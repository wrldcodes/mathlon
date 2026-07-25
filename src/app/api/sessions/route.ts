import { NextResponse } from 'next/server';
import { createSession, listSessionsForUser, resolveUserId } from '@/lib/sessions/repository';
import type { CreateSessionInput, SessionEntryMode } from '@/lib/sessions/types';

export const runtime = 'nodejs';

function isEntryMode(value: unknown): value is SessionEntryMode {
  return value === 'text-first' || value === 'mic-first';
}

export async function GET() {
  try {
    const sessions = await listSessionsForUser(resolveUserId());
    return NextResponse.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list sessions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const session = await createSession({
      title: title || 'New session',
      prompt: typeof body.prompt === 'string' ? body.prompt : '',
      entryMode: body.entryMode,
      demo: Boolean(body.demo),
      userId: typeof body.userId === 'string' ? body.userId : undefined,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
