import { NextResponse } from 'next/server';
import { deleteSession, getSessionById, updateSession } from '@/lib/sessions/repository';
import type {
  PersistedCanvasState,
  SessionStatus,
  UpdateSessionInput,
} from '@/lib/sessions/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ sessionId: string }> };

const STATUSES: SessionStatus[] = ['created', 'active', 'paused', 'ended'];

function isStatus(value: unknown): value is SessionStatus {
  return typeof value === 'string' && (STATUSES as string[]).includes(value);
}

function isCanvasState(value: unknown): value is PersistedCanvasState {
  if (!value || typeof value !== 'object') return false;
  const state = value as PersistedCanvasState;
  return state.version === 1 && Array.isArray(state.steps);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = (await request.json()) as Partial<UpdateSessionInput>;

    if (body.status !== undefined && !isStatus(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }

    if (
      body.canvasState !== undefined &&
      body.canvasState !== null &&
      !isCanvasState(body.canvasState)
    ) {
      return NextResponse.json({ error: 'invalid canvasState' }, { status: 400 });
    }

    const patch: UpdateSessionInput = {};
    if (body.status !== undefined) patch.status = body.status;
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.providerConversationId === 'string') {
      patch.providerConversationId = body.providerConversationId;
    }
    if (body.canvasState !== undefined) patch.canvasState = body.canvasState;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
    }

    const session = await updateSession(sessionId, patch);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const deleted = await deleteSession(sessionId);
    if (!deleted) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
