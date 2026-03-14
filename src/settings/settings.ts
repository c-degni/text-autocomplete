import { PluginSettingTab, App, Setting, Notice, DropdownComponent, ToggleComponent, SliderComponent, TextComponent, ButtonComponent } from 'obsidian';
import type TAPlugin from 'src/main';
import { destroyTAUI } from './ui';
import { DUPLICATE_FILE, DUPLICATE_WORD, EMPTY_FILE } from 'src/constants';
import { Result } from 'src/utils';

export interface DictionaryFile {
    filename: string;
    words: string[];
};

export interface TASettings {
    enabled: boolean;
    language: string;
    maxSuggestions: number;
    addSpace: boolean;
    caseSensitive: boolean;
    customDict: string[];
    dictFiles: DictionaryFile[];
    wordScores: Record<string, number | undefined>;
}

export const DEFAULT_SETTINGS: TASettings = {
    enabled: true,
    language: 'English',
    maxSuggestions: 3,
    addSpace: false,
    caseSensitive: true,
    customDict: [],
    dictFiles: [],
    wordScores: {}
}

export class TASettingsTab extends PluginSettingTab {
    plugin: TAPlugin;

    constructor(app: App, plugin: TAPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl: HTMLElement = this.containerEl;
        containerEl.empty();

        // AUTOCOMPLETE
        new Setting(containerEl)
            .setName('Autocomplete')
            .setDesc('Enable/disable the autocomplete feature.')
            .addToggle((toggle: ToggleComponent) =>
                toggle.setValue(this.plugin.settings.enabled)
                    .onChange(async (val: boolean) => {
                        this.updateSetting('enabled', val, !val);
                    }));

        // LANGUAGE
        new Setting(containerEl)
            .setName('Language')
            .setDesc('Specify text language support (only English is supported at the moment).')
            .addDropdown((dropdown: DropdownComponent) =>
                dropdown.addOption('English', 'English')
                    .setValue(this.plugin.settings.language)
                    .onChange(async (val: string) => {
                        this.updateSetting('language', val, true);
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
                        this.updateSetting('maxSuggestions', val, false);
                    }));

        // SPACE TERMINATOR
        new Setting(containerEl)
            .setName('Space terminator after autocomplete')
            .setDesc('Enable/disable adding space terminator to autocompleted words.')
            .addToggle((toggle: ToggleComponent) =>
                toggle.setValue(this.plugin.settings.addSpace)
                    .onChange(async (val: boolean) => {
                        this.updateSetting('addSpace', val, false);
                    }));

        // CASE SENSITIVE
        new Setting(containerEl)
            .setName('Case sensitive suggestions')
            .setDesc('Enable/disable case sensitivity for word suggestions.')
            .addToggle((toggle: ToggleComponent) =>
                toggle.setValue(this.plugin.settings.caseSensitive)
                    .onChange(async (val: boolean) => {
                        this.updateSetting('caseSensitive', val, true);
                    }));

        // CUSTOM DICT
        new Setting(containerEl)
            .setName('Custom dictionary')
            .setDesc('Add words to your custom dictionary.')
            .addText((text: TextComponent) => {
                text.setPlaceholder('e.g. tiktok');
                text.inputEl.addEventListener('keydown', async (e: KeyboardEvent) => {
                    if (e.key !== 'Enter') return;

                    const word: string = text.getValue().trim();
                    const result: Result = await this.plugin.addCustomWord(word);

                    if (!result.ok && result === DUPLICATE_WORD) {
                        new Notice(`"${word}" is already in your custom dictionary.`);
                    }

                    this.display();
                });
            });

        if (this.plugin.settings.customDict.length > 0) {
            const scrollContainer = containerEl.createDiv({ cls: 'custom-word-scroll' }) as HTMLDivElement & {
                scrollTimeout?: number;
            };

            this.addDefaultScrollContainerBehavior(scrollContainer);

            this.plugin.settings.customDict.forEach((word: string, index: number) => {
                new Setting(scrollContainer)
                    .setDesc(word)
                    .addButton((b: ButtonComponent) =>
                        b.setButtonText('Remove')
                            .setTooltip(`Remove "${word}" from your custom dictionary`)
                            .onClick(async () => {
                                await this.plugin.removeCustomWord(index);
                                this.display();
                            }));
            });
        }

        // CLEAR CUSTOM DICT
        new Setting(containerEl)
            .setName('Clear custom dictionary')
            .setDesc('Remove all words from your custom dictionary.')
            .addButton((b: ButtonComponent) =>
                b.setButtonText('Reset')
                    .setCta()
                    .onClick(async () => {
                        await this.plugin.clearCustomWords();
                        this.display();
                    }));

        // IMPORT DICT
        new Setting(containerEl)
            .setName('Imported dictionaries')
            .setDesc('Import words from a one word per line Text File (.txt).')
            .addButton((b: ButtonComponent) => 
                b.setButtonText('Import')
                    .onClick(async () => {
                        await this.importDictionary();
                    }));

        if (this.plugin.settings.dictFiles.length > 0) {
            const importContainer = containerEl.createDiv({ cls: 'custom-word-scroll' }) as HTMLDivElement & {
                scrollTimeout?: number;
            };

            this.addDefaultScrollContainerBehavior(importContainer);

            this.plugin.settings.dictFiles.forEach((file: DictionaryFile, index: number) => {
                new Setting(importContainer)
                    .setDesc(`${file.filename} ~ ${file.words.length} word(s)`)
                    .addButton((b: ButtonComponent) =>
                        b.setButtonText('Remove')
                            .setTooltip(`Remove "${file.filename}" and its words from imported dictionaries`)
                            .onClick(async () => {
                                await this.plugin.removeImportedDictFile(index);
                                this.display();
                            }));
            });
        };
    }

    private async updateSetting<K extends keyof TASettings>(
        key: K, 
        val: TASettings[K], 
        destroyUI: boolean
    ): Promise<void> {
        this.plugin.settings[key] = val;
        if (destroyUI) destroyTAUI();
        await this.plugin.saveSettings();
    }

    private addDefaultScrollContainerBehavior(container: HTMLDivElement & { scrollTimeout?: number }): void {
        container.addEventListener('scroll', () => {
            container.classList.add('show');
            window.clearTimeout(container.scrollTimeout);
            container.scrollTimeout = window.setTimeout(() => {
                container.classList.remove('show');
            }, 1000);
        });
    }

    private async importDictionary(): Promise<void> {
        const input: HTMLInputElement = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.style.display = 'none';

        document.body.appendChild(input);

        input.onchange = async () => {
            const file: File | undefined = input.files?.[0];
            if (!file) return;

            const res: {result: Result, wordCount?: number}  = await this.plugin.importDictFile(file);

            if (!res.result.ok) {
                if (res.result === DUPLICATE_FILE) {
                    new Notice(`"${file.name}" has already been imported.`);
                } else if (res.result === EMPTY_FILE) {
                    new Notice('No words found in file.');
                } else {
                    new Notice('Failed to import dictionary file.');
                }
                return;
            }

            new Notice(`Imported ${res.wordCount} word(s) from "${file.name}".`)
            this.display();

            input.remove();
        };

        input.click();
    }
}