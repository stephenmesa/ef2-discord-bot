const mockQuery = jest.fn();
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: mockQuery,
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

const pg = require('pg');
const { hydrateProgress, getGlobalMpmScatterData, getOutliers } = require('./db');

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
      expect(hydrateProgress([{ blah: 'blah' }])).toBeNull();
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

describe('getOutliers()', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('queries for absolute outlier entries and returns hydrated progress models', async () => {
    const now = new Date();
    const mockRows = [
      {
        id: 1,
        user_id: 'user_outlier_kl',
        entry_type: 'sr',
        knight_level: 1200,
        total_medals: '100b',
        sr_mpm: '10b',
        estimated_sr_pct: '12.5',
        estimated_double_sr_pct: '25.0',
        created_at: now,
      },
      {
        id: 2,
        user_id: 'user_outlier_pct',
        entry_type: 'sr',
        knight_level: 50,
        total_medals: '100b',
        sr_mpm: '10b',
        estimated_sr_pct: '150.0',
        estimated_double_sr_pct: '300.0',
        created_at: now,
      },
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const result = await getOutliers();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sqlQuery = mockQuery.mock.calls[0][0];
    expect(sqlQuery).toBe('SELECT * FROM progress;');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      userId: 'user_outlier_kl',
      knightLevel: 1200,
      outlierReason: expect.stringContaining('Knight Level 1200 is out of bounds'),
    });
    expect(result[1]).toMatchObject({
      id: 2,
      userId: 'user_outlier_pct',
      estimatedSrPercent: 1920,
      outlierReason: expect.stringContaining('Impossible SR %'),
    });
  });

  test('flags standard deviation outliers at KL +/- 1 when Z-score > 3', async () => {
    const now = new Date();
    const mockRows = [
      // Clean entries at KL 50
      {
        id: 10,
        user_id: 'user_a',
        entry_type: 'sr',
        knight_level: 50,
        total_medals: '100b',
        sr_mpm: '10a',
        created_at: now,
      },
      {
        id: 11,
        user_id: 'user_b',
        entry_type: 'sr',
        knight_level: 50,
        total_medals: '100b',
        sr_mpm: '10.5a',
        created_at: now,
      },
      {
        id: 12,
        user_id: 'user_c',
        entry_type: 'sr',
        knight_level: 50,
        total_medals: '100b',
        sr_mpm: '11a',
        created_at: now,
      },
      // Outlier entry at KL 50
      {
        id: 13,
        user_id: 'user_d',
        entry_type: 'sr',
        knight_level: 50,
        total_medals: '100b',
        sr_mpm: '25a',
        created_at: now,
      },
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const result = await getOutliers();

    // Out of the 4 users, only user_d should be flagged as standard deviation outlier
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: 'user_d',
      outlierReason: expect.stringContaining('SR % Z-score is'),
    });
  });

  test('flags outlier when stddev is 0 and difference is > 1%', async () => {
    const now = new Date();
    const mockRows = [
      { id: 20, user_id: 'user_e', entry_type: 'sr', knight_level: 60, total_medals: '100b', sr_mpm: '10a', created_at: now },
      { id: 21, user_id: 'user_f', entry_type: 'sr', knight_level: 60, total_medals: '100b', sr_mpm: '10a', created_at: now },
      { id: 22, user_id: 'user_g', entry_type: 'sr', knight_level: 60, total_medals: '100b', sr_mpm: '10a', created_at: now },
      { id: 23, user_id: 'user_h', entry_type: 'sr', knight_level: 60, total_medals: '100b', sr_mpm: '20a', created_at: now },
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockRows });
    const result = await getOutliers();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: 'user_h',
      outlierReason: expect.stringContaining('SR % difference from neighbors is'),
    });
  });
});
