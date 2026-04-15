from datetime import timedelta
from html import escape
from urllib.parse import quote, urlencode

import requests
from django.conf import settings
from django.utils import timezone

from .models import GoogleDocsConnection


GOOGLE_OAUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_DOCS_URL = "https://docs.googleapis.com/v1/documents"
GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
GOOGLE_SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets"

GOOGLE_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
]


def build_google_auth_url(state: str) -> str:
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_OAUTH_BASE_URL}?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    expires_in = int(payload.get("expires_in", 3600))
    payload["token_expiry"] = timezone.now() + timedelta(seconds=expires_in)
    return payload


def refresh_google_tokens(refresh_token: str) -> dict:
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    access_token = payload.get("access_token")
    if not access_token:
        raise ValueError("No access_token in Google refresh response.")
    expires_in = int(payload.get("expires_in", 3600))
    payload["token_expiry"] = timezone.now() + timedelta(seconds=expires_in)
    return payload


def _persist_refreshed_tokens(connection: GoogleDocsConnection, payload: dict) -> None:
    connection.set_access_token(payload["access_token"])
    new_refresh = payload.get("refresh_token")
    if new_refresh:
        connection.set_refresh_token(new_refresh)
    connection.token_expiry = payload.get("token_expiry")
    connection.save(update_fields=["encrypted_access_token", "encrypted_refresh_token", "token_expiry", "updated_at"])


def get_access_token_for_api(connection: GoogleDocsConnection) -> str:
    if not connection.get_access_token():
        raise ValueError("Google Docs is not connected.")
    now = timezone.now()
    buffer = timedelta(minutes=2)
    expiry_ok = connection.token_expiry and connection.token_expiry > now + buffer
    if expiry_ok:
        return connection.get_access_token()
    if not connection.get_refresh_token():
        return connection.get_access_token()
    payload = refresh_google_tokens(connection.get_refresh_token())
    _persist_refreshed_tokens(connection, payload)
    return connection.get_access_token()


def run_google_api_with_token_retry(connection: GoogleDocsConnection, fn):
    token = get_access_token_for_api(connection)
    try:
        return fn(token)
    except requests.HTTPError as exc:
        if exc.response is None or exc.response.status_code != 401:
            raise
        if not connection.get_refresh_token():
            raise
        payload = refresh_google_tokens(connection.get_refresh_token())
        _persist_refreshed_tokens(connection, payload)
        return fn(connection.get_access_token())


def fetch_google_email(access_token: str) -> str | None:
    response = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json().get("email")


def _extract_plain_text(structural_elements: list[dict]) -> str:
    chunks: list[str] = []
    for element in structural_elements:
        paragraph = element.get("paragraph")
        if not paragraph:
            continue
        for text_run in paragraph.get("elements", []):
            content = text_run.get("textRun", {}).get("content")
            if content:
                chunks.append(content)
    return "".join(chunks).strip()


def _render_text_run_to_html(text_run: dict) -> str:
    content = text_run.get("content") or ""
    if not content:
        return ""

    text_style = text_run.get("textStyle") or {}
    rendered = escape(content).replace("\n", "<br>")

    link = (text_style.get("link") or {}).get("url")
    if link:
        rendered = f'<a href="{escape(link)}" target="_blank" rel="noopener noreferrer">{rendered}</a>'
    if text_style.get("bold"):
        rendered = f"<strong>{rendered}</strong>"
    if text_style.get("italic"):
        rendered = f"<em>{rendered}</em>"
    if text_style.get("underline"):
        rendered = f"<u>{rendered}</u>"

    return rendered


def _extract_rich_html(structural_elements: list[dict]) -> str:
    blocks: list[str] = []
    for element in structural_elements:
        paragraph = element.get("paragraph")
        if paragraph:
            line_parts: list[str] = []
            for paragraph_element in paragraph.get("elements", []):
                text_run = paragraph_element.get("textRun")
                if text_run:
                    line_parts.append(_render_text_run_to_html(text_run))
            line_html = "".join(line_parts).strip()
            if line_html:
                blocks.append(f"<p>{line_html}</p>")
            continue

        table = element.get("table")
        if table:
            for row in table.get("tableRows", []):
                for cell in row.get("tableCells", []):
                    cell_html = _extract_rich_html(cell.get("content", []))
                    if cell_html:
                        blocks.append(cell_html)

    return "".join(blocks).strip()


