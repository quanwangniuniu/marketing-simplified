import { POST as bulkDelete } from '@/app/api/ad_copy_variation/variations/bulk_delete/route';
import { GET as latestBatch } from '@/app/api/ad_copy_variation/variations/latest_batch/route';
import { prisma } from '@/lib/prisma';

import {
  setupStudioFixture,
  teardownStudioFixture,
  type StudioFixture,
} from './support/fixtures';
import { studioRequest } from './support/requests';
import {
  accessToken,
  expiredAccessToken,
  foreignlySignedToken,
  refreshToken,
} from './support/tokens';

let fixture: StudioFixture;

beforeAll(async () => {
  fixture = await setupStudioFixture();
});

afterAll(async () => {
  await teardownStudioFixture(fixture);
  await prisma.$disconnect();
});

function latestBatchRequest(authorization?: string) {
  return studioRequest(
    `/api/ad_copy_variation/variations/latest_batch/?project_id=${fixture.projectA}`,
    authorization === undefined ? {} : { authorization }
  );
}

describe('access token rejection', () => {
  it('rejects a request with no Authorization header', async () => {
    const response = await latestBatch(latestBatchRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      detail: 'Authentication credentials were not provided.',
    });
  });

  it('rejects a non-Bearer scheme', async () => {
    const token = await accessToken(fixture.memberUserId);
    const response = await latestBatch(latestBatchRequest(`Token ${token}`));

    expect(response.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await foreignlySignedToken(fixture.memberUserId);
    const response = await latestBatch(latestBatchRequest(`Bearer ${token}`));

    expect(response.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await expiredAccessToken(fixture.memberUserId);
    const response = await latestBatch(latestBatchRequest(`Bearer ${token}`));

    expect(response.status).toBe(401);
  });

  it('rejects a refresh token used as an access token', async () => {
    const token = await refreshToken(fixture.memberUserId);
    const response = await latestBatch(latestBatchRequest(`Bearer ${token}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      detail: 'Given token not valid for any token type',
    });
  });
});

describe('user state is re-checked on every request', () => {
  // Django's JWTAuthentication loads the user and checks is_active. A signature
  // check alone would let a disabled account keep working until its token expires.
  it('rejects a valid token belonging to a deactivated user', async () => {
    const token = await accessToken(fixture.inactiveUserId);
    const response = await latestBatch(latestBatchRequest(`Bearer ${token}`));

    expect(response.status).toBe(401);
  });

  it('rejects a valid token belonging to a deleted user', async () => {
    const ghostUserId = 2_000_000_000;
    const token = await accessToken(ghostUserId);
    const response = await latestBatch(latestBatchRequest(`Bearer ${token}`));

    expect(response.status).toBe(401);
  });
});

describe('write endpoints are guarded too', () => {
  it('rejects an unauthenticated bulk_delete', async () => {
    const response = await bulkDelete(
      studioRequest('/api/ad_copy_variation/variations/bulk_delete/', {
        body: {
          project_id: String(fixture.projectA),
          selected_ids: [Number(fixture.draftA)],
          status: 'draft',
        },
      })
    );

    expect(response.status).toBe(401);
  });
});
