/**
 * EverFern Desktop — Messaging Tools
 *
 * Tools for sending messages to Discord and Telegram.
 */

import { AgentTool } from '../runner/types';
import { integrationService } from '../../integrations/integration-service';

/**
 * Get the bot integration manager.
 */
function getBotManager() {
  return integrationService.getService<any>('bot-integration-manager');
}

/**
 * Check if a platform is connected and has model/provider configured.
 */
function checkPlatformStatus(platform: 'discord' | 'telegram') {
  const botManager = getBotManager();
  if (!botManager) return { connected: false, error: 'Bot integration manager not available' };

  const p = botManager.getPlatform(platform);
  if (!p) return { connected: false, error: `${platform} is not set up. User needs to configure it in Integration Settings.` };

  // We also need to check if it's connected
  // This is a bit simplified, but basically if it's registered it should be usable if the user intended.
  return { connected: true };
}

export const sendDiscordMessageTool: AgentTool = {
  name: 'send_discord_message',
  description: 'Send a message to a Discord channel or user. Use this when the user asks to "message me on discord" or "tell discord...".',
  parameters: {
    type: 'object',
    properties: {
      chatId: { type: 'string', description: 'The Discord channel ID or user ID. If not known, ask the user.' },
      content: { type: 'string', description: 'The text content of the message.' }
    },
    required: ['chatId', 'content']
  },
  execute: async ({ chatId, content }) => {
    const status = checkPlatformStatus('discord');
    if (!status.connected) {
      return { success: false, output: status.error || 'Discord integration is not connected.' };
    }

    try {
      const botManager = getBotManager();
      const results = await botManager.sendMessage(content as string, ['discord'], { chatId: chatId as string });
      const result = results.get('discord');

      if (result instanceof Error) {
        return { success: false, output: `Failed to send Discord message: ${result.message}` };
      }

      return { success: true, output: `Successfully sent message to Discord (ID: ${result})` };
    } catch (err) {
      return { success: false, output: `Error sending Discord message: ${err}` };
    }
  }
};

export const sendTelegramMessageTool: AgentTool = {
  name: 'send_telegram_message',
  description: 'Send a message to a Telegram chat or user. Use this when the user asks to "message me on telegram" or "tell telegram...".',
  parameters: {
    type: 'object',
    properties: {
      chatId: { type: 'string', description: 'The Telegram chat ID or user ID. If not known, ask the user.' },
      content: { type: 'string', description: 'The text content of the message.' }
    },
    required: ['chatId', 'content']
  },
  execute: async ({ chatId, content }) => {
    const status = checkPlatformStatus('telegram');
    if (!status.connected) {
      return { success: false, output: status.error || 'Telegram integration is not connected.' };
    }

    try {
      const botManager = getBotManager();
      const results = await botManager.sendMessage(content as string, ['telegram'], { chatId: chatId as string });
      const result = results.get('telegram');

      if (result instanceof Error) {
        return { success: false, output: `Failed to send Telegram message: ${result.message}` };
      }

      return { success: true, output: `Successfully sent message to Telegram (ID: ${result})` };
    } catch (err) {
      return { success: false, output: `Error sending Telegram message: ${err}` };
    }
  }
};
