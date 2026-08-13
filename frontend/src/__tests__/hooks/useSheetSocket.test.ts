import { act, renderHook } from '@testing-library/react';
import { useSheetSocket } from '@/hooks/useSheetSocket';
import { useAuthStore } from '@/lib/authStore';
import { useSheetSocketStore } from '@/lib/sheetSocketStore';
import {
  clearSheetRevision,
  getSheetRevision,
  publishSheetRevisionConflict,
  setSheetRevision,
} from '@/lib/sheetRevisionStore';

const createSheetWebSocketTicketMock = jest.fn();
jest.mock('@/lib/api/spreadsheetApi', () => ({
  SpreadsheetAPI: {
    createWebSocketTicket: (...args: unknown[]) =>
      createSheetWebSocketTicketMock(...args),
  },
  setSheetCollabClientId: jest.fn(),
}));

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  send(data: string) {
    this.sent.push(data);
  }

  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  close = jest.fn((code = 1000) => {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSING;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  });
}

describe('useSheetSocket resume recovery', () => {
  const originalWebSocket = global.WebSocket;
  const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  let visibilityState: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-25T00:00:00Z'));
    MockWebSocket.instances = [];
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    delete (window as typeof window & { __sheetCollabClientId?: string }).__sheetCollabClientId;
    window.sessionStorage.clear();
    useAuthStore.setState({ token: 'test-token' });
    useSheetSocketStore.getState().reset();
    clearSheetRevision(123);
    createSheetWebSocketTicketMock.mockReset();
    createSheetWebSocketTicketMock.mockResolvedValue({
      ticket: 'one-time-ticket',
      expires_in: 30,
    });
  });

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null });
    useSheetSocketStore.getState().reset();
    clearSheetRevision(123);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    global.WebSocket = originalWebSocket;
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
  });

  it('forces a new socket and canonical refresh after a long hidden interval', async () => {
    const onRefreshRequired = jest.fn();
    const { unmount } = renderHook(() => useSheetSocket(123, { onRefreshRequired }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('ticket=one-time-ticket');
    expect(MockWebSocket.instances[0].url).not.toContain('token=test-token');

    act(() => {
      MockWebSocket.instances[0].open();
    });

    act(() => {
      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    jest.setSystemTime(new Date('2026-07-25T00:00:21Z'));
    await act(async () => {
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(MockWebSocket.instances[0].close).toHaveBeenCalledWith(4000, 'client_resume');
    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => {
      MockWebSocket.instances[1].open();
    });
    expect(onRefreshRequired).toHaveBeenCalledWith('reconnected');

    unmount();
  });

  it('ignores old events and reloads instead of applying cells across a revision gap', async () => {
    const onCellsUpdated = jest.fn();
    const onRefreshRequired = jest.fn();
    const { unmount } = renderHook(() =>
      useSheetSocket(123, { onCellsUpdated, onRefreshRequired })
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      MockWebSocket.instances[0].open();
      setSheetRevision(123, 5);
      MockWebSocket.instances[0].receive({
        type: 'cells_updated',
        sheet_id: 123,
        revision: 4,
        cells: [{ row_position: 0, column_position: 0 }],
      });
    });
    expect(onCellsUpdated).not.toHaveBeenCalled();

    act(() => {
      MockWebSocket.instances[0].receive({
        type: 'cells_updated',
        sheet_id: 123,
        revision: 7,
        cells: [{ row_position: 0, column_position: 0 }],
      });
    });
    expect(onCellsUpdated).not.toHaveBeenCalled();
    expect(onRefreshRequired).toHaveBeenCalledWith('revision_gap');
    expect(getSheetRevision(123)).toBe(7);

    unmount();
  });

  it('delivers sheet-list refresh events that intentionally have no revision', async () => {
    const onRefreshRequired = jest.fn();
    const { unmount } = renderHook(() =>
      useSheetSocket(123, { onRefreshRequired })
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      MockWebSocket.instances[0].open();
      setSheetRevision(123, 5);
      MockWebSocket.instances[0].receive({
        type: 'sheet_refresh_required',
        sheet_id: 123,
        reason: 'sheet_created',
        revision: null,
      });
    });

    expect(onRefreshRequired).toHaveBeenCalledWith('sheet_created');
    expect(getSheetRevision(123)).toBe(5);
    unmount();
  });

  it('backs off failed ticket requests instead of retrying every 1.5 seconds', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    createSheetWebSocketTicketMock.mockRejectedValue(new Error('backend down'));
    const { unmount } = renderHook(() => useSheetSocket(123));

    await act(async () => {
      await Promise.resolve();
    });
    expect(createSheetWebSocketTicketMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1499);
      await Promise.resolve();
    });
    expect(createSheetWebSocketTicketMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createSheetWebSocketTicketMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(2999);
      await Promise.resolve();
    });
    expect(createSheetWebSocketTicketMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createSheetWebSocketTicketMock).toHaveBeenCalledTimes(3);

    unmount();
    randomSpy.mockRestore();
  });

  it('requests a canonical refresh when REST reports a revision conflict', async () => {
    const onRefreshRequired = jest.fn();
    const { unmount } = renderHook(() =>
      useSheetSocket(123, { onRefreshRequired })
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      MockWebSocket.instances[0].open();
      publishSheetRevisionConflict(123, 9);
    });

    expect(onRefreshRequired).toHaveBeenCalledWith('revision_conflict');
    expect(getSheetRevision(123)).toBe(9);
    unmount();
  });
});
