/**
 * Basic integration test for artifact editing capability
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactResolver } from '../artifact-resolver';
import { ArtifactParser } from '../artifact-parser';
import { ArtifactEditor } from '../artifact-editor';
import { writeArtifact, readArtifact, deleteArtifact } from '../../../store/artifacts';

describe('Artifact Editing - Basic Integration', () => {
  const testChatId = 'test-session';
  const testFilename = 'test-artifact.html';

  const sampleHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Artifact</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.custom { color: red; }</style>
</head>
<body class="font-['Figtree']">
  <div id="content">Original content</div>
  <script>console.log('test');</script>
</body>
</html>`;

  beforeEach(() => {
    // Create test artifact
    writeArtifact(testChatId, testFilename, sampleHTML);
  });

  afterEach(() => {
    // Clean up test artifact
    deleteArtifact(testChatId, testFilename);
  });

  it('should parse HTML artifact correctly', () => {
    const parser = new ArtifactParser();
    const parsed = parser.parse(sampleHTML);

    expect(parsed.title).toBe('Test Artifact');
    expect(parsed.bodyContent).toContain('Original content');
    expect(parsed.customCSS).toContain('.custom { color: red; }');
    expect(parsed.customJS).toContain("console.log('test');");
  });

  it('should add content to artifact', () => {
    const parser = new ArtifactParser();
    const editor = new ArtifactEditor();

    const parsed = parser.parse(sampleHTML);
    const { parsed: updated, changes } = editor.applyEdits(parsed, {
      addContent: '<div class="new-section">New content</div>'
    });

    expect(updated.bodyContent).toContain('New content');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toContain('Added new content');
  });

  it('should remove elements by selector', () => {
    const parser = new ArtifactParser();
    const editor = new ArtifactEditor();

    const parsed = parser.parse(sampleHTML);
    const { parsed: updated, changes } = editor.applyEdits(parsed, {
      removeSelector: '#content'
    });

    expect(updated.bodyContent).not.toContain('Original content');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toContain('Removed 1 element');
  });

  it('should modify elements by selector', () => {
    const parser = new ArtifactParser();
    const editor = new ArtifactEditor();

    const parsed = parser.parse(sampleHTML);
    const { parsed: updated, changes } = editor.applyEdits(parsed, {
      modifySelector: '#content',
      modifyContent: '<p>Modified content</p>'
    });

    expect(updated.bodyContent).toContain('Modified content');
    expect(updated.bodyContent).not.toContain('Original content');
    expect(changes).toHaveLength(1);
  });

  it('should update custom styles', () => {
    const parser = new ArtifactParser();
    const editor = new ArtifactEditor();

    const parsed = parser.parse(sampleHTML);
    const { parsed: updated, changes } = editor.applyEdits(parsed, {
      updateStyles: '.new-style { background: blue; }'
    });

    expect(updated.customCSS).toContain('.custom { color: red; }');
    expect(updated.customCSS).toContain('.new-style { background: blue; }');
    expect(changes).toHaveLength(1);
  });

  it('should serialize artifact back to HTML', () => {
    const parser = new ArtifactParser();
    const parsed = parser.parse(sampleHTML);
    const serialized = parser.serialize(parsed);

    expect(serialized).toContain('<!DOCTYPE html>');
    expect(serialized).toContain('<title>Test Artifact</title>');
    expect(serialized).toContain('Original content');
  });

  it('should resolve artifact by exact filename', () => {
    const resolver = new ArtifactResolver();
    resolver.setMostRecent(testChatId, testFilename);

    const ref = resolver.resolve(testChatId, undefined, testFilename);
    expect(ref).not.toBeNull();
    expect(ref?.filename).toBe(testFilename);
  });

  it('should resolve most recent artifact', () => {
    const resolver = new ArtifactResolver();
    resolver.setMostRecent(testChatId, testFilename);

    const ref = resolver.resolve(testChatId, 'the');
    expect(ref).not.toBeNull();
    expect(ref?.filename).toBe(testFilename);
  });

  it('should detect template type', () => {
    const chartHTML = `<!DOCTYPE html>
<html>
<head><title>Chart</title></head>
<body>
  <canvas id="myChart"></canvas>
  <script>new Chart(ctx, config);</script>
</body>
</html>`;

    const parser = new ArtifactParser();
    const parsed = parser.parse(chartHTML);
    expect(parsed.template).toBe('chart');
  });
});
