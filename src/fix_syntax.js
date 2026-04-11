const fs = require('fs');
let content = fs.readFileSync('app/chat/page.tsx', 'utf8');

// Fix the corrupted border radiuses
content = content.replace(/borderRadius:\s*0%"?/g, 'borderRadius: 0');
content = content.replace(/borderRadius:\s*"0%"?/g, 'borderRadius: 0');

fs.writeFileSync('app/chat/page.tsx', content, 'utf8');
