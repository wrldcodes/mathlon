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

type SessionRecord = SessionDoc & { _id: ObjectId };

const COLLECTION = 'sessions';
const useMemoryStore = !process.env.MONGODB_URI;
const memorySessions = new Map<string, SessionRecord>();

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

async function readSessionRecords(): Promise<SessionRecord[]> {
  if (useMemoryStore) {
    return [...memorySessions.values()];
  }

  const col = await sessions();
  return (await col.find().toArray()) as SessionRecord[];
}

async function readSessionRecord(sessionId: string, userId?: string): Promise<SessionRecord | null> {
  if (useMemoryStore) {
    const record = memorySessions.get(sessionId);
    if (!record) return null;
    if (userId && record.userId !== userId) return null;
    return record;
  }

  if (!ObjectId.isValid(sessionId)) return null;
  const col = await sessions();
  const filter: { _id: ObjectId; userId?: string } = { _id: new ObjectId(sessionId) };
  if (userId) filter.userId = userId;
  return (await col.findOne(filter)) as SessionRecord | null;
}

async function writeSessionRecord(doc: SessionDoc): Promise<SessionRecord> {
  if (useMemoryStore) {
    const record: SessionRecord = { ...doc, _id: new ObjectId() };
    memorySessions.set(record._id.toHexString(), record);
    return record;
  }

  const col = await sessions();
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

/**
 * Until real auth lands, callers must pass the browser anonymous user id
 * (from the X-Mathlon-User-Id header). No shared env fallback — that made
 * every teammate share one session list.
 */
export function requireUserId(userId: string | null | undefined): string {
  const id = userId?.trim() ?? '';
  if (!id) {
    throw new Error('Missing browser user id. Refresh the page and try again.');
  }
  return id;
}

export async function createSession(input: CreateSessionInput): Promise<TeachingSession> {
  const now = new Date();
  const prompt = (input.prompt ?? '').trim();
  const entryMode: SessionEntryMode = input.entryMode ?? (prompt ? 'text-first' : 'mic-first');
  const title = input.title.trim() || (prompt ? prompt.slice(0, 42) : 'New session');
  const isDemo = Boolean(input.demo);

  const record = await writeSessionRecord({
    userId: requireUserId(input.userId),
    title,
    prompt,
    entryMode,
    status: 'created',
    demo: isDemo,
    demoExpiresAt: isDemo ? new Date(now.getTime() + getDemoDurationSeconds() * 1000) : undefined,
    createdAt: now,
    updatedAt: now,
  });

  return toSession(record);
}

export async function getSessionById(
  sessionId: string,
  userId?: string,
): Promise<TeachingSession | null> {
  const record = await readSessionRecord(sessionId, userId);
  return record ? toSession(record) : null;
}

export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput,
  userId?: string,
): Promise<TeachingSession | null> {
  const current = await readSessionRecord(sessionId, userId);
  if (!current) return null;

  const now = new Date();
  const next: SessionRecord = {
    ...current,
    updatedAt: now,
  };

  if (input.title !== undefined) next.title = input.title.trim() || 'New session';
  if (input.providerConversationId !== undefined) {
    next.providerConversationId = input.providerConversationId;
  }
  if (input.status !== undefined) {
    next.status = input.status;
    if (input.status === 'ended') next.endedAt = now;
  }
  if (input.canvasState === null) {
    delete next.canvasState;
  } else if (input.canvasState !== undefined) {
    next.canvasState = {
      ...input.canvasState,
      version: 1,
      updatedAt: now.toISOString(),
    };
  }

  if (useMemoryStore) {
    memorySessions.set(next._id.toHexString(), next);
    return toSession(next);
  }

  const { _id, ...doc } = next;
  const col = await sessions();
  await col.replaceOne({ _id }, doc);
  return toSession(next);
}

export async function listSessionsForUser(userId: string, limit = 50): Promise<TeachingSession[]> {
  const docs = await readSessionRecords();
  return docs
    .filter((doc) => doc.userId === requireUserId(userId))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)
    .map(toSession);
}

export async function deleteSession(sessionId: string, userId?: string): Promise<boolean> {
  if (useMemoryStore) {
    const record = memorySessions.get(sessionId);
    if (!record) return false;
    if (userId && record.userId !== userId) return false;
    return memorySessions.delete(sessionId);
  }

  if (!ObjectId.isValid(sessionId)) return false;
  const col = await sessions();
  const filter: { _id: ObjectId; userId?: string } = { _id: new ObjectId(sessionId) };
  if (userId) filter.userId = userId;
  const result = await col.deleteOne(filter);
  return result.deletedCount === 1;
}