def fetch_document_text(document_id: str, access_token: str) -> tuple[str, str, str]:
    response = requests.get(
        f"{GOOGLE_DOCS_URL}/{document_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    title = payload.get("title") or "Imported Google Doc"
    body = payload.get("body", {}).get("content", [])
    plain_text = _extract_plain_text(body)
    rich_html = _extract_rich_html(body)
    return title, plain_text, rich_html


def create_google_doc(title: str, content: str, access_token: str) -> dict:
    create_response = requests.post(
        GOOGLE_DOCS_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json={"title": title},
        timeout=20,
    )
    create_response.raise_for_status()
    document = create_response.json()
    document_id = document["documentId"]

    requests.post(
        f"{GOOGLE_DOCS_URL}/{document_id}:batchUpdate",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "requests": [
                {
                    "insertText": {
                        "location": {"index": 1},
                        "text": content,
                    }
                }
            ]
        },
        timeout=20,
    ).raise_for_status()

    return {
        "document_id": document_id,
        "url": f"https://docs.google.com/document/d/{document_id}/edit",
    }


def list_google_docs(access_token: str, page_size: int = 20) -> list[dict]:
    response = requests.get(
        GOOGLE_DRIVE_FILES_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        params={
            "q": "mimeType='application/vnd.google-apps.document' and trashed=false",
            "fields": "files(id,name,modifiedTime,webViewLink)",
            "orderBy": "modifiedTime desc",
            "pageSize": max(1, min(page_size, 100)),
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    files = payload.get("files") or []
    return [
        {
            "id": item.get("id"),
            "name": item.get("name") or "Untitled document",
            "modified_time": item.get("modifiedTime"),
            "web_view_link": item.get("webViewLink"),
        }
        for item in files
        if item.get("id")
    ]


def _col_letter(n: int) -> str:
    """Convert 1-based column number to column letter(s): 1→A, 26→Z, 27→AA."""
    result = ""
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        result = chr(65 + remainder) + result
    return result or "A"


def fetch_google_sheet(spreadsheet_id: str, access_token: str) -> tuple[str, list]:
    """Fetch first sheet of a Google Spreadsheet, return (title, matrix)."""
    meta_response = requests.get(
        f"{GOOGLE_SHEETS_URL}/{spreadsheet_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"fields": "properties.title,sheets.properties.title"},
        timeout=20,
    )
    meta_response.raise_for_status()
    metadata = meta_response.json()
    title = metadata.get("properties", {}).get("title") or "Imported Sheet"
    sheets = metadata.get("sheets", [])
    first_sheet = sheets[0]["properties"]["title"] if sheets else "Sheet1"

    values_response = requests.get(
        f"{GOOGLE_SHEETS_URL}/{spreadsheet_id}/values/{quote(first_sheet, safe='')}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    values_response.raise_for_status()
    matrix = values_response.json().get("values") or []
    return title, matrix


def export_to_google_sheet(title: str, matrix: list, access_token: str) -> dict:
    """Create a new Google Sheet and write matrix data into it, return spreadsheet URL."""
    create_response = requests.post(
        GOOGLE_SHEETS_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "properties": {"title": title or "Exported Sheet"},
            "sheets": [{"properties": {"title": "Sheet1"}}],
        },
        timeout=20,
    )
    create_response.raise_for_status()
    spreadsheet_id = create_response.json()["spreadsheetId"]

    if matrix:
        max_cols = max((len(row) for row in matrix), default=0)
        if max_cols > 0:
            range_notation = f"Sheet1!A1:{_col_letter(max_cols)}{len(matrix)}"
            update_response = requests.put(
                f"{GOOGLE_SHEETS_URL}/{spreadsheet_id}/values/{range_notation}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"valueInputOption": "USER_ENTERED"},
                json={"values": matrix},
                timeout=30,
            )
            update_response.raise_for_status()

    return {
        "spreadsheet_id": spreadsheet_id,
        "url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
    }
