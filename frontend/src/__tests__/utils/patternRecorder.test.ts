import {
  HEADER_ROW_INDEX,
  recordRenameColumnStep,
  shouldRecordHeaderRename,
} from '@/lib/spreadsheets/patternRecorder';

const createId = () => 'step-1';

describe('pattern rename recorder', () => {
  it('records header-row rename as SET_COLUMN_NAME', () => {
    const result = recordRenameColumnStep(
      [],
      { columnIndex: 1, newName: 'Name', oldName: 'Old', headerRowIndex: HEADER_ROW_INDEX },
      {},
      createId,
      1000,
      1500
    );
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].type).toBe('SET_COLUMN_NAME');
  });

  it('does not record when row is not header', () => {
    expect(shouldRecordHeaderRename(1)).toBe(false);
  });

  it('dedupes rapid edits on same column', () => {
    const first = recordRenameColumnStep(
      [],
      { columnIndex: 0, newName: 'First', oldName: 'Old', headerRowIndex: HEADER_ROW_INDEX },
      {},
      () => 'step-1',
      1000,
      1500
    );
    const second = recordRenameColumnStep(
      first.steps,
      { columnIndex: 0, newName: 'Final', oldName: 'First', headerRowIndex: HEADER_ROW_INDEX },
      first.state,
      () => 'step-2',
      1200,
      1500
    );
    expect(second.steps).toHaveLength(1);
    const step = second.steps[0];
    if (step.type !== 'SET_COLUMN_NAME') {
      throw new Error(`Expected SET_COLUMN_NAME, received ${step.type}`);
    }
    expect(step.params.to_header).toBe('Final');
  });
});
