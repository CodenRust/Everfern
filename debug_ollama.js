const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || '';
const commonPaths = [
  path.join(userProfile, 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
  'C:\\Program Files\\Ollama\\ollama.exe',
];

console.log('Checking PATH...');
try {
  const v = execSync('ollama -v', { encoding: 'utf8' });
  console.log('Ollama -v output:', v);
} catch (e) {
  console.log('Ollama not in PATH.');
}

console.log('Checking physical paths...');
commonPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`FOUND at ${p}`);
    try {
      const v = execSync(`"${p}" -v`, { encoding: 'utf8' });
      console.log(`Output from ${p}:`, v);
    } catch (err) {
      console.log(`Failed to run from ${p}:`, err.message);
    }
  } else {
    console.log(`Not found at ${p}`);
  }
});
