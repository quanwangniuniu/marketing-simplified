import { act, renderHook } from '@testing-library/react';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { useAuthStore } from '@/lib/authStore';
import { useChatStore } from '@/lib/chatStore';
import type { Message } from '@/types/chat';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = jest.fn();

  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  close = jest.fn((code = 1000) => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason: '' } as CloseEvent);
  });
}

const PREVIEW = {
  url: 'https://example.com/story',
  title: 'A great article',
  description: 'Why it matters',
  image_url: 'https://cdn.example.com/cover.jpg',
};

const makeMessage = (id: number): Message =>
  ({ id, chat: 12, content: 'see https://example.com/story', link_preview: null } as unknown as Message);

describe('useChatWebSocket link previews', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    useAuthStore.setState({ token: 'test-token' });
    useChatStore.setState({ messages: { 12: [makeMessage(44)] }, threadReplies: {}, outbox: [] });
  });

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null });
    useChatStore.setState({ messages: {}, threadReplies: {}, outbox: [] });
  });

  afterAll(() => {
    global.WebSocket = originalWebSocket;
  });

  it('attaches a pushed preview to its message and forwards the event', () => {
    const onLinkPreview = jest.fn();
    const { unmount } = renderHook(() => useChatWebSocket(100, { onLinkPreview }));

    act(() => {
      MockWebSocket.instances[0].receive({
        type: 'link_preview',
        chat_id: 12,
        message_id: 44,
        preview: PREVIEW,
      });
    });

    expect(useChatStore.getState().messages[12][0].link_preview).toEqual(PREVIEW);
    expect(onLinkPreview).toHaveBeenCalledWith(expect.objectContaining({ message_id: 44 }));

    unmount();
  });

  it('ignores an event with no preview payload', () => {
    const { unmount } = renderHook(() => useChatWebSocket(100));

    act(() => {
      MockWebSocket.instances[0].receive({
        type: 'link_preview',
        chat_id: 12,
        message_id: 44,
        preview: null,
      });
    });

    expect(useChatStore.getState().messages[12][0].link_preview).toBeNull();

    unmount();
  });

  it('ignores an event for a message that is not loaded', () => {
    const { unmount } = renderHook(() => useChatWebSocket(100));

    act(() => {
      MockWebSocket.instances[0].receive({
        type: 'link_preview',
        chat_id: 12,
        message_id: 999,
        preview: PREVIEW,
      });
    });

    expect(useChatStore.getState().messages[12][0].link_preview).toBeNull();

    unmount();
  });
});
