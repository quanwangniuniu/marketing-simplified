export type WorkspaceTab = "Summary" | "Tasks" | "Board";
export type TasksViewMode = "list" | "timeline";

const tabTestId: Record<WorkspaceTab, string> = {
  Summary: "tab-summary",
  Tasks: "tab-tasks",
  Board: "tab-board",
};

/**
 * Wait for blocking overlays (Guided Onboarding, "Preparing your workspace")
 * to dismiss. Clicks "Retry check" if visible.
 */
export function waitForTasksPageReady(): void {
  cy.get("body").then(($body) => {
    if ($body.find('button:contains("Retry check")').length) {
      cy.contains("button", "Retry check").click();
    }
  });

  cy.contains("Guided Onboarding", { timeout: 15_000 }).should("not.exist");
  cy.contains("Preparing your workspace", { timeout: 15_000 }).should(
    "not.exist",
  );
}

/**
 * Navigate to /tasks, pick the E2E project, and return its ID via an alias.
 * After calling this, use `cy.get("@projectId")` to retrieve the value.
 */
export function selectProject(): void {
  const projectName =
    Cypress.env("E2E_PROJECT_NAME") || "E2E Test Project";

  cy.visit("/tasks");
  cy.contains("Preparing your workspace", { timeout: 30_000 }).should(
    "not.exist",
  );
  cy.contains("h1", "Select a project", { timeout: 10_000 }).should(
    "be.visible",
  );

  cy.get("button.group")
    .filter(`:has(span.font-semibold.text-slate-900:contains("${projectName}"))`)
    .first()
    .click();

  cy.url().should("match", /\/tasks\?project_id=\d+/, { timeout: 10_000 });

  waitForTasksPageReady();

  cy.url().then((url) => {
    const id = new URL(url).searchParams.get("project_id");
    cy.wrap(Number(id)).as("projectId");
  });
}

/** Click a top-level workspace tab (Summary / Tasks / Board). */
export function switchTab(tab: WorkspaceTab): void {
  cy.get(`[data-testid="${tabTestId[tab]}"]`).click();
}

/** Toggle between List and Timeline inside the Tasks tab. */
export function switchView(mode: TasksViewMode): void {
  const testId = mode === "list" ? "view-button-list" : "view-button-timeline";
  cy.get(`[data-testid="${testId}"]`).click();
}

/**
 * Click the first task in the list and then click "Open" to navigate
 * to the task detail page.
 */
export function openFirstTaskFromList(): void {
  cy.get('[role="listbox"][aria-label="Task list"]', { timeout: 10_000 })
    .should("be.visible")
    .find('[role="option"]')
    .first()
    .should("be.visible")
    .click();

  cy.get('[data-testid="task-open-button"]').click();
}

/**
 * From the Board view, click the first card to navigate to the task detail page.
 */
export function openFirstTaskFromBoard(): void {
  cy.get('[data-testid="board-columns"]', { timeout: 10_000 })
    .should("be.visible")
    .find('[role="button"]')
    .first()
    .should("be.visible")
    .click();
}

/**
 * No inline loading copy like "Loading attachments...", "Loading asset details...", etc.
 * (Separate from page-level task-detail-loading.)
 */
export function assertNoLoadingEllipsisText(): void {
  cy.get("body", { timeout: 30_000 }).should(($body) => {
    const text = $body.text();
    const re = /Loading\s+.+?\.\.\./g;
    const matches = text.match(re);
    if (matches?.length) {
      throw new Error(
        `Unexpected loading text still present: ${[...new Set(matches)].join(" | ")}`,
      );
    }
  });
}

/** Task detail route shell: no loading or error panels. */
export function assertTaskDetailShellNoLoadingOrError(): void {
  cy.get('[data-testid="task-detail-loading"]').should("not.exist");
  cy.get('[data-testid="task-detail-error"]').should("not.exist");
}

/**
 * After navigation, task detail should be past loading/error and show title + description section.
 * Used when opening from list or board.
 */
export function assertTaskDetailCoreContentVisible(): void {
  assertNoLoadingEllipsisText();
  assertTaskDetailShellNoLoadingOrError();

  cy.get('[data-testid="task-summary-title"]', { timeout: 15_000 })
    .should("be.visible")
    .and(($el) => {
      if (!$el.text().trim()) {
        throw new Error("task summary title is empty");
      }
    });

  cy.get('[data-testid="task-description-heading"]').should("be.visible");
}
