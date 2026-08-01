jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

const pg = require('pg');
const { hydrateProgress, getGlobalMpmScatterData } = require('./db');

describe('hydrateProgress()', () => {
  describe('Sad Paths', () => {
    test('Handles null', () => {
      expect(hydrateProgress(null)).toBeNull();
    });
    test('Handles undefined', () => {
      expect(hydrateProgress()).toBeNull();
    });
    test('Handles number', () => {
      expect(hydrateProgress(23)).toBeNull();
    });
    test('Handles empty array', () => {
      expect(hydrateProgress([])).toBeNull();
    });
    test('Handles array', () => {
      expect(hydrateProgress([{blah: 'blah'}])).toBeNull();
    });
  });
  describe('Happy Paths', () => {
    test('Handles basic progress record', () => {
        const now = Date();
        const result = hydrateProgress({
            id: 123,
            user_id: 9191,
            entry_type: 'sr',
            knight_level: 32,
            total_medals: '912b',
            sr_mpm: '199a',
            notes: null,
            created_at: now,
            rebirth_medal_bonus: 598,
        });

        expect(result).toBeTruthy();
        expect(result).toMatchObject({
            id: 123,
            userId: 9191,
            entryType: 'sr',
            knightLevel: 32,
            totalMedals: '912b',
            srMpm: '199a',
            estimatedSrPercent: 4.19,
            estimatedSrPercentDouble: 8.38,
            notes: null,
            createdAt: now,
            rebirthMedalBonus: 598,
            baseSrMpm: '28.5a',
            baseEstimatedSrPercent: 0.6,
            baseEstimatedSrPercentDouble: 1.2,
        });
    });
  });
});

describe('getGlobalMpmScatterData()', () => {
  test('queries all progress entries with type sr and returns rows', async () => {
    const mockRows = [
      { knight_level: 50, sr_mpm: '100a', base_sr_mpm: '90a' },
      { knight_level: 60, sr_mpm: '200a', base_sr_mpm: '180a' }
    ];

    const poolInstance = new pg.Pool();
    poolInstance.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await getGlobalMpmScatterData();

    expect(poolInstance.query).toHaveBeenCalledWith(
      `SELECT knight_level, sr_mpm, base_sr_mpm FROM progress WHERE entry_type = 'sr' ORDER BY knight_level ASC;`
    );
    expect(result).toEqual(mockRows);
  });
});
