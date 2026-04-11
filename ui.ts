import { ReadReceiptEntry, ReadReceiptPluginSettings } from "./types";

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortEntries(
  entries: ReadReceiptEntry[],
  order: "newest" | "oldest"
): ReadReceiptEntry[] {
  return [...entries].sort((a, b) => {
    const diff = new Date(a.readAt).getTime() - new Date(b.readAt).getTime();
    return order === "newest" ? -diff : diff;
  });
}

export function renderReceiptPanel(
  container: HTMLElement,
  entries: ReadReceiptEntry[],
  settings: ReadReceiptPluginSettings,
  currentUser: string,
  onToggle: () => void
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

    chip.createSpan({
      cls: "rr-chip-name",
      text: isYou ? `${entry.user} (you)` : entry.user,
    });

    if (settings.displayMode === "full" && settings.showTimestamps) {
      chip.createSpan({
        cls: "rr-chip-ts",
        text: formatTimestamp(entry.readAt),
      });
    }
  }
}
