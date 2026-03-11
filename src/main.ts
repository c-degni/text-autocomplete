import { Editor, EditorPosition, Plugin, Menu, MenuItem, Notice } from 'obsidian';
import { TASettingsTab, DEFAULT_SETTINGS, TASettings } from './settings/settings';
import { createTAUI, destroyTAUI, updateSuggestions } from './settings/ui';
import { inCodeBlock, stringInWordOrBeforePunctuation, wordBeforeString } from './utils';
import { DEFAULT_TRIE } from './dictionary/dictionary';
import { Trie } from './dictionary/trie';

export default class TAPlugin extends Plugin {
	settings: TASettings;
	wordTrie: Trie;
	lastCursor: EditorPosition | null;
	settingsTab: TASettingsTab | null;

	async onload() {
		await this.loadSettings();
		await this.loadWordTrie();
		this.settingsTab = new TASettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		// Event listeners
		this.registerEvent(this.app.workspace.on('editor-change', this.handleEditorChange.bind(this)));
		this.registerEvent(this.app.workspace.on('editor-menu', this.handleContextMenu.bind(this)));
		this.registerDomEvent(document, 'keydown', this.handleKeyDown.bind(this), { capture: true });
		this.registerEditorExtension(createTAUI());
	}

	onunload() {
		destroyTAUI();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async loadWordTrie() {
		this.wordTrie = DEFAULT_TRIE;
		this.settings.customDict.forEach(word => this.wordTrie.insert(word));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	handleEditorChange(editor: Editor) {
		if (!this.settings.enabled) return;

		const cursor: EditorPosition = editor.getCursor(); // Position in current
		const line: string = editor.getLine(cursor.line); // Current line in doc
		const beforeCursor: string = line.substring(0, cursor.ch); // Current line up to cursor
		const afterCursor: string = line.substring(cursor.ch);

		// For now, prevent autocomplete inside code blocks
		// TODO - Add code block support
		if (inCodeBlock(editor, cursor)) {
			destroyTAUI();
			this.lastCursor = cursor;
			return;
		}

		if (this.lastCursor && (stringInWordOrBeforePunctuation(afterCursor) || !wordBeforeString(beforeCursor))) {
			destroyTAUI();
			return;
		}

		this.lastCursor = cursor;
		const match: RegExpMatchArray | null = wordBeforeString(beforeCursor);

		if (stringInWordOrBeforePunctuation(afterCursor) || !match) {
			destroyTAUI();
			return;
		}

		const word: string = match[1];
		const suggestions: string[] = this.wordTrie.findWordsWithPrefix(word, this.settings.maxSuggestions)
			.filter((w: string) => w !== word);

		if (suggestions.length > 0) {
			updateSuggestions(suggestions, editor, this.settings);
		} else {
			destroyTAUI();
		}
	}

	handleContextMenu(menu: Menu, editor: Editor) {
		const selectedText = editor.getSelection()?.trim();
		if (selectedText) {
			menu.addItem((item: MenuItem) =>
				item.setTitle(`Add "${selectedText}" to custom dictionary`)
					.onClick(async () => {
						if (!this.settings.customDict.includes(selectedText)) {
							this.settings.customDict.push(selectedText);
							this.wordTrie.insert(selectedText);
							await this.saveSettings();
							new Notice(`Added "${selectedText}" to custom dictionary`, 1000);
							if (this.settingsTab) this.settingsTab.display();
						} else {
							new Notice(`"${selectedText}" is already in custom dictionary`, 1000);
						}
					})
			);
		}
	}

	handleKeyDown(evt: KeyboardEvent) {
		if (!this.settings.enabled) return;
		if (evt.key === 'Enter' && evt.shiftKey) return;

		const dropdown = document.querySelector('.autocomplete-dropdown');
		if (!dropdown) return;

		if (['Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Escape'].includes(evt.key)) {
			evt.preventDefault();

			if (evt.key === 'Escape') {
				destroyTAUI();
				return;
			}

			const items = Array.from(dropdown.querySelectorAll('li'));
			const active = dropdown.querySelector('li.active');
			let index = items.indexOf(active as HTMLLIElement);

			if (evt.key === 'Enter' || evt.key === 'Tab') {
				const selected = active || items[0];
				if (selected) selected.dispatchEvent(new Event('mousedown'));
				destroyTAUI();
				return;
			}
			if (evt.key === 'ArrowDown') index = (index + 1) % items.length;
			if (evt.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;

			items.forEach((item, i) => item.classList.toggle('active', i === index));
		}
	}
}