# Notion Integration Step 1-2 Design

## Step 1: Data Model

This step only defines what the backend needs to store for a user's Notion workspace connection. It does not add a persistent relationship between external Notion pages and MediaJira drafts yet.

### `NotionConnection`

Stored in `backend/notion_editor/models.py`.


| Field                       | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `user`                      | One-to-one owner of the Notion workspace connection.               |
| `workspace_id`              | Notion workspace identifier returned by OAuth.                     |
| `workspace_name`            | Human-readable workspace name for display.                         |
| `workspace_icon`            | Optional workspace icon URL.                                       |
| `bot_id`                    | Notion integration/bot user ID when available.                     |
| `bot_name`                  | Bot display name or email when available.                          |
| `encrypted_access_token`    | Encrypted Notion access token. The raw token must never be stored. |
| `is_active`                 | Whether the connection is currently usable.                        |
| `connected_at`              | Timestamp when the connection became active.                       |
| `created_at` / `updated_at` | Standard audit timestamps.                                         |


### Deferred Model

Do not add `NotionPageLink` in this step. Import/export can be treated as one-time actions first. A future sync or webhook ticket can introduce a link table with fields such as `draft_id`, `external_page_id`, `direction`, and `last_synced_at`.

## Step 2: ERD

```mermaid
erDiagram
    User ||--o| NotionConnection : owns
    User ||--o{ Draft : owns

    User {
        int id
        string email
    }

    NotionConnection {
        int id
        int user_id
        string workspace_id
        string workspace_name
        string workspace_icon
        string bot_id
        string bot_name
        string encrypted_access_token
        boolean is_active
        datetime connected_at
        datetime created_at
        datetime updated_at
    }

    Draft {
        int id
        int user_id
        string title
        string status
        json content_blocks
        boolean is_deleted
        datetime created_at
        datetime updated_at
    }
```



Key points for review:

- `User` to `NotionConnection` is one-to-zero-or-one: a user may have no Notion connection or one active workspace connection.
- `Draft` remains the internal MediaJira document model.
- There is no direct database relationship between `Draft` and an external Notion page in this step.

## Connect Flow

```mermaid
flowchart TD
    user["User opens Integrations"] --> connectClick["Click Connect Notion"]
    connectClick --> backendBuildAuth["Backend builds Notion OAuth URL"]
    backendBuildAuth --> notionConsent["User authorizes in Notion"]
    notionConsent --> callback["Notion redirects to callback"]
    callback --> tokenExchange["Backend exchanges code for token"]
    tokenExchange --> saveConnection["Save NotionConnection with encrypted token"]
    saveConnection --> connectedState["User sees Notion connected"]
```



## Import Flow

This is a future flow for the next implementation step. The current design does not persist an external page to draft relationship.

```mermaid
flowchart TD
    user["User chooses Import from Notion"] --> providePage["Provide Notion page URL or ID"]
    providePage --> readConnection["Backend reads active NotionConnection"]
    readConnection --> fetchPage["Backend fetches page and blocks from Notion"]
    fetchPage --> convertBlocks["Convert Notion blocks to MediaJira blocks"]
    convertBlocks --> createOrUpdateDraft["Create or update MediaJira Draft"]
    createOrUpdateDraft --> openDraft["Frontend opens imported draft"]
```



## Export Flow

This is a future flow for the next implementation step. The current design does not store the exported Notion page ID.

```mermaid
flowchart TD
    user["User chooses Export to Notion"] --> selectDraft["Select MediaJira Draft"]
    selectDraft --> readDraft["Backend reads draft content"]
    readDraft --> readConnection["Backend reads active NotionConnection"]
    readConnection --> convertBlocks["Convert MediaJira blocks to Notion blocks"]
    convertBlocks --> createPage["Create page in user's Notion workspace"]
    createPage --> returnLink["Return Notion page link to frontend"]
```



