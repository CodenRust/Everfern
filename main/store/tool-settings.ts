import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ToolConfig {
  mode: 'local' | 'api';
  headless: boolean;
  apiKey: string;
}

export interface ToolSettingsConfig {
  webSearch: ToolConfig;
  webCrawl: ToolConfig;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettingsConfig = {
  webSearch: { mode: 'local', headless: true, apiKey: '' },
  webCrawl:  { mode: 'local', headless: true, apiKey: '' },
};

const SETTINGS_FILE_PATH = path.join(os.homedir(), '.everfern', 'tool-settings.json');

export class ToolSettingsStore {
  private cache: ToolSettingsConfig;

  constructor() {
    this.cache = this.load();
  }

  private load(): ToolSettingsConfig {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      return { ...DEFAULT_TOOL_SETTINGS };
    }

    try {
      const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
      return JSON.parse(raw) as ToolSettingsConfig;
    } catch (err) {
      console.warn('[ToolSettings] ⚠️ Malformed tool-settings.json — resetting to defaults:', err);
      this.writeFile(DEFAULT_TOOL_SETTINGS);
      return { ...DEFAULT_TOOL_SETTINGS };
    }
  }

  private writeFile(config: ToolSettingsConfig): void {
    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  }

  get(): ToolSettingsConfig {
    return this.cache;
  }

  set(config: ToolSettingsConfig): void {
    this.writeFile(config);
    this.cache = config;
  }
}

export const toolSettingsStore = new ToolSettingsStore();
