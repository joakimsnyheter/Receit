import {
  ReadReceiptEntry,
  ReadReceiptPluginSettings,
  DateFormat,
} from "./types";

export interface ReceiptDocumentMeta {
  author: string | null;
  updatedAt: string;
}

export function formatTimestamp(raw: string, format: DateFormat): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  switch (format) {
    case "iso":
      return d.toISOString().slice(0, 16).replace("T", " ");
    case "eu":
      return (
        d.toLocaleDateString("sv-SE", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }) +
        " " +
        d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
      );
    case "short":
    default:
      return (
        d.toLocaleDateString("sv-SE", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) +
        ", " +
        d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
      );
  }
}

export function formatTooltip(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function sortEntries(
  entries: ReadReceiptEntry[],
  order: "newest" | "oldest"
): ReadReceiptEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = new Date(a.readAt).getTime();
    const bTime = new Date(b.readAt).getTime();
    return order === "newest" ? bTime - aTime : aTime - bTime;
  });
}

export function renderReceiptPanel(
  container: HTMLElement,
  entries: ReadReceiptEntry[],
  settings: ReadReceiptPluginSettings,
  currentUser: string,
  onToggle: () => void,
  documentMeta?: ReceiptDocumentMeta
): void {
  container.empty();

  const sorted = sortEntries(entries, settings.sortOrder);
  const userHasRead = entries.some((e) => e.user === currentUser);

  const inner = container.createDiv("rr-inner");

  // Toggle button
  const btn = inner.createEl("button", {
    cls: userHasRead ? "rr-btn rr-btn--unmark" : "rr-btn rr-btn--mark",
    text: userHasRead ? "Unmark as read" : "Mark as read",
  });
  btn.addEventListener("click", onToggle);

  if (documentMeta) {
    const metaEl = inner.createDiv("rr-doc-meta");
    const authorText = documentMeta.author?.trim()
      ? documentMeta.author
      : "Unknown";

    metaEl.createSpan({ cls: "rr-doc-meta-item", text: `Author: ${authorText}` });
    metaEl.createSpan({
      cls: "rr-doc-meta-item",
      text: `Updated: ${formatTimestamp(documentMeta.updatedAt, settings.dateFormat)}`,
    });
  }

  // No readers yet
  if (sorted.length === 0) {
    inner.createSpan({ cls: "rr-no-readers", text: "No readers yet" });
    return;
  }

  const readersEl = inner.createDiv("rr-readers");

  // Count-only mode
  if (settings.displayMode === "count") {
    readersEl.createSpan({
      cls: "rr-count",
      text: `${sorted.length} ${sorted.length === 1 ? "reader" : "readers"}`,
    });
    return;
  }

  readersEl.createSpan({ cls: "rr-label", text: "Read by:" });

  for (const entry of sorted) {
    const isYou = entry.user === currentUser;
    const chip = readersEl.createDiv(isYou ? "rr-chip rr-chip--you" : "rr-chip");

    // Tooltip with full timestamp on hover
    chip.setAttribute("title", formatTooltip(entry.readAt));
    chip.setAttribute("aria-label", formatTooltip(entry.readAt));

    chip.createSpan({
      cls: "rr-chip-name",
      text: isYou ? `${entry.user} (you)` : entry.user,
    });

    if (settings.displayMode === "full" && settings.showTimestamps) {
      chip.createSpan({
        cls: "rr-chip-ts",
        text: formatTimestamp(entry.readAt, settings.dateFormat),
      });
    }
  }
}
