import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * MED-284: owner-side booking link management.
 *
 * The API is mocked so the spec doesn't depend on the signed-in E2E user
 * already having links or calendars. Ownership scoping and validation are
 * covered server-side in backend/calendars/test_booking_link_crud.py.
 */

const PAGE_URL = '/calendar/booking-links';
const AUTH_FILE = path.resolve(__dirname, '../.auth/user.json');

/**
 * The org/project slugs the signed-in user actually has.
 *
 * The nested layout validates these against the API (and will switch orgs if
 * they diverge), so placeholder slugs land on an error state instead of the
 * page. auth.setup persists the active project, which is the same source the
 * app reads.
 */
function activeSlugs(): { orgSlug: string; projectSlug: string } {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  for (const origin of state.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (item.name !== 'project-storage-v1') continue;
      const project = JSON.parse(item.value)?.state?.activeProject;
      const orgSlug = project?.organization?.slug;
      const projectSlug = project?.slug ?? project?.id;
      if (orgSlug && projectSlug) {
        return { orgSlug: String(orgSlug), projectSlug: String(projectSlug) };
      }
    }
  }
  throw new Error('No active project in storage state.');
}
const LINKS_GLOB = '**/api/booking-links/';
const CALENDARS_GLOB = /\/api\/calendars\/(\?.*)?$/;

const EXISTING_LINK = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'intro-call',
  organization_slug: 'acme',
  title: 'Intro Call',
  description: 'A quick chat.',
  duration_minutes: 30,
  slot_increment_minutes: 15,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 60,
  max_advance_days: 60,
  timezone: 'UTC',
  availability_windows: [],
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

async function mockCalendars(page: Page) {
  await page.route(CALENDARS_GLOB, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 2,
        results: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            name: 'Primary',
            timezone: 'UTC',
            is_primary: true,
          },
          // Non-primary: must not be offered, since the API would reject it.
          {
            id: '33333333-3333-3333-3333-333333333333',
            name: 'Secondary',
            timezone: 'UTC',
            is_primary: false,
          },
        ],
      }),
    });
  });
}

async function mockLinks(page: Page, links: unknown[]) {
  await page.route(LINKS_GLOB, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(links),
      });
      return;
    }
    await route.continue();
  });
}

async function gotoManager(page: Page) {
  await page.goto(PAGE_URL);
  await expect(page.getByTestId('booking-link-manager')).toBeVisible({ timeout: 30_000 });
}

test.describe('Booking link management', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test('shows an empty state before any link exists', async ({ page }) => {
    await mockCalendars(page);
    await mockLinks(page, []);
    await gotoManager(page);

    await expect(page.getByTestId('booking-link-empty')).toBeVisible();
    await expect(page.getByTestId('booking-link-item')).toHaveCount(0);
  });

  test('is reachable on the nested org/project route the sidebar builds', async ({
    page,
  }) => {
    // useBuildUrl prefixes every sidebar href with /[orgSlug]/[projectSlug], so
    // the flat route alone is not reachable from navigation — that combination
    // 404'd until the nested alias existed. The page reads org context from the
    // auth store rather than the path, so the slugs here are only routing.
    await mockCalendars(page);
    await mockLinks(page, [EXISTING_LINK]);

    const { orgSlug, projectSlug } = activeSlugs();
    await page.goto(`/${orgSlug}/${projectSlug}/calendar/booking-links`);
    await expect(page.getByTestId('booking-link-manager')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('booking-link-item')).toHaveCount(1);
  });

  test('lists existing links with their public path', async ({ page }) => {
    await mockCalendars(page);
    await mockLinks(page, [EXISTING_LINK]);
    await gotoManager(page);

    await expect(page.getByTestId('booking-link-item')).toHaveCount(1);
    await expect(page.getByText('Intro Call')).toBeVisible();
    // The path uses the org the API reports for the link, not the active project's.
    await expect(page.getByText('/book/acme/intro-call · 30 min')).toBeVisible();
  });

  test('an owner can generate a new link', async ({ page }) => {
    await mockCalendars(page);
    await mockLinks(page, []);

    let created: Record<string, unknown> | null = null;
    await page.route(LINKS_GLOB, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      created = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...EXISTING_LINK, title: 'Discovery Call', slug: 'discovery-call' }),
      });
    });

    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();

    await expect(page.getByTestId('booking-link-form')).toBeVisible();
    // Only the primary calendar is offered: placeholder + one option.
    await expect(
      page.getByTestId('booking-link-calendar').locator('option'),
    ).toHaveCount(2);
    await page.getByTestId('booking-link-title').fill('Discovery Call');
    await page.getByTestId('booking-link-slug').fill('discovery-call');
    await page.getByTestId('booking-link-calendar').selectOption({ index: 1 });
    await page.getByTestId('booking-link-duration_minutes').fill('45');
    await page.getByTestId('booking-link-save').click();

    await expect(page.getByTestId('booking-link-item')).toHaveCount(1);
    expect(created).toMatchObject({
      title: 'Discovery Call',
      slug: 'discovery-call',
      duration_minutes: 45,
    });
  });

  test('a duplicate slug surfaces the server message', async ({ page }) => {
    await mockCalendars(page);
    await mockLinks(page, []);
    await page.route(LINKS_GLOB, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      // The calendars app wraps validation errors in its own envelope.
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: 'VALIDATION_ERROR',
          details: [
            { field: 'slug', message: 'You already have a booking link with this slug.' },
          ],
        }),
      });
    });

    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();
    await page.getByTestId('booking-link-title').fill('Intro Call');
    await page.getByTestId('booking-link-calendar').selectOption({ index: 1 });
    await page.getByTestId('booking-link-save').click();

    await expect(page.getByTestId('booking-link-error')).toContainText(
      /already have a booking link/i,
    );
  });
});
