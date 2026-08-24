import { useNotificationStore } from '@/lib/notificationStore';

describe('notificationStore connection health', () => {
  beforeEach(() => {
    useNotificationStore.setState({ connectionStatus: 'disconnected' });
  });

  it('starts disconnected', () => {
    expect(useNotificationStore.getState().connectionStatus).toBe('disconnected');
  });

  it('updates the SSE connection status', () => {
    useNotificationStore.getState().setConnectionStatus('connecting');
    expect(useNotificationStore.getState().connectionStatus).toBe('connecting');

    useNotificationStore.getState().setConnectionStatus('connected');
    expect(useNotificationStore.getState().connectionStatus).toBe('connected');

    useNotificationStore.getState().setConnectionStatus('reconnecting');
    expect(useNotificationStore.getState().connectionStatus).toBe('reconnecting');
  });
});
