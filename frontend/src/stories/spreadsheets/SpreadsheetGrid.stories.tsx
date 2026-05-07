import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor, screen } from '@storybook/test';
import { fireEvent } from '@testing-library/dom';
import SpreadsheetGrid from '@/components/spreadsheets/SpreadsheetGrid';

/** Unique sheetId per story so module-level caches don't leak between stories */
function storySheetId(storyId: string | undefined): number {
  const id = storyId ?? 'default';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return 10000 + Math.abs(h % 10000);
}

/** Get cell by row/col; cells use data-row and data-col, not data-testid */
function getCell(container: HTMLElement, row: number, col: number): HTMLTableCellElement {
  const cell = container.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
  if (!cell) throw new Error(`Cell ${row},${col} not found`);
  return cell as HTMLTableCellElement;
}

const meta: Meta<typeof SpreadsheetGrid> = {
  title: 'Spreadsheets/SpreadsheetGrid',
  component: SpreadsheetGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    chromatic: { delay: 500 },
    docs: {
      description: {
        component:
          'Editable spreadsheet grid with cells, formulas, export (CSV/XLSX), import, undo, and cell highlighting. Uses mock API in Storybook. Supports A1-style references and formula evaluation.',
      },
    },
  },
  decorators: [
    (Story, context) => (
      <div key={context.id ?? context.storyId ?? 'story'} className="h-[600px] w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SpreadsheetGrid>;

const gridProps = {
  spreadsheetId: 1,
  spreadsheetName: 'Sheet',
  sheetName: 'Sheet1',
};

export const Default: Story = {
  parameters: {
    docs: { description: { story: 'Grid with toolbar (Export, Undo, Import, Highlight) and select-all.' } },
  },
  render: (_, context) => (
    <SpreadsheetGrid
      {...gridProps}
      sheetId={storySheetId(context.id ?? context.storyId)}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('button', { name: /Export/i })).toBeInTheDocument());
    await expect(canvas.getByRole('button', { name: /Undo/i })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /^Import$/i })).toBeInTheDocument();
    await expect(canvas.getByTestId('highlight-button')).toBeInTheDocument();
    await expect(canvas.getByTestId('select-all-cell')).toBeInTheDocument();
  },
};





export const HighlightToolbar: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: { description: { story: 'Select cell, click Highlight, apply yellow, and assert cell style.' } },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('td[data-row="0"][data-col="0"]')).toBeInTheDocument());
    const cell = getCell(canvasElement, 0, 0);
    await userEvent.click(cell);
    const highlightBtn = canvas.getByTestId('highlight-button');
    await userEvent.click(highlightBtn);
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await expect(screen.getByTestId('highlight-color-yellow')).toBeInTheDocument();
    await expect(screen.getByTestId('highlight-clear')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('highlight-color-yellow'));
    await waitFor(() => {
      const bg = window.getComputedStyle(cell).backgroundColor;
      expect(bg).toMatch(/rgb\(254,\s*240,\s*138\)|#FEF08A|rgb\(254 240 138\)/);
    });
  },
};

export const CellSelection: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: { description: { story: 'Click a cell to select it.' } },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('td[data-row="0"][data-col="0"]')).toBeInTheDocument());
    const cell = getCell(canvasElement, 0, 0);
    await userEvent.click(cell);
    await expect(cell).toBeInTheDocument();
  },
};

async function createTestXlsxFile(): Promise<File> {
  const XLSXImport = await import('xlsx');
  const XLSX = (XLSXImport as { default?: unknown }).default ?? XLSXImport;
  const x = XLSX as { utils: { book_new: () => unknown; aoa_to_sheet: (d: unknown[][]) => unknown; book_append_sheet: (wb: unknown, ws: unknown, n: string) => void }; write: (wb: unknown, opts: { bookType: string; type: string }) => ArrayBuffer };
  const wb = x.utils.book_new();
  const ws = x.utils.aoa_to_sheet([
    ['Hello', 'World'],
    ['A2', 'B2'],
  ]);
  x.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = x.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export const ExcelImport: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: { description: { story: 'Import an Excel file and verify data appears in the grid.' } },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('button', { name: /^Import$/i })).toBeInTheDocument());
    const file = await createTestXlsxFile();
    const fileInput = canvasElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fireEvent.change(fileInput, { bubbles: true });
    await waitFor(
      () => {
        const cell = getCell(canvasElement, 0, 0);
        expect(cell).toHaveTextContent('Hello');
      },
      { timeout: 10000 }
    );
  },
};

