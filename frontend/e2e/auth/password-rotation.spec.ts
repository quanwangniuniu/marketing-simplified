import { test, expect, type Page } from '@playwright/test';

const warningRotation = {
  required: false,
  warning: true,
  elevated: true,
  expires_at: '2026-08-06T00:00:00Z',
  days_until_expiry: 7,
  max_age_days: 90,
  warning_days: 7,
};

const requiredRotation = {
  ...warningRotation,
  required: true,
  warning: false,
  days_until_expiry: 0,
};

async function seedPasswordRotationUser(page: Page, passwordRotation: typeof warningRotation) {
  const user = {
    id: 1,
    email: 'admin@example.com',
    username: 'admin',
    is_verified: true,
    is_staff: true,
    roles: ['Organization Admin'],
    password_rotation: passwordRotation,
  };

  await page.addInitScript((authUser) => {
    window.localStorage.setItem(
      'auth-storage-v1',
      JSON.stringify({
        state: {
          token: 'e2e-access-token',
          refreshToken: 'e2e-refresh-token',
          organizationAccessToken: null,
          user: authUser,
          isAuthenticated: true,
          loading: false,
          initialized: true,
          hasHydrated: true,
          userTeams: [],
          selectedTeamId: null,
        },
        version: 0,
      })
    );
  }, user);

  await page.route('**/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });
  await page.route('**/auth/me/teams/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ team_ids: [] }),
    });
  });
  await page.route('**/api/notifications/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    });
  });
  await page.route('**/api/core/projects**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    });
  });
  await page.route('**/api/projects/*/meetings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    });
  });
}

test.describe('Password rotation', () => {
  test('shows the seven-day warning banner for elevated users', async ({ page }) => {
    await seedPasswordRotationUser(page, warningRotation);

    await page.goto('/overview');

    await expect(
      page.getByText('Your elevated account password expires in 7 days.')
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible();
  });

  test('redirects hard-expired elevated users through change-password', async ({ page }) => {
    await seedPasswordRotationUser(page, requiredRotation);

    await page.goto('/overview');

    await expect(page).toHaveURL(/\/set-password\?rotation=1/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Change Your Password' })).toBeVisible();
    await expect(page.getByLabel('Current Password')).toBeVisible();
  });
});
