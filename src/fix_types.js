const fs = require('fs');

const fixCasting = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace inline WebkitAppRegion styling by casting the whole style object to any
    content = content.replace(/style=\{\{([^}]+WebkitAppRegion:[^}]+)}\}/g, 'style={{} as any}');
    fs.writeFileSync(filePath, content, 'utf8');
};

fixCasting('app/components/Sidebar.tsx');
fixCasting('app/components/WindowControls.tsx');
