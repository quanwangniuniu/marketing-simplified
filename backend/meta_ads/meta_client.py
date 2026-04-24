"""Low-level Graph API wrapper for the Marketing API.

Centralizes the Graph API version, retry + rate-limit handling, and error shape
so sync services stay thin.
"""

import logging
import time
from typing import Any, Iterable

import requests
from django.conf import settings


logger = logging.getLogger(__name__)


GRAPH_BASE = "https://graph.facebook.com"


class MetaApiError(Exception):
    def __init__(self, message: str, status_code: int | None = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _graph_url(path: str) -> str:
    return f"{GRAPH_BASE}/{settings.FB_API_VERSION}{path}"


def graph_get(
    path: str,
    access_token: str,
    params: dict[str, Any] | None = None,
    max_retries: int = 3,
) -> dict[str, Any]:
    """GET from Graph API with retry on 5xx and throttle headers."""
    request_params = {"access_token": access_token}
    if params:
        request_params.update(params)

    attempt = 0
    backoff = 1.0
    last_error: Exception | None = None
    while attempt < max_retries:
        attempt += 1
        try:
            resp = requests.get(_graph_url(path), params=request_params, timeout=30)
        except requests.RequestException as err:
            last_error = err
            time.sleep(backoff)
            backoff *= 2
            continue

        _log_usage(resp.headers)

        if resp.status_code in (500, 502, 503, 504):
            last_error = MetaApiError(
                f"Graph API {resp.status_code} on {path}",
                status_code=resp.status_code,
                body=_safe_body(resp),
            )
            time.sleep(backoff)
            backoff *= 2
            continue

        if not resp.ok:
            raise MetaApiError(
                f"Graph API {resp.status_code} on {path}: {_safe_body(resp)!r}",
                status_code=resp.status_code,
                body=_safe_body(resp),
            )
        return resp.json()
    raise last_error or MetaApiError(f"Graph API exhausted retries on {path}")


def graph_paged(
    path: str,
    access_token: str,
    params: dict[str, Any] | None = None,
    max_pages: int = 50,
    max_retries: int = 3,
) -> Iterable[dict[str, Any]]:
    """Yield items across cursor-paginated Graph API responses.

    Both the first call and subsequent cursor hops apply the same exponential
    backoff as `graph_get` so transient 5xx errors don't kill a full sync.
    """
    page_params = dict(params or {})
    pages = 0
    next_url: str | None = None
    while pages < max_pages:
        pages += 1
        if next_url:
            attempt = 0
            backoff = 1.0
            payload: dict[str, Any] | None = None
            last_error: Exception | None = None
            while attempt < max_retries:
                attempt += 1
                try:
                    resp = requests.get(next_url, timeout=30)
                except requests.RequestException as err:
                    last_error = err
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                _log_usage(resp.headers)
                if resp.status_code in (500, 502, 503, 504):
                    last_error = MetaApiError(
                        f"Graph pagination {resp.status_code}",
                        status_code=resp.status_code,
                        body=_safe_body(resp),
                    )
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                if not resp.ok:
                    raise MetaApiError(
                        f"Graph pagination {resp.status_code}: {_safe_body(resp)!r}",
                        status_code=resp.status_code,
                        body=_safe_body(resp),
                    )
                payload = resp.json()
                break
            if payload is None:
                raise last_error or MetaApiError(
                    f"Graph pagination exhausted retries on {next_url[:80]}"
                )
        else:
            payload = graph_get(path, access_token, params=page_params)
        for item in payload.get("data", []):
            yield item
        next_url = (payload.get("paging") or {}).get("next")
        if not next_url:
            return


def _safe_body(resp: requests.Response) -> Any:
    try:
        return resp.json()
    except ValueError:
        return resp.text[:500]


def _log_usage(headers) -> None:
    """Observe Meta throttle headers for future backoff tuning."""
    app_usage = headers.get("x-app-usage")
    ad_usage = headers.get("x-ad-account-usage")
    if app_usage or ad_usage:
        logger.debug("Meta usage x-app=%s x-ad=%s", app_usage, ad_usage)
