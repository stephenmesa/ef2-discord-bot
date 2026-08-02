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
      },
    };
  });

  test('validates inputs and returns error message when invalid', async () => {
    // Invalid Knight Level
    await recordCommand.execute(mockInteraction, ['invalid', '10a', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Knight level must be a whole number greater than zero.',
      flags: MessageFlags.Ephemeral,
    });

    // Invalid Total Medals
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, 'invalid', '1a'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Total medals must be a positive number.',
      flags: MessageFlags.Ephemeral,
    });

    // Invalid SR MPM
    mockInteraction.reply.mockClear();
    await recordCommand.execute(mockInteraction, [47, '10a', 'invalid'], mockContext);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'SR mpm must be a positive number.',
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
