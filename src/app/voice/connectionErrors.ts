/** Thrown when a voice connection is cancelled (e.g. user hits Cancel on the loader). */
export class ConnectionAbortedError extends Error {
  constructor() {
    super('Connection aborted');
    this.name = 'ConnectionAbortedError';
  }
}

export function isConnectionAborted(err: unknown): boolean {
  return err instanceof ConnectionAbortedError;
}
