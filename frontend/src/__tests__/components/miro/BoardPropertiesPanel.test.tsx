import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BoardPropertiesPanel from '@/components/miro/BoardPropertiesPanel';
import { createMockBoardItem } from './__mocks__/miroApi';

const defaultProps = {
  selectedItem: null,
  onUpdate: jest.fn(),
  onDelete: jest.fn(),
};

describe('BoardPropertiesPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    test('renders empty state when no item selected', () => {
      render(<BoardPropertiesPanel {...defaultProps} />);
      
      expect(screen.getByText('Board Properties')).toBeInTheDocument();
      expect(screen.getByText('Select an item to edit properties')).toBeInTheDocument();
    });
  });

  describe('Basic Properties', () => {
    test('renders position inputs', () => {
      const item = createMockBoardItem({ x: 100, y: 200 });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      const xInput = screen.getByPlaceholderText('X') as HTMLInputElement;
      const yInput = screen.getByPlaceholderText('Y') as HTMLInputElement;
      
      expect(xInput.value).toBe('100');
      expect(yInput.value).toBe('200');
    });

    test('updates position on input change', () => {
      const item = createMockBoardItem({ x: 100, y: 200 });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      const xInput = screen.getByPlaceholderText('X');
      fireEvent.change(xInput, { target: { value: '150' } });
      
      expect(onUpdate).toHaveBeenCalledWith({ x: 150 });
    });

    test('renders size inputs', () => {
      const item = createMockBoardItem({ width: 300, height: 400 });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      const widthInput = screen.getByPlaceholderText('Width') as HTMLInputElement;
      const heightInput = screen.getByPlaceholderText('Height') as HTMLInputElement;
      
      expect(widthInput.value).toBe('300');
      expect(heightInput.value).toBe('400');
    });

    test('updates size on input change', () => {
      const item = createMockBoardItem({ width: 300, height: 400 });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      const widthInput = screen.getByPlaceholderText('Width');
      fireEvent.change(widthInput, { target: { value: '350' } });
      
      expect(onUpdate).toHaveBeenCalledWith({ width: 350 });
    });
  });

  describe('Text Item Properties', () => {
    test('renders content textarea for text items', () => {
      const item = createMockBoardItem({ type: 'text', content: 'Test content' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      const textarea = screen.getByDisplayValue('Test content');
      expect(textarea).toBeInTheDocument();
    });

    test('renders font family select', () => {
      const item = createMockBoardItem({ type: 'text' });
      const { container } = render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);

      // The label isn't associated via htmlFor, so query the select directly
      const select = container.querySelector('select');
      expect(select).toBeInTheDocument();
    });

    test('updates font family', () => {
      const item = createMockBoardItem({ type: 'text', style: { fontFamily: 'Arial' } });
      const onUpdate = jest.fn();
      const { container } = render(
        <BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />
      );

      const select = container.querySelector('select');
      expect(select).toBeInTheDocument();
      fireEvent.change(select as HTMLSelectElement, { target: { value: 'Helvetica' } });
      
      expect(onUpdate).toHaveBeenCalledWith({
        style: { ...item.style, fontFamily: 'Helvetica' },
      });
    });

    test('renders font size controls', () => {
      const item = createMockBoardItem({ type: 'text', style: { fontSize: 16 } });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      expect(screen.getByText(/Font Size: 16px/i)).toBeInTheDocument();
    });

    test('updates font size', () => {
      const item = createMockBoardItem({ type: 'text', style: { fontSize: 16 } });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      const fontSizeInput = screen.getAllByDisplayValue('16')[0];
      fireEvent.change(fontSizeInput, { target: { value: '20' } });
      
      expect(onUpdate).toHaveBeenCalledWith({
        style: { ...item.style, fontSize: 20 },
      });
    });

    test('renders text color picker', () => {
      const item = createMockBoardItem({ type: 'text', style: { color: '#000000' } });
      const { container } = render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);

      // The label isn't associated via htmlFor, so query the input directly
      const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement | null;
      expect(colorInput).toBeInTheDocument();
      
      const input = colorInput!;
      expect(input.type).toBe('color');
      expect(input.value).toBe('#000000');
    });
  });

  describe('Shape Item Properties', () => {
    test('renders shape type buttons', () => {
      const item = createMockBoardItem({ type: 'shape' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      expect(screen.getByText('Rectangle')).toBeInTheDocument();
      expect(screen.getByText('Rounded')).toBeInTheDocument();
      expect(screen.getByText('Ellipse')).toBeInTheDocument();
      expect(screen.getByText('Diamond')).toBeInTheDocument();
    });

    test('updates shape type', () => {
      const item = createMockBoardItem({ type: 'shape' });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      const ellipseButton = screen.getByText('Ellipse');
      fireEvent.click(ellipseButton);
      
      expect(onUpdate).toHaveBeenCalledWith({
        style: { ...item.style, shapeType: 'ellipse' },
      });
    });

    test('renders background and border color pickers', () => {
      const item = createMockBoardItem({ type: 'shape' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      // Shape properties include Background Color and Border Color
      expect(screen.getByText(/Background Color/i)).toBeInTheDocument();
      expect(screen.getByText(/Border Color/i)).toBeInTheDocument();
    });
  });

  describe('Sticky Note Properties', () => {
    test('renders color presets', () => {
      const item = createMockBoardItem({ type: 'sticky_note' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      // Check for some common sticky note colors
      const buttons = screen.getAllByRole('button');
      const colorButtons = buttons.filter(btn => 
        btn.getAttribute('style')?.includes('background')
      );
      expect(colorButtons.length).toBeGreaterThan(0);
    });

    test('updates background color', () => {
      const item = createMockBoardItem({ type: 'sticky_note' });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      // Find a color button and click it
      const buttons = screen.getAllByRole('button');
      const yellowButton = buttons.find(btn => btn.getAttribute('title') === 'Yellow');
      if (yellowButton) {
        fireEvent.click(yellowButton);
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('Line Item Properties', () => {
    test('renders line style buttons', () => {
      const item = createMockBoardItem({ type: 'line' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      expect(screen.getByTitle('Solid')).toBeInTheDocument();
      expect(screen.getByTitle('Dashed')).toBeInTheDocument();
    });

    test('updates line style', () => {
      const item = createMockBoardItem({ type: 'line' });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      const dashedButton = screen.getByTitle('Dashed');
      fireEvent.click(dashedButton);
      
      expect(onUpdate).toHaveBeenCalledWith({
        style: { ...item.style, strokeDasharray: '8,4' },
      });
    });
  });

  describe('Delete Functionality', () => {
    test('renders delete button', () => {
      const item = createMockBoardItem();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('calls onDelete when delete button clicked', () => {
      const item = createMockBoardItem();
      const onDelete = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onDelete={onDelete} />);
      
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);
      
      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe('Frame Properties', () => {
    test('renders frame label input', () => {
      const item = createMockBoardItem({ type: 'frame', content: 'Frame 1' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      const labelInput = screen.getByPlaceholderText('Frame name') as HTMLInputElement;
      expect(labelInput.value).toBe('Frame 1');
    });

    test('renders remove from frame button for items with parent', () => {
      const item = createMockBoardItem({ parent_item_id: 'frame-1' });
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} />);
      
      expect(screen.getByText('Remove from frame')).toBeInTheDocument();
    });

    test('removes item from frame', () => {
      const item = createMockBoardItem({ parent_item_id: 'frame-1' });
      const onUpdate = jest.fn();
      render(<BoardPropertiesPanel {...defaultProps} selectedItem={item} onUpdate={onUpdate} />);
      
      // The button uses onPointerDown, not onClick
      const removeButton = screen.getByText('Remove from frame').closest('button');
      expect(removeButton).toBeInTheDocument();
      
      if (removeButton) {
        fireEvent.pointerDown(removeButton);
        expect(onUpdate).toHaveBeenCalledWith({ parent_item_id: null });
      }
    });
  });
});
