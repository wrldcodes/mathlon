import http from 'http';

const MCP_URL = 'http://127.0.0.1:3845';

function sseConnect() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${MCP_URL}/sse`, { headers: { Accept: 'text/event-stream' } }, (res) => {
      let buffer = '';
      let sessionId = null;
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.startsWith('/messages?sessionId=')) {
              sessionId = data.split('sessionId=')[1];
              resolve({ sessionId, res });
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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
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

async function main() {
  const nodeId = process.argv[2] || '589:1774';
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

  // Send initialized notification
  await sendMessage(sessionId, 'notifications/initialized', {}, 0);

  // Get design context
  console.error(`Fetching design context for node: ${nodeId}...`);
  const designPromise = waitForResponse(sseRes, 2, 30000);
  await sendMessage(sessionId, 'tools/call', {
    name: 'get_design_context',
    arguments: {
      nodeId,
      clientLanguages: 'typescript,tsx,css',
      clientFrameworks: 'nextjs,react,tailwindcss',
      artifactType: 'WEB_PAGE_OR_APP_SCREEN',
      taskType: 'CREATE_ARTIFACT',
    },
  }, 2);
  
  const designResp = await designPromise;
  if (designResp && designResp.result) {
    // Print the full result
    const content = designResp.result.content || designResp.result;
    for (const item of (Array.isArray(content) ? content : [content])) {
      if (item.type === 'text') {
        process.stdout.write(item.text);
      } else if (item.type === 'image') {
        // Save screenshot to file
        const fs = await import('fs');
        const path = await import('path');
        const imgData = item.data || item.dataUrl;
        if (imgData) {
          const base64 = imgData.replace(/^data:image\/\w+;base64,/, '');
          const outPath = path.join(process.cwd(), 'scripts', `screenshot-${nodeId.replace(':', '-')}.png`);
          fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
          console.error(`Screenshot saved to: ${outPath}`);
        }
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    }
  } else {
    console.log('No response or empty response:', JSON.stringify(designResp, null, 2));
  }

  sseRes.destroy();
  process.exit(0);
}

main().catch(console.error);
