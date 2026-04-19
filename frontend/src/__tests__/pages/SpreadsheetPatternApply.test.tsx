import React from 'react';
import { render, waitFor } from '@testing-library/react';

import SpreadsheetDetailPage from '@/app/(project)/projects/[projectId]/spreadsheets/[spreadsheetId]/page';
import { PatternAPI } from '@/lib/api/patternApi';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '1', spreadsheetId: '10' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/layout/Layout', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('@/components/auth/ProtectedRoute', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);

jest.mock('@/components/spreadsheets/SpreadsheetGrid', () => {
  const React = require('react');
  return React.forwardRef((props: any, ref) => {
    React.useImperativeHandle(ref, () => ({
      refresh: jest.fn(),
    }));
    return <div data-testid="spreadsheet-grid" />;
  });
});

jest.mock('@/components/spreadsheets/PatternAgentPanel', () => {
  const React = require('react');
  return (props: any) => {
    React.useEffect(() => {
      props.onSelectPattern('pattern-1');
      props.onApplyPattern();
    }, [props]);
    return <div data-testid="pattern-panel" />;
  };
});

jest.mock('@/lib/api/patternApi', () => ({
  PatternAPI: {
    listPatterns: jest.fn(),
    getPattern: jest.fn(),
    applyPattern: jest.fn(),
    getPatternJob: jest.fn(),
    deletePattern: jest.fn(),
    createPattern: jest.fn(),
  },
}));

jest.mock('@/lib/api/spreadsheetApi', () => ({
  SpreadsheetAPI: {
    getSpreadsheet: jest.fn(),
    listSheets: jest.fn(),
  },
}));

describe('SpreadsheetDetailPage pattern apply flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (SpreadsheetAPI.getSpreadsheet as jest.Mock).mockResolvedValue({ id: 10, name: 'Test Spreadsheet' });
    (SpreadsheetAPI.listSheets as jest.Mock).mockResolvedValue({
      results: [{ id: 1, name: 'Sheet1' }],
    });
    (PatternAPI.listPatterns as jest.Mock).mockResolvedValue({ results: [{ id: 'pattern-1', name: 'Pattern' }] });
    (PatternAPI.getPattern as jest.Mock).mockResolvedValue({
      id: 'pattern-1',
      name: 'Pattern',
      steps: [
        { id: 'step-1', seq: 1, type: 'APPLY_FORMULA', params: { target: { row: 1, col: 1 }, formula: '=1+1' } },
      ],
    });
    (PatternAPI.applyPattern as jest.Mock).mockResolvedValue({ job_id: 'job-1', status: 'queued' });
    (PatternAPI.getPatternJob as jest.Mock).mockResolvedValue({
      id: 'job-1',
      status: 'succeeded',
      progress: 100,
      current_step: 1,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('applies pattern via backend job and polls status', async () => {
    render(<SpreadsheetDetailPage />);

    await waitFor(() => {
      expect(PatternAPI.applyPattern).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(PatternAPI.getPatternJob).toHaveBeenCalledWith('job-1');
    });
  });

  it('replay highlight pattern triggers only one batch call and stops polling on succeeded', async () => {
    (PatternAPI.getPatternJob as jest.Mock).mockResolvedValue({
      id: 'job-1',
      status: 'succeeded',
      progress: 100,
      current_step: 1,
      finishedAt: new Date().toISOString(),
    });

    render(<SpreadsheetDetailPage />);

    await waitFor(() => {
      expect(PatternAPI.applyPattern).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(PatternAPI.getPatternJob).toHaveBeenCalledWith('job-1');
    });

    const getPatternJobCalls = (PatternAPI.getPatternJob as jest.Mock).mock.calls.length;
    jest.advanceTimersByTime(10000);
    await Promise.resolve();

    expect(PatternAPI.applyPattern).toHaveBeenCalledTimes(1);
    expect((PatternAPI.getPatternJob as jest.Mock).mock.calls.length).toBe(getPatternJobCalls);
  });
});

