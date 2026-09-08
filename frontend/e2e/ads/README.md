# Ads browser tests

Start the local development stack with migrations applied, then run from `frontend`:

```bash
BASE_URL=http://localhost E2E_USE_EXISTING_SERVER=1 npm run test:e2e:ads
```

No `DEV_USER_EMAIL` or `DEV_USER_PASSWORD` is required. Each Playwright worker registers a
unique account, creates its organization and project, and logs in through the real API.
Automatic registration is restricted to loopback URLs, including CI's local Docker stack.
The other Playwright projects keep their existing authentication setup.

For one browser, or to watch a run:

```bash
BASE_URL=http://localhost E2E_USE_EXISTING_SERVER=1 npm run test:e2e -- --project=ads-firefox --headed --workers=1
```

Facebook Meta coverage uses no mocked API responses:

- Empty list for the worker's user.
- Real list, row navigation, creative content, and loaded image preview.
- UI creation and slug navigation, 14-day share generation, persisted link after reload,
  unauthenticated public image preview, revocation, and rejection of the revoked link.

API helpers prepare the creative content and upload/associate the bundled image. Media-picker
UI behavior and external Facebook services are not covered. API setup still exercises the
real database and file storage.

Teardown attempts every cleanup even if a test fails. It deletes test creatives, uploaded
photos, and the project, then uses the application's organization/account deletion APIs.
Those APIs retain inactive organizations, tenant schemas, audit records, and anonymized users;
they do not physically erase the entire test tenant. Prefer a disposable database for repeated
CI runs. No existing account or project is used or deleted.

The main CI workflow runs the three Ads browser projects explicitly after its frontend checks.
The default browser projects exclude Ads to avoid duplicate runs and credential-based setup.
CI uses `docker-compose.e2e.yml` to enable Django's local media serving and expose port 8000
on loopback, which the public preview currently uses as its default media origin. This
override is for disposable test environments only, not deployment.
