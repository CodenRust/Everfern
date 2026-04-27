import { registerSystemHandlers } from './system';
import { registerAgentHandlers } from './agent';
import { registerHistoryHandlers } from './history';
import { registerStoreHandlers } from './store-handlers';
import { registerToolSettingsHandlers } from './tool-settings-handlers';
import { registerBrowserUseHandlers } from './browser-use';
import { registerChatTitleHandler } from '../lib/chat-title-generator';
import { ChatHistoryStore } from '../store/history';

export function setupIPC(historyStore: ChatHistoryStore) {
  registerSystemHandlers();
  registerAgentHandlers();
  registerHistoryHandlers(historyStore);
  registerStoreHandlers();
  registerToolSettingsHandlers();
  registerBrowserUseHandlers();
  registerChatTitleHandler();
}
