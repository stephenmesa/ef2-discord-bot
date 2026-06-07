const { parseCompactNumber, compactifyNumber } = require('./utils');

describe('parseCompactNumber', () => {
  describe('plain numbers', () => {
    test('parses plain integer', () => {
      expect(parseCompactNumber('123')).toBe(123);
    });

    test('parses plain decimal', () => {
      expect(parseCompactNumber('123.45')).toBe(123.45);
    });

    test('parses numbers with commas', () => {
      expect(parseCompactNumber('1,234,567')).toBe(1234567);
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
