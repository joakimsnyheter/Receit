import { App, PluginSettingTab, Setting } from "obsidian";
import type ReadReceiptPlugin from "./main";
import { ReadReceiptPluginSettings } from "./types";

export class ReadReceiptSettingTab extends PluginSettingTab {
  plugin: ReadReceiptPlugin;

  constructor(app: App, plugin: ReadReceiptPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Read Receipt" });

    new Setting(containerEl)
      .setName("User name")
      .setDesc(
        "Your display name used to identify you in read receipts. Required to mark notes as read."
      )
      .addText((text) =>
        text
          .setPlaceholder("Your name")
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Frontmatter field name")
      .setDesc("YAML field name where read receipts are stored.")
      .addText((text) =>
        text
          .setPlaceholder("read_receipts")
          .setValue(this.plugin.settings.fieldName)
          .onChange(async (value) => {
            const v = value.trim();
            if (v) {
              this.plugin.settings.fieldName = v;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Show timestamps")
      .setDesc("Display when each person marked the note as read.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showTimestamps)
          .onChange(async (v) => {
            this.plugin.settings.showTimestamps = v;
            await this.plugin.saveSettings();
            this.plugin.refreshUI();
          })
      );

    new Setting(containerEl)
      .setName("Sort order")
      .setDesc("Order in which readers are listed.")
      .addDropdown((d) =>
        d
          .addOption("newest", "Newest first")
          .addOption("oldest", "Oldest first")
          .setValue(this.plugin.settings.sortOrder)
          .onChange(async (v) => {
            this.plugin.settings.sortOrder = v as "newest" | "oldest";
            await this.plugin.saveSettings();
            this.plugin.refreshUI();
          })
      );

    new Setting(containerEl)
      .setName("Display mode")
      .setDesc("How readers are shown in the note header panel.")
      .addDropdown((d) =>
        d
          .addOption("full", "Name + timestamp")
          .addOption("compact", "Names only")
          .addOption("count", "Count only")
          .setValue(this.plugin.settings.displayMode)
          .onChange(async (v) => {
            this.plugin.settings.displayMode =
              v as ReadReceiptPluginSettings["displayMode"];
            await this.plugin.saveSettings();
            this.plugin.refreshUI();
          })
      );

    new Setting(containerEl)
      .setName("Show UI in note view")
      .setDesc("Display the read receipt panel at the top of each note.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showInNoteView)
          .onChange(async (v) => {
            this.plugin.settings.showInNoteView = v;
            await this.plugin.saveSettings();
            this.plugin.refreshUI();
          })
      );

    new Setting(containerEl)
      .setName("Enable ribbon icon")
      .setDesc("Show a ribbon icon for quick Mark as read access.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.enableRibbonIcon)
          .onChange(async (v) => {
            this.plugin.settings.enableRibbonIcon = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable status bar")
      .setDesc("Show read status in the status bar for the active note.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.enableStatusBar)
          .onChange(async (v) => {
            this.plugin.settings.enableStatusBar = v;
            await this.plugin.saveSettings();
            this.plugin.updateStatusBar();
          })
      );
  }
}
