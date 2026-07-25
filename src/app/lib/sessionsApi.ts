import type {
  CreateSessionInput,
  TeachingSession,
  UpdateSessionInput,
} from '@/lib/sessions/types';

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${response.status})`,
    );
  }
  return data;
}

export async function listTeachingSessions(): Promise<TeachingSession[]> {
  const response = await fetch('/api/sessions', {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await parseJson<{ sessions: TeachingSession[] }>(response);
  return data.sessions;
}

export async function createTeachingSession(
  input: CreateSessionInput,
): Promise<TeachingSession> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ session: TeachingSession }>(response);
  return data.session;
}

export async function fetchTeachingSession(sessionId: string): Promise<TeachingSession> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await parseJson<{ session: TeachingSession }>(response);
  return data.session;
}

export async function updateTeachingSession(
  sessionId: string,
  input: UpdateSessionInput,
): Promise<TeachingSession> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ session: TeachingSession }>(response);
  return data.session;
}

export async function deleteTeachingSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  await parseJson<{ ok: boolean }>(response);
}
