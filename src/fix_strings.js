const fs = require('fs');
const file = 'app/chat/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix border radius syntax errors
content = content.replace(/borderRadius:\s*["']?\d+%?["']?/g, 'borderRadius: 0');
content = content.replace(/borderRadius:\s*0["']/g, 'borderRadius: 0');
content = content.replace(/borderRadius:\s*0%["']/g, 'borderRadius: 0');
content = content.replace(/borderRadius:\s*0px/g, 'borderRadius: 0');

// Fix broken RGBA values in background or color
// If it replaced rgba(129, 140, 248, 0.2) with rgba(255, 255, 255, 0.2)
content = content.replace(/rgba\(255,\s*255,\s*255(?=[^\d])/g, 'rgba(255, 255, 255');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax errors');
