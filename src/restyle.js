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

    // Remove border radiuses
    content = content.replace(/borderRadius:\s*["']?\d+p?x?["']?/g, 'borderRadius: 0');
    content = content.replace(/rounded-\[([a-zA-Z0-9_.]*)\]/g, 'rounded-none');
    content = content.replace(/rounded-[a-z0-9]+/g, 'rounded-none');
    content = content.replace(/border-radius:\s*[0-9]+px/g, 'border-radius: 0px');

    // Remove shadows
    content = content.replace(/boxShadow:\s*["'].+?["']/g, 'boxShadow: "none"');
    content = content.replace(/box-shadow:\s*.+?;/g, 'box-shadow: none;');

    // Change background colors to match Obsidian Pulse Mono
    content = content.replace(/#171615/g, '#141312');
    content = content.replace(/#1E1D1B/gi, '#0a0a09');
    content = content.replace(/#1c1c1e/gi, '#141312');
    content = content.replace(/#1a1917/gi, '#141312');
    content = content.replace(/#18181b/gi, '#0a0a09');
    
    // Indigo/Purple to white/grey
    content = content.replace(/rgba\(129,\s*140,\s*248/g, 'rgba(255, 255, 255');
    content = content.replace(/rgba\(99,\s*102,\s*241/g, 'rgba(255, 255, 255');
    content = content.replace(/#818cf8/gi, '#e5e5e5');
    content = content.replace(/#6366f1/gi, '#e5e5e5');
    content = content.replace(/#3b82f6/gi, '#d4d4d8');
    content = content.replace(/#ef4444/gi, '#e5e5e5'); // Red to grey in agent matrix
    content = content.replace(/#a5b4fc/gi, '#e5e5e5'); 
    content = content.replace(/#34d399/gi, '#e5e5e5'); 
    
    // Linear gradients
    content = content.replace(/linear-gradient\(.+?\)/g, '#e5e5e5');

    // Specific text colors in permission modal
    content = content.replace(/bg-blue-500\/10/g, 'bg-white/5');
    content = content.replace(/bg-orange-500\/10/g, 'bg-white/5');
    content = content.replace(/bg-purple-500\/10/g, 'bg-white/5');
    content = content.replace(/text-blue-400/g, 'text-zinc-400');
    content = content.replace(/text-orange-400/g, 'text-zinc-400');
    content = content.replace(/text-purple-400/g, 'text-zinc-400');

    fs.writeFileSync(file, content, 'utf8');
});
console.log('Restyling complete.');
