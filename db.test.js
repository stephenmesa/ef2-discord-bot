const { hydrateProgress } = require('./db');

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
