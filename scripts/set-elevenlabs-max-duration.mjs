/**
 * Set ElevenLabs agent max conversation duration (dashboard often hides this).
 *
 * Usage:
 *   node scripts/set-elevenlabs-max-duration.mjs
 *   node scripts/set-elevenlabs-max-duration.mjs 2700
 *
 * Requires in .env.local:
 *   ELEVENLABS_API_KEY=...
 *   NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_...
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env) || !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    console.error('Could not read .env.local — create it or export env vars.');
    process.exit(1);
  }
}

loadEnvLocal();

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID?.trim();
const seconds = Number(process.argv[2] ?? process.env.ELEVENLABS_MAX_DURATION_SECONDS ?? 1800);

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY in .env.local');
  console.error('Get one from: https://elevenlabs.io/app/settings/api-keys');
  process.exit(1);
}
if (!agentId) {
  console.error('Missing NEXT_PUBLIC_ELEVENLABS_AGENT_ID in .env.local');
  process.exit(1);
}
if (!Number.isFinite(seconds) || seconds < 60 || seconds > 43200) {
  console.error('Duration must be between 60 and 43200 seconds. Got:', seconds);
  process.exit(1);
}

const body = {
  conversation_config: {
    conversation: {
      max_duration_seconds: Math.round(seconds),
      max_conversation_duration_message:
        "We've reached our session time limit. Let's wrap up this step, then you can start a new session to continue.",
    },
  },
};

const url = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;
const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = null;
}

if (!res.ok) {
  console.error(`Failed (${res.status}):`, json ?? text);
  process.exit(1);
}

const applied =
  json?.conversation_config?.conversation?.max_duration_seconds ??
  '(field not echoed — check agent in dashboard / GET agent)';

console.log(`Updated agent ${agentId}`);
console.log(`max_duration_seconds → ${Math.round(seconds)} (${(seconds / 60).toFixed(0)} min)`);
console.log(`API reports: ${applied}`);
