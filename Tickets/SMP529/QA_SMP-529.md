# QA Checklist — SMP-529 : Google Calendar Integration

**Jira Ticket:** SMP-529

**Branch:** SMP-529-Google-Calendar-Integration

**Date:** _______21-04-2026________

**Tester:** Kenita

---

## Step 1 — QA Demo Video

**Goal:** Show that users can securely connect Google Calendar from the platform, create events that sync to Google Calendar, import Google Calendar events into the platform Calendar view, and see reliable status, without silent mismatch between the platform calendar and Google Calendar.

| Item | Status |
|------|--------|
| From **Settings → Integrations**, walk through connecting a Google account and show that the flow feels straightforward and secure | [x] Recorded |
| Show **connection status** stored and displayed for the user (connected / disconnected / error as applicable) | [x] Recorded |
| Create a **calendar event in the platform** and show it **synchronised to Google Calendar** (or explain the expected sync path if demo time is limited) | [x] Recorded |
| Show **importing Google Calendar events** into the **platform Calendar** view | [x] Recorded |
| Show **disconnect** and **reconnect** of the Google Calendar integration | [x] Recorded |

---

## Step 2 — Manual Test Scenarios

| # | Steps | Expected Result | Actual Result | Pass/Fail |
|---|-------|-----------------|---------------|-----------|
| 2.1 | Open **Settings → Integrations** and connect a Google Calendar account (OAuth/consent as shown) | Connection succeeds; user is returned to the app with **Google Calendar connected** (or equivalent success state) | No error | Pass |
| 2.2 | In **Calendar**, create an event in the platform; open **Google Calendar** for the same account | Event appears in Google Calendar; titles/times match (no silent wrong copy) | No error | Pass |
| 2.3 | In **Google Calendar**, create or change an event; refresh or wait for sync in the **platform Calendar** | Imported/updated events appear in the platform view; **duplicates or stale ghosts** are absent or clearly explained | No error | Pass |
| 2.4 | Open Settings (or connection UI) and confirm **connection status** is shown consistently | Status reflects reality (**connected / syncing / error / disconnected**) and matches what Calendar shows | No error | Pass |
| 2.5 | **Disconnect** Google Calendar, then **reconnect** | Disconnect clears or labels integration appropriately; reconnect restores sync without leaving confusing half-connected state | No error | Pass |

---

## Step 3 — Automated Test Results

| Item | Result |
|------|--------|
| Command | `docker compose exec backend sh -lc 'DJANGO_SETTINGS_MODULE=backend.settings pytest google_calendar_integration/tests/ --cov=google_calendar_integration --cov-report=term-missing'` |
| Tests run | **72** |
| Passed | **72** |
| Failed | **0** |
| Duration | **~41 s** |
| Notes | `google_calendar_integration` package coverage **~96%** (pytest-cov TOTAL, includes test modules). Production files: `services.py` **~87%**, `views.py` / `tasks.py` / `urls.py` **100%**, `models.py` **~97%** (only `__str__` path optional). Suites: `test_views.py` (OAuth callback, connect misconfig, sync 502), `test_tasks.py`, `test_services.py`, `test_services_extended.py` (`exchange_code_for_token`, token refresh, `run_google_calendar_api` 401 replay, fetch primary, import/export branches, `disconnect_user_calendar`, **`requests` mocks**). Remaining `services.py` misses are mostly **413 replay / `_patch` 412 / real HTTP** branches—optional integration tests if you need 90%+ on `services.py` alone. |

---

## Step 4 — Approval

| Item | Status |
|------|--------|
| QA checklist posted to `#qa-feedback` | [ ] |
| Approved by Ray or Maisy with "Ready for PR" | [ ] |

**Reviewer:** ___________ **Date:** ___________

---

**Notes / Issues Found:**

>

