import { NextResponse } from 'next/server';

import { isAuthFailure, requireAccessUser } from '@/lib/auth';
import {
  jsonError,
  projectIdParam,
  readJsonBody,
  responseFromUnknown,
} from '@/lib/bulk';
import { runCustomGenerate } from '@/lib/generate';
import { requireProjectForUser } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAccessUser(request);
  if (isAuthFailure(auth)) {
    return NextResponse.json({ detail: auth.error }, { status: auth.status });
  }

  const json = await readJsonBody(request);
  if (!json.ok) return json.response;

  const project = await requireProjectForUser(
    auth.userId,
    projectIdParam(json.body.project_id)
  );
  if (!project.ok) {
    return jsonError(project.error, project.status);
  }

  try {
    const payload = await runCustomGenerate({
      userId: auth.userId,
      projectId: project.projectId,
      body: json.body,
    });
    const status = payload.count_succeeded === 0 ? 502 : 200;
    return NextResponse.json(payload, { status });
  } catch (err) {
    return responseFromUnknown(err);
  }
}
