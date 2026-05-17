/**
 * After ensure-project: create (or reuse) a spreadsheet and an asset task via API so Lighthouse
 * can audit `/projects/{id}/spreadsheets/{id}` with real data.
 *
 * Env:
 * - LHCI_TEST_PROJECT_ID — required (set by lhci-ensure-project.cjs or CI)
 * - LHCI_AUTH_EMAIL / LHCI_AUTH_PASSWORD — required for API calls; if missing, seed is skipped
 * - LHCI_API_BASE / LHCI_BASE_URL — same as other lhci scripts
 * - LHCI_SEED_ENTITIES=0 — skip entirely
 *
 * Sets:
 * - LHCI_TEST_SPREADSHEET_ID — consumed by lighthouserc.js
 */
const {
  getBaseUrl,
  getCredentials,
  registerUserIfNotExists,
  loginWithApi,
} = require('./lhci-lib.cjs');

const SPREADSHEET_NAME = 'LHCI Seed Spreadsheet';
const TASK_SUMMARY = 'LHCI seed asset task';

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} projectId
 * @returns {Promise<number | null>}
 */
async function findSpreadsheetIdByName(baseUrl, token, projectId) {
  const u = new URL(`${baseUrl}/api/spreadsheet/spreadsheets/`);
  u.searchParams.set('project_id', String(projectId));
  u.searchParams.set('search', SPREADSHEET_NAME);
  u.searchParams.set('page_size', '50');

  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LHCI list spreadsheets failed ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const rows = data.results || [];
  const found = rows.find((r) => r.name === SPREADSHEET_NAME);
  return found && found.id != null ? Number(found.id) : null;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} projectId
 * @returns {Promise<number>}
 */
async function createSpreadsheet(baseUrl, token, projectId) {
  const url = `${baseUrl}/api/spreadsheet/spreadsheets/?project_id=${encodeURIComponent(projectId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: SPREADSHEET_NAME }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LHCI create spreadsheet failed ${res.status}: ${text.slice(0, 800)}`);
  }
  const data = await res.json();
  if (data.id == null) throw new Error('LHCI create spreadsheet: response missing id');
  return Number(data.id);
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} projectId
 * @returns {Promise<number | null>}
 */
async function findTaskIdBySummary(baseUrl, token, projectId) {
  const u = new URL(`${baseUrl}/api/tasks/`);
  u.searchParams.set('project_id', String(projectId));
  u.searchParams.set('page_size', '100');

  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LHCI list tasks failed ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const rows = data.results || data;
  const list = Array.isArray(rows) ? rows : [];
  const found = list.find((t) => t.summary === TASK_SUMMARY);
  return found && found.id != null ? Number(found.id) : null;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} projectId
 * @returns {Promise<number>}
 */
async function createAssetTask(baseUrl, token, projectId) {
  const res = await fetch(`${baseUrl}/api/tasks/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      summary: TASK_SUMMARY,
      description: 'Created by Lighthouse CI (lhci-seed-spreadsheet-task.cjs)',
      type: 'asset',
      project_id: Number(projectId),
      create_as_draft: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LHCI create task failed ${res.status}: ${text.slice(0, 800)}`);
  }
  const data = await res.json();
  if (data.id == null) throw new Error('LHCI create task: response missing id');
  return Number(data.id);
}

/**
 * @returns {Promise<void>}
 */
async function seedSpreadsheetAndTask() {
  if (process.env.LHCI_SEED_ENTITIES === '0') {
    process.stderr.write('[lhci] seed: skipped (LHCI_SEED_ENTITIES=0)\n');
    return;
  }

  const projectId = process.env.LHCI_TEST_PROJECT_ID;
  if (!projectId) {
    process.stderr.write('[lhci] seed: skipped (no LHCI_TEST_PROJECT_ID)\n');
    return;
  }

  const creds = getCredentials();
  if (!creds) {
    process.stderr.write(
      '[lhci] seed: skipped (set LHCI_AUTH_EMAIL and LHCI_AUTH_PASSWORD to create spreadsheet/task)\n'
    );
    return;
  }

  const base = getBaseUrl();
  process.stderr.write(`[lhci] seed: project_id=${projectId} apiBase=${base}\n`);

  await registerUserIfNotExists(base, creds.email, creds.password);
  const token = await loginWithApi(base, creds.email, creds.password);

  let spreadsheetId = await findSpreadsheetIdByName(base, token, projectId);
  if (spreadsheetId == null) {
    spreadsheetId = await createSpreadsheet(base, token, projectId);
    process.stderr.write(`[lhci] seed: created spreadsheet id=${spreadsheetId}\n`);
  } else {
    process.stderr.write(`[lhci] seed: reusing spreadsheet id=${spreadsheetId}\n`);
  }

  let taskId = await findTaskIdBySummary(base, token, projectId);
  if (taskId == null) {
    taskId = await createAssetTask(base, token, projectId);
    process.stderr.write(`[lhci] seed: created asset task id=${taskId}\n`);
  } else {
    process.stderr.write(`[lhci] seed: reusing asset task id=${taskId}\n`);
  }

  process.env.LHCI_TEST_SPREADSHEET_ID = String(spreadsheetId);
}

module.exports = { seedSpreadsheetAndTask, SPREADSHEET_NAME, TASK_SUMMARY };
