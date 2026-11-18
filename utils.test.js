jest.mock('quickchart-js', () => {
  return jest.fn().mockImplementation(() => {
    return {
      setConfig: jest.fn(),
      setWidth: jest.fn(),
      setHeight: jest.fn(),
      setBackgroundColor: jest.fn(),
      toBinary: jest.fn().mockResolvedValue(Buffer.from('mocked chart buffer')),
    };
  });
});

const { parseCompactNumber, compactifyNumber, calculateBaseMpm, buildScatterChartBuffer, buildGradeEmbed } = require('./utils');
const QuickChart = require('quickchart-js');

describe('calculateBaseMpm', () => {
  describe('Happy path scenarios', () => {
    test('calculates for zero bonus', () => {
      const mpm = 50;
      const bonus = 0;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toEqual(50);
    });
    test('calculates for 100 bonus', () => {
      const mpm = 100;
      const bonus = 100;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toEqual(50);
    });
    test('calculates for 1000 bonus', () => {
      const mpm = 550;
      const bonus = 1000;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toEqual(50);
    });
  });
  describe('Edge cases', () => {
    test('negative bonus', () => {
      const mpm = 550;
      const bonus = -100;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toBeNull();
    });
    test('negative mpm', () => {
      const mpm = -550;
      const bonus = 100;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toBeNull();
    });
    test('null bonus', () => {
      const mpm = 550;
      const bonus = null;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toBeNull();
    });
    test('undefined bonus', () => {
      const mpm = 550;

      const target = calculateBaseMpm(mpm, undefined);

      expect(target).toBeNull();
    });
    test('null mpm', () => {
      const mpm = null;
      const bonus = 100;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toBeNull();
    });
    test('undefined mpm', () => {
      const mpm = undefined;
      const bonus = 100;

      const target = calculateBaseMpm(mpm, bonus);

      expect(target).toBeNull();
    });
  });
});

describe('parseCompactNumber', () => {
  describe('plain numbers', () => {
    test('parses plain integer', () => {
      expect(parseCompactNumber('123')).toBe(123);
    });

    test('parses plain decimal', () => {
      expect(parseCompactNumber('123.45')).toBe(123.45);
    });

    test('parses numbers with one comma', () => {
      expect(parseCompactNumber('4,56')).toBe(4.56);
    });

    test('parses numbers with whitespace', () => {
      expect(parseCompactNumber('  456  ')).toBe(456);
    });
  });

  describe('compact notation without decimals', () => {
    test.each([
        ['5a', 5E3],
        ['5b', 5E6],
        ['5c', 5E9],
        ['52.6d', 52.6E12],
        ['5z', 5E78],
        ['5aa', 5E81],
        ['5ab', 5E84]
    ])('parses %s as %s', (input, expected) => {
      expect(parseCompactNumber(input)).toBeCloseTo(expected, -70);
    });
  });

  describe('compact notation with decimals', () => {
    test.each([
        ['5.62a', 5.62E3],
        ['5.62b', 5.62E6],
        ['5.62c', 5.62E9],
        ['5.62d', 5.62E12],
        ['5.62z', 5.62E78],
        ['5.62aa', 5.62E81],
        ['5.62ab', 5.62E84]
    ])('parses %s as %s', (input, expected) => {
      expect(parseCompactNumber(input)).toBeCloseTo(expected, -70);
    });
  });

  describe('compact notation with commas', () => {
    test.each([
        ['5,62a', 5.62E3],
        ['5,62b', 5.62E6],
        ['5,62c', 5.62E9],
        ['5,62d', 5.62E12],
        ['5,62z', 5.62E78],
        ['5,62aa', 5.62E81],
        ['5,62ab', 5.62E84]
    ])('parses %s as %s', (input, expected) => {
      expect(parseCompactNumber(input)).toBeCloseTo(expected, -70);
    });
  });

  describe('case insensitivity', () => {
    test('handles uppercase letters', () => {
      expect(parseCompactNumber('5A')).toBe(5E3);
      expect(parseCompactNumber('92.8B')).toBe(92.8E6);
    });
  });

  describe('edge cases', () => {
    test('returns NaN for undefined', () => {
      expect(parseCompactNumber(undefined)).toBeNaN();
    });

    test('returns NaN for null', () => {
      expect(parseCompactNumber(null)).toBeNaN();
    });

    test('returns NaN for empty string', () => {
      expect(parseCompactNumber('')).toBeNaN();
    });

    test('returns NaN for whitespace only', () => {
      expect(parseCompactNumber('   ')).toBeNaN();
    });

    test('returns NaN for multiple commas', () => {
      expect(parseCompactNumber('4,56,789')).toBeNaN();
    });
  });

  describe('invalid formats', () => {
    test('returns NaN for letters without number prefix', () => {
      expect(parseCompactNumber('abc')).toBeNaN();
    });

    test('returns NaN for numbers with invalid formats', () => {
      expect(parseCompactNumber('12.34.56')).toBeNaN();
    });
  });
});

describe('compactifyNumber', () => {
  test('preserves existing compact notation in lowercase', () => {
    expect(compactifyNumber('5A')).toBe('5a');
    expect(compactifyNumber('92.8B')).toBe('92.8b');
  });

  test.each([
    ['1234', '1.23a'],
    ['5.62b', '5.62b'],
    ['123.4c', '123c'],
    ['1000000', '1.00b'],
    ['13000000', '13.0b'],
    [5.62E78, '5.62z'],
    [5.62E81, '5.62aa'],
    [5.62E84, '5.62ab']
  ])('converts raw numbers larger than 999 to compact notation', (input, expected) => {
    expect(compactifyNumber(input)).toBe(expected);
  });

  test('keeps small numbers as plain values', () => {
    expect(compactifyNumber('999')).toBe('999');
    expect(compactifyNumber('123')).toBe('123');
  });
});

