import {
  ReadReceiptEntry,
  ReadReceiptPluginSettings,
  DateFormat,
} from "./types";

export interface ReceiptDocumentMeta {
  author: string | null;
  updatedAt: string;
}

function withAlpha(color: string, alphaHex: string): string | null {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return `${hex}${alphaHex}`;
  }
  return null;
}

function parseReadAt(raw: string): Date {
  // Current stored format in frontmatter is local wall time without timezone.
  const localNoZonePattern = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;
  const m = raw.match(localNoZonePattern);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s ?? "0")
    );
  }
  return new Date(raw);
}

export function formatTimestamp(raw: string, format: DateFormat): string {
  const d = parseReadAt(raw);
  if (isNaN(d.getTime())) return raw;
  switch (format) {
    case "iso":
      return d.toISOString().slice(0, 19).replace("T", " ");
    case "eu":
      return (
        d.toLocaleDateString("sv-SE", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }) +
        " " +
        d.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
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
        d.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
  }
}

export function formatTooltip(raw: string): string {
  const d = parseReadAt(raw);
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
    const aTime = parseReadAt(a.readAt).getTime();
    const bTime = parseReadAt(b.readAt).getTime();
    return order === "newest" ? bTime - aTime : aTime - bTime;
  });
}

export function renderReceiptPanel(
  container: HTMLElement,
  entries: ReadReceiptEntry[],
  settings: ReadReceiptPluginSettings,
  currentUser: string,
  onMarkOrRefresh: () => void,
  onUnmark: () => void,
  documentMeta?: ReceiptDocumentMeta
): void {
  container.empty();

  const sorted = sortEntries(entries, settings.sortOrder);
  const userHasRead = entries.some((e) => e.user === currentUser);

  const inner = container.createDiv("rr-inner");

  // Primary action always marks/refreshes read timestamp.
  const btn = inner.createEl("button", {
    cls: "rr-btn rr-btn--mark",
    text: userHasRead ? "Refresh read time" : "Mark as read",
  });
  btn.addEventListener("click", onMarkOrRefresh);

  // Keep explicit unmark action without making refresh depend on toggle.
  if (userHasRead) {
    const unmarkBtn = inner.createEl("button", {
      cls: "rr-btn rr-btn--unmark",
      text: "Unmark as read",
    });
    unmarkBtn.addEventListener("click", onUnmark);
  }

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

    const nameEl = chip.createSpan({
      cls: "rr-chip-name",
      text: isYou ? `${entry.user} (you)` : entry.user,
    });

    const chipColor =
      settings.userColors[entry.user] ?? (isYou ? settings.badgeColor : "");

    if (chipColor) {
      chip.style.setProperty("border-color", chipColor, "important");
      const bg = withAlpha(chipColor, "22");
      if (bg) chip.style.backgroundColor = bg;
      nameEl.style.setProperty("color", chipColor, "important");
    }

    // Keep chips compact for larger teams; exact read time is available in the tooltip.
  }
}
