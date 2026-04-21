/**
 * Lighthouse CI configuration.
 * Category assertions use `warn` (not `error`) so scores below the minimum are reported but do not fail the run.
 *
 * Prerequisites: the app is reachable at http://localhost on port 80 (e.g.
 * Docker Compose maps host :80 → the frontend). LHCI does not start Next.js — start
 * your stack first, then run `npm run lighthouse:local` from `frontend/`.
 *
 * Authenticated audits: set LHCI_AUTH_EMAIL + LHCI_AUTH_PASSWORD (see scripts/lhci-puppeteer-login.cjs).
 * Project-scoped URLs need LHCI_TEST_PROJECT_ID. `npm run lighthouse:local` runs
 * scripts/lhci-ensure-project.cjs first (register if needed → login → find or create project by
 * LHCI_PROJECT_NAME) unless LHCI_TEST_PROJECT_ID is already set or LHCI_ENSURE_PROJECT=0.
 * Then scripts/lhci-seed-spreadsheet-task.cjs creates/reuses a spreadsheet and asset task and sets
 * LHCI_TEST_SPREADSHEET_ID for `/projects/{id}/spreadsheets/{id}` (skipped without credentials or
 * if LHCI_SEED_ENTITIES=0).
 *
 * Requires `puppeteer` (devDependency). LHCI reuses the same browser for Puppeteer + Lighthouse.
 * `disableStorageReset` is required: Lighthouse otherwise clears origin storage before each URL,
 * wiping Zustand `auth-storage` from the Puppeteer login.
 *
 * After autorun, npm script writes the dashboard (`report-dashboard.html` by default, plus `index.html`
 * mirror) and copies each HTML/JSON report to readable names (`report-<slug>.html`) — see
 * `scripts/lhci-build-dashboard.cjs`.
 *
 * Desktop: `preset: "desktop"` applies desktop UA, viewport (~1350×940), and desktop throttling
 * (simulated dense 4G). `formFactor` is set explicitly for clarity.
 *
 * outputDir uses an absolute path (__dirname) so LHCI always writes to frontend/.lighthouseci/
 * regardless of what working directory the lhci process inherits at runtime.
 * @see ../docs/lighthouse-auditing-integration-plan.md
 */
const path = require("path");
const base = "http://localhost";

const testProjectId = process.env.LHCI_TEST_PROJECT_ID;
const testSpreadsheetId = process.env.LHCI_TEST_SPREADSHEET_ID;

const urls = [
  `${base}/`,
  `${base}/spreadsheets`,
  `${base}/projects`,
  `${base}/decisions`,
  `${base}/campaigns`,
  `${base}/variations`,
  `${base}/mailchimp`,
  `${base}/notion`,
  `${base}/tiktok`,
  `${base}/messages`,
  `${base}/calendar`,
];

if (testProjectId) {
  urls.push(`${base}/projects/${testProjectId}/spreadsheets`);
  urls.push(`${base}/projects/${testProjectId}/meetings`);
  urls.push(`${base}/tasks?view=list&project_id=${testProjectId}`);
  if (testSpreadsheetId) {
    urls.push(`${base}/projects/${testProjectId}/spreadsheets/${testSpreadsheetId}`);
  }
}

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      puppeteerScript: "./scripts/lhci-puppeteer-login.cjs",
      url: urls,
      settings: {
        preset: "desktop",
        formFactor: "desktop",
        disableStorageReset: true,
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["warn", { minScore: 1.0 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 1.0 }]
      },
    },
    upload: {
      target: "filesystem",
      // Absolute path
      outputDir: path.join(__dirname, ".lighthouseci"),
    },
  },
};
