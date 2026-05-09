/**
 * IDE Mode - VS Code-like interface integrated in chat
 * AI can "cook" (write code) directly in this pane
 */

import { useState } from 'react';

interface IDEModeProps {
  visible?: boolean;
  onClose?: () => void;
}

export default function IDEMode({ visible, onClose }: IDEModeProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'editor' | 'terminal'>('files');
  const [selectedFile, setSelectedFile] = useState('src/App.tsx');

  const files = ['App.tsx', 'main.tsx', 'index.html', 'package.json', 'vite.config.ts'];

  if (!visible) return null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>⚙</span>
        <span style={styles.title}>Coding Mode</span>
        {onClose && (
          <button onClick={onClose} style={styles.closeBtn}>✕ Close</button>
        )}
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* File Explorer */}
        {activeTab === 'files' && (
          <div style={styles.sidebar}>
            <div style={styles.sidebarTitle}>EXPLORER</div>
            {files.map((f: string) => (
              <div
                key={f}
                onClick={() => { setSelectedFile(f); setActiveTab('editor'); }}
                style={fileStyle(f === selectedFile)}
              >
                <span>⚛</span> {f}
              </div>
            ))}
          </div>
        )}

        {/* Editor */}
        {activeTab === 'editor' && (
          <div style={styles.editor}>
            <div style={styles.fileTab}>⚛ {selectedFile}</div>
            <pre style={styles.code}>
              {`import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <h1>EverFern App</h1>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}`.split('\n').map((line: string, i: number) => (
                <div key={i} style={styles.codeLine}>
                  <span style={styles.lineNum}>{i + 1}</span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        )}

        {/* Terminal */}
        {activeTab === 'terminal' && (
          <div style={styles.terminal}>
            <div style={styles.termLine}><span style={styles.prompt}>$</span> npm install</div>
            <div style={styles.termLine}>added 124 packages</div>
            <div style={styles.termLine}><span style={styles.prompt}>$</span> npm run dev</div>
            <div style={styles.termLine}>Ready on http://localhost:5173</div>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        <button onClick={() => setActiveTab('files')} style={tabBtnStyle(activeTab === 'files')}>📂 Files</button>
        <button onClick={() => setActiveTab('editor')} style={tabBtnStyle(activeTab === 'editor')}>⚛ Editor</button>
        <button onClick={() => setActiveTab('terminal')} style={tabBtnStyle(activeTab === 'terminal')}>💻 Terminal</button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    fontSize: '13px',
    height: '500px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3e3e42',
  },
  logo: { fontSize: '11px', color: '#858587', marginRight: '8px' },
  title: { fontSize: '12px', fontWeight: 500 },
  closeBtn: {
    marginLeft: 'auto',
    padding: '4px 8px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#3e3e42',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '11px',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '200px',
    borderRight: '1px solid #3e3e42',
    padding: '8px',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '10px',
    color: '#858587',
    marginBottom: '8px',
    textTransform: 'uppercase' as any,
  },
  editor: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  fileTab: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3e3e42',
    fontSize: '12px',
  },
  code: { flex: 1, margin: 0, padding: '12px', overflow: 'auto', backgroundColor: '#1e1e1e' },
  codeLine: { display: 'flex' },
  lineNum: { color: '#858587', marginRight: '12px', userSelect: 'none' as any },
  terminal: {
    flex: 1, padding: '12px',
    backgroundColor: '#1e1e1e',
    overflowY: 'auto',
    fontFamily: "'Cascadia Code', monospace",
  },
  termLine: { marginBottom: '2px' },
  prompt: { color: '#6a9955', marginRight: '6px' },
  tabBar: {
    display: 'flex',
    gap: '2px',
    padding: '8px 12px',
    backgroundColor: '#2d2d2d',
    borderTop: '1px solid #3e3e42',
  },
};

function fileStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '4px 8px',
    cursor: 'pointer',
    backgroundColor: selected ? '#37373d' : 'transparent',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: active ? '#3e3e42' : 'transparent',
    color: active ? '#fff' : '#858587',
    cursor: 'pointer',
    fontSize: '11px',
    textTransform: 'capitalize' as any,
  };
}
