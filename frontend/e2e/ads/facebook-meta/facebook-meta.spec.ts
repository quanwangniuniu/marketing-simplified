import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { AdCreative } from '../../../src/lib/api/facebookMetaApi';

const creative: AdCreative = {
  id: '128001',
  name: 'MED-128 summer campaign',
  status: 'ACTIVE',
  call_to_action_type: 'LEARN_MORE',
  object_story_spec: {
    link_data: {
      message: 'Discover our summer collection.',
      name: 'Summer starts here',
      description: 'Explore the new collection.',
      link: 'https://example.com/summer',
    },
    photo_data: [{
      id: 128,
      url: '/med-128-preview.jpg',
      caption: 'Summer collection preview',
    }],
  },
};

const listEndpoint = /\/api\/facebook_meta\/adcreatives\/(?:\?.*)?$/;
const detailEndpoint = `**/api/facebook_meta/${creative.id}/`;
const shareEndpoint = `**/api/facebook_meta/${creative.id}/share-preview/`;

async function openFacebookMeta(page: Page, suffix = '') {
  // Open the canonical URL so the legacy redirect cannot interrupt a click.
  const state = await page.context().storageState();
  const storage = state.origins.flatMap((origin) => origin.localStorage);
  const auth = JSON.parse(storage.find((item) => item.name === 'auth-storage-v1')?.value ?? '{}');
  const project = JSON.parse(storage.find((item) => item.name === 'project-storage-v1')?.value ?? '{}');
  const orgSlug = auth.state?.user?.current_organization?.slug;
  const projectSlug = project.state?.activeProject?.slug;
  const prefix = orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : '';
  await page.goto(`${prefix}/facebook-meta${suffix}`);
}

test.describe('Facebook Meta ad creatives', () => {
  // Reuse the real login from auth.setup.ts; only ads data and media are mocked.
  test.beforeEach(async ({ page }) => {
    await page.route(listEndpoint, (route) => route.fulfill({
      json: { count: 1, next: null, previous: null, results: [creative] },
    }));
    await page.route(detailEndpoint, (route) => route.fulfill({ json: creative }));
    await page.route(shareEndpoint, (route) => route.fulfill({
      json: { link: null, days_active: null, days_left: null },
    }));
    // Serve both the page's HEAD probe and the browser's image request locally.
    await page.route('**/med-128-preview.jpg', (route) => route.fulfill({
      contentType: 'image/jpeg',
      path: path.join(__dirname, '../../profile/fixtures/sample-image.png'),
    }));
  });

  test('shows the creatives list', async ({ page }) => {
    await openFacebookMeta(page);

    await expect(page.getByRole('heading', {
      name: 'Facebook Meta ad creatives', exact: true,
    })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Call to action', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'ID', exact: true })).toBeVisible();

    const row = table.getByRole('row').filter({ hasText: creative.name });
    await expect(row.getByRole('cell', { name: creative.name, exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: 'Active', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: 'Learn More', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: creative.id, exact: true })).toBeVisible();
    await expect(page.getByText('No ad creatives yet', { exact: true })).toBeHidden();
  });

  test('shows the empty state after an empty list response', async ({ page }) => {
    await page.route(listEndpoint, (route) => route.fulfill({
      json: { count: 0, next: null, previous: null, results: [] },
    }));
    const response = page.waitForResponse(listEndpoint);
    await openFacebookMeta(page);
    expect((await response).ok()).toBe(true);

    await expect(page.getByText('Loading ad creatives…', { exact: true })).toBeHidden();
    await expect(page.getByText('No ad creatives yet', { exact: true })).toBeVisible();
    await expect(page.getByText('above to create your first one.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Ad Creative', exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();
  });

  test('opens a creative from the list and renders its content and preview', async ({ page }) => {
    await openFacebookMeta(page);
    await page.getByRole('row').filter({ hasText: creative.name }).click();

    // The list hook currently keeps the ID but not the slug. Allow the org/project prefix.
    await expect(page).toHaveURL(new RegExp(`/facebook-meta/${creative.id}$`));
    await expect(page.getByRole('heading', { name: creative.name, exact: true })).toBeVisible();
    const content = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Creative content', exact: true }),
    });
    await expect(content.getByText('Discover our summer collection.', { exact: true })).toBeVisible();
    await expect(content.getByText('Summer starts here', { exact: true })).toBeVisible();
    await expect(content.getByRole('link')).toHaveAttribute('href', 'https://example.com/summer');

    const preview = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Preview', exact: true }),
    });
    const image = preview.getByRole('img', { name: 'Summer collection preview', exact: true }).first();
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty('complete', true);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test('displays a mocked share link response', async ({ page }) => {
    await openFacebookMeta(page, `/${creative.id}`);
    await page.getByRole('button', { name: 'Share preview', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share Facebook creative preview', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: '14 days', exact: true }).click();

    const shareLink = new URL('/ads/previewer/facebook_meta/med-128-token/', page.url()).href;
    await page.route(shareEndpoint, (route) => route.fulfill({
      status: 201,
      json: { link: shareLink, days_active: 14, days_left: 14 },
    }));
    const request = page.waitForRequest((request) =>
      request.url().endsWith(`/api/facebook_meta/${creative.id}/share-preview/`) &&
      request.method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Generate link', exact: true }).click();

    expect((await request).postDataJSON()).toEqual({ days: 14 });
    await expect(dialog.getByRole('textbox')).toHaveValue(shareLink);
    await expect(dialog.getByRole('button', { name: 'Copy link', exact: true })).toBeEnabled();
  });
});
