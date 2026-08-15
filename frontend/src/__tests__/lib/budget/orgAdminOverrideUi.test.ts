import {
  canOrgAdminOverrideBudgetUi,
  resolveTaskProjectOrgId,
  resolveUserOrgId,
} from '@/lib/budget/orgAdminOverrideUi';
import type { User } from '@/types/auth';

const orgAdmin: User = {
  email: 'admin@test.com',
  username: 'admin',
  is_org_admin: true,
  organization: null,
  current_organization: { id: 10, name: 'Org A', slug: 'org-a' },
  roles: [],
};

describe('orgAdminOverrideUi', () => {
  it('resolveUserOrgId prefers current_organization', () => {
    expect(resolveUserOrgId(orgAdmin)).toBe(10);
  });

  it('canOrgAdminOverrideBudgetUi is false when orgs differ', () => {
    expect(
      canOrgAdminOverrideBudgetUi(
        orgAdmin,
        { type: 'budget', project_id: 1, project: { id: 1, name: 'P' } },
        {
          id: 1,
          name: 'P',
          organization: { id: 99, name: 'Other org' },
        },
      ),
    ).toBe(false);
  });

  it('canOrgAdminOverrideBudgetUi is true when orgs match', () => {
    expect(
      canOrgAdminOverrideBudgetUi(
        orgAdmin,
        { type: 'budget', project_id: 1, project: { id: 1, name: 'P' } },
        {
          id: 1,
          name: 'P',
          organization: { id: 10, name: 'Org A' },
        },
      ),
    ).toBe(true);
  });

  it('resolveTaskProjectOrgId returns null when active project does not match task', () => {
    expect(
      resolveTaskProjectOrgId(
        { project_id: 2, project: { id: 2, name: 'Other' } },
        { id: 1, name: 'Active', organization: { id: 10, name: 'Org A' } },
      ),
    ).toBeNull();
  });
});
