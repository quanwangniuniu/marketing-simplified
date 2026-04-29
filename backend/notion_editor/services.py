import base64
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max

from .models import ContentBlock, Draft, DraftRevision, NotionConnection

NOTION_OAUTH_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize"
NOTION_OAUTH_TOKEN_URL = "https://api.notion.com/v1/oauth/token"
NOTION_API_VERSION = "2022-06-28"
NOTION_ME_URL = "https://api.notion.com/v1/users/me"
NOTION_PAGE_URL = "https://api.notion.com/v1/pages/{page_id}"
NOTION_BLOCK_CHILDREN_URL = "https://api.notion.com/v1/blocks/{block_id}/children"
NOTION_PAGES_URL = "https://api.notion.com/v1/pages"
NOTION_PAGE_ID_REGEX = re.compile(r"([0-9a-fA-F]{32}|[0-9a-fA-F-]{36})(?:[?#/]|$)")


def build_notion_auth_url(state: str) -> str:
    params = {
        "client_id": settings.NOTION_OAUTH_CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": settings.NOTION_OAUTH_REDIRECT_URI,
        "state": state,
    }
    return f"{NOTION_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"


def exchange_notion_code_for_token(code: str) -> dict:
    basic = base64.b64encode(
        f"{settings.NOTION_OAUTH_CLIENT_ID}:{settings.NOTION_OAUTH_CLIENT_SECRET}".encode()
    ).decode()

    response = requests.post(
        NOTION_OAUTH_TOKEN_URL,
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/json",
        },
        json={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.NOTION_OAUTH_REDIRECT_URI,
        },
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def fetch_notion_bot_name(access_token: str) -> str | None:
    response = requests.get(
        NOTION_ME_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": NOTION_API_VERSION,
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    person = payload.get("person") or {}
    return person.get("email") or payload.get("name")


def normalize_notion_page_id(value: str) -> str:
    candidate = (value or "").strip()
    if not candidate:
        raise ValidationError("Notion page URL or ID is required.")

    match = NOTION_PAGE_ID_REGEX.search(candidate)
    page_id = match.group(1) if match else candidate
    page_id = page_id.replace("-", "")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", page_id):
        raise ValidationError("Enter a valid Notion page URL or page ID.")

    return (
        f"{page_id[0:8]}-{page_id[8:12]}-{page_id[12:16]}-"
        f"{page_id[16:20]}-{page_id[20:32]}"
    ).lower()


def _notion_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
    }


