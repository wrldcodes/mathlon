import { NextResponse } from 'next/server';
import { userIdFromRequest } from '@/app/lib/browserIdentity';
import { createSession, listSessionsForUser, requireUserId } from '@/lib/sessions/repository';
import type { CreateSessionInput, SessionEntryMode } from '@/lib/sessions/types';

export const runtime = 'nodejs';

function isEntryMode(value: unknown): value is SessionEntryMode {
  return value === 'text-first' || value === 'mic-first';
}

function unauthorized() {
  return NextResponse.json(
    { error: 'Missing or invalid browser user id. Refresh the page and try again.' },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  try {
    const userId = userIdFromRequest(request);
    if (!userId) return unauthorized();

    const sessions = await listSessionsForUser(requireUserId(userId));
    return NextResponse.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list sessions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = userIdFromRequest(request);
    if (!userId) return unauthorized();

    const body = (await request.json()) as Partial<CreateSessionInput>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title && !(typeof body.prompt === 'string' && body.prompt.trim())) {
      return NextResponse.json(
        { error: 'title or prompt is required' },
        { status: 400 },
      );
    }

    if (body.entryMode !== undefined && !isEntryMode(body.entryMode)) {
      return NextResponse.json({ error: 'invalid entryMode' }, { status: 400 });
    }

    // Ignore body.userId — only the browser identity header is trusted.
    const session = await createSession({
      title: title || 'New session',
      prompt: typeof body.prompt === 'string' ? body.prompt : '',
      entryMode: body.entryMode,
      demo: Boolean(body.demo),
      userId,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
