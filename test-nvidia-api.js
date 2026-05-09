const https = require('https');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(process.env.USERPROFILE || '', '.everfern', 'keys', 'nvidia.key');
const apiKey = fs.readFileSync(keyPath, 'utf8').trim();

console.log('[Test] Testing NVIDIA NIM API with Mistral Small...');
console.log(`[Test] API Key length: ${apiKey.length}`);

const data = JSON.stringify({
  model: 'mistralai/mistral-small-4-119b-2603',
  messages: [{ role: 'user', content: 'Say hello in 5 words or less' }],
  temperature: 0.3,
  max_tokens: 50
});

const options = {
  hostname: 'integrate.api.nvidia.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('[Test] Status:', res.statusCode);
    try {
      const parsed = JSON.parse(body);
      if (parsed.choices && parsed.choices[0]) {
        console.log('[Test] ✅ SUCCESS! Response:', parsed.choices[0].message?.content);
        console.log('[Test] Model used:', parsed.model);
      } else {
        console.log('[Test] Response:', body.slice(0, 300));
      }
    } catch (e) {
      console.log('[Test] Raw response:', body.slice(0, 300));
    }
  });
});

req.on('error', (err) => {
  console.error('[Test] Error:', err.message);
  process.exit(1);
});

req.write(data);
req.end();
