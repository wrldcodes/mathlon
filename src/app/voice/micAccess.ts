export type MicAccessState = 'unsupported' | 'unknown' | 'prompt' | 'granted' | 'denied';

export async function queryMicAccessState(): Promise<MicAccessState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    if (result.state === 'granted') return 'granted';
    if (result.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

/** Request mic access. Stops tracks immediately — permission persists for the real session. */
export async function requestMicAccess(): Promise<{ ok: boolean; state: MicAccessState }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, state: 'unsupported' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return { ok: true, state: 'granted' };
  } catch {
    return { ok: false, state: await queryMicAccessState() };
  }
}
