/**
 * All user-visible messages for the Agent area.
 * Update copy here instead of hardcoding in components.
 */
export const AGENT_MESSAGES = {
  // Upload
  UPLOAD_SUCCESS: 'CSV uploaded successfully',
  UPLOAD_FAILED: 'Failed to upload CSV. Please try again.',
  UPLOAD_NO_FILE: 'No file selected.',
  // Delete
  DELETE_SUCCESS: 'CSV file removed from list',
  DELETE_FAILED: 'Failed to delete file. Please try again.',
  DELETE_CONFIRM_TITLE: 'Delete CSV File',
  DELETE_CONFIRM_MSG: (name: string) =>
    `Are you sure you want to remove "${name}" from the list? The file will no longer appear in Spreadsheets.`,
  // Report loading
  REPORTS_LOAD_FAILED: 'Failed to load reports.',
  REPORT_NOT_FOUND: 'Report not found.',
  // General
  NO_PROJECT: 'No active project.',
  // Pipeline
  SESSION_CREATE_FAILED: 'Failed to create session. Please try again.',
  ANALYSIS_NO_PROVIDER: 'No analysis provider configured. Please contact your administrator.',
  ANALYSIS_FAILED: 'Analysis failed. Please try again.',
  ANALYSIS_EMPTY_CSV: 'CSV file is empty or could not be parsed.',
  // Chat
  CHAT_WELCOME: 'Welcome! Upload your ad performance CSV file to begin analysis.',
  CHAT_THINKING: 'Thinking...',
  CHAT_GENERAL_GUIDANCE:
    "I can help you analyze spreadsheet data and recommended tasks. To get started, select a spreadsheet and use the 'analyze' action.",
  // Empty states
  EMPTY_PERFORMANCE_CHART: 'Upload a CSV report via the Pipeline to see performance trends',
  EMPTY_ANOMALY_ALERTS: 'No active alerts',
  EMPTY_LOADING: 'Loading...',
} as const;
