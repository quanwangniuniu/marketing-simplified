import { GET as getVariation } from '@/app/api/ad_copy_variation/variations/[id]/route';
import { POST as generate } from '@/app/api/ad_copy_variation/variations/generate/route';
import { GET as latestBatch } from '@/app/api/ad_copy_variation/variations/latest_batch/route';
import { prisma } from '@/lib/prisma';

import {
  setupStudioFixture,
  teardownStudioFixture,
  type StudioFixture,
} from './support/fixtures';
import { readJson, studioRequest } from './support/requests';
import { accessToken } from './support/tokens';

// Guards run before any model call, but mocking keeps a regression from
// reaching the real Vertex endpoint.
jest.mock('@/lib/gemini');

let fixture: StudioFixture;
let token: string;

beforeAll(async () => {
  fixture = await setupStudioFixture();
  token = await accessToken(fixture.memberUserId);
});

afterAll(async () => {
  await teardownStudioFixture(fixture);
  await prisma.$disconnect();
});

function latestBatchFor(projectId: string) {
  return latestBatch(
    studioRequest(
      `/api/ad_copy_variation/variations/latest_batch/?project_id=${projectId}`,
      { token }
    )
  );
}

describe('project membership resolves against the tenant schema', () => {
  // The fixture writes core_projectmember into the org schema only, the same
  // way Django does. Reading membership from `public` would 403 here.
  it('allows a member whose membership row lives in the org schema', async () => {
    const response = await latestBatchFor(String(fixture.projectA));

    expect(response.status).toBe(200);
  });

  it('denies a project the user is not a member of', async () => {
    const response = await latestBatchFor(String(fixture.projectB));

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toEqual({
      error: 'You are not a member of this project.',
    });
  });

  it('rejects a missing project_id', async () => {
    const response = await latestBatch(
      studioRequest('/api/ad_copy_variation/variations/latest_batch/', { token })
    );

    expect(response.status).toBe(400);
  });

  it('rejects a project_id that does not exist', async () => {
    const response = await latestBatchFor('999999999');

    expect(response.status).toBe(400);
  });
});

describe('generate requires membership', () => {
  it('denies generating into a project the user is not a member of', async () => {
    const response = await generate(
      studioRequest('/api/ad_copy_variation/variations/generate/', {
        token,
        body: {
          project_id: String(fixture.projectB),
          source_mode: 'custom',
          count: 1,
          base_copy: { hook: 'h', headline: 'H', description: 'd', cta: 'LEARN_MORE' },
        },
      })
    );

    expect(response.status).toBe(403);
  });
});

describe('single variation access', () => {
  it('returns a variation from a project the user belongs to', async () => {
    const response = await getVariation(
      studioRequest(`/api/ad_copy_variation/variations/${fixture.draftA}/`, { token }),
      { params: { id: String(fixture.draftA) } }
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      id: Number(fixture.draftA),
      project: Number(fixture.projectA),
    });
  });

  it('denies a variation belonging to another project', async () => {
    const response = await getVariation(
      studioRequest(`/api/ad_copy_variation/variations/${fixture.draftB}/`, { token }),
      { params: { id: String(fixture.draftB) } }
    );

    expect(response.status).toBe(403);
  });

  it('returns 404 for an unknown variation', async () => {
    const response = await getVariation(
      studioRequest('/api/ad_copy_variation/variations/999999999/', { token }),
      { params: { id: '999999999' } }
    );

    expect(response.status).toBe(404);
  });
});
