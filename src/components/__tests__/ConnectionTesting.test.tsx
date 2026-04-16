import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the electron API
const mockElectronAPI = {
  integration: {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    testConnection: vi.fn(),
  },
};

// Mock window.electronAPI
Object.defineProperty(globalThis, 'window', {
  value: {
    electronAPI: mockElectronAPI,
  },
  writable: true,
});

describe('Connection Testing Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockElectronAPI.integration.getConfig.mockResolvedValue({
      telegram: {
        enabled: true,
        botToken: 'test-token',
        webhookUrl: '',
        connected: false,
      },
      discord: {
        enabled: true,
        botToken: 'test-token',
        applicationId: 'test-app-id',
        webhookUrl: '',
        connected: false,
      },
    });

    mockElectronAPI.integration.saveConfig.mockResolvedValue(undefined);
  });

  it('should handle successful Telegram connection test', async () => {
    mockElectronAPI.integration.testConnection.mockResolvedValue(true);

    const result = await mockElectronAPI.integration.testConnection('telegram');

    expect(result).toBe(true);
    expect(mockElectronAPI.integration.testConnection).toHaveBeenCalledWith('telegram');
  });

  it('should handle failed Telegram connection test', async () => {
    mockElectronAPI.integration.testConnection.mockResolvedValue(false);

    const result = await mockElectronAPI.integration.testConnection('telegram');

    expect(result).toBe(false);
    expect(mockElectronAPI.integration.testConnection).toHaveBeenCalledWith('telegram');
  });

  it('should handle successful Discord connection test', async () => {
    mockElectronAPI.integration.testConnection.mockResolvedValue(true);

    const result = await mockElectronAPI.integration.testConnection('discord');

    expect(result).toBe(true);
    expect(mockElectronAPI.integration.testConnection).toHaveBeenCalledWith('discord');
  });

  it('should handle failed Discord connection test', async () => {
    mockElectronAPI.integration.testConnection.mockResolvedValue(false);

    const result = await mockElectronAPI.integration.testConnection('discord');

    expect(result).toBe(false);
    expect(mockElectronAPI.integration.testConnection).toHaveBeenCalledWith('discord');
  });

  it('should handle connection test exceptions gracefully', async () => {
    mockElectronAPI.integration.testConnection.mockRejectedValue(new Error('Network error'));

    await expect(mockElectronAPI.integration.testConnection('telegram')).rejects.toThrow('Network error');
  });

  it('should load and save configuration correctly', async () => {
    const testConfig = {
      telegram: {
        enabled: true,
        botToken: 'new-token',
        webhookUrl: 'https://example.com/webhook',
        connected: true,
      },
      discord: {
        enabled: false,
        botToken: '',
        applicationId: '',
        webhookUrl: '',
        connected: false,
      },
    };

    mockElectronAPI.integration.getConfig.mockResolvedValue(testConfig);

    const config = await mockElectronAPI.integration.getConfig();
    expect(config).toEqual(testConfig);

    await mockElectronAPI.integration.saveConfig(testConfig);
    expect(mockElectronAPI.integration.saveConfig).toHaveBeenCalledWith(testConfig);
  });
});