export const ExcelExport: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: { description: { story: 'Export as XLSX; logs the action instead of triggering browser download.' } },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalClick = HTMLAnchorElement.prototype.click;
    (window as unknown as { __exportXlsxCalled?: boolean }).__exportXlsxCalled = false;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download?.endsWith('.xlsx')) {
        (window as unknown as { __exportXlsxCalled?: boolean }).__exportXlsxCalled = true;
      }
    };
    try {
      await waitFor(() => expect(canvas.getByRole('button', { name: /Export/i })).toBeInTheDocument());
      await userEvent.click(canvas.getByRole('button', { name: /Export/i }));
      await userEvent.click(screen.getByRole('menuitem', { name: /Export as XLSX/i }));
      await waitFor(
        () =>
          expect((window as unknown as { __exportXlsxCalled?: boolean }).__exportXlsxCalled).toBe(true),
        { timeout: 5000 }
      );
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      delete (window as unknown as { __exportXlsxCalled?: boolean }).__exportXlsxCalled;
    }
  },
};

export const FormatToolbar: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story: 'Apply Bold, Italic, Strikethrough, and font color to a cell and assert format styles.',
      },
    },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('td[data-row="0"][data-col="0"]')).toBeInTheDocument());
    const cell = getCell(canvasElement, 0, 0);
    await userEvent.dblClick(cell);
    await userEvent.keyboard('FillTest');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(cell).toHaveTextContent('FillTest'));
    await userEvent.click(cell);
    await userEvent.click(canvas.getByTestId('format-bold'));
    await waitFor(() => {
      const content = cell.querySelector('[class*="text-gray-900"]') ?? cell;
      expect(window.getComputedStyle(content).fontWeight).toBe('700');
    });
    await userEvent.click(canvas.getByTestId('format-italic'));
    await waitFor(() => {
      const content = cell.querySelector('[class*="text-gray-900"]') ?? cell;
      expect(window.getComputedStyle(content).fontStyle).toBe('italic');
    });
    await userEvent.click(canvas.getByTestId('format-strikethrough'));
    await waitFor(() => {
      const content = cell.querySelector('[class*="text-gray-900"]') ?? cell;
      expect(window.getComputedStyle(content).textDecoration).toContain('line-through');
    });
    await userEvent.click(canvas.getByTestId('format-text-color'));
    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Red'));
    await waitFor(() => {
      const content = cell.querySelector('[class*="text-gray-900"]') ?? cell;
      const color = window.getComputedStyle(content).color;
      expect(color).toMatch(/rgb\(220,\s*38,\s*38\)|#DC2626|rgb\(220 38 38\)/);
    });
  },
};

export const UndoRedo: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story: 'Fill a cell, Undo to revert, Redo to restore the value.',
      },
    },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('td[data-row="0"][data-col="0"]')).toBeInTheDocument());
    const cell = getCell(canvasElement, 0, 0);
    await userEvent.dblClick(cell);
    await userEvent.keyboard('UndoTest');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(cell).toHaveTextContent('UndoTest'));
    await userEvent.click(canvas.getByRole('button', { name: /Undo/i }));
    await waitFor(() => expect(cell).toHaveTextContent(''));
    await userEvent.click(canvas.getByRole('button', { name: /Redo/i }));
    await waitFor(() => expect(cell).toHaveTextContent('UndoTest'));
  },
};

export const AddRow: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story: 'Scroll to bottom, use Add rows input to add 1 row, verify row count increases.',
      },
    },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('row-header-0')).toBeInTheDocument());
    const scrollContainer = canvasElement.querySelector('.spreadsheet-scroll-container') as HTMLDivElement;
    expect(scrollContainer).toBeTruthy();
    await userEvent.click(scrollContainer);
    scrollContainer.scrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    await waitFor(
      () => expect(canvas.getByText('Add')).toBeInTheDocument(),
      { timeout: 5000 }
    );
    const addInput = canvasElement.querySelector('input[type="number"]') as HTMLInputElement;
    expect(addInput).toBeTruthy();
    fireEvent.change(addInput, { target: { value: '' } });
    fireEvent.change(addInput, { target: { value: '1' } });
    await userEvent.click(canvas.getByText('Add'));
    scrollContainer.scrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    await waitFor(
      () => expect(canvas.getByTestId('row-header-1000')).toBeInTheDocument(),
      { timeout: 5000 }
    );
  },
};

