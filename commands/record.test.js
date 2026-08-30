const recordCommand = require('./record');
const { MessageFlags, EmbedBuilder } = require('discord.js');

describe('record command', () => {
  let mockInteraction;
  let mockContext;

  beforeEach(() => {
    mockInteraction = {
      user: { id: 'user_123' },
      reply: jest.fn().mockResolvedValue(),
    };

    mockContext = {
      db: {
        getLatestEntry: jest.fn(),
        insertProgress: jest.fn(),
        getNearbyEntries: jest.fn(),
        getHighestMetrics: jest.fn().mockResolvedValue({
          highestKnightLevel: null,
          highestTotalMedals: null,
          highestSrMpm: null,
        }),
      },
    };
  });

  test('validates knight level', async () => {
    // Non-integer / <= 0
    await recordCommand.execute(mockInteraction, ['invalid', '10a', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Knight level must be a whole number greater than zero.',
      flags: MessageFlags.Ephemeral,
    });

    // >= 1000
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [1000, '10a', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Knight level must be below 1000.',
      flags: MessageFlags.Ephemeral,
    });

    // >= 2 * highest current knight level
    mockInteraction.reply.mockClear();
    mockContext.db.getHighestMetrics.mockResolvedValueOnce({
      highestKnightLevel: 75,
      highestTotalMedals: null,
      highestSrMpm: null,
    });
    await recordCommand.execute(mockInteraction, [150, '10a', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Knight level must be less than twice the highest recorded knight level (150).',
      flags: MessageFlags.Ephemeral,
    });
  });

  test('validates total medals', async () => {
    // <= 1000 (1.00a)
    await recordCommand.execute(mockInteraction, [47, '1000', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Total medals must be greater than 1000 (1.00a).',
      flags: MessageFlags.Ephemeral,
    });

    // >= 1.00f
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '1.00f', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Total medals must be below 1.00f.',
      flags: MessageFlags.Ephemeral,
    });

    // >= 2 * highest current total medals
    mockInteraction.reply.mockClear();
    mockContext.db.getHighestMetrics.mockResolvedValueOnce({
      highestKnightLevel: null,
      highestTotalMedals: 10000, // 10.00a
      highestSrMpm: null,
    });
    await recordCommand.execute(mockInteraction, [47, '20.00a', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Total medals must be less than twice the highest recorded total medals (20.0a).',
      flags: MessageFlags.Ephemeral,
    });
  });

  test('validates SR mpm', async () => {
    // <= 600
    await recordCommand.execute(mockInteraction, [47, '10a', '600'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR mpm must be greater than 600.',
      flags: MessageFlags.Ephemeral,
    });

    // >= 1.00d
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '1000a', '1.00d'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR mpm must be below 1.00d.',
      flags: MessageFlags.Ephemeral,
    });

    // >= 2 * highest current SR mpm
    mockInteraction.reply.mockClear();
    mockContext.db.getHighestMetrics.mockResolvedValueOnce({
      highestKnightLevel: null,
      highestTotalMedals: null,
      highestSrMpm: 10000, // 10.00a
    });
    await recordCommand.execute(mockInteraction, [47, '100a', '20.00a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR mpm must be less than twice the highest recorded SR mpm (20.0a).',
      flags: MessageFlags.Ephemeral,
    });
  });

  test('validates SR percentage and medal buff percent', async () => {
    // SR % >= 100% (e.g. MPM is too huge relative to total medals)
    await recordCommand.execute(mockInteraction, [47, '2.00a', '10.00a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR percentage must be above 0% and below 100%.',
      flags: MessageFlags.Ephemeral,
    });

    // Invalid Medal Buff Percent
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', '-50'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Medal buff percent must be a positive number.',
      flags: MessageFlags.Ephemeral,
    });
  });

  test('respects process.env limit overrides for knight level, total medals, and SR mpm', async () => {
    const originalEnv = { ...process.env };
    process.env.MAX_KNIGHT_LEVEL = '500';
    process.env.MAX_TOTAL_MEDALS = '10.00c';
    process.env.MAX_SR_MPM = '5.00b';

    try {
      // Knight level >= 500
      await recordCommand.execute(mockInteraction, [500, '100a', '10a'], mockContext);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Knight level must be below 500.',
        flags: MessageFlags.Ephemeral,
      });

      // Total medals >= 10.00c
      mockInteraction.reply.mockClear();
      await recordCommand.execute(mockInteraction, [47, '10.00c', '10a'], mockContext);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Total medals must be below 10.0c.',
        flags: MessageFlags.Ephemeral,
      });

      // SR mpm >= 5.00b
      mockInteraction.reply.mockClear();
      await recordCommand.execute(mockInteraction, [47, '1.00c', '5.00b'], mockContext);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'SR mpm must be below 5.00b.',
        flags: MessageFlags.Ephemeral,
      });
    } finally {
      process.env = originalEnv;
    }
  });

  test('records entry without previous entry and returns embed reply', async () => {
    const mockEntry = {
      id: 101,
      userId: 'user_123',
      knightLevel: 47,
      totalMedals: '11.3c',
      srMpm: '1.23b',
      estimatedSrPercent: 2.09,
      estimatedSrPercentDouble: 4.18,
      createdAt: new Date('2026-08-02T07:14:00Z'),
      rebirthMedalBonus: null,
      baseSrMpm: null,
      baseEstimatedSrPercent: null,
      baseEstimatedSrPercentDouble: null,
    };

    mockContext.db.getLatestEntry.mockResolvedValue(null);
    mockContext.db.insertProgress.mockResolvedValue(mockEntry);
    mockContext.db.getNearbyEntries.mockResolvedValue([]);

    await recordCommand.execute(mockInteraction, [47, '11.3c', '1.23b'], mockContext);

    expect(mockContext.db.getLatestEntry).toHaveBeenCalledWith('user_123', 'sr');
    expect(mockContext.db.insertProgress).toHaveBeenCalled();
    expect(mockContext.db.getNearbyEntries).toHaveBeenCalledWith('sr', 47, 1, 101);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(EmbedBuilder)],
      flags: MessageFlags.Ephemeral,
    });

    const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
    expect(embed.data.title).toBe('✨ Recorded Soul Rest Entry');
  });

  test('records entry with previous entry and rebirth bonus', async () => {
    const mockPrevious = {
      id: 99,
      userId: 'user_123',
      knightLevel: 45,
      totalMedals: '11.2c',
      srMpm: '1.00b',
    };

    const mockEntry = {
      id: 100,
      userId: 'user_123',
      knightLevel: 47,
      totalMedals: '11.3c',
      srMpm: '1.23b',
      estimatedSrPercent: 2.09,
      estimatedSrPercentDouble: 4.18,
      createdAt: new Date('2026-08-02T07:14:00Z'),
      rebirthMedalBonus: 1918,
      baseSrMpm: '61.0a',
      baseEstimatedSrPercent: 0.10,
      baseEstimatedSrPercentDouble: 0.21,
    };

    mockContext.db.getLatestEntry.mockResolvedValue(mockPrevious);
    mockContext.db.insertProgress.mockResolvedValue(mockEntry);
    mockContext.db.getNearbyEntries.mockResolvedValue([
      { knightLevel: 47, estimatedSrPercent: 2.0, baseEstimatedSrPercent: 0.1 },
    ]);

    await recordCommand.execute(mockInteraction, [47, '11.3c', '1.23b', '1918'], mockContext);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(EmbedBuilder)],
      flags: MessageFlags.Ephemeral,
    });

    const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
    expect(embed.data.title).toBe('✨ Recorded Soul Rest Entry');
    const fieldNames = embed.data.fields.map(f => f.name);
    expect(fieldNames).toContain('📜 Previous Entry');
    expect(fieldNames).toContain('⚔️ KL Change');
    expect(fieldNames).toContain('🏅 Medal Change');
  });
});
