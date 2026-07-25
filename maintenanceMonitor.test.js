const { createMaintenanceMonitor, parseChannelIds, parseCheckIntervalSeconds, getMaintenanceState } = require('./maintenanceMonitor');

describe('maintenance monitor helpers', () => {
  test('parses channel ids from a comma-separated config value', () => {
    expect(parseChannelIds('123, 456 ,789')).toEqual(['123', '456', '789']);
    expect(parseChannelIds('')).toEqual([]);
  });

  test('uses the configured interval minutes and falls back to five minutes', () => {
    expect(parseCheckIntervalSeconds('2')).toBe(2);
    expect(parseCheckIntervalSeconds('0')).toBe(300);
    expect(parseCheckIntervalSeconds(undefined)).toBe(300);
  });

  test('maps the API check value to a maintenance state', () => {
    expect(getMaintenanceState({ check: 'N' })).toBe('operational');
    expect(getMaintenanceState({ check: 'Y' })).toBe('maintenance');
    expect(getMaintenanceState({ check: 'x' })).toBeNull();
  });
});

describe('createMaintenanceMonitor', () => {
  test('only posts when the maintenance state changes', async () => {
    const sentMessages = [];
    const channel = { send: jest.fn().mockImplementation((message) => {
      sentMessages.push(message);
      return Promise.resolve();
    }) };
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue(channel),
      },
    };

    const fetcher = jest.fn()
      .mockResolvedValueOnce({ check: 'N' })
      .mockResolvedValueOnce({ check: 'Y' })
      .mockResolvedValueOnce({ check: 'Y' })
      .mockResolvedValueOnce({ check: 'N' });

    const monitor = createMaintenanceMonitor({
      client,
      channelIds: ['123'],
      fetcher,
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });

    await monitor.checkNow();
    await monitor.checkNow();
    await monitor.checkNow();
    await monitor.checkNow();

    expect(sentMessages).toEqual([
      '⚠️ The EF2 server is now under maintenance.',
      '✅ The EF2 server is no longer under maintenance.',
    ]);
  });
});