def fetch_notion_page(page_id: str, access_token: str) -> dict:
    response = requests.get(
        NOTION_PAGE_URL.format(page_id=page_id),
        headers=_notion_headers(access_token),
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def fetch_notion_block_children(block_id: str, access_token: str) -> list[dict]:
    blocks: list[dict] = []
    cursor = None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        response = requests.get(
            NOTION_BLOCK_CHILDREN_URL.format(block_id=block_id),
            headers=_notion_headers(access_token),
            params=params,
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        blocks.extend(payload.get("results") or [])
        if not payload.get("has_more"):
            return blocks
        cursor = payload.get("next_cursor")


def _rich_text_to_plain_text(rich_text: list[dict]) -> str:
    return "".join((item or {}).get("plain_text") or "" for item in rich_text or [])


def _rich_text_to_html(rich_text: list[dict]) -> str:
    parts: list[str] = []
    for item in rich_text or []:
        text = escape(item.get("plain_text") or "")
        if not text:
            continue

        annotations = item.get("annotations") or {}
        href = item.get("href")
        if annotations.get("code"):
            text = f"<code>{text}</code>"
        if annotations.get("bold"):
            text = f"<strong>{text}</strong>"
        if annotations.get("italic"):
            text = f"<em>{text}</em>"
        if annotations.get("strikethrough"):
            text = f"<s>{text}</s>"
        if annotations.get("underline"):
            text = f"<u>{text}</u>"
        if href:
            text = f'<a href="{escape(href)}" target="_blank" rel="noopener noreferrer">{text}</a>'
        parts.append(text)
    return "".join(parts)


def _extract_notion_page_title(page: dict) -> str:
    properties = page.get("properties") or {}
    for value in properties.values():
        if value.get("type") == "title":
            title = _rich_text_to_plain_text(value.get("title") or [])
            if title:
                return title
    return "Imported Notion Page"


def _notion_block_to_content_block(block: dict, order: int) -> dict | None:
    block_type = block.get("type")
    payload = block.get(block_type) or {}

    text_block_map = {
        "paragraph": "rich_text",
        "heading_1": "heading",
        "heading_2": "heading",
        "heading_3": "heading",
        "bulleted_list_item": "list",
        "numbered_list_item": "numbered_list",
        "to_do": "todo_list",
        "quote": "quote",
    }
    if block_type in text_block_map:
        html = _rich_text_to_html(payload.get("rich_text") or [])
        if block_type == "to_do":
            state = "checked" if payload.get("checked") else "unchecked"
            html = f'<span data-todo-state="{state}"></span>{html or "<br>"}'
        return {
            "id": block.get("id"),
            "type": text_block_map[block_type],
            "order": order,
            "content": {"html": html},
        }

    if block_type == "code":
        return {
            "id": block.get("id"),
            "type": "code",
            "order": order,
            "content": {
                "html": _rich_text_to_html(payload.get("rich_text") or []),
                "language": payload.get("language") or "plain",
            },
        }

    if block_type == "divider":
        return {
            "id": block.get("id"),
            "type": "divider",
            "order": order,
            "content": {"html": "<hr />"},
        }

    if block_type in {"image", "file", "video"}:
        file_obj = payload.get("file") or payload.get("external") or {}
        url = file_obj.get("url")
        if url:
            return {
                "id": block.get("id"),
                "type": "image" if block_type == "image" else "file",
                "order": order,
                "content": {
                    "file_url": url,
                    "filename": _rich_text_to_plain_text(payload.get("caption") or []),
                },
            }

    if block_type == "bookmark":
        url = payload.get("url")
        if url:
            return {
                "id": block.get("id"),
                "type": "web_bookmark",
                "order": order,
                "content": {"url": url, "title": url, "description": "", "favicon": ""},
            }

    return None


def convert_notion_blocks_to_draft_blocks(blocks: list[dict]) -> list[dict]:
    converted = [
        converted_block
        for order, block in enumerate(blocks)
        if (converted_block := _notion_block_to_content_block(block, order)) is not None
    ]
    return converted or [{"type": "rich_text", "order": 0, "content": {"html": ""}}]


def _active_connection_for_user(user) -> NotionConnection:
    connection = NotionConnection.objects.filter(user=user, is_active=True).first()
    if not connection or not connection.get_access_token():
        raise ValidationError("Notion is not connected.")
    return connection


@transaction.atomic
def import_notion_page_as_draft(user, page_ref: str, draft_id: int | None = None) -> tuple[Draft, str]:
    connection = _active_connection_for_user(user)
    page_id = normalize_notion_page_id(page_ref)
    access_token = connection.get_access_token()
    page = fetch_notion_page(page_id, access_token)
    blocks = fetch_notion_block_children(page_id, access_token)

    source_page_id = page.get("id") or page_id
    title = _extract_notion_page_title(page)
    content_blocks = convert_notion_blocks_to_draft_blocks(blocks)

    if draft_id:
        draft = Draft.objects.select_for_update().filter(
            id=draft_id,
            user=user,
            is_deleted=False,
        ).first()
        if not draft:
            raise ValidationError("Draft not found or access denied.")
        draft.title = title or draft.title
        draft.content_blocks = content_blocks
        draft.save(update_fields=["title", "content_blocks", "updated_at"])
    else:
        draft = Draft.objects.create(
            user=user,
            title=title,
            status="draft",
            content_blocks=content_blocks,
        )

    draft.blocks.all().delete()
    for order, block in enumerate(content_blocks):
        ContentBlock.objects.create(
            draft=draft,
            block_type=block.get("type", "rich_text"),
            content=block.get("content") or {},
            order=order,
        )

    last_revision = draft.revisions.aggregate(Max("revision_number"))["revision_number__max"]
    DraftRevision.objects.create(
        draft=draft,
        title=draft.title,
        content_blocks=content_blocks.copy(),
        status=draft.status,
        revision_number=(last_revision or 0) + 1,
        change_summary="Imported from Notion",
        created_by=user,
    )

    return draft, source_page_id


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self.parts.append("\n")

    def get_text(self) -> str:
        return "".join(self.parts).strip()


def _html_to_plain_text(html: str) -> str:
    parser = _HTMLTextExtractor()
    parser.feed(html or "")
    return parser.get_text()


def _plain_text_to_notion_rich_text(text: str) -> list[dict]:
    return [{"type": "text", "text": {"content": (text or "")[:2000]}}]


def _draft_block_to_notion_block(block: dict) -> dict | None:
    block_type = block.get("type") or "rich_text"
    content = block.get("content") or {}
    html = content.get("html") or content.get("text") or ""
    plain_text = _html_to_plain_text(html)

    if block_type == "divider":
        return {"object": "block", "type": "divider", "divider": {}}

    if block_type == "heading":
        return {
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": _plain_text_to_notion_rich_text(plain_text)},
        }

    if block_type == "quote":
        return {
            "object": "block",
            "type": "quote",
            "quote": {"rich_text": _plain_text_to_notion_rich_text(plain_text)},
        }

    if block_type == "list":
        return {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": _plain_text_to_notion_rich_text(plain_text)},
        }

    if block_type == "numbered_list":
        return {
            "object": "block",
            "type": "numbered_list_item",
            "numbered_list_item": {"rich_text": _plain_text_to_notion_rich_text(plain_text)},
        }

    if block_type == "todo_list":
        checked = 'data-todo-state="checked"' in html
        return {
            "object": "block",
            "type": "to_do",
            "to_do": {
                "rich_text": _plain_text_to_notion_rich_text(plain_text),
                "checked": checked,
            },
        }

    if block_type == "code":
        return {
            "object": "block",
            "type": "code",
            "code": {
                "rich_text": _plain_text_to_notion_rich_text(plain_text),
                "language": content.get("language") or "plain text",
            },
        }

    if block_type in {"image", "file"}:
        file_url = content.get("file_url") or content.get("url")
        if file_url:
            return {
                "object": "block",
                "type": "image",
                "image": {"type": "external", "external": {"url": file_url}},
            }

    if block_type == "web_bookmark":
        url = content.get("url")
        if url:
            return {
                "object": "block",
                "type": "bookmark",
                "bookmark": {"url": url},
            }

    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": _plain_text_to_notion_rich_text(plain_text)},
    }


def convert_draft_blocks_to_notion_blocks(content_blocks: list[dict]) -> list[dict]:
    converted = [
        notion_block
        for block in content_blocks or []
        if (notion_block := _draft_block_to_notion_block(block)) is not None
    ]
    return converted or [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": _plain_text_to_notion_rich_text("")},
        }
    ]


def create_notion_page(
    access_token: str,
    parent_page_id: str,
    title: str,
    children: list[dict],
) -> dict:
    response = requests.post(
        NOTION_PAGES_URL,
        headers=_notion_headers(access_token),
        json={
            "parent": {"page_id": parent_page_id},
            "properties": {
                "title": {
                    "title": [
                        {
                            "type": "text",
                            "text": {"content": title or "Untitled"},
                        }
                    ]
                }
            },
            "children": children,
        },
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def export_draft_to_notion(
    user,
    draft_id: int,
    parent_page_id: str | None,
    title: str | None = None,
) -> dict:
    connection = _active_connection_for_user(user)
    if not parent_page_id:
        raise ValidationError("Notion parent_page_id is required for export.")

    draft = Draft.objects.filter(id=draft_id, user=user, is_deleted=False).first()
    if not draft:
        raise ValidationError("Draft not found or access denied.")

    page = create_notion_page(
        access_token=connection.get_access_token(),
        parent_page_id=normalize_notion_page_id(parent_page_id),
        title=title or draft.title,
        children=convert_draft_blocks_to_notion_blocks(draft.content_blocks),
    )
    return {
        "page_id": page.get("id"),
        "url": page.get("url"),
    }
