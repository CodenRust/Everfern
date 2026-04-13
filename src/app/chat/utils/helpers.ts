// ── Utilities ────────────────────────────────────────────────────────────────

function stripAnsi(str: string) {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function extractFileArtifacts(content: string) {
    if (!content) return { cleanContent: '', artifacts: [] };
    const artifactRegex = /📄 \*\*([^*]+)\*\*\n\s*Path: `([^`]+)`/g;
    const artifacts: { description: string, path: string }[] = [];
    let match;
    while ((match = artifactRegex.exec(content)) !== null) {
        artifacts.push({ description: match[1], path: match[2] });
    }

    let cleanContent = content;
    if (artifacts.length > 0) {
        // Remove entire block if it matches "Files presented to the user:" up to "Task complete."
        const blockRegex = /Files presented to the user:\n\n(?:📄 \*\*[\s\S]*?\*\*\n\s*Path: `[^`]+`\n\n?)+\n*Task complete\./g;
        const replaced = cleanContent.replace(blockRegex, '');
        if (replaced !== cleanContent) {
            cleanContent = replaced;
        } else {
            // Fallback: remove lines one by one
            cleanContent = cleanContent.replace(/Files presented to the user:\n\n/g, '');
            cleanContent = cleanContent.replace(artifactRegex, '');
            cleanContent = cleanContent.replace(/Task complete\./g, '');
        }
    }
    return { cleanContent: cleanContent.trim(), artifacts };
}

export { stripAnsi, extractFileArtifacts };
