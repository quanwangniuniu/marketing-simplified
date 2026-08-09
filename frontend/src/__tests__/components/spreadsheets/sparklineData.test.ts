import {
  isSparklineRawInput,
  parseSparklinePayload,
} from '@/components/spreadsheets/sparklineData';

describe('isSparklineRawInput', () => {
  it.each([
    '=SPARKLINE(A1:A10)',
    '=sparkline(a1:a10)',
    '  =SPARKLINE(A1:A5)  ',
  ])('detects %s', (raw) => {
    expect(isSparklineRawInput(raw)).toBe(true);
  });

  it.each(['=SUM(A1:A10)', 'SPARKLINE(A1:A10)', 'hello', '', null, undefined])(
    'rejects %s',
    (raw) => {
      expect(isSparklineRawInput(raw as string)).toBe(false);
    },
  );
});

describe('parseSparklinePayload', () => {
  it('parses a valid sparkline payload', () => {
    const json = JSON.stringify({
      kind: 'sparkline',
      type: 'line',
      range: 'A1:A5',
      color: '#3CCED7',
      series: [10, 20, null, 40, 50],
    });
    expect(parseSparklinePayload(json)).toEqual({
      type: 'line',
      color: '#3CCED7',
      series: [10, 20, null, 40, 50],
    });
  });

  it('coerces non-number series entries to null', () => {
    const json = JSON.stringify({ kind: 'sparkline', series: [1, 'x', 3] });
    expect(parseSparklinePayload(json)?.series).toEqual([1, null, 3]);
  });

  it.each([
    null,
    undefined,
    '',
    'not json',
    JSON.stringify({ kind: 'other', series: [1, 2] }),
    JSON.stringify({ kind: 'sparkline' }), // no series array
  ])('returns null for %s', (input) => {
    expect(parseSparklinePayload(input as string)).toBeNull();
  });
});
