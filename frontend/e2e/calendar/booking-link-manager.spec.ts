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
    // The path uses the org the API reports for the link, not the active
    // project's. Path and duration are now separate elements on the card.
    await expect(page.getByText('/book/acme/intro-call')).toBeVisible();
    await expect(page.getByText('30 min')).toBeVisible();
    // The card exposes the public page directly, so a link can be previewed.
    await expect(page.getByTestId('booking-link-open')).toHaveAttribute(
      'href',
      '/book/acme/intro-call',
    );
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
    // Every calendar the user can write to is offered — placeholder + both.
    await expect(
      page.getByTestId('booking-link-calendar').locator('option'),
    ).toHaveCount(3);
    await page.getByTestId('booking-link-title').fill('Discovery Call');
    await page.getByTestId('booking-link-slug').fill('discovery-call');
    await page.getByTestId('booking-link-calendar').selectOption({ index: 1 });
    await page.getByTestId('booking-link-duration-45').click();
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

  test('a non-primary calendar is offered, with a note that it will not sync', async ({
    page,
  }) => {
    // is_primary is only set by the Google connect flow, so blocking on it
    // would mean no booking links without Google. Warn, don't block.
    await page.route(/\/api\/google-calendar\/status\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true }),
      });
    });
    await mockCalendars(page);
    await mockLinks(page, []);

    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();

    // Both calendars are selectable, primary or not.
    await expect(
      page.getByTestId('booking-link-calendar').locator('option'),
    ).toHaveCount(3);
    await expect(page.getByTestId('booking-link-save')).toBeEnabled();

    await page.getByTestId('booking-link-calendar').selectOption(
      '33333333-3333-3333-3333-333333333333',
    );
    await expect(page.getByTestId('booking-link-no-google-sync')).toBeVisible();

    await page.getByTestId('booking-link-calendar').selectOption(
      '22222222-2222-2222-2222-222222222222',
    );
    await expect(page.getByTestId('booking-link-no-google-sync')).toBeHidden();
  });

  test('no sync warning when Google is not connected', async ({ page }) => {
    // Nothing to sync to, so the note would be noise.
    await mockCalendars(page);
    await mockLinks(page, []);
    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();

    await page.getByTestId('booking-link-calendar').selectOption(
      '33333333-3333-3333-3333-333333333333',
    );
    await expect(page.getByTestId('booking-link-no-google-sync')).toBeHidden();
  });

  test('the empty state is hidden while the create form is open', async ({ page }) => {
    await mockCalendars(page);
    await mockLinks(page, []);
    await gotoManager(page);

    await expect(page.getByTestId('booking-link-empty')).toBeVisible();
    await page.getByTestId('booking-link-new').click();
    // "No booking links yet" underneath the form is contradictory.
    await expect(page.getByTestId('booking-link-empty')).toBeHidden();
  });

  test('advanced scheduling rules stay collapsed until asked for', async ({ page }) => {
    // Buffers, notice and horizon are defaults most people never touch; putting
    // them on the create step made every user answer six questions to make one
    // link.
    await mockCalendars(page);
    await mockLinks(page, []);
    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();

    await expect(page.getByTestId('booking-link-advanced')).toBeHidden();
    await expect(page.getByTestId('booking-link-min_notice_minutes')).toBeHidden();

    await page.getByTestId('booking-link-advanced-toggle').click();
    await expect(page.getByTestId('booking-link-advanced')).toBeVisible();
    await expect(page.getByTestId('booking-link-min_notice_minutes')).toBeVisible();
  });

  test('a custom duration is still reachable', async ({ page }) => {
    await mockCalendars(page);
    await mockLinks(page, []);
    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();

    // Presets cover the common cases; the number input appears only on demand.
    await expect(page.getByTestId('booking-link-duration_minutes')).toBeHidden();
    await page.getByTestId('booking-link-duration-custom').click();
    await expect(page.getByTestId('booking-link-duration_minutes')).toBeVisible();
    await page.getByTestId('booking-link-duration_minutes').fill('25');
    await expect(page.getByTestId('booking-link-duration_minutes')).toHaveValue('25');
  });

  test('the calendar page carries the entry point for booking links', async ({
    page,
  }) => {
    // Booking links have no sidebar entry of their own; the way in is a button
    // on the calendar toolbar, beside Ask Agent.
    await page.goto('/calendar');
    const entry = page.getByTestId('calendar-create-booking-link');
    await expect(entry).toBeVisible({ timeout: 30_000 });
    await expect(entry).toHaveText(/Create Booking link/);
    await expect(entry).toHaveAttribute('href', /\/calendar\/booking-links$/);
  });

  test('offers only calendars scoped to the active project', async ({ page }) => {
    // The calendar page filters its own view by project. If this picker were
    // unscoped it could offer a calendar whose events that page never shows —
    // the booking would succeed and then appear nowhere.
    const requested: string[] = [];
    await page.route(CALENDARS_GLOB, async (route) => {
      requested.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });
    await mockLinks(page, []);

    await gotoManager(page);
    // The project store hydrates after first render, so an unscoped request can
    // go out first; what matters is that the list finally rendered is scoped.
    expect(requested.length).toBeGreaterThan(0);
    expect(requested[requested.length - 1]).toContain('project_id=');
  });

  test('explains a missing project calendar rather than offering a dead button', async ({
    page,
  }) => {
    // Projects auto-provision a calendar, and the calendars API treats
    // project_id as read-only — so anything created from here would be
    // project-less and would not come back in this project's picker at all.
    await page.route(CALENDARS_GLOB, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });
    await mockLinks(page, []);

    await gotoManager(page);
    await page.getByTestId('booking-link-new').click();

    await expect(page.getByTestId('booking-link-no-calendar')).toBeVisible();
    await expect(page.getByTestId('booking-link-save')).toBeDisabled();
    await expect(page.getByTestId('booking-link-create-calendar')).toHaveCount(0);
    await expect(page.getByText(/ask an admin to provision one/i)).toBeVisible();
  });

  test('an owner can edit an existing link', async ({ page }) => {
    // Every field was set-once until now: changing a duration or notice period
    // meant deleting the link and reissuing the URL.
    await mockCalendars(page);
    await mockLinks(page, [EXISTING_LINK]);

    let patched: Record<string, unknown> | null = null;
    await page.route(/\/api\/booking-links\/[0-9a-f-]+\/$/, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }
      patched = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...EXISTING_LINK, title: 'Renamed Call', duration_minutes: 45 }),
      });
    });

    await gotoManager(page);
    await page.getByTestId('booking-link-edit').click();

    // The form opens prefilled, in edit mode.
    await expect(page.getByTestId('booking-link-form')).toBeVisible();
    await expect(page.getByText('Edit booking link')).toBeVisible();
    await expect(page.getByTestId('booking-link-title')).toHaveValue('Intro Call');
    await expect(page.getByTestId('booking-link-slug')).toHaveValue('intro-call');

    await page.getByTestId('booking-link-title').fill('Renamed Call');
    await page.getByTestId('booking-link-duration-45').click();
    await page.getByTestId('booking-link-save').click();

    await expect(page.getByText('Renamed Call')).toBeVisible();
    expect(patched).toMatchObject({ title: 'Renamed Call', duration_minutes: 45 });
    // The calendar was left alone, so no calendar_id is sent.
    expect(patched).not.toHaveProperty('calendar_id');
  });
});
