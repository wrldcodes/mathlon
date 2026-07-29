import http from 'http';
import fs from 'fs';
import path from 'path';

const MCP_URL = 'http://127.0.0.1:3845';

function sseConnect() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${MCP_URL}/sse`, { headers: { Accept: 'text/event-stream' } }, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.startsWith('/messages?sessionId=')) {
              resolve({ sessionId: data.split('sessionId=')[1], res });
              return;
            }
          }
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

function sendMessage(sessionId, method, params, id) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const req = http.request(`${MCP_URL}/messages?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function waitForResponse(sseRes, expectedId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let buffer = '';
    const handler = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.id === expectedId) {
              sseRes.removeListener('data', handler);
              resolve(parsed);
              return;
            }
          } catch {}
        }
      }
    };
    sseRes.on('data', handler);
    setTimeout(() => { sseRes.removeListener('data', handler); resolve(null); }, timeoutMs);
  });
}

async function callTool(sseRes, sessionId, toolName, args, callId) {
  const promise = waitForResponse(sseRes, callId, 30000);
  await sendMessage(sessionId, 'tools/call', { name: toolName, arguments: args }, callId);
  return promise;
}

async function main() {
  const nodes = process.argv.slice(2);
  const { sessionId, res: sseRes } = await sseConnect();
  console.error(`Connected. Session: ${sessionId}`);

  // Initialize
  const initPromise = waitForResponse(sseRes, 1, 10000);
  await sendMessage(sessionId, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'opencode', version: '1.0' },
  }, 1);
  await initPromise;
  await sendMessage(sessionId, 'notifications/initialized', {}, 0);

  for (const nodeId of nodes) {
    const safeId = nodeId.replace(':', '-');
    console.error(`\n--- Fetching screenshot for ${nodeId} ---`);
    
    const screenshotResp = await callTool(sseRes, sessionId, 'get_screenshot', { nodeId }, 10);
    if (screenshotResp?.result?.content) {
      for (const item of screenshotResp.result.content) {
        if (item.type === 'image' && item.data) {
          const base64 = item.data.replace(/^data:image\/\w+;base64,/, '');
          const outPath = path.join(process.cwd(), 'scripts', `screenshot-${safeId}.png`);
          fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
          console.error(`Screenshot saved: ${outPath}`);
        } else if (item.type === 'text') {
          process.stdout.write(item.text);
        }
      }
    }
  }

  sseRes.destroy();
  process.exit(0);
}

main().catch(console.error);
