import { randomUUID } from 'crypto';
import { expect, test } from '@playwright/test';

test('creates, retrieves, and revokes a real share link from a creative slug', async ({ page }) => {
  test.setTimeout(90_000);
  // Use the real account saved by auth.setup.ts. No API responses are mocked.
  const state = await page.context().storageState();
  const storage = state.origins.flatMap((origin) => origin.localStorage);
  const auth = JSON.parse(storage.find((item) => item.name === 'auth-storage-v1')!.value).state;
  const project = JSON.parse(storage.find((item) => item.name === 'project-storage-v1')!.value).state;
  const orgSlug = auth.user.current_organization?.slug;
  const projectSlug = project.activeProject?.slug;
  const prefix = orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : '';
  const name = `MED-128 share regression ${randomUUID()}`;

  await page.goto(`${prefix}/facebook-meta`);
  await page.getByRole('button', { name: 'New Ad Creative', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'New Facebook Meta ad creative', exact: true });
  await createDialog.getByLabel('Name', { exact: true }).fill(name);
  const creation = page.waitForResponse((response) =>
    response.url().endsWith('/api/facebook_meta/adcreatives/') && response.request().method() === 'POST',
  );
  await createDialog.getByRole('button', { name: 'Create creative', exact: true }).click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const { data: creative } = await created.json();

  try {
    expect(creative.slug).toBeTruthy();
    expect(creative.slug).not.toBe(creative.id);
    await expect(page).toHaveURL(new RegExp(`/facebook-meta/${creative.slug}$`));
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    const shareEndpoint = `/api/facebook_meta/${creative.slug}/share-preview/`;
    await page.getByRole('button', { name: 'Share preview', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share Facebook creative preview', exact: true });
    const generation = page.waitForResponse((response) =>
      response.url().endsWith(shareEndpoint) && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Generate link', exact: true }).click();
    const generated = await generation;
    expect(generated.status()).toBe(201);
    const { link, days_active: daysActive } = await generated.json();
    expect(daysActive).toBe(7);
    expect(link).toMatch(/\/ads\/previewer\/facebook_meta\/[^/]+\/$/);
    await expect(dialog.getByRole('textbox')).toHaveValue(link);
    await expect(dialog.getByRole('button', { name: 'Copy link', exact: true })).toBeEnabled();

    // Reload forces a real GET; the link must survive beyond the modal's state.
    await page.reload();
    const share = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Share', exact: true }),
    });
    await expect(share.getByText(link, { exact: true })).toBeVisible();
    const revocation = page.waitForResponse((response) =>
      response.url().endsWith(shareEndpoint) && response.request().method() === 'DELETE',
    );
    await share.getByRole('button', { name: 'Revoke link', exact: true }).click();
    expect((await revocation).status()).toBe(200);
    await expect(share.getByText('No share link generated.', { exact: false })).toBeVisible();
  } finally {
    // Delete only this test's creative; its preview is cascade-deleted on failure.
    const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}` };
    if (auth.organizationAccessToken) headers['X-Organization-Token'] = auth.organizationAccessToken;
    const deleted = await page.request.delete(`/api/facebook_meta/${creative.id}/`, { headers });
    expect(deleted.status()).toBe(200);
  }
});
