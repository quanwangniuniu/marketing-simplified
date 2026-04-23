import api from '../api';
import {
  SpreadsheetData,
  SpreadsheetListResponse,
  CreateSpreadsheetRequest,
  UpdateSpreadsheetRequest,
  SheetData,
  SheetListResponse,
  CreateSheetRequest,
  UpdateSheetRequest,
  PivotConfigDTO,
} from '@/types/spreadsheet';

/** Timeout for long-running spreadsheet requests (import batch, large range read). Default axios 10s is too short. */
const SPREADSHEET_LONG_REQUEST_TIMEOUT_MS = 300000; // 5 minutes (safety net; optimized batch writes should finish in <5s)

export const SpreadsheetAPI = {
  // List spreadsheets for a project
  listSpreadsheets: async (
    projectId: number,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
      order_by?: 'name' | 'created_at' | 'updated_at';
    }
  ): Promise<SpreadsheetListResponse> => {
    const queryParams: any = {
      project_id: projectId,
      ...params,
    };
    const response = await api.get<SpreadsheetListResponse>('/api/spreadsheet/spreadsheets/', {
      params: queryParams,
    });
    return response.data;
  },

  // Get a specific spreadsheet by ID
  getSpreadsheet: async (spreadsheetId: number): Promise<SpreadsheetData> => {
    const response = await api.get<SpreadsheetData>(`/api/spreadsheet/spreadsheets/${spreadsheetId}/`);
    return response.data;
  },

  // Create a new spreadsheet
  createSpreadsheet: async (
    projectId: number,
    data: CreateSpreadsheetRequest
  ): Promise<SpreadsheetData> => {
    const response = await api.post<SpreadsheetData>(
      `/api/spreadsheet/spreadsheets/?project_id=${projectId}`,
      data
    );
    return response.data;
  },

  // Update a spreadsheet
  updateSpreadsheet: async (
    spreadsheetId: number,
    data: UpdateSpreadsheetRequest
  ): Promise<SpreadsheetData> => {
    const response = await api.put<SpreadsheetData>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/`,
      data
    );
    return response.data;
  },

  // Delete a spreadsheet (soft delete)
  deleteSpreadsheet: async (spreadsheetId: number): Promise<void> => {
    await api.delete(`/api/spreadsheet/spreadsheets/${spreadsheetId}/`);
  },

  // Sheet operations
  // List sheets for a spreadsheet
  listSheets: async (
    spreadsheetId: number,
    params?: {
      page?: number;
      page_size?: number;
      order_by?: 'name' | 'position' | 'created_at';
    }
  ): Promise<SheetListResponse> => {
    const queryParams: any = {
      ...params,
    };
    const response = await api.get<SheetListResponse>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/`,
      { params: queryParams }
    );
    return response.data;
  },

  // Get a specific sheet by ID
  getSheet: async (spreadsheetId: number, sheetId: number): Promise<SheetData> => {
    const response = await api.get<SheetData>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/`
    );
    return response.data;
  },

  // Create a new sheet
  createSheet: async (
    spreadsheetId: number,
    data: CreateSheetRequest
  ): Promise<SheetData> => {
    const response = await api.post<SheetData>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/`,
      data
    );
    return response.data;
  },

  // Update a sheet
  updateSheet: async (
    spreadsheetId: number,
    sheetId: number,
    data: UpdateSheetRequest
  ): Promise<SheetData> => {
    const response = await api.put<SheetData>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/`,
      data
    );
    return response.data;
  },

  // Sort rows by column (updates SheetRow.position only, no cell rewrite)
  sortSheet: async (
    spreadsheetId: number,
    sheetId: number,
    params: {
      column_position: number;
      direction: 'asc' | 'desc';
      has_header: boolean;
      previous_sort_columns?: Array<number | { column_position: number; direction: 'asc' | 'desc' }>;
    }
  ): Promise<{
    previous_order: Array<{ row_id: number; position: number }>;
    new_order: Array<{ row_id: number; position: number }>;
  }> => {
    const response = await api.post<{
      previous_order: Array<{ row_id: number; position: number }>;
      new_order: Array<{ row_id: number; position: number }>;
    }>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/sort/`,
      {
        column_position: params.column_position,
        direction: params.direction,
        has_header: params.has_header,
        previous_sort_columns: params.previous_sort_columns ?? [],
      }
    );
    return response.data;
  },

  // Reorder rows by position (for undo/redo)
  reorderRows: async (
    spreadsheetId: number,
    sheetId: number,
    params: { order: Array<{ row_id: number; position: number }> }
  ): Promise<{ status: string }> => {
    const response = await api.post<{ status: string }>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/reorder-rows/`,
      { order: params.order }
    );
    return response.data;
  },

  // Delete a sheet (soft delete) via project-scoped endpoint
  deleteSheet: async (projectId: number, spreadsheetId: number, sheetId: number): Promise<void> => {
    await api.delete(
      `/api/projects/${projectId}/spreadsheets/${spreadsheetId}/sheets/${sheetId}/`
    );
  },

  // Cell operations
  // Read cells in a range
  readCellRange: async (
    spreadsheetId: number,
    sheetId: number,
    startRow: number,
    endRow: number,
    startColumn: number,
    endColumn: number,
    options?: { includeSheetDimensions?: boolean }
  ): Promise<{
    cells: Array<{
      id: number;
      row_position: number;
      column_position: number;
      value_type: string;
      string_value?: string | null;
      number_value?: number | null;
      boolean_value?: boolean | null;
      formula_value?: string | null;
      raw_input?: string | null;
      computed_type?: string | null;
      computed_number?: number | string | null;
      computed_string?: string | null;
      error_code?: string | null;
    }>;
    row_count: number;
    column_count: number;
    /** Full sheet dimensions (use for grid size). When present, prefer over row_count/column_count which are the requested range size. */
    sheet_row_count?: number | null;
    sheet_column_count?: number | null;
  }> => {
    const response = await api.post<{
      cells: Array<{
        id: number;
        row_position: number;
        column_position: number;
        value_type: string;
        string_value?: string | null;
        number_value?: number | null;
        boolean_value?: boolean | null;
        formula_value?: string | null;
        raw_input?: string | null;
        computed_type?: string | null;
        computed_number?: number | string | null;
        computed_string?: string | null;
        error_code?: string | null;
      }>;
      row_count: number;
      column_count: number;
      sheet_row_count?: number | null;
      sheet_column_count?: number | null;
    }>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/cells/range/`,
      {
        start_row: startRow,
        end_row: endRow,
        start_column: startColumn,
        end_column: endColumn,
        ...(options?.includeSheetDimensions === false
          ? { include_sheet_dimensions: false }
          : {}),
      },
      { timeout: SPREADSHEET_LONG_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  },

  // Batch update cells
  batchUpdateCells: async (
    spreadsheetId: number,
    sheetId: number,
    operations: Array<{
      operation: 'set' | 'clear';
      row: number;
      column: number;
      raw_input?: string | null;
      value_type?: string;
      string_value?: string | null;
      number_value?: number | null;
      boolean_value?: boolean | null;
      formula_value?: string | null;
    }>,
    autoExpand: boolean = true,
    options?: {
      importId?: string;
      chunkIndex?: number;
      importMode?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<{
    updated: number;
    cleared: number;
    rows_expanded: number;
    columns_expanded: number;
    cells?: Array<{
      id: number;
      row_position: number;
      column_position: number;
      value_type: string;
      string_value?: string | null;
      number_value?: number | null;
      boolean_value?: boolean | null;
      formula_value?: string | null;
      raw_input?: string | null;
      computed_type?: string | null;
      computed_number?: number | string | null;
      computed_string?: string | null;
      error_code?: string | null;
    }>;
  }> => {
    const body: Record<string, unknown> = {
      operations,
      auto_expand: autoExpand,
    };
    if (options?.importId != null) body.import_id = options.importId;
    if (options?.chunkIndex != null) body.chunk_index = options.chunkIndex;
    if (options?.importMode === true) body.import_mode = true;

    const config: { timeout: number; signal?: AbortSignal } = {
      timeout: SPREADSHEET_LONG_REQUEST_TIMEOUT_MS,
    };
    if (options?.signal) config.signal = options.signal;

    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/cells/batch/`,
      body,
      config
    );
    return response.data;
  },

  /** Finalize import: recompute formulas and update sheet meta. Call after all batch chunks complete. */
  finalizeImport: async (
    spreadsheetId: number,
    sheetId: number,
    importId: string
  ): Promise<{ status: string }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/cells/import-finalize/`,
      { import_id: importId },
      { timeout: SPREADSHEET_LONG_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  },

  // Highlights
  getHighlights: async (
    spreadsheetId: number,
    sheetId: number
  ): Promise<{
    highlights: Array<{
      id: number;
      scope: 'CELL' | 'ROW' | 'COLUMN';
      row_index: number | null;
      col_index: number | null;
      color: string;
      created_at: string;
      updated_at: string;
    }>;
  }> => {
    const response = await api.get(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/highlights/`
    );
    return response.data;
  },

  getCellFormats: async (
    spreadsheetId: number,
    sheetId: number
  ): Promise<{
    formats: Array<{
      id: number;
      row_index: number;
      column_index: number;
      bold: boolean;
      italic: boolean;
      strikethrough: boolean;
      text_color: string | null;
      font_family: string | null;
      font_size: number | null;
      number_format: {
        type?: 'GENERAL' | 'NUMBER' | 'CURRENCY' | 'PERCENT';
        currency_code?: string | null;
        decimal_places?: number | null;
      } | null;
      created_at: string;
      updated_at: string;
    }>;
  }> => {
    const response = await api.get(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/cell-formats/`
    );
    return response.data;
  },

  batchUpdateCellFormats: async (
    spreadsheetId: number,
    sheetId: number,
    ops: Array<{
      row: number;
      column: number;
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      text_color?: string | null;
      font_family?: string | null;
      font_size?: number | null;
      number_format?: {
        type?: 'GENERAL' | 'NUMBER' | 'CURRENCY' | 'PERCENT';
        currency_code?: string | null;
        decimal_places?: number | null;
      } | null;
    }>
  ): Promise<{ updated: number }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/cell-formats/batch/`,
      { ops }
    );
    return response.data;
  },

  batchUpdateHighlights: async (
    spreadsheetId: number,
    sheetId: number,
    ops: Array<{
      scope: 'CELL' | 'ROW' | 'COLUMN';
      row?: number;
      col?: number;
      color?: string;
      operation: 'SET' | 'CLEAR';
    }>
  ): Promise<{ updated: number; deleted: number }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/highlights/batch/`,
      { ops }
    );
    return response.data;
  },

  // Resize sheet (ensure minimum dimensions)
  resizeSheet: async (
    spreadsheetId: number,
    sheetId: number,
    rowCount: number,
    columnCount: number
  ): Promise<{
    rows_created: number;
    columns_created: number;
    total_rows: number;
    total_columns: number;
  }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/resize/`,
      {
        row_count: rowCount,
        column_count: columnCount,
      }
    );
    return response.data;
  },

  // Insert rows
  insertRows: async (
    spreadsheetId: number,
    sheetId: number,
    position: number,
    count: number = 1
  ): Promise<{
    rows_created: number;
    total_rows: number;
    operation_id: number;
  }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/rows/insert/`,
      {
        position,
        count,
      }
    );
    return response.data;
  },

  // Insert columns
  insertColumns: async (
    spreadsheetId: number,
    sheetId: number,
    position: number,
    count: number = 1
  ): Promise<{
    columns_created: number;
    total_columns: number;
    operation_id: number;
  }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/columns/insert/`,
      {
        position,
        count,
      }
    );
    return response.data;
  },

  // Delete rows
  deleteRows: async (
    spreadsheetId: number,
    sheetId: number,
    position: number,
    count: number = 1
  ): Promise<{
    rows_deleted: number;
    total_rows: number;
    operation_id: number;
  }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/rows/delete/`,
      {
        position,
        count,
      }
    );
    return response.data;
  },

  // Delete columns
  deleteColumns: async (
    spreadsheetId: number,
    sheetId: number,
    position: number,
    count: number = 1
  ): Promise<{
    columns_deleted: number;
    total_columns: number;
    operation_id: number;
  }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/columns/delete/`,
      {
        position,
        count,
      }
    );
    return response.data;
  },

  // Revert structure operation
  revertStructureOperation: async (
    spreadsheetId: number,
    sheetId: number,
    operationId: number
  ): Promise<{ operation_id: number; is_reverted: boolean }> => {
    const response = await api.post(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/operations/${operationId}/revert/`,
      {}
    );
    return response.data;
  },

  // Upsert pivot configuration for a sheet and trigger recompute
  upsertPivotConfig: async (
    spreadsheetId: number,
    sheetId: number,
    payload: {
      sourceSheetId: number;
      rows: any[];
      columns: any[];
      values: any[];
      filters?: any;
      showGrandTotalRow?: boolean;
      showGrandTotalColumn?: boolean;
    }
  ): Promise<PivotConfigDTO> => {
    const body: Record<string, unknown> = {
      source_sheet_id: payload.sourceSheetId,
      rows_config: payload.rows,
      columns_config: payload.columns,
      values_config: payload.values,
    };
    if (payload.filters !== undefined) body.filters_config = payload.filters;
    if (payload.showGrandTotalRow !== undefined) body.show_grand_total_row = payload.showGrandTotalRow;
    if (payload.showGrandTotalColumn !== undefined) {
      body.show_grand_total_column = payload.showGrandTotalColumn;
    }

    const response = await api.post<PivotConfigDTO>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/pivot-config/`,
      body
    );
    return response.data;
  },
  // Trigger backend pivot recompute based on persisted config (fire-and-forget from UI).
  recomputePivot: async (
    spreadsheetId: number,
    sheetId: number
  ): Promise<{ status: string; detail?: string }> => {
    const response = await api.post<{ status: string; detail?: string }>(
      `/api/spreadsheet/spreadsheets/${spreadsheetId}/sheets/${sheetId}/pivot-recompute/`,
      {}
    );
    return response.data;
  },
};

