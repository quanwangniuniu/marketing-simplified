import {
  clearSheetRevision,
  getSheetRevision,
  isSheetRevisionConflictResponse,
  setSheetRevision,
  withBaseRevision,
} from '@/lib/sheetRevisionStore';


describe('sheetRevisionStore', () => {
  afterEach(() => {
    clearSheetRevision(42);
  });

  it('adds the latest known base revision without moving backwards', () => {
    expect(withBaseRevision(42, { operation: 'set' })).toEqual({
      operation: 'set',
    });

    setSheetRevision(42, 3);
    setSheetRevision(42, 2);
    expect(getSheetRevision(42)).toBe(3);
    expect(withBaseRevision(42, { operation: 'set' })).toEqual({
      operation: 'set',
      base_revision: 3,
    });

    setSheetRevision(42, 4);
    expect(getSheetRevision(42)).toBe(4);
  });

  it('recognizes revision conflicts without treating every HTTP 409 as one', () => {
    expect(
      isSheetRevisionConflictResponse(400, {
        code: 'SHEET_REVISION_CONFLICT',
        current_revision: 7,
      })
    ).toBe(true);
    expect(
      isSheetRevisionConflictResponse(409, {
        current_revision: 8,
      })
    ).toBe(true);
    expect(
      isSheetRevisionConflictResponse(409, {
        code: 'ANOTHER_CONFLICT',
      })
    ).toBe(false);
    expect(
      isSheetRevisionConflictResponse(500, {
        current_revision: 9,
      })
    ).toBe(false);
  });
});
