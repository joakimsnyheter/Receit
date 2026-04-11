import { App, TFile, Notice } from "obsidian";
import { ReadReceiptEntry } from "./types";

export function getReceipts(
  app: App,
  file: TFile,
  fieldName: string
): ReadReceiptEntry[] {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter) return [];

  const field = cache.frontmatter[fieldName];
  if (!field) return [];

  const items: unknown[] = Array.isArray(field)
    ? field
    : Array.isArray(field.users)
    ? field.users
    : [];

  const result: ReadReceiptEntry[] = [];
  for (const item of items) {
    // Current format: "JJ: 11 apr 2026, 13:46"
    if (typeof item === "string") {
      const idx = item.indexOf(": ");
      if (idx > 0) {
        result.push({ user: item.slice(0, idx), readAt: item.slice(idx + 2) });
      }
    // Legacy object format: { user, readAt } — migrate transparently
    } else if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as ReadReceiptEntry).user === "string" &&
      typeof (item as ReadReceiptEntry).readAt === "string"
    ) {
      result.push(item as ReadReceiptEntry);
    }
  }
  return result;
}

export async function addReceipt(
  app: App,
  file: TFile,
  fieldName: string,
  userName: string
): Promise<void> {
  const existing = getReceipts(app, file, fieldName);
  if (existing.some((e) => e.user === userName)) return; // deduplicate

  const updated: ReadReceiptEntry[] = [
    ...existing,
    { user: userName, readAt: new Date().toISOString() },
  ];
  await writeReceipts(app, file, fieldName, updated);
}

export async function removeReceipt(
  app: App,
  file: TFile,
  fieldName: string,
  userName: string
): Promise<void> {
  const existing = getReceipts(app, file, fieldName);
  const updated = existing.filter((e) => e.user !== userName);
  await writeReceipts(app, file, fieldName, updated);
}

export async function toggleReceipt(
  app: App,
  file: TFile,
  fieldName: string,
  userName: string
): Promise<"added" | "removed"> {
  const existing = getReceipts(app, file, fieldName);
  if (existing.some((e) => e.user === userName)) {
    await removeReceipt(app, file, fieldName, userName);
    return "removed";
  } else {
    await addReceipt(app, file, fieldName, userName);
    return "added";
  }
}

function serializeEntry(entry: ReadReceiptEntry): string {
  // Always store ISO timestamp — display formatting happens in the UI layer
  return `${entry.user}: ${entry.readAt}`;
}

async function writeReceipts(
  app: App,
  file: TFile,
  fieldName: string,
  entries: ReadReceiptEntry[]
): Promise<void> {
  try {
    await app.fileManager.processFrontMatter(file, (fm) => {
      fm[fieldName] = entries.map(serializeEntry);
    });
  } catch (err) {
    new Notice(`Read Receipt: Could not update frontmatter. ${err}`);
    throw err;
  }
}
