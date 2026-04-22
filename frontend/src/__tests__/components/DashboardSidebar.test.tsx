/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';

const mockPush = jest.fn();

const authState = {
  user: null as any,
  loading: false,
  initialized: true,
};

const projectState = {
  activeProject: null as any,
  hasHydrated: true,
};

const projectsHookState = {
  projects: [] as any[],
  loading: false,
  fetchProjects: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/tasks',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => projectsHookState,
}));

jest.mock('@/lib/authStore', () => ({
  useAuthStore: (selector: any) => selector(authState),
}));

jest.mock('@/lib/projectStore', () => ({
  useProjectStore: (selector: any) => selector(projectState),
}));

jest.mock('@/hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({ logout: jest.fn() }),
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

describe('DashboardSidebar', () => {
  beforeEach(() => {
    mockPush.mockReset();
    projectsHookState.projects = [];
    projectsHookState.loading = false;
    projectsHookState.fetchProjects.mockReset();

    authState.user = { email: 'ada@example.com', username: 'ada', roles: ['member'] };
    authState.loading = false;
    authState.initialized = true;

    projectState.activeProject = null;
    projectState.hasHydrated = true;
  });

  test('shows loading placeholders instead of project and auth empty copy during boot', () => {
    authState.user = null;
    authState.loading = true;
    authState.initialized = false;
    projectState.hasHydrated = false;

    const { container } = render(<DashboardSidebar />);

    expect(screen.queryByText('Select a project')).not.toBeInTheDocument();
    expect(screen.queryByText('Not signed in')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton-fade').length).toBeGreaterThan(0);
  });
});
