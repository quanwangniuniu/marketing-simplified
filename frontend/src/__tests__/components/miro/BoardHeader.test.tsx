import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BoardHeader from '@/components/miro/BoardHeader';
import { createMockViewport } from './__mocks__/testUtils';

const mockViewport = createMockViewport({ zoom: 1.5 });

const defaultProps = {
  title: 'Test Board',
  onTitleChange: jest.fn(),
  viewport: mockViewport,
  onZoomIn: jest.fn(),
  onZoomOut: jest.fn(),
  onFitToScreen: jest.fn(),
  shareToken: 'test-token',
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock window.alert
window.alert = jest.fn();

describe('BoardHeader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders title input', () => {
      render(<BoardHeader {...defaultProps} />);
      const titleInput = screen.getByDisplayValue('Test Board');
      expect(titleInput).toBeInTheDocument();
    });

    test('displays zoom percentage', () => {
      render(<BoardHeader {...defaultProps} />);
      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    test('renders all control buttons', () => {
      render(<BoardHeader {...defaultProps} />);
      expect(screen.getByTitle('Back to Boards')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
      expect(screen.getByTitle('Fit to screen')).toBeInTheDocument();
    });
  });

  describe('Title Editing', () => {
    test('calls onTitleChange when title is edited', () => {
      const onTitleChange = jest.fn();
      render(<BoardHeader {...defaultProps} onTitleChange={onTitleChange} />);
      
      const titleInput = screen.getByDisplayValue('Test Board');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });
      
      expect(onTitleChange).toHaveBeenCalledWith('New Title');
    });

    test('calls onTitleChange on blur', () => {
      const onTitleChange = jest.fn();
      render(<BoardHeader {...defaultProps} onTitleChange={onTitleChange} />);
      
      const titleInput = screen.getByDisplayValue('Test Board');
      fireEvent.blur(titleInput);
      
      expect(onTitleChange).toHaveBeenCalledWith('Test Board');
    });
  });

  describe('Zoom Controls', () => {
    test('calls onZoomIn when zoom in button clicked', () => {
      const onZoomIn = jest.fn();
      render(<BoardHeader {...defaultProps} onZoomIn={onZoomIn} />);
      
      const zoomInButton = screen.getByTitle('Zoom in');
      fireEvent.click(zoomInButton);
      
      expect(onZoomIn).toHaveBeenCalled();
    });

    test('calls onZoomOut when zoom out button clicked', () => {
      const onZoomOut = jest.fn();
      render(<BoardHeader {...defaultProps} onZoomOut={onZoomOut} />);
      
      const zoomOutButton = screen.getByTitle('Zoom out');
      fireEvent.click(zoomOutButton);
      
      expect(onZoomOut).toHaveBeenCalled();
    });

    test('calls onFitToScreen when fit to screen button clicked', () => {
      const onFitToScreen = jest.fn();
      render(<BoardHeader {...defaultProps} onFitToScreen={onFitToScreen} />);
      
      const fitButton = screen.getByTitle('Fit to screen');
      fireEvent.click(fitButton);
      
      expect(onFitToScreen).toHaveBeenCalled();
    });

    test('displays correct zoom percentage', () => {
      render(<BoardHeader {...defaultProps} viewport={{ ...mockViewport, zoom: 0.75 }} />);
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('Save Button', () => {
    test('renders save button when onSave provided', () => {
      const onSave = jest.fn();
      render(<BoardHeader {...defaultProps} onSave={onSave} />);
      
      expect(screen.getByTitle('Save snapshot')).toBeInTheDocument();
    });

    test('does not render save button when onSave not provided', () => {
      render(<BoardHeader {...defaultProps} />);
      
      expect(screen.queryByTitle('Save snapshot')).not.toBeInTheDocument();
    });

    test('calls onSave when save button clicked', () => {
      const onSave = jest.fn();
      render(<BoardHeader {...defaultProps} onSave={onSave} />);
      
      const saveButton = screen.getByTitle('Save snapshot');
      fireEvent.click(saveButton);
      
      expect(onSave).toHaveBeenCalled();
    });

    test('disables save button when isSaving is true', () => {
      render(<BoardHeader {...defaultProps} onSave={jest.fn()} isSaving={true} />);
      
      const saveButton = screen.getByTitle('Save snapshot');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Snapshot Button', () => {
    test('renders snapshot button when onSnapshotClick provided', () => {
      const onSnapshotClick = jest.fn();
      render(<BoardHeader {...defaultProps} onSnapshotClick={onSnapshotClick} />);
      
      expect(screen.getByTitle('Snapshots')).toBeInTheDocument();
    });

    test('does not render snapshot button when onSnapshotClick not provided', () => {
      render(<BoardHeader {...defaultProps} />);
      
      expect(screen.queryByTitle('Snapshots')).not.toBeInTheDocument();
    });

    test('calls onSnapshotClick when snapshot button clicked', () => {
      const onSnapshotClick = jest.fn();
      render(<BoardHeader {...defaultProps} onSnapshotClick={onSnapshotClick} />);
      
      const snapshotButton = screen.getByTitle('Snapshots');
      fireEvent.click(snapshotButton);
      
      expect(onSnapshotClick).toHaveBeenCalled();
    });
  });

  describe('Preview Button', () => {
    test('renders preview button when onPreviewClick provided', () => {
      const onPreviewClick = jest.fn();
      render(<BoardHeader {...defaultProps} onPreviewClick={onPreviewClick} />);
      
      expect(screen.getByTitle('Preview')).toBeInTheDocument();
    });

    test('does not render preview button when onPreviewClick not provided', () => {
      render(<BoardHeader {...defaultProps} />);
      
      expect(screen.queryByTitle('Preview')).not.toBeInTheDocument();
    });

    test('calls onPreviewClick when preview button clicked', () => {
      const onPreviewClick = jest.fn();
      render(<BoardHeader {...defaultProps} onPreviewClick={onPreviewClick} />);
      
      const previewButton = screen.getByTitle('Preview');
      fireEvent.click(previewButton);
      
      expect(onPreviewClick).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo Buttons', () => {
    test('renders undo/redo when handlers provided', () => {
      render(
        <BoardHeader
          {...defaultProps}
          onUndo={jest.fn()}
          onRedo={jest.fn()}
          canUndo={true}
          canRedo={false}
        />
      );
      expect(screen.getByTitle('Undo (Cmd/Ctrl+Z)')).toBeInTheDocument();
      expect(screen.getByTitle('Redo (Cmd+Shift+Z / Ctrl+Y)')).toBeInTheDocument();
      expect(screen.getByTitle('Redo (Cmd+Shift+Z / Ctrl+Y)')).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    test('back button calls onBack', () => {
      const onBack = jest.fn();

      render(<BoardHeader {...defaultProps} onBack={onBack} />);

      const backButton = screen.getByTitle('Back to Boards');
      fireEvent.click(backButton);

      expect(onBack).toHaveBeenCalled();
    });
  });
});
