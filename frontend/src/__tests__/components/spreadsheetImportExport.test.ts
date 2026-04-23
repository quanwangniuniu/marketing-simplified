import {
  buildCellOperations,
  chunkOperations,
  parseCSVText,
} from '@/components/spreadsheets/spreadsheetImportExport';

describe('chunkOperations', () => {
  it('splits an operation list into fixed-size chunks', () => {
    const ops = Array.from({ length: 1100 }, (_, i) => ({
      operation: 'set' as const,
      row: i,
      column: 0,
      raw_input: String(i),
    }));

    const chunks = chunkOperations(ops, 500);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(100);
  });

  it('returns a single chunk when ops.length <= size', () => {
    const ops = Array.from({ length: 20 }, (_, i) => ({
      operation: 'set' as const,
      row: 0,
      column: i,
      raw_input: String(i),
    }));
    const chunks = chunkOperations(ops, 500);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(20);
  });
});

describe('buildCellOperations', () => {
  it('emits only non-empty cells and tracks the bounding box', () => {
    const matrix = [
      ['a', '', 'c'],
      ['', 'e', ''],
    ];
    const result = buildCellOperations(matrix, 0, 0);
    expect(result.operations).toEqual([
      { operation: 'set', row: 0, column: 0, raw_input: 'a' },
      { operation: 'set', row: 0, column: 2, raw_input: 'c' },
      { operation: 'set', row: 1, column: 1, raw_input: 'e' },
    ]);
    expect(result.maxRow).toBe(1);
    expect(result.maxCol).toBe(2);
  });

  it('honors a non-zero starting offset', () => {
    const matrix = [['x']];
    const result = buildCellOperations(matrix, 5, 7);
    expect(result.operations).toEqual([
      { operation: 'set', row: 5, column: 7, raw_input: 'x' },
    ]);
    expect(result.maxRow).toBe(5);
    expect(result.maxCol).toBe(7);
  });
});

describe('parseCSVText', () => {
  it('parses quoted fields with embedded commas and escaped quotes', () => {
    const csv = 'a,"b,c","d""e"\n1,2,3';
    const rows = parseCSVText(csv);
    expect(rows).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', '2', '3'],
    ]);
  });

  it('drops trailing all-empty rows', () => {
    const csv = 'a,b\n1,2\n,\n';
    const rows = parseCSVText(csv);
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});
