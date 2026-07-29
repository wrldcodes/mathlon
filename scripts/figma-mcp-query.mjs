import http from 'http';

const MCP_URL = 'http://127.0.0.1:3845';

function sseConnect() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${MCP_URL}/sse`, { headers: { Accept: 'text/event-stream' } }, (res) => {
      let buffer = '';
      let sessionId = null;
      const responses = {};
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('event: endpoint')) continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            // Session endpoint
            if (data.startsWith('/messages?sessionId=')) {
              sessionId = data.split('sessionId=')[1];
              resolve({ sessionId, req, res, responses });
              return;
            }
            
            // JSON-RPC response
            try {
              const parsed = JSON.parse(data);
              if (parsed.id && responses[parsed.id]) {
                responses[parsed.id](parsed);
              }
            } catch {}
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
      res.on('end', () => resolve({ status: res.status || res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const { sessionId, res: sseRes } = await sseConnect();
  console.log(`Connected. Session: ${sessionId}`);

  // Initialize
  const initPromise = waitForResponse(sseRes, 1);
  await sendMessage(sessionId, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'opencode', version: '1.0' },
  }, 1);
  const initResp = await initPromise;
  console.log('Initialize:', JSON.stringify(initResp, null, 2));

  // Send initialized notification
  await sendMessage(sessionId, 'notifications/initialized', {}, 0);

  // List tools
  const toolsPromise = waitForResponse(sseRes, 2);
  await sendMessage(sessionId, 'tools/list', {}, 2);
  const toolsResp = await toolsPromise;
  console.log('Tools:', JSON.stringify(toolsResp, null, 2));

  sseRes.destroy();
  process.exit(0);
}

function waitForResponse(sseRes, expectedId) {
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
    setTimeout(() => { sseRes.removeListener('data', handler); resolve(null); }, 5000);
  });
}

main().catch(console.error);
