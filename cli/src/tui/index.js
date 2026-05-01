const chalk = require('chalk');
const readline = require('readline');

function runTui(options) {
  console.clear();
  
  // Header
  console.log(chalk.cyan.bold('╔══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + chalk.bold.white('           EverFern TUI v0.1.1           ') + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╠══════════════════════════════════════════╣'));
  console.log(chalk.cyan.bold('║ ') + chalk.dim(`Session: ${options.session || 'main'} • ready`) + chalk.cyan.bold(' ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════╝'));
  console.log('');
  
  // Messages area
  console.log(chalk.white('Welcome to EverFern TUI!'));
  console.log(chalk.dim('The interactive TUI is running. Type messages below.'));
  console.log('');
  console.log(chalk.dim('─────────────────────────────────────────────'));
  console.log('');
  
  // Input area
  console.log(chalk.cyan.bold('╔══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║ ') + chalk.green('❯ ') + chalk.dim('Ready for input...') + chalk.cyan.bold('                    ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════╝'));
  console.log('');
  
  // Footer
  console.log(chalk.dim('Press Ctrl+C to exit'));
  console.log('');
  
  // Set up input handling
  readline.emitKeypressEvents(process.stdin);
  
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', (str, key) => {
    if (key && key.ctrl && key.name === 'c') {
      console.log('\n' + chalk.yellow('Goodbye!'));
      process.exit(0);
    }
  });
  
  // Keep process alive
  setInterval(() => {}, 1000);
}

module.exports = { runTui };
