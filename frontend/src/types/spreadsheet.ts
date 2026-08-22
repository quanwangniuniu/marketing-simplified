// Type definitions for Spreadsheet feature

export interface SpreadsheetData {
  id: number;
  slug?: string;
  project: number;
  name: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface SpreadsheetListResponse {
  count: number;
  page: number;
  page_size: number;
  results: SpreadsheetData[];
}

export interface CreateSpreadsheetRequest {
  name: string;
}

export interface UpdateSpreadsheetRequest {
  name: string;
}

export interface PivotConfigDTO {
  id: number;
  source_sheet_id: number;
  rows_config: any[];
  columns_config: any[];
  values_config: any[];
  filters_config?: any;
  show_grand_total_row: boolean;
  show_grand_total_column: boolean;
}

export interface SheetData {
  id: number;
  spreadsheet: number;
  name: string;
  position: number;
  revision?: number;
  kind?: 'normal' | 'pivot';
  pivot_config?: PivotConfigDTO | null;
  frozen_row_count?: number;
  frozen_column_count?: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface SheetListResponse {
  count: number;
  page: number;
  page_size: number;
  results: SheetData[];
}

export interface CreateSheetRequest {
  name: string;
}

export interface UpdateSheetRequest {
  name?: string;
  frozen_row_count?: number;
  frozen_column_count?: number;
}
