const fs = require('fs');
const filesToUpdate = [
    'app/chat/page.tsx',
    'app/components/Sidebar.tsx',
    'app/components/WindowControls.tsx',
    'app/globals.css'
];

filesToUpdate.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Fix border radius syntax errors
    content = content.replace(/borderRadius:\s*["']?\d+%?["']?/g, 'borderRadius: 0');
    content = content.replace(/borderRadius:\s*0["']/g, 'borderRadius: 0');
    content = content.replace(/borderRadius:\s*0%["']/g, 'borderRadius: 0');
    content = content.replace(/borderRadius:\s*0px/g, 'borderRadius: 0');

    // Fix broken RGBA values in background or color
    content = content.replace(/rgba\(255,\s*255,\s*255(?=[^\d])/g, 'rgba(255, 255, 255');

    fs.writeFileSync(file, content, 'utf8');
});
console.log('Fixed syntax errors in all files');
