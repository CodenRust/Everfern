const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'electron.log');
fs.writeFileSync(logFile, '=== Starting Electron ===\n');

const electronPath = require('electron');
const proc = spawn(electronPath, ['.', '--no-sandbox', '--enable-logging'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

proc.stdout.on('data', (data) => {
  fs.appendFileSync(logFile, '[stdout] ' + data.toString());
});

proc.stderr.on('data', (data) => {
  fs.appendFileSync(logFile, '[stderr] ' + data.toString());
});

proc.on('close', (code) => {
  fs.appendFileSync(logFile, '\n=== Electron exited with code: ' + code + ' ===\n');
  console.log('Done, check electron.log');
});

setTimeout(() => {
  fs.appendFileSync(logFile, '\n=== Force quit after 20 seconds ===\n');
  proc.kill();
  process.exit(0);
}, 20000);