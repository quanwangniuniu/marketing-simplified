import { test, expect, type Page } from '@playwright/test';

/**
 * MED-284: external booking through a public link.
 *
 * The API is mocked (the `email_draft` specs do the same) for two reasons:
 * there is no owner-facing endpoint yet for creating a BookingLink, so a real
 * link cannot be provisioned from a test; and slot availability moves with the
 * clock, which would make assertions flaky. The server side — tenant
 * resolution, double-booking, throttling, PII — is covered by
 * backend/calendars/test_public_booking.py; this spec covers what the prospect
 * actually does.
 */

const ORG = 'acme';
const LINK = 'intro-call';
const BOOKING_URL = `/book/${ORG}/${LINK}`;
const API_GLOB = `**/api/public/book/${ORG}/${LINK}/`;
const BOOKINGS_GLOB = `**/api/public/book/${ORG}/${LINK}/bookings/`;

/** Fixed future slots so assertions don't drift with the clock. */
const SLOTS = [
  { start: '2027-03-02T09:00:00Z', end: '2027-03-02T10:00:00Z' },
  { start: '2027-03-02T10:00:00Z', end: '2027-03-02T11:00:00Z' },
  { start: '2027-03-03T09:00:00Z', end: '2027-03-03T10:00:00Z' },
];

const LINK_PAYLOAD = {
  slug: LINK,
  title: 'Intro Call',
  description: 'A quick chat about your campaigns.',
  duration_minutes: 60,
  timezone: 'UTC',
  owner_name: 'Ada Lovelace',
  slots: SLOTS,
};

async function mockAvailability(page: Page, payload: unknown = LINK_PAYLOAD) {
  await page.route(API_GLOB, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

async function gotoBooking(page: Page) {
  await page.goto(BOOKING_URL);
  await expect(page.getByTestId('booking-widget')).toBeVisible({ timeout: 30_000 });
}

test.describe('Public booking link', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test('an external visitor can book a slot end to end', async ({ page }) => {
    await mockAvailability(page);

    let submitted: Record<string, unknown> | null = null;
    await page.route(BOOKINGS_GLOB, async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'confirmed',
          start: SLOTS[0].start,
          end: SLOTS[0].end,
          title: 'Intro Call with Grace Hopper',
          timezone: 'UTC',
        }),
      });
    });

    await gotoBooking(page);

    // The page identifies whose time this is and how long it runs.
    await expect(page.getByText('Intro Call')).toBeVisible();
    await expect(page.getByText('Ada Lovelace')).toBeVisible();
    await expect(page.getByText('60 minutes')).toBeVisible();

    // Show times in a fixed zone so the assertions below are deterministic.
    await page.getByTestId('booking-timezone').selectOption('UTC');
    await expect(page.getByTestId('booking-slot')).toHaveCount(3);

    await page.getByTestId('booking-slot').first().click();

    await expect(page.getByTestId('booking-form')).toBeVisible();
    await page.getByTestId('booking-name').fill('Grace Hopper');
    await page.getByTestId('booking-email').fill('grace@example.com');
    await page.getByTestId('booking-notes').fill('Looking forward to it.');
    await page.getByTestId('booking-submit').click();

    await expect(page.getByTestId('booking-confirmed')).toBeVisible();
    await expect(page.getByText(/You're booked/)).toBeVisible();

    // The slot's exact instant must reach the API, not a re-derived local time.
    expect(submitted).toMatchObject({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      start: SLOTS[0].start,
    });
  });

  test('slots regroup when the visitor changes timezone', async ({ page }) => {
    await mockAvailability(page);
    await gotoBooking(page);

    await page.getByTestId('booking-timezone').selectOption('UTC');
    // Day labels come from Intl with the runtime's locale, so match on the parts
    // that are locale-independent rather than a fixed "2 March" ordering.
    await expect(
      page.getByRole('heading', { name: /Tuesday.*(March|2)/ }),
    ).toBeVisible();

    // 09:00Z on 2 March is 20:00 the same day in Sydney, so the heading stays
    // on the 2nd but the displayed time shifts.
    await page.getByTestId('booking-timezone').selectOption('Australia/Sydney');
    await expect(page.getByTestId('booking-slot').first()).toHaveText(/8:00/);
  });

  test('a slot taken while the page was open is reported, not silently failed',
    async ({ page }) => {
      await mockAvailability(page);
      await page.route(BOOKINGS_GLOB, async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'SLOT_UNAVAILABLE',
            message: 'That time is no longer available.',
          }),
        });
      });

      await gotoBooking(page);
      await page.getByTestId('booking-slot').first().click();
      await page.getByTestId('booking-name').fill('Grace Hopper');
      await page.getByTestId('booking-email').fill('grace@example.com');
      await page.getByTestId('booking-submit').click();

      await expect(page.getByTestId('booking-error')).toContainText(/just taken/i);
      // Back to the slot list so another time can be picked.
      await expect(page.getByTestId('booking-slots')).toBeVisible();
    });

  test('an unknown link shows an unavailable message rather than an error page',
    async ({ page }) => {
      await page.route(API_GLOB, async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'This booking link is not available.' }),
        });
      });

      await page.goto(BOOKING_URL);
      await expect(page.getByTestId('booking-missing')).toBeVisible({ timeout: 30_000 });
    });

  test('a link with no free time says so', async ({ page }) => {
    await mockAvailability(page, { ...LINK_PAYLOAD, slots: [] });
    await gotoBooking(page);
    await expect(page.getByText(/No times are available/)).toBeVisible();
    await expect(page.getByTestId('booking-slot')).toHaveCount(0);
  });
});
