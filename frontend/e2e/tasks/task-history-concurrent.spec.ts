import {
  test,
  expect,
  type Page,
  type Response,
} from '@playwright/test';
import {
  createDraftTaskViaApi,
  deleteTaskById,
  getAuthToken,
  waitForTasksPageReady,
} from './tasks-helpers';

type ProjectPayload = {
  id: number;
  slug: string;
};

type ProjectContext = ProjectPayload & {
  orgSlug: string;
};

type HistoryEntry = {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

async function getFirstProjectViaApi(page: Page): Promise<ProjectContext> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const token = await getAuthToken(page);
  if (!token) {
    throw new Error('No authentication token found');
  }

  const orgSlug = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage-v1');
      if (!raw) return null;

      const user = JSON.parse(raw)?.state?.user;

      return (
        user?.current_organization?.slug
        ?? user?.organization?.slug
        ?? null
      );
    } catch {
      return null;
    }
  });

  if (!orgSlug) {
    throw new Error('No organization slug found for the E2E user');
  }

  const origin = new URL(page.url()).origin;
  const response = await page.request.get(
    `${origin}/api/core/projects/`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Projects API failed (${response.status()}): ${await response.text()}`,
    );
  }

  const payload = await response.json() as
    | ProjectPayload[]
    | { results?: ProjectPayload[] };

  const projects = Array.isArray(payload)
    ? payload
    : payload.results ?? [];

  const project = projects[0];

  if (!project?.id || !project.slug) {
    throw new Error('The E2E user has no available project');
  }

  return {
    id: project.id,
    slug: project.slug,
    orgSlug,
  };
}

let createdTaskId: number | null = null;

test.afterEach(async ({ page }) => {
  if (!createdTaskId) return;

  try {
    await deleteTaskById(page, createdTaskId);
  } catch {
    // Best-effort cleanup.
  } finally {
    createdTaskId = null;
  }
});
test('two tabs preserve both summary edits and reconcile to server truth', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const project = await getFirstProjectViaApi(page);
    const projectId = project.id;
    const projectSlug = project.slug;
    const orgSlug = project.orgSlug;

    const originalSummary = `History two-tab original ${Date.now()}`;
    const writerAValue = `History two-tab writer A ${Date.now()}`;
    const writerBValue = `History two-tab writer B ${Date.now()}`;

    const listUrl = `/${encodeURIComponent(orgSlug)}/${encodeURIComponent(projectSlug)}/tasks`;

    await page.goto(listUrl);
    await waitForTasksPageReady(page);

    const fixture = await createDraftTaskViaApi(
      page,
      projectId,
      originalSummary,
    );
    createdTaskId = fixture.id;

    const pageA = page;
    const pageB = await page.context().newPage();

    const openSummaryEditor = async (
      targetPage: Page,
    ) => {
      await targetPage.goto(listUrl);
      await waitForTasksPageReady(targetPage);

      const taskRows = targetPage.getByTestId('task-row');
      const matchingRow = taskRows
        .filter({ hasText: originalSummary })
        .first();

      await expect(matchingRow).toBeVisible({ timeout: 10_000 });

      const rowIndex = await taskRows.evaluateAll(
        (rows, summary) => rows.findIndex(
          (candidate) => candidate.textContent?.includes(summary) ?? false,
        ),
        originalSummary,
      );

      if (rowIndex < 0) {
        throw new Error(`Task row not found for summary: ${originalSummary}`);
      }

      const row = taskRows.nth(rowIndex);
      await expect(row).toBeVisible({ timeout: 10_000 });

      const summaryArea = row.getByTestId('task-row-open');
      await summaryArea.hover();

      const editButton = summaryArea.getByRole('button', {
        name: 'Edit',
        exact: true,
      });
      await expect(editButton).toBeVisible();
      await editButton.click();

      const input = row.locator('input').first();
      await expect(input).toBeVisible();

      return { input };
    };

    try {
      const editorA = await openSummaryEditor(pageA);
      const editorB = await openSummaryEditor(pageB);

      await editorA.input.fill(writerAValue);
      await editorB.input.fill(writerBValue);

      const isTargetPatch = (response: Response) => {
        if (response.request().method() !== 'PATCH') return false;

        const pathname = new URL(response.url())
          .pathname
          .replace(/\/$/, '');

        return (
          pathname.endsWith(`/api/tasks/${fixture.id}`)
          || pathname.endsWith(`/api/tasks/${fixture.slug}`)
        );
      };

      const responseAPromise = pageA.waitForResponse(isTargetPatch);
      const responseBPromise = pageB.waitForResponse(isTargetPatch);

      await Promise.all([
        editorA.input.press('Enter'),
        editorB.input.press('Enter'),
      ]);

      const [patchAResponse, patchBResponse] = await Promise.all([
        responseAPromise,
        responseBPromise,
      ]);

      expect(patchAResponse.ok()).toBeTruthy();
      expect(patchBResponse.ok()).toBeTruthy();

      for (const patchResponse of [
        patchAResponse,
        patchBResponse,
      ]) {
        const requestOperationId = new URL(
          patchResponse.url()
        ).searchParams.get('operation_id');

        expect(requestOperationId).toBeTruthy();

        const responseBody = await patchResponse.json() as {
          operation_id?: string;
        };

        expect(responseBody.operation_id).toBe(
          requestOperationId
        );
      }

      const token = await getAuthToken(pageA);
      expect(token).toBeTruthy();

      const origin = new URL(pageA.url()).origin;
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const finalTaskResponse = await pageA.request.get(
        `${origin}/api/tasks/${fixture.id}/`,
        { headers },
      );
      expect(finalTaskResponse.ok()).toBeTruthy();

      const finalTask = await finalTaskResponse.json() as {
        summary: string;
      };

      expect([writerAValue, writerBValue]).toContain(finalTask.summary);

      const historyResponse = await pageA.request.get(
        `${origin}/api/tasks/${fixture.id}/field-history/?page_size=100`,
        { headers },
      );
      expect(historyResponse.ok()).toBeTruthy();

      const historyPayload = await historyResponse.json() as {
        results: HistoryEntry[];
      };

      const summaryEntries = historyPayload.results
        .filter((entry) => entry.field_name === 'summary')
        .sort((left, right) => {
          const timeOrder = left.changed_at.localeCompare(right.changed_at);
          return timeOrder !== 0 ? timeOrder : left.id - right.id;
        });

      expect(summaryEntries).toHaveLength(2);
      expect(summaryEntries[0].old_value).toBe(originalSummary);
      expect(summaryEntries[1].old_value).toBe(
        summaryEntries[0].new_value,
      );
      expect(summaryEntries[1].new_value).toBe(finalTask.summary);

      expect(
        new Set(summaryEntries.map((entry) => entry.new_value)),
      ).toEqual(new Set([writerAValue, writerBValue]));

      for (const entry of summaryEntries) {
        expect(entry.changed_by_name).toBeTruthy();
      }

      // Cross-tab real-time synchronization is out of scope. A reload must
      // nevertheless resolve both tabs to the authoritative server value.
      await Promise.all([
        pageA.reload({ waitUntil: 'domcontentloaded' }),
        pageB.reload({ waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([
        waitForTasksPageReady(pageA),
        waitForTasksPageReady(pageB),
      ]);

      const finalSummaryRowA = pageA
        .getByTestId('task-row')
        .filter({ hasText: finalTask.summary })
        .first();

      const finalSummaryRowB = pageB
        .getByTestId('task-row')
        .filter({ hasText: finalTask.summary })
        .first();

      await Promise.all([
        expect(finalSummaryRowA).toBeVisible({ timeout: 30_000 }),
        expect(finalSummaryRowB).toBeVisible({ timeout: 30_000 }),
      ]);

      await finalSummaryRowA
        .getByTestId('task-row-open')
        .click();
      await expect(pageA.getByTestId('task-drawer')).toBeVisible({
        timeout: 30_000,
      });

      await pageA.getByTestId('drawer-tab-history').click();

      for (const entry of summaryEntries) {
        const historyRow = pageA.locator(
          `[data-history-entry-id="${entry.id}"]`,
        );

        await expect(historyRow).toBeVisible({ timeout: 10_000 });
        await expect(historyRow).toContainText(
          entry.changed_by_name ?? 'System',
        );
        await expect(historyRow).toContainText(entry.old_value ?? 'empty');
        await expect(historyRow).toContainText(entry.new_value ?? 'empty');
      }
    } finally {
      await pageB.close();
    }
  });