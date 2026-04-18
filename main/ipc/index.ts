import { registerSystemHandlers } from './system';
import { registerAgentHandlers } from './agent';
import { registerHistoryHandlers } from './history';
import { registerStoreHandlers } from './store-handlers';
import { ChatHistoryStore } from '../store/history';

export function setupIPC(historyStore: ChatHistoryStore) {
  registerSystemHandlers();
  registerAgentHandlers();
  registerHistoryHandlers(historyStore);
  registerStoreHandlers();
}