describe('buildScatterChartBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('correctly configures scatter plot and returns buffer for standard metric', async () => {
    const entries = [
      { knight_level: 50, sr_mpm: '10a', base_sr_mpm: '9a' },
      { knightLevel: 60, srMpm: '20a', baseSrMpm: '18a' }, // camelCase
      { knight_level: 0, sr_mpm: '10a' }, // invalid KL
      { knight_level: 70, sr_mpm: 'invalid' }, // invalid MPM
      { knight_level: 1001, sr_mpm: '10a' } // too high KL (filtered out)
    ];

    const result = await buildScatterChartBuffer(entries, 'standard');

    expect(result.toString()).toBe('mocked chart buffer');

    const mockChartInstance = QuickChart.mock.results[0].value;
    expect(mockChartInstance.setConfig).toHaveBeenCalledWith(expect.objectContaining({
      type: 'scatter',
      data: expect.objectContaining({
        datasets: [
          expect.objectContaining({
            label: 'Standard MPM',
            data: [
              { x: 50, y: 10000 },
              { x: 60, y: 20000 }
            ]
          })
        ]
      }),
      options: expect.objectContaining({
        scales: expect.objectContaining({
          yAxes: [
            expect.objectContaining({
              type: 'logarithmic',
              min: 10000 // min of standard y values (10000, 20000)
            })
          ]
        })
      })
    }));
  });

  test('correctly configures base metric', async () => {
    const entries = [
      { knight_level: 50, sr_mpm: '10a', base_sr_mpm: '9a' },
      { knight_level: 60, sr_mpm: '20a', base_sr_mpm: '18a' }
    ];

    const result = await buildScatterChartBuffer(entries, 'base');

    expect(result.toString()).toBe('mocked chart buffer');

    const mockChartInstance = QuickChart.mock.results[0].value;
    expect(mockChartInstance.setConfig).toHaveBeenCalledWith(expect.objectContaining({
      type: 'scatter',
      data: expect.objectContaining({
        datasets: [
          expect.objectContaining({
            label: 'Base MPM',
            data: [
              { x: 50, y: 9000 },
              { x: 60, y: 18000 }
            ]
          })
        ]
      }),
      options: expect.objectContaining({
        scales: expect.objectContaining({
          yAxes: [
            expect.objectContaining({
              type: 'logarithmic',
              min: 9000
            })
          ]
        })
      })
    }));
  });
});

describe('buildGradeEmbed', () => {
  test('uses custom srEfficiency to calculate medals gained and displays efficiency field when non-default', () => {
    const record = {
      id: 1,
      knightLevel: 50,
      totalMedals: '10.0b',
      srMpm: '1.00a',
      srEfficiency: 100,
      estimatedSrPercent: 2.4,
      estimatedSrPercentDouble: 4.8,
      createdAt: new Date('2026-08-02T07:14:00Z'),
    };
    const assessment = { score: 75, kls: {} };

    const embed = buildGradeEmbed(record, assessment);
    const srField = embed.data.fields.find(f => f.name === '📈 SR %');
    const doubleSrField = embed.data.fields.find(f => f.name === '⚡ Double SR %');
    const effField = embed.data.fields.find(f => f.name === '⚙️ SR Efficiency');

    expect(srField.value).toContain('240a medals gained');
    expect(doubleSrField.value).toContain('480a medals gained');
    expect(effField).toBeDefined();
    expect(effField.value).toBe('**100%**');
  });

  test('defaults to 80% efficiency and omits efficiency field when srEfficiency is 80 or absent', () => {
    const record = {
      id: 2,
      knightLevel: 50,
      totalMedals: '10.0b',
      srMpm: '1.00a',
      estimatedSrPercent: 1.92,
      estimatedSrPercentDouble: 3.84,
      createdAt: new Date('2026-08-02T07:14:00Z'),
    };
    const assessment = { score: 75, kls: {} };

    const embed = buildGradeEmbed(record, assessment);
    const srField = embed.data.fields.find(f => f.name === '📈 SR %');
    const effField = embed.data.fields.find(f => f.name === '⚙️ SR Efficiency');

    expect(srField.value).toContain('192a medals gained');
    expect(effField).toBeUndefined();
  });

  test('pads fields before neighboring KL fields so KL fields always start on a new row', () => {
    const record = {
      id: 3,
      knightLevel: 43,
      totalMedals: '254c',
      srMpm: '2.5b',
      estimatedSrPercent: 0.19,
      estimatedSrPercentDouble: 0.38,
      baseSrMpm: '148a',
      baseEstimatedSrPercent: 0.01,
      baseEstimatedSrPercentDouble: 0.02,
      createdAt: new Date('2026-08-02T07:14:00Z'),
    };
    const previous = {
      knightLevel: 43,
      totalMedals: '254c',
    };
    const assessment = {
      score: 15,
      baseScore: 100,
      kls: {
        42: { n: 2, percentageMin: 3.06, percentageMax: 3.5 },
        43: { n: 7, percentageMin: 0.19, percentageMax: 3.46 },
        44: { n: 4, percentageMin: 1.92, percentageMax: 3.02 },
      },
    };

    const embed = buildGradeEmbed(record, assessment, { previous });
    const fields = embed.data.fields;
    const firstKlIndex = fields.findIndex(f => f.name.startsWith('KL42'));

    expect(firstKlIndex % 3).toBe(0);
    expect(fields.slice(firstKlIndex).map(f => f.name)).toEqual([
      'KL42 (2 records)',
      'KL43 (7 records)',
      'KL44 (4 records)',
    ]);
  });
});
