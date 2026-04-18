// ── Utilities ────────────────────────────────────────────────────────────────

function stripAnsi(str: string) {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function extractFileArtifacts(content: string) {
    if (!content) return { cleanContent: '', artifacts: [] };
    
    const artifacts: { description: string, path: string }[] = [];
    
    // 1. Match standard file presentation output
    const standardRegex = /📄 \*\*([^*]+)\*\*\n\s*Path: `([^`]+)`/g;
    let match;
    while ((match = standardRegex.exec(content)) !== null) {
        artifacts.push({ description: match[1], path: match[2] });
    }

    // 2. Match create_artifact tool output: ✅ Artifact created: **Title**\n📁 Saved to: `path`
    const artifactToolRegex = /✅ Artifact created: \*\*([^*]+)\*\*\n📁 Saved to: `([^`]+)`/g;
    let toolMatch;
    while ((toolMatch = artifactToolRegex.exec(content)) !== null) {
        artifacts.push({ description: toolMatch[1], path: toolMatch[2] });
    }

    let cleanContent = content;
    if (artifacts.length > 0) {
        // Remove blocks for standard presentation
        const blockRegex = /Files presented to the user:\n\n(?:📄 \*\*[\s\S]*?\*\*\n\s*Path: `[^`]+`\n\n?)+\n*Task complete\./g;
        cleanContent = cleanContent.replace(blockRegex, '');
        
        // Remove blocks for create_artifact output
        const toolBlockRegex = /✅ Artifact created: \*\*[\s\S]*?\*\*\n📁 Saved to: `[^`]+`\n🎁 Auto-presented to user\./g;
        cleanContent = cleanContent.replace(toolBlockRegex, '');

        // Final cleanup of remaining tool markers if blocks didn't match perfectly
        cleanContent = cleanContent
            .replace(/Files presented to the user:\n\n/g, '')
            .replace(standardRegex, '')
            .replace(artifactToolRegex, '')
            .replace(/🎁 Auto-presented to user\./g, '')
            .replace(/Task complete\./g, '');
    }
    
    return { cleanContent: cleanContent.trim(), artifacts };
}

export { stripAnsi, extractFileArtifacts };
