const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');

console.log('Electron path:', electronPath);

const proc = spawn(electronPath, ['.', '--no-sandbox', '--enable-logging'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

proc.on('close', (code) => {
  console.log('Electron exited with code:', code);
});