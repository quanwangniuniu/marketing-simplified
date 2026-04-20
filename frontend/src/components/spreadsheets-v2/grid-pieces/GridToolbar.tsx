'use client';

import { Bold, Italic, MoreHorizontal, Redo2, Strikethrough, Table2, Undo2, Upload, Download } from 'lucide-react';
import ToolbarIconButton from './ToolbarIconButton';
import ToolbarDivider from './ToolbarDivider';
import FontSizeControl from './FontSizeControl';
import FontFamilyPicker from './FontFamilyPicker';
import TextColorPicker from './TextColorPicker';
import HighlightColorPicker from './HighlightColorPicker';
import NumberFormatPicker, { NumberFormatValue } from './NumberFormatPicker';

export interface GridToolbarFormatState {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  textColor?: string | null;
  highlightColor?: string | null;
  fontFamily?: string;
  fontSize?: number;
  numberFormat?: NumberFormatValue | null;
}

interface Props {
  format: GridToolbarFormatState;
  disabled?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onFormatChange: (next: Partial<GridToolbarFormatState>) => void;
  onImport?: () => void;
  onExport?: () => void;
  onPivot?: () => void;
  onMore?: () => void;
}

export default function GridToolbar({
  format,
  disabled = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onFormatChange,
  onImport,
  onExport,
  onPivot,
  onMore,
}: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Spreadsheet toolbar"
      className="flex flex-wrap items-center gap-1 rounded-lg bg-white px-2 py-1.5 ring-1 ring-gray-200"
    >
      <ToolbarIconButton label="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarIconButton>
      <ToolbarIconButton label="Redo (⌘⇧Z)" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarIconButton>

      <ToolbarDivider />

      <NumberFormatPicker
        value={format.numberFormat}
        disabled={disabled}
        onChange={(nf) => onFormatChange({ numberFormat: nf })}
      />

      <ToolbarDivider />

      <FontFamilyPicker
        value={format.fontFamily || 'Default'}
        disabled={disabled}
        onChange={(fam) => onFormatChange({ fontFamily: fam })}
      />

      <ToolbarDivider />

      <FontSizeControl
        value={format.fontSize ?? 12}
        disabled={disabled}
        onChange={(size) => onFormatChange({ fontSize: size })}
      />

      <ToolbarDivider />

      <ToolbarIconButton
        label="Bold (⌘B)"
        active={!!format.bold}
        disabled={disabled}
        onClick={() => onFormatChange({ bold: !format.bold })}
      >
        <Bold className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Italic (⌘I)"
        active={!!format.italic}
        disabled={disabled}
        onClick={() => onFormatChange({ italic: !format.italic })}
      >
        <Italic className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarIconButton>
      <ToolbarIconButton
        label="Strikethrough (⌘⇧X)"
        active={!!format.strikethrough}
        disabled={disabled}
        onClick={() => onFormatChange({ strikethrough: !format.strikethrough })}
      >
        <Strikethrough className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarIconButton>

      <TextColorPicker
        value={format.textColor ?? null}
        disabled={disabled}
        onChange={(color) => onFormatChange({ textColor: color })}
      />

      <ToolbarDivider />

      <HighlightColorPicker
        value={format.highlightColor ?? null}
        disabled={disabled}
        onChange={(color) => onFormatChange({ highlightColor: color })}
      />

      <ToolbarDivider />

      {onImport && (
        <ToolbarIconButton label="Import CSV or XLSX" onClick={onImport}>
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarIconButton>
      )}
      {onExport && (
        <ToolbarIconButton label="Export" onClick={onExport}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarIconButton>
      )}
      {onPivot && (
        <ToolbarIconButton label="Create pivot" onClick={onPivot}>
          <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarIconButton>
      )}

      {onMore && (
        <>
          <ToolbarDivider />
          <ToolbarIconButton label="More" onClick={onMore}>
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarIconButton>
        </>
      )}
    </div>
  );
}
