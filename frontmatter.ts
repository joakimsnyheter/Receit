import { App, TFile, Notice } from "obsidian";
import { ReadReceiptEntry } from "./types";

function parseStoredReadAt(raw: string): Date {
  // Legacy/frontmatter format without zone has historically represented UTC.
  // Interpret as UTC so we can migrate and rewrite as local wall time.
  const utcNoZonePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
  if (utcNoZonePattern.test(raw)) {
    return new Date(raw.replace(" ", "T") + "Z");
  }
  return new Date(raw);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

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
      // Legacy object format: { user, readAt } - migrate transparently
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
): Promise<"added" | "updated"> {
  const existing = getReceipts(app, file, fieldName);
  const existingIndex = existing.findIndex((e) => e.user === userName);
  const nowIso = new Date().toISOString();

  if (existingIndex >= 0) {
    const updated = existing.map((entry, index) =>
      index === existingIndex ? { ...entry, readAt: nowIso } : entry
    );
    await writeReceipts(app, file, fieldName, updated);
    return "updated";
  }

  const updated: ReadReceiptEntry[] = [
    ...existing,
    { user: userName, readAt: nowIso },
  ];
  await writeReceipts(app, file, fieldName, updated);
  return "added";
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
  const d = parseStoredReadAt(entry.readAt);
  if (isNaN(d.getTime())) return `${entry.user}: ${entry.readAt}`;
  // Store local wall time so Obsidian properties and panel show the same clock time.
  const date =
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return `${entry.user}: ${date}`;
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
