import { useChatStore } from '@/lib/chatStore';
import type { Message, MessageLinkPreview } from '@/types/chat';

const PREVIEW: MessageLinkPreview = {
  url: 'https://example.com/story',
  title: 'A great article',
  description: 'Why it matters',
  image_url: 'https://cdn.example.com/cover.jpg',
};

const makeMessage = (id: number, content = 'see https://example.com/story'): Message =>
  ({ id, chat: 1, content, link_preview: null } as unknown as Message);

describe('applyLinkPreview', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: {}, threadReplies: {} });
  });

  it('attaches the preview to the matching timeline message', () => {
    useChatStore.setState({ messages: { 1: [makeMessage(10), makeMessage(11)] } });

    useChatStore.getState().applyLinkPreview(10, PREVIEW);

    const [first, second] = useChatStore.getState().messages[1];
    expect(first.link_preview).toEqual(PREVIEW);
    expect(second.link_preview).toBeNull();
  });

  it('attaches the preview to a thread reply', () => {
    useChatStore.setState({ threadReplies: { 99: [makeMessage(20)] } });

    useChatStore.getState().applyLinkPreview(20, PREVIEW);

    expect(useChatStore.getState().threadReplies[99][0].link_preview).toEqual(PREVIEW);
  });

  it('leaves state untouched when the message is not loaded', () => {
    const before = [makeMessage(10)];
    useChatStore.setState({ messages: { 1: before } });

    useChatStore.getState().applyLinkPreview(404, PREVIEW);

    expect(useChatStore.getState().messages[1][0].link_preview).toBeNull();
  });

  it('does not mutate the previous message object', () => {
    const original = makeMessage(10);
    useChatStore.setState({ messages: { 1: [original] } });

    useChatStore.getState().applyLinkPreview(10, PREVIEW);

    // The store returns new objects; the one we handed in must be unchanged.
    expect(original.link_preview).toBeNull();
    expect(useChatStore.getState().messages[1][0]).not.toBe(original);
  });
});