export const DeleteColumn: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story: 'Right-click column header, delete column, verify column is removed.',
      },
    },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('col-header-1')).toBeInTheDocument());
    const cellB1 = getCell(canvasElement, 0, 1);
    await userEvent.dblClick(cellB1);
    await userEvent.keyboard('ToDelete');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(cellB1).toHaveTextContent('ToDelete'));
    await new Promise((r) => setTimeout(r, 600));
    const colHeader = canvas.getByTestId('col-header-1');
    fireEvent.contextMenu(colHeader);
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: /Delete column/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete column/i }));
    await waitFor(
      () => {
        expect(getCell(canvasElement, 0, 1)).not.toHaveTextContent('ToDelete');
      },
      { timeout: 5000 }
    );
  },
};

export const InsertColumn: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story:
          'Fill 3 column headers (row 0), insert left and right on center column, verify new columns are empty.',
      },
    },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('td[data-row="0"][data-col="0"]')).toBeInTheDocument());
    const cellA1 = getCell(canvasElement, 0, 0);
    const cellB1 = getCell(canvasElement, 0, 1);
    const cellC1 = getCell(canvasElement, 0, 2);
    await userEvent.dblClick(cellA1);
    await userEvent.keyboard('H1');
    await userEvent.keyboard('{Enter}');
    await userEvent.dblClick(cellB1);
    await userEvent.keyboard('H2');
    await userEvent.keyboard('{Enter}');
    await userEvent.dblClick(cellC1);
    await userEvent.keyboard('H3');
    await userEvent.keyboard('{Enter}');
    await waitFor(
      () => {
        expect(getCell(canvasElement, 0, 0)).toHaveTextContent('H1');
        expect(getCell(canvasElement, 0, 1)).toHaveTextContent('H2');
        expect(getCell(canvasElement, 0, 2)).toHaveTextContent('H3');
      },
      { timeout: 1000 }
    );
    await new Promise((r) => setTimeout(r, 600));
    const colHeaderB = canvas.getByTestId('col-header-1');
    fireEvent.contextMenu(colHeaderB);
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: /Insert column left/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Insert column left/i }));
    await waitFor(
      () => {
        expect(getCell(canvasElement, 0, 0)).toHaveTextContent('H1');
        expect(getCell(canvasElement, 0, 1)).toHaveTextContent('');
        expect(getCell(canvasElement, 0, 2)).toHaveTextContent('H2');
      },
      { timeout: 5000 }
    );
    const colHeaderH2 = canvas.getByTestId('col-header-2');
    fireEvent.contextMenu(colHeaderH2);
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: /Insert column right/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Insert column right/i }));
    await waitFor(
      () => {
        expect(getCell(canvasElement, 0, 0)).toHaveTextContent('H1');
        expect(getCell(canvasElement, 0, 1)).toHaveTextContent('');
        expect(getCell(canvasElement, 0, 2)).toHaveTextContent('H2');
        expect(getCell(canvasElement, 0, 3)).toHaveTextContent('');
        expect(getCell(canvasElement, 0, 4)).toHaveTextContent('H3');
      },
      { timeout: 5000 }
    );
  },
};

export const ColumnFill: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        story:
          'Press fill crosshair. Asserts the crosshair appears on the selected cell.',
      },
    },
  },
  render: (_, context) => (
    <SpreadsheetGrid {...gridProps} sheetId={storySheetId(context.id ?? context.storyId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('td[data-row="0"][data-col="0"]')).toBeInTheDocument());
    const cellA1 = getCell(canvasElement, 0, 0);
    await userEvent.dblClick(cellA1);
    await userEvent.keyboard('FillTest');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(cellA1).toHaveTextContent('FillTest'));
    await userEvent.click(cellA1);
    const fillHandle = await waitFor(
      () => {
        const h = cellA1.querySelector('.cursor-crosshair') ?? cellA1.querySelector('[class*="cursor-crosshair"]');
        if (!h) throw new Error('Fill handle not found');
        return h as HTMLElement;
      },
      { timeout: 2000 }
    );
    await expect(fillHandle).toBeInTheDocument();
    await userEvent.click(fillHandle);
  },
};
