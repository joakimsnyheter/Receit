export interface ReadReceiptEntry {
  user: string;
  readAt: string;
}

export type DisplayMode = "full" | "compact" | "count";
export type SortOrder = "newest" | "oldest";
export type DateFormat = "short" | "iso" | "eu";

export interface ReadReceiptPluginSettings {
  userName: string;
  fieldName: string;
  showTimestamps: boolean;
  sortOrder: SortOrder;
  showInNoteView: boolean;
  enableRibbonIcon: boolean;
  enableStatusBar: boolean;
  displayMode: DisplayMode;
  dateFormat: DateFormat;
  notifyOnNewReader: boolean;
}

export const DEFAULT_SETTINGS: ReadReceiptPluginSettings = {
  userName: "",
  fieldName: "read_receipts",
  showTimestamps: true,
  sortOrder: "newest",
  showInNoteView: true,
  enableRibbonIcon: true,
  enableStatusBar: true,
  displayMode: "full",
  dateFormat: "short",
  notifyOnNewReader: true,
};
