import React from 'react';
import { render, waitFor } from '@testing-library/react';

import SpreadsheetDetailPage from '@/app/(project)/projects/[projectId]/spreadsheets/[spreadsheetId]/page';
import { PatternAPI } from '@/lib/api/patternApi';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '1', spreadsheetId: '10' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/layout/Layout', () => {
  const MockLayout = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  MockLayout.displayName = 'MockLayout';
  return MockLayout;
});

jest.mock('@/components/auth/ProtectedRoute', () => {
  const MockProtectedRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  MockProtectedRoute.displayName = 'MockProtectedRoute';
  return { ProtectedRoute: MockProtectedRoute };
});

jest.mock('@/components/spreadsheets/SpreadsheetGrid', () => {
  const React = require('react');
  const MockSpreadsheetGrid = React.forwardRef((props: any, ref: React.Ref<{ refresh: jest.Mock }>) => {
    React.useImperativeHandle(ref, () => ({
      refresh: jest.fn(),
    }));
    return <div data-testid="spreadsheet-grid" />;
  });
  MockSpreadsheetGrid.displayName = 'MockSpreadsheetGrid';
  return MockSpreadsheetGrid;
});

jest.mock('@/components/spreadsheets/PatternAgentPanel', () => {
  const React = require('react');
  const MockPatternAgentPanel = (props: any) => {
    const { selectedPatternId, onApplyPattern, onSelectPattern } = props;
    const selectedOnce = React.useRef(false);
    const appliedOnce = React.useRef(false);

    React.useEffect(() => {
      if (!selectedPatternId && !selectedOnce.current) {
        selectedOnce.current = true;
        onSelectPattern('pattern-1');
        return;
      }
      if (selectedPatternId === 'pattern-1' && !appliedOnce.current) {
        appliedOnce.current = true;
        onApplyPattern();
      }
    }, [selectedPatternId, onApplyPattern, onSelectPattern]);
    return <div data-testid="pattern-panel" />;
  };
  MockPatternAgentPanel.displayName = 'MockPatternAgentPanel';
  return MockPatternAgentPanel;
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
