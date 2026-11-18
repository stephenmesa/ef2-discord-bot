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

    // Invalid Medal Buff Percent (negative)
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', '-50'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Medal buff percent must be above 0 and below 20000.',
      flags: MessageFlags.Ephemeral,
    });

    // Invalid Medal Buff Percent (zero)
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', '0'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Medal buff percent must be above 0 and below 20000.',
      flags: MessageFlags.Ephemeral,
    });

    // Invalid Medal Buff Percent (>= 20000)
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', '20000'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Medal buff percent must be above 0 and below 20000.',
      flags: MessageFlags.Ephemeral,
    });

    // Invalid Medal Buff Percent (non-numeric)
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', 'invalid'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Medal buff percent must be above 0 and below 20000.',
      flags: MessageFlags.Ephemeral,
    });
  });

  test('respects process.env limit overrides for knight level, total medals, SR mpm, and medal buff percent', async () => {
    const originalEnv = { ...process.env };
    process.env.MAX_KNIGHT_LEVEL = '500';
    process.env.MAX_TOTAL_MEDALS = '10.00c';
    process.env.MAX_SR_MPM = '5.00b';
    process.env.MAX_MEDAL_BUFF_PERCENT = '15000';

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
      await recordCommand.execute(mockInteraction, [47, '10.00a', '5.00b'], mockContext);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'SR mpm must be below 5.00b.',
        flags: MessageFlags.Ephemeral,
      });

      // Medal buff percent >= 15000
      mockInteraction.reply.mockClear();
      await recordCommand.execute(mockInteraction, [47, '10.00a', '1.00a', '15000'], mockContext);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Medal buff percent must be above 0 and below 15000.',
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

  test('validates sr_efficiency_percent', async () => {
    // < 80
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', undefined, '79'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR efficiency percent must be between 80 and 95, inclusive.',
      flags: MessageFlags.Ephemeral,
    });

    // <= 0
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', undefined, '0'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR efficiency percent must be between 80 and 95, inclusive.',
      flags: MessageFlags.Ephemeral,
    });

    // negative
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', undefined, '-10'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR efficiency percent must be between 80 and 95, inclusive.',
      flags: MessageFlags.Ephemeral,
    });

    // > 95
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', undefined, '96'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR efficiency percent must be between 80 and 95, inclusive.',
      flags: MessageFlags.Ephemeral,
    });

    // non-numeric
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', '1a', undefined, 'invalid'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR efficiency percent must be between 80 and 95, inclusive.',
      flags: MessageFlags.Ephemeral,
    });
  });

  test('records entry with custom sr_efficiency_percent and calculates medals gained', async () => {
    // 95% efficiency (inclusive upper bound): 1.00a * 240 * 0.95 = 228a medals gained; 228a / 10.0b = 2.28%
    const mockEntry = {
      id: 102,
      userId: 'user_123',
      knightLevel: 47,
      totalMedals: '10.0b',
      srMpm: '1.00a',
      srEfficiency: 95,
      estimatedSrPercent: 2.28,
      estimatedSrPercentDouble: 4.56,
      createdAt: new Date('2026-08-02T07:14:00Z'),
      rebirthMedalBonus: null,
      baseSrMpm: null,
      baseEstimatedSrPercent: null,
      baseEstimatedSrPercentDouble: null,
    };

    mockContext.db.getLatestEntry.mockResolvedValue(null);
    mockContext.db.insertProgress.mockResolvedValue(mockEntry);
    mockContext.db.getNearbyEntries.mockResolvedValue([]);

    await recordCommand.execute(mockInteraction, [47, '10.0b', '1.00a', undefined, '95'], mockContext);

    expect(mockContext.db.insertProgress).toHaveBeenCalledWith(expect.objectContaining({
      srEfficiency: 95,
      estimatedSrPct: expect.closeTo(2.28, 5),
      estimatedDoubleSrPct: expect.closeTo(4.56, 5),
    }));

    const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
    const srPctField = embed.data.fields.find(f => f.name === '📈 SR %');
    expect(srPctField.value).toContain('228a medals gained');
    const effField = embed.data.fields.find(f => f.name === '⚙️ SR Efficiency');
    expect(effField).toBeDefined();
    expect(effField.value).toBe('**95%**');
  });

  test('handles optional trailing percent sign on sr_efficiency_percent', async () => {
    // 85% efficiency: 1.00a * 240 * 0.85 = 204a medals gained; 204a / 10.0b = 2.04%
    const mockEntry = {
      id: 103,
      userId: 'user_123',
      knightLevel: 47,
      totalMedals: '10.0b',
      srMpm: '1.00a',
      srEfficiency: 85,
      estimatedSrPercent: 2.04,
      estimatedSrPercentDouble: 4.08,
      createdAt: new Date('2026-08-02T07:14:00Z'),
      rebirthMedalBonus: null,
      baseSrMpm: null,
      baseEstimatedSrPercent: null,
      baseEstimatedSrPercentDouble: null,
    };

    mockContext.db.getLatestEntry.mockResolvedValue(null);
    mockContext.db.insertProgress.mockResolvedValue(mockEntry);
    mockContext.db.getNearbyEntries.mockResolvedValue([]);

    await recordCommand.execute(mockInteraction, [47, '10.0b', '1.00a', undefined, '85%'], mockContext);

    expect(mockContext.db.insertProgress).toHaveBeenCalledWith(expect.objectContaining({
      srEfficiency: 85,
      estimatedSrPct: expect.closeTo(2.04, 5),
      estimatedDoubleSrPct: expect.closeTo(4.08, 5),
    }));

    const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
    const effField = embed.data.fields.find(f => f.name === '⚙️ SR Efficiency');
    expect(effField).toBeDefined();
    expect(effField.value).toBe('**85%**');
  });
});
