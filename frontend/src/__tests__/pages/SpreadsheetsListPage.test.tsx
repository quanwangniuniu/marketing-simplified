import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpreadsheetsListPage from '@/app/(project)/spreadsheets/page';

const projectStoreState = {
  activeProject: null as any,
  hasHydrated: false,
};

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock('@/lib/projectStore', () => ({
  useProjectStore: (selector: any) => selector(projectStoreState),
}));

jest.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/dashboard/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/global-chat/ChatFAB', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/common/ConfirmDialog', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/spreadsheets-v2/SpreadsheetsHeader', () => ({
  __esModule: true,
  default: ({ projectName }: { projectName?: string }) => <div>{projectName || 'Spreadsheets'}</div>,
}));

jest.mock('@/components/spreadsheets-v2/SpreadsheetCard', () => ({
  __esModule: true,
  default: () => <div>Spreadsheet card</div>,
}));

jest.mock('@/components/spreadsheets-v2/CreateSpreadsheetDialog', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/api/projectApi', () => ({
  ProjectAPI: {
    getProjects: jest.fn(),
  },
}));

jest.mock('@/lib/api/spreadsheetApi', () => ({
  SpreadsheetAPI: {
    listSpreadsheets: jest.fn(),
    deleteSpreadsheet: jest.fn(),
  },
}));

describe('Spreadsheets list page', () => {
  test('keeps the route in loading mode while project context is still hydrating', () => {
    const { container } = render(<SpreadsheetsListPage />);

    expect(screen.queryByText('Select a project from the sidebar to view spreadsheets.')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton-fade').length).toBeGreaterThan(0);
  });
});
