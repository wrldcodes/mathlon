import { ObjectId, type Collection, type WithId } from 'mongodb';
import { getDb } from '../db/mongodb';
import { getDemoDurationSeconds } from './demo';
import type {
  CreateSessionInput,
  PersistedCanvasState,
  SessionEntryMode,
  SessionStatus,
  TeachingSession,
  UpdateSessionInput,
} from './types';

type SessionDoc = {
  userId: string;
  title: string;
  prompt: string;
  entryMode: SessionEntryMode;
  status: SessionStatus;
  demo: boolean;
  demoExpiresAt?: Date;
  providerConversationId?: string;
  canvasState?: PersistedCanvasState;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
};

const COLLECTION = 'sessions';

async function sessions(): Promise<Collection<SessionDoc>> {
  const db = await getDb();
  return db.collection<SessionDoc>(COLLECTION);
}

function toSession(doc: WithId<SessionDoc>): TeachingSession {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId,
    title: doc.title,
    prompt: doc.prompt,
    entryMode: doc.entryMode,
    status: doc.status,
    demo: doc.demo,
    demoExpiresAt: doc.demoExpiresAt?.toISOString(),
    providerConversationId: doc.providerConversationId,
    canvasState: doc.canvasState,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    endedAt: doc.endedAt?.toISOString(),
  };
}

/** Until auth lands, sessions are scoped to this placeholder user. */
export function resolveUserId(explicit?: string): string {
  return (
    explicit?.trim() ||
    process.env.MATHLON_DEV_USER_ID?.trim() ||
    'dev-user'
  );
}

export async function createSession(input: CreateSessionInput): Promise<TeachingSession> {
  const now = new Date();
  const prompt = (input.prompt ?? '').trim();
  const entryMode: SessionEntryMode =
    input.entryMode ?? (prompt ? 'text-first' : 'mic-first');
  const title = input.title.trim() || (prompt ? prompt.slice(0, 42) : 'New session');
  const isDemo = Boolean(input.demo);

  const doc: SessionDoc = {
    userId: resolveUserId(input.userId),
    title,
    prompt,
    entryMode,
    status: 'created',
    demo: isDemo,
    // Anchored once, here, server-side — never extended on resume/reload.
    demoExpiresAt: isDemo
      ? new Date(now.getTime() + getDemoDurationSeconds() * 1000)
      : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const col = await sessions();
  const result = await col.insertOne(doc);
  return toSession({ ...doc, _id: result.insertedId });
}

export async function getSessionById(sessionId: string): Promise<TeachingSession | null> {
  if (!ObjectId.isValid(sessionId)) return null;
  const col = await sessions();
  const doc = await col.findOne({ _id: new ObjectId(sessionId) });
  return doc ? toSession(doc) : null;
}

export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput,
): Promise<TeachingSession | null> {
  if (!ObjectId.isValid(sessionId)) return null;

  const now = new Date();
  const $set: Partial<SessionDoc> = { updatedAt: now };
  const $unset: Record<string, ''> = {};

  if (input.title !== undefined) $set.title = input.title.trim() || 'New session';
  if (input.providerConversationId !== undefined) {
    $set.providerConversationId = input.providerConversationId;
  }
  if (input.status !== undefined) {
    $set.status = input.status;
    if (input.status === 'ended') $set.endedAt = now;
  }
  if (input.canvasState === null) {
    $unset.canvasState = '';
  } else if (input.canvasState !== undefined) {
    $set.canvasState = {
      ...input.canvasState,
      version: 1,
      updatedAt: now.toISOString(),
    };
  }

  const col = await sessions();
  const update: { $set: Partial<SessionDoc>; $unset?: Record<string, ''> } = { $set };
  if (Object.keys($unset).length > 0) update.$unset = $unset;

  const doc = await col.findOneAndUpdate(
    { _id: new ObjectId(sessionId) },
    update,
    { returnDocument: 'after' },
  );

  return doc ? toSession(doc) : null;
}

export async function listSessionsForUser(userId: string, limit = 50): Promise<TeachingSession[]> {
  const col = await sessions();
  const docs = await col
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toSession);
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  if (!ObjectId.isValid(sessionId)) return false;
  const col = await sessions();
  const result = await col.deleteOne({ _id: new ObjectId(sessionId) });
  return result.deletedCount === 1;
}
