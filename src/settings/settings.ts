import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import type TAPlugin from 'src/main';
import { destroyTAUI } from './ui';

// TODO Add LaTex support

export interface TASettings {
    enabled: boolean; // Autocomplete enabling
    language: string; // Language support
    maxSuggestions: number; // Max number of proposed suggestions at a time
    addSpace: boolean; // Add space enabling
    customDict: string[];
    // latex: boolean; // LaTeX support
}

export const DEFAULT_SETTINGS: TASettings = {
    enabled: true,
    language: 'English',
    maxSuggestions: 3,
    addSpace: false,
    customDict: [],
    // latex: false,
}

export class TASettingsTab extends PluginSettingTab {
    plugin: TAPlugin;

    constructor(app: App, plugin: TAPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl = this.containerEl;
        containerEl.empty();

        // Autocomplete setting
        new Setting(containerEl)
            .setName('Autocomplete')
            .setDesc('Enable/disable the autocomplete feature.')
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.enabled)
                    .onChange(async val => {
                        this.plugin.settings.enabled = val;
                        if (!val) destroyTAUI;
                        await this.plugin.saveSettings();
                    }));

        // Language setting
        new Setting(containerEl)
            .setName('Language')
            .setDesc('Specify text language support (only English is supported at the moment).')
            .addDropdown(dropdown =>
                dropdown.addOption('English', 'English')
                    .setValue(this.plugin.settings.language)
                    .onChange(async val => {
                        this.plugin.settings.language = val;
                        await this.plugin.saveSettings();
                    }));

        // Max suggestions setting
        new Setting(containerEl)
            .setName('Maximum suggestions')
            .setDesc('Maximum number of suggestions shown at once (3-10).')
            .addSlider(slider =>
                slider.setLimits(3, 10, 1)
                    .setValue(this.plugin.settings.maxSuggestions)
                    .setDynamicTooltip()
                    .onChange(async (val: number) => {
                        this.plugin.settings.maxSuggestions = val;
                        await this.plugin.saveSettings();
                    }));

        // Space terminator setting
        new Setting(containerEl)
            .setName('Space terminator after autocomplete')
            .setDesc('Enable/disable adding space terminator to autocompleted words.')
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.addSpace)
                    .onChange(async val => {
                        this.plugin.settings.addSpace = val;
                        if (!val) destroyTAUI;
                        await this.plugin.saveSettings();
                    }));

        // Custom dictionary setting
        new Setting(containerEl)
            .setName('Custom dictionary')
            .setDesc('Add words to a your custom dictionary.')
            .addText(text => {
                text.setPlaceholder('e.g. tiktok');
                text.inputEl.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        const word = text.getValue().trim();
                        if (word && !this.plugin.settings.customDict.includes(word)) {
                            this.plugin.settings.customDict.push(word);
                            this.plugin.wordTrie.insert(word);
                            await this.plugin.saveSettings();
                            // new Notice(`Added "${word}" to your custom dictionary.`);
                            this.display();
                        }
                    }
                });
            });

        // Manage custom dictionary subsetting
        if (this.plugin.settings.customDict.length > 0) {
            const scrollContainer = containerEl.createDiv({ cls: 'custom-word-scroll' }) as HTMLDivElement & {
                scrollTimeout?: number;
            };

            scrollContainer.addEventListener('scroll', () => {
                scrollContainer.classList.add('show');
                window.clearTimeout(scrollContainer.scrollTimeout);
                scrollContainer.scrollTimeout = window.setTimeout(() => {
                    scrollContainer.classList.remove('show');
                }, 1000);
            });

            this.plugin.settings.customDict.forEach((word: string, index: number) => {
                const row = new Setting(scrollContainer)
                    .setDesc(word)
                    .addButton(b =>
                        b.setButtonText('Remove')
                            .setTooltip(`Remove "${word}" from your custom dictionary`)
                            .onClick(async () => {
                                this.plugin.settings.customDict.splice(index, 1);
                                this.plugin.wordTrie.remove(word);
                                await this.plugin.saveSettings();
                                // new Notice(`Removed "${word}" from your custom dictionary.`)
                                this.display();
                            }))
            })
        }

        // Clear custom dictionary setting
        new Setting(containerEl)
            .setName('Clear custom dictionary')
            .setDesc('Remove all words from your custom dictionary.')
            .addButton(b =>
                b.setButtonText('Reset')
                    .setCta()
                    .onClick(async () => {
                        this.plugin.settings.customDict.forEach((word: string) => this.plugin.wordTrie.remove(word));
                        this.plugin.settings.customDict = [];
                        await this.plugin.saveSettings();
                        // new Notice('Custom dictionary cleared.')
                        this.display();
                    }));

        // LaTeX setting
        // new Setting(containerEl)
        //     .setName('LaTeX Support')
        //     .setDesc('Enable/disable LaTeX code autocomplete.')
        //     .addToggle(toggle =>
        //         toggle.setValue(this.plugin.settings.latex)
        //             .onChange(async val => {
        //                 this.plugin.settings.latex = val;
        //                 await this.plugin.saveSettings();
        //             }));
    }
}