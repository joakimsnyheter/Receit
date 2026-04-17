import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { ReadReceiptPluginSettings, DEFAULT_SETTINGS } from "./types";
import { getReceipts, toggleReceipt, addReceipt, removeReceipt } from "./frontmatter";
import { renderReceiptPanel, formatTimestamp, ReceiptDocumentMeta } from "./ui";
import { ReadReceiptSettingTab } from "./settings";

const PANEL_CLASS = "read-receipt-panel";
const DEBOUNCE_MS = 150;
const LOCAL_USERNAME_KEY = "receit-user-name";
const LOCAL_BADGE_COLOR_KEY = "receit-badge-color";

export default class ReadReceiptPlugin extends Plugin {
  settings: ReadReceiptPluginSettings;
  private statusBarItem: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Track known readers per file path to detect new ones on sync
  private knownReaders = new Map<string, Set<string>>();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ReadReceiptSettingTab(this.app, this));
    this.applyBadgeColorStyle();

    if (this.settings.enableRibbonIcon) {
      this.addRibbonIcon("bookmark-check", "Mark as read", () => {
        this.markCurrentNote();
      });
    }

    if (this.settings.enableStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
    }

    this.addCommand({
      id: "mark-as-read",
      name: "Mark current note as read",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) this.markCurrentNote();
        return true;
      },
    });

    this.addCommand({
      id: "unmark-as-read",
      name: "Unmark current note as read",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) this.unmarkCurrentNote();
        return true;
      },
    });

    this.addCommand({
      id: "toggle-read-status",
      name: "Toggle read status",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) this.toggleCurrentNote();
        return true;
      },
    });

    this.addCommand({
      id: "show-readers",
      name: "Show readers for current note",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) this.showReaders();
        return true;
      },
    });

    this.addCommand({
      id: "mark-all-tabs-as-read",
      name: "Mark all open tabs as read",
      callback: () => this.markAllOpenTabs(),
    });

    this.addCommand({
      id: "copy-readers-list",
      name: "Copy readers list",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) this.copyReadersList();
        return true;
      },
    });

    this.addCommand({
      id: "export-readers-markdown",
      name: "Export readers as markdown table",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) this.exportReadersMarkdown();
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.scheduleRefresh();
      })
    );

    // React to frontmatter changes - fires when a file is saved or synced
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const activeFile = this.getActiveMarkdownFile();
        if (activeFile && activeFile.path === file.path) {
          this.checkForNewReaders(file);
          this.scheduleRefresh();
        }
      })
    );

    // Also listen to vault modify as a backup (catches sync writes before cache updates)
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) return;
        const activeFile = this.getActiveMarkdownFile();
        if (activeFile && activeFile.path === file.path) {
          this.scheduleRefresh();
        }
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.refreshUI();
      this.updateStatusBar();
    });
  }

  onunload() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    document.getElementById("receit-dynamic-style")?.remove();
    document.querySelectorAll(`.${PANEL_CLASS}`).forEach((el) => el.remove());
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    const localUserName = this.loadLocalUserName();
    if (localUserName !== null) {
      this.settings.userName = localUserName;
    }

    const localBadgeColor = this.loadLocalBadgeColor();
    if (localBadgeColor !== null) {
      this.settings.badgeColor = localBadgeColor;
    }

    let migrated = false;

    // Migrate legacy synced username into per-device local storage.
    if (localUserName === null) {
      const syncedUserName = this.settings.userName.trim();
      if (syncedUserName) {
        this.settings.userName = syncedUserName;
        this.saveLocalUserName(syncedUserName);
        migrated = true;
      }
    }

    // Migrate legacy synced badge color into per-device local storage.
    if (localBadgeColor === null) {
      const syncedBadgeColor = this.settings.badgeColor.trim();
      if (syncedBadgeColor) {
        this.settings.badgeColor = syncedBadgeColor;
        this.saveLocalBadgeColor(syncedBadgeColor);
        migrated = true;
      }
    }

    if (migrated) {
      await this.saveData({ ...this.settings, userName: "", badgeColor: "" });
    }
  }

  async saveSettings() {
    this.saveLocalUserName(this.settings.userName.trim());
    this.saveLocalBadgeColor(this.settings.badgeColor.trim());
    await this.saveData({ ...this.settings, userName: "", badgeColor: "" });
  }

  private loadLocalUserName(): string | null {
    const raw = this.app.loadLocalStorage(LOCAL_USERNAME_KEY);
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    return value.length > 0 ? value : null;
  }

  private saveLocalUserName(value: string): void {
    const trimmed = value.trim();
    this.app.saveLocalStorage(
      LOCAL_USERNAME_KEY,
      trimmed.length > 0 ? trimmed : null
    );
  }

  private loadLocalBadgeColor(): string | null {
    const raw = this.app.loadLocalStorage(LOCAL_BADGE_COLOR_KEY);
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    return value.length > 0 ? value : null;
  }

  private saveLocalBadgeColor(value: string): void {
    const trimmed = value.trim();
    this.app.saveLocalStorage(
      LOCAL_BADGE_COLOR_KEY,
      trimmed.length > 0 ? trimmed : null
    );
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || view.file.extension !== "md") return null;
    return view.file;
  }

  private requireUserName(): boolean {
    if (!this.settings.userName) {
      new Notice(
        "Read Receipt: Please set your user name in plugin settings (Settings -> Read Receipt)."
      );
      return false;
    }
    return true;
  }

  private normalizeAuthorValue(value: unknown): string | null {
    if (typeof value === "string") {
      const name = value.trim();
      return name.length > 0 ? name : null;
    }

    if (Array.isArray(value)) {
      const names = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      return names.length > 0 ? names.join(", ") : null;
    }

    return null;
  }

  private getDocumentMeta(file: TFile): ReceiptDocumentMeta {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
      | Record<string, unknown>
      | undefined;
    const authorKeys = ["author", "authors", "owner", "created_by", "createdBy"];
    let author: string | null = null;

    if (frontmatter) {
      for (const key of authorKeys) {
        const parsed = this.normalizeAuthorValue(frontmatter[key]);
        if (parsed) {
          author = parsed;
          break;
        }
      }
    }

    return {
      author,
      updatedAt: new Date(file.stat.mtime).toISOString(),
    };
  }

  async markCurrentNote(): Promise<void> {
    if (!this.requireUserName()) return;
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Read Receipt: No active markdown file.");
      return;
    }

    const result = await addReceipt(
      this.app,
      file,
      this.settings.fieldName,
      this.settings.userName
    );
    new Notice(result === "added" ? "Marked as read" : "Updated latest read time");
  }

  async unmarkCurrentNote(): Promise<void> {
    if (!this.requireUserName()) return;
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Read Receipt: No active markdown file.");
      return;
    }
    await removeReceipt(this.app, file, this.settings.fieldName, this.settings.userName);
    new Notice("Unmarked as read");
  }

  async toggleCurrentNote(): Promise<void> {
    if (!this.requireUserName()) return;
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Read Receipt: No active markdown file.");
      return;
    }
    const result = await toggleReceipt(
      this.app,
      file,
      this.settings.fieldName,
      this.settings.userName
    );
    new Notice(result === "added" ? "Marked as read" : "Unmarked as read");
  }

  showReaders(): void {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    const entries = getReceipts(this.app, file, this.settings.fieldName);
    if (entries.length === 0) {
      new Notice("No one has read this note yet.");
      return;
    }
    const names = entries.map((e) => e.user).join(", ");
    new Notice(`Read by: ${names}`);
  }

  async markAllOpenTabs(): Promise<void> {
    if (!this.requireUserName()) return;
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    let added = 0;
    let updated = 0;

    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      const file = view.file;
      if (file && file.extension === "md") {
        const result = await addReceipt(
          this.app,
          file,
          this.settings.fieldName,
          this.settings.userName
        );

        if (result === "added") {
          added++;
        } else {
          updated++;
        }
      }
    }

    const total = added + updated;
    new Notice(
      `Updated ${total} note${total !== 1 ? "s" : ""} as read (${added} new, ${updated} refreshed)`
    );
  }

  async copyReadersList(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    const entries = getReceipts(this.app, file, this.settings.fieldName);
    if (entries.length === 0) {
      new Notice("No readers to copy.");
      return;
    }
    const text = entries
      .map((e) => `${e.user} (${formatTimestamp(e.readAt, this.settings.dateFormat)})`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    new Notice("Readers list copied to clipboard");
  }

  async exportReadersMarkdown(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    const entries = getReceipts(this.app, file, this.settings.fieldName);
    if (entries.length === 0) {
      new Notice("No readers to export.");
      return;
    }
    const header = "| Name | Read at |\n|------|---------|";
    const rows = entries
      .map((e) => `| ${e.user} | ${formatTimestamp(e.readAt, this.settings.dateFormat)} |`)
      .join("\n");
    await navigator.clipboard.writeText(`${header}\n${rows}`);
    new Notice("Readers table copied to clipboard");
  }

  private checkForNewReaders(file: TFile): void {
    if (!this.settings.notifyOnNewReader) return;
    const entries = getReceipts(this.app, file, this.settings.fieldName);
    const known = this.knownReaders.get(file.path) ?? new Set<string>();
    const newReaders = entries.filter(
      (e) => e.user !== this.settings.userName && !known.has(e.user)
    );
    if (newReaders.length > 0) {
      const names = newReaders.map((e) => e.user).join(", ");
      new Notice(`Receit: ${names} just read this note`);
    }
    this.knownReaders.set(file.path, new Set(entries.map((e) => e.user)));
  }

  applyBadgeColorStyle(): void {
    document.getElementById("receit-dynamic-style")?.remove();
    const color = this.settings.badgeColor;
    const field = this.settings.fieldName;

    const css: string[] = [
      // Bold the frontmatter property entries in Obsidian's properties panel
      `.metadata-property[data-property-key="${field}"] .multi-select-pill { font-weight: 700; }`,
      `.metadata-property[data-property-key="${field}"] .metadata-property-value { font-weight: 700; }`,
    ];

    if (color) {
      css.push(
        `.rr-chip--you { border-color: ${color} !important; background: ${color}22 !important; }`,
        `.rr-chip--you .rr-chip-name { color: ${color} !important; }`
      );
    }

    const style = document.createElement("style");
    style.id = "receit-dynamic-style";
    style.textContent = css.join("\n");
    document.head.appendChild(style);
  }

  // Debounce so rapid events (vault modify + metadataCache.changed) only trigger one redraw
  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.refreshUI();
      this.updateStatusBar();
    }, DEBOUNCE_MS);
  }

  updateStatusBar(): void {
    if (!this.statusBarItem) return;
    if (!this.settings.enableStatusBar) {
      this.statusBarItem.setText("");
      return;
    }
    const file = this.getActiveMarkdownFile();
    if (!file) {
      this.statusBarItem.setText("");
      return;
    }
    const entries = getReceipts(this.app, file, this.settings.fieldName);
    const count = entries.length;
    const hasRead = this.settings.userName
      ? entries.some((e) => e.user === this.settings.userName)
      : false;

    if (count === 0) {
      this.statusBarItem.setText("No readers");
    } else {
      const readerText = `Read by ${count} user${count !== 1 ? "s" : ""}`;
      const youText = this.settings.userName
        ? hasRead
          ? " · You have read this"
          : " · You have not read this"
        : "";
      this.statusBarItem.setText(readerText + youText);
    }
  }

  refreshUI(): void {
    this.applyBadgeColorStyle();
    // Remove all existing panels first
    document.querySelectorAll(`.${PANEL_CLASS}`).forEach((el) => el.remove());

    if (!this.settings.showInNoteView) return;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    const file = view.file;
    if (!file || file.extension !== "md") return;

    const entries = getReceipts(this.app, file, this.settings.fieldName);
    const documentMeta = this.getDocumentMeta(file);

    // Insert panel into both editing and reading mode containers
    const targets = view.contentEl.querySelectorAll(
      ".cm-editor, .markdown-reading-view"
    );
    if (targets.length > 0) {
      targets.forEach((target) => {
        const panel = createDiv(PANEL_CLASS);
        target.parentElement?.insertBefore(panel, target);
        renderReceiptPanel(
          panel,
          entries,
          this.settings,
          this.settings.userName,
          () => {
            this.markCurrentNote();
          },
          () => {
            this.unmarkCurrentNote();
          },
          documentMeta
        );
      });
    } else {
      // Fallback: insert at top of contentEl
      const panel = view.contentEl.createDiv(PANEL_CLASS);
      view.contentEl.insertBefore(panel, view.contentEl.firstChild);
      renderReceiptPanel(
        panel,
        entries,
        this.settings,
        this.settings.userName,
        () => {
          this.markCurrentNote();
        },
        () => {
          this.unmarkCurrentNote();
        },
        documentMeta
      );
    }
  }
}
