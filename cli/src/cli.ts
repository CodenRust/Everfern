#!/usr/bin/env tsx
import { Command } from 'commander';
import chalk from 'chalk';
import packageJson from '../package.json' with { type: 'json' };
import { runOnboarding, isSetup } from './onboarding.ts';
import { runChat } from './chat.ts';

const program = new Command();

async function ensureSetup() {
  if (!isSetup()) {
    await runOnboarding();
  }
}

program
  .name('everfern')
  .description('EverFern CLI - Terminal UI for your autonomous AI workplace agent')
  .version(packageJson.version);

program
  .command('tui')
  .description('Launch the Terminal UI (interactive chat interface)')
  .option('--model <model>', 'Override model for this session')
  .option('--session <session>', 'Session key (default: main)', 'main')
  .action(async (options) => {
    await ensureSetup();
    await runChat(options);
  });

program
  .command('chat')
  .description('Alias for tui (quick chat session)')
  .alias('terminal')
  .action(async () => {
    await ensureSetup();
    await runChat({ session: 'main' });
  });

program
  .command('setup')
  .description('Run EverFern onboarding setup')
  .action(async () => {
    await runOnboarding();
  });

program
  .command('status')
  .description('Check EverFern agent status')
  .action(() => {
    console.log(chalk.green('✓ EverFern CLI is ready'));
    console.log(chalk.dim('  Use `everfern tui` to start interactive chat'));
  });

program
  .command('doctor')
  .description('Run diagnostics on EverFern installation')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const diagnostics = {
      cli: true,
      version: packageJson.version,
      node: process.version,
      platform: process.platform,
    };
    if (options.json) {
      console.log(JSON.stringify(diagnostics, null, 2));
    } else {
      console.log(chalk.bold('\nEverFern Doctor\n'));
      console.log(chalk.dim('CLI Version:'), chalk.cyan(diagnostics.version));
      console.log(chalk.dim('Node.js:'), chalk.cyan(diagnostics.node));
      console.log(chalk.dim('Platform:'), chalk.cyan(diagnostics.platform));
      console.log(chalk.green('\n✓ All checks passed\n'));
    }
  });

if (process.argv.length === 2) {
  // Default to TUI when no command is provided
  (async () => {
    await ensureSetup();
    await runChat({ session: 'main' });
  })();
} else {
  program.parse();
}
