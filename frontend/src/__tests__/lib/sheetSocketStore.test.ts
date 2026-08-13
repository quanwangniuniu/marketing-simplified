import { useSheetSocketStore } from '@/lib/sheetSocketStore';


describe('sheetSocketStore authoritative presence snapshots', () => {
  beforeEach(() => {
    useSheetSocketStore.getState().reset();
  });

  it('removes stale identities while preserving active peer cursor state', () => {
    const store = useSheetSocketStore.getState();
    store.applySnapshot([
      { user_id: 1, username: 'Active', client_id: 'active-client' },
      { user_id: 2, username: 'Stale', client_id: 'stale-client' },
    ]);
    useSheetSocketStore.getState().applyCursor({
      user_id: 1,
      username: 'Active',
      client_id: 'active-client',
      row: 4,
      col: 7,
      is_active: true,
    });

    useSheetSocketStore.getState().applySnapshot([
      { user_id: 1, username: 'Active', client_id: 'active-client' },
    ]);

    const users = useSheetSocketStore.getState().usersByKey;
    expect(Object.keys(users)).toEqual(['1:active-client']);
    expect(users['1:active-client'].cursor).toEqual(
      expect.objectContaining({ row: 4, col: 7, isActive: true })
    );
  });
});
