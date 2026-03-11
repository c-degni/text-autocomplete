import { PluginSettingTab, App, Setting, Notice, DropdownComponent, ToggleComponent, SliderComponent, TextComponent, ButtonComponent } from 'obsidian';
import type TAPlugin from 'src/main';
import { destroyTAUI } from './ui';

// TODO Add LaTex support

type DictionaryFile = {
    filename: string;
    words: string[];
};

export interface TASettings {
    enabled: boolean;
    language: string;
    maxSuggestions: number;
    addSpace: boolean;
    customDict: string[];
    dictFiles: DictionaryFile[];
    // latex: boolean;
}

export const DEFAULT_SETTINGS: TASettings = {
    enabled: true,
    language: 'English',
    maxSuggestions: 3,
    addSpace: false,
    customDict: [],
    dictFiles: [],
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

        // AUTOCOMPLETE
        new Setting(containerEl)
            .setName('Autocomplete')
            .setDesc('Enable/disable the autocomplete feature.')
            .addToggle((toggle: ToggleComponent) =>
                toggle.setValue(this.plugin.settings.enabled)
                    .onChange(async (val: boolean) => {
                        this.plugin.settings.enabled = val;
                        if (!val) destroyTAUI;
                        await this.plugin.saveSettings();
                    }));

        // LANGUAGE
        new Setting(containerEl)
            .setName('Language')
            .setDesc('Specify text language support (only English is supported at the moment).')
            .addDropdown((dropdown: DropdownComponent) =>
                dropdown.addOption('English', 'English')
                    .setValue(this.plugin.settings.language)
                    .onChange(async (val: string) => {
                        this.plugin.settings.language = val;
                        await this.plugin.saveSettings();
                    }));

        // MAX SUGGESTIONS
        new Setting(containerEl)
            .setName('Maximum suggestions')
            .setDesc('Maximum number of suggestions shown at once (3-10).')
            .addSlider((slider: SliderComponent) =>
                slider.setLimits(3, 10, 1)
                    .setValue(this.plugin.settings.maxSuggestions)
                    .setDynamicTooltip()
                    .onChange(async (val: number) => {
                        this.plugin.settings.maxSuggestions = val;
                        await this.plugin.saveSettings();
                    }));

        // SPACE TERMINATOR
        new Setting(containerEl)
            .setName('Space terminator after autocomplete')
            .setDesc('Enable/disable adding space terminator to autocompleted words.')
            .addToggle((toggle: ToggleComponent) =>
                toggle.setValue(this.plugin.settings.addSpace)
                    .onChange(async (val: boolean) => {
                        this.plugin.settings.addSpace = val;
                        if (!val) destroyTAUI;
                        await this.plugin.saveSettings();
                    }));

        // CUSTOM DICT
        new Setting(containerEl)
            .setName('Custom dictionary')
            .setDesc('Add words to a your custom dictionary.')
            .addText((text: TextComponent) => {
                text.setPlaceholder('e.g. tiktok');
                text.inputEl.addEventListener('keydown', async (e: KeyboardEvent) => {
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
                    .addButton((b: ButtonComponent) =>
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

        // CLEAR CUSTOM DICT
        new Setting(containerEl)
            .setName('Clear custom dictionary')
            .setDesc('Remove all words from your custom dictionary.')
            .addButton((b: ButtonComponent) =>
                b.setButtonText('Reset')
                    .setCta()
                    .onClick(async () => {
                        this.plugin.settings.customDict.forEach((word: string) => this.plugin.wordTrie.remove(word));
                        this.plugin.settings.customDict = [];
                        await this.plugin.saveSettings();
                        // new Notice('Custom dictionary cleared.')
                        this.display();
                    }));

        // IMPORT DICT
        new Setting(containerEl)
            .setName('Imported dictionaries')
            .setDesc('Import words from a one word per line Text File (.txt).')
            .addButton((b: ButtonComponent) => 
                b.setButtonText('Import file')
                    .onClick(() => {
                        const input : HTMLInputElement = document.createEl('input');
                        input.type = 'file';
                        input.accept = '.txt';
                        input.onchange = async () => {
                            const file: File | undefined = input.files?.[0];
                            if (!file) return;

                            if (this.plugin.settings.dictFiles.some(f => f.filename === file.name)) {
                                new Notice(`"${file.name}" has already been imported.`);
                                return;
                            }

                            const text: string = await file.text();
                            const separator: string = '\n';
                            const words: string[] = text
                                .split(separator)
                                .map((w: string) => w.trim())
                                .filter((w: string) => w.length > 0);

                            if (words.length === 0) {
                                new Notice('No new words found in file.');
                                return;
                            }

                            words.forEach((w: string) => {
                                this.plugin.wordTrie.insert(w);
                            });

                            const dictFile: DictionaryFile = { filename: file.name, words: words };
                            this.plugin.settings.dictFiles.push(dictFile);
                            await this.plugin.saveSettings();
                            new Notice(`Imported ${words.length} new word(s) from "${file.name}".`)
                            this.display();
                        };
                        input.click();
                    }));

        if (this.plugin.settings.dictFiles.length > 0) {
            const importContainer = containerEl.createDiv({ cls: 'custom-word-scroll' }) as HTMLDivElement & {
                scrollTimeout?: number;
            };

            importContainer.addEventListener('scroll', () => {
                importContainer.classList.add('show');
                window.clearTimeout(importContainer.scrollTimeout);
                importContainer.scrollTimeout = window.setTimeout(() => {
                    importContainer.classList.remove('show');
                }, 1000);
            });

            this.plugin.settings.dictFiles.forEach((file: DictionaryFile, index: number) => {
                new Setting(importContainer)
                    .setDesc(`${file.filename} ~ ${file.words.length} word(s)`)
                    .addButton((b: ButtonComponent) =>
                        b.setButtonText('Remove')
                            .setTooltip(`Remove "${file.filename}" and its words from your imported dictionaries`)
                            .onClick(async () => {
                                file.words.forEach((w: string) => {
                                    if (!this.plugin.settings.customDict.includes(w)) {
                                        this.plugin.wordTrie.remove(w);
                                    }
                                });
                                this.plugin.settings.dictFiles.splice(index, 1);
                                await this.plugin.saveSettings();
                                new Notice(`Removed "${file.filename}" and its words from your imported dictionaries.`)
                                this.display();
                            }));
            });
        };

        // LATEX
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