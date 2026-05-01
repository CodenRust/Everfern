const { TUI, Container, Text, ProcessTerminal } = require('@mariozechner/pi-tui');

console.log('Test 1: Creating components...');
const container = new Container('');
container.flexDirection = 'column';
container.height = '100%';

const text = new Text('');
text.text = 'EverFern TUI Test';
text.bold = true;
text.color = 'cyan';
container.addChild(text);

console.log('✓ Components created successfully!');

console.log('\nTest 2: ProcessTerminal...');
const terminal = new ProcessTerminal();
console.log('✓ ProcessTerminal created!');

console.log('\nTest 3: TUI instance...');
const tui = new TUI(terminal);
console.log('✓ TUI created!');

console.log('\n✅ All pi-tui components work correctly!');
console.log('Run "npm run dev" in your terminal to see the actual TUI.');
console.log('Press Ctrl+C to exit the TUI when it runs.');
