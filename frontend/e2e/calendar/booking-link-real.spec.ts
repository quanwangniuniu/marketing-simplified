import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * MED-284: external booking against the real backend — no API mocking.
 *
 * Creates a booking link through the authenticated API, then books it through
 * the public page as an anonymous visitor would, and verifies the event was
 * really created. The companion booking-link.spec.ts covers widget states that
 * are awkward to produce for real (Google outage, 409 races).
 */

const AUTH_FILE = path.resolve(__dirname, '../.auth/user.json');
const SLUG = `e2e-real-${Date.now().toString(36)}`;

interface Ctx {
  baseUrl: string;
  headers: Record<string, string>;
  orgSlug: string;
  calendarId: string;
}

function readToken(): string {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  for (const origin of state.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (item.name === 'auth-storage-v1') {
        const token = JSON.parse(item.value)?.state?.token;
        if (token) return token;
      }
    }
  }
  throw new Error('No auth token in storage state.');
}

/** Unwraps a paginated list payload, which several of these endpoints return. */
function unwrap<T>(payload: unknown): T[] {
  return Array.isArray(payload)
    ? (payload as T[])
    : ((payload as { results?: T[] })?.results ?? []);
}

async function buildContext(page: Page): Promise<Ctx> {
  const baseUrl = (process.env.BASE_URL || 'http://localhost').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${readToken()}` };

  const calendarsRes = await page.request.get(`${baseUrl}/api/calendars/`, { headers });
  expect(calendarsRes.ok(), 'listing calendars').toBeTruthy();
  const calendars = unwrap<{ id: string; is_primary: boolean; organization_id: string }>(
    await calendarsRes.json(),
  );
  const primary = calendars.find((c) => c.is_primary);
  expect(primary, 'the E2E user needs a primary calendar').toBeTruthy();

  // The public URL is org-scoped, so the org slug has to come from the API too.
  // Projects carry a nested organization with its slug, which is the shape the
  // app itself reads (activeProject.organization.slug).
  const projectsRes = await page.request.get(`${baseUrl}/api/core/projects/`, { headers });
  expect(projectsRes.ok(), 'listing projects').toBeTruthy();
  const projects = unwrap<{ organization?: { id: number | string; slug?: string } }>(
    await projectsRes.json(),
  );
  const orgSlug =
    projects.find(
      (p) => String(p.organization?.id ?? '') === String(primary!.organization_id),
    )?.organization?.slug ??
    projects.find((p) => p.organization?.slug)?.organization?.slug ??
    '';
  expect(orgSlug, 'could not resolve an organisation slug').toBeTruthy();

  return { baseUrl, headers, orgSlug, calendarId: primary!.id };
}

test.describe('Public booking against the real backend', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let ctx: Ctx;
  let linkId: string | null = null;
  let bookedStart: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    ctx = await buildContext(page);

    // Wide windows and no notice period so slots exist regardless of when the
    // suite runs.
    const created = await page.request.post(`${ctx.baseUrl}/api/booking-links/`, {
      headers: ctx.headers,
      data: {
        slug: SLUG,
        title: 'E2E Real Booking',
        description: 'Created by the booking E2E.',
        calendar_id: ctx.calendarId,
        duration_minutes: 30,
        slot_increment_minutes: 30,
        min_notice_minutes: 0,
        max_advance_days: 14,
        timezone: 'UTC',
        availability_windows: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          start: '00:00',
          end: '23:30',
        })),
      },
    });
    expect(created.ok(), `creating link: ${await created.text()}`).toBeTruthy();
    linkId = (await created.json()).id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!linkId) return;
    const page = await browser.newPage();
    await page.request.delete(`${ctx.baseUrl}/api/booking-links/${linkId}/`, {
      headers: ctx.headers,
    });
    await page.close();
  });

  test('an anonymous visitor books a real slot end to end', async ({ browser }) => {
    // A fresh context with no storage state: the prospect is not logged in.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto(`/book/${ctx.orgSlug}/${SLUG}`);
    await expect(page.getByTestId('booking-widget')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('E2E Real Booking')).toBeVisible();

    // Slots come from the real availability merge, so pick whatever is offered.
    const slots = page.getByTestId('booking-slot');
    await expect(slots.first()).toBeVisible({ timeout: 30_000 });
    bookedStart = await slots.first().getAttribute('data-slot-start');
    expect(bookedStart).toBeTruthy();

    await slots.first().click();
    await page.getByTestId('booking-name').fill('Grace Hopper');
    await page.getByTestId('booking-email').fill('grace@example.com');
    await page.getByTestId('booking-notes').fill('Booked by the real E2E.');
    await page.getByTestId('booking-submit').click();

    await expect(page.getByTestId('booking-confirmed')).toBeVisible({ timeout: 30_000 });
    await context.close();

    // The booking must exist server-side, not just on screen.
    const verifier = await browser.newPage();
    const events = await verifier.request.get(`${ctx.baseUrl}/api/events/`, {
      headers: ctx.headers,
      params: { search: 'E2E Real Booking' },
    });
    expect(events.ok(), 'listing events as the owner').toBeTruthy();
    const found = unwrap<{ title: string }>(await events.json());
    expect(
      found.some((e) => e.title?.includes('Grace Hopper')),
      'the booking should be visible to the owner',
    ).toBeTruthy();
    await verifier.close();
  });

  test('the same slot cannot be booked twice', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto(`/book/${ctx.orgSlug}/${SLUG}`);
    await expect(page.getByTestId('booking-slot').first()).toBeVisible({ timeout: 30_000 });

    // The slot taken by the previous test must no longer be offered — proof the
    // availability merge sees the event it just created.
    const remaining = await page
      .getByTestId('booking-slot')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-slot-start')));
    expect(remaining.length).toBeGreaterThan(0);
    expect(bookedStart, 'the first test should have recorded a slot').toBeTruthy();
    expect(remaining).not.toContain(bookedStart);

    await context.close();
  });
});
