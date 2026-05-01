import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CONFIG_DIR = path.join(os.homedir(), '.everfern');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const KEYS_DIR = path.join(CONFIG_DIR, 'keys');

export async function runOnboarding() {
  console.log(chalk.cyan.bold('\nWelcome to EverFern! 🌿'));
  console.log(chalk.dim('Let\'s get you set up with an AI provider.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Choose your AI provider:',
      choices: [
        { name: 'OpenAI (GPT-4o, etc.)', value: 'openai' },
        { name: 'Anthropic (Claude 3.5, etc.)', value: 'anthropic' },
        { name: 'Ollama (Local LLMs)', value: 'ollama' },
        { name: 'DeepSeek', value: 'deepseek' },
        { name: 'Gemini (Google)', value: 'gemini' },
        { name: 'NVIDIA NIM', value: 'nvidia' },
        { name: 'OpenRouter', value: 'openrouter' }
      ]
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your API Key:',
      when: (a: any) => a.provider !== 'ollama' && a.provider !== 'lmstudio',
      validate: (input: string) => input.length > 0 ? true : 'API Key is required'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Default model name (optional):',
      default: (a: any) => {
        const defaults: Record<string, string> = {
          openai: 'gpt-4o',
          anthropic: 'claude-3-5-sonnet-20241022',
          ollama: 'llama3',
          deepseek: 'deepseek-chat',
          gemini: 'gemini-1.5-pro',
          nvidia: 'meta/llama-3.1-8b-instruct',
          openrouter: 'anthropic/claude-3.5-sonnet'
        };
        return defaults[a.provider];
      }
    }
  ]);

  // Ensure directories exist
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });

  const config = {
    provider: answers.provider,
    model: answers.model,
    baseUrl: undefined,
  };

  // Save config
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  // Save API key securely in keys directory
  if (answers.apiKey) {
    const keyPath = path.join(KEYS_DIR, `${answers.provider}.key`);
    fs.writeFileSync(keyPath, answers.apiKey.trim());
    // On Unix, set permissions. On Windows chmod is limited but let's try.
    try { fs.chmodSync(keyPath, 0o600); } catch (e) {}
  }

  console.log(chalk.green.bold('\n✓ Setup complete!'));
  console.log(chalk.dim(`Config saved to ${CONFIG_FILE}\n`));
  
  return config;
}

export function isSetup() {
  return fs.existsSync(CONFIG_FILE);
}
