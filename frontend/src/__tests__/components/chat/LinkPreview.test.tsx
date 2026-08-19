import { fireEvent, render, screen } from '@testing-library/react';
import LinkPreview from '@/components/chat/LinkPreview';
import type { MessageLinkPreview } from '@/types/chat';

const PREVIEW: MessageLinkPreview = {
  url: 'https://example.com/story',
  title: 'A great article',
  description: 'Why it matters',
  image_url: 'https://cdn.example.com/cover.jpg',
};

describe('LinkPreview dismiss button', () => {
  it('renders no close button when dismissing is not offered', () => {
    render(<LinkPreview preview={PREVIEW} />);

    expect(screen.queryByTestId('dismiss-link-preview')).toBeNull();
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = jest.fn();
    render(<LinkPreview preview={PREVIEW} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('dismiss-link-preview'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not follow the card link when dismissing', () => {
    const onDismiss = jest.fn();
    render(<LinkPreview preview={PREVIEW} onDismiss={onDismiss} />);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByTestId('dismiss-link-preview').dispatchEvent(event);

    // The button sits inside an <a>; without preventDefault the browser would navigate.
    expect(event.defaultPrevented).toBe(true);
  });

  it('labels the button for screen readers', () => {
    render(<LinkPreview preview={PREVIEW} onDismiss={jest.fn()} />);

    expect(screen.getByRole('button', { name: /remove link preview/i })).toBeInTheDocument();
  });

  it('keeps the button in the DOM so keyboard users can reach it', () => {
    // Hover only controls opacity; hiding it with display:none would make it
    // unreachable by tab.
    render(<LinkPreview preview={PREVIEW} onDismiss={jest.fn()} />);

    expect(screen.getByTestId('dismiss-link-preview')).toBeVisible();
  });

  it('renders nothing when there is no metadata worth drawing', () => {
    const { container } = render(
      <LinkPreview
        preview={{ url: 'https://example.com/x', title: null, description: null, image_url: null }}
        onDismiss={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
