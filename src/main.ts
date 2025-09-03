import { Editor, EditorPosition, MarkdownView, Plugin, Menu, Notice } from 'obsidian';
import { TASettingsTab, DEFAULT_SETTINGS, TASettings } from './settings/settings';
import { createTAUI, destroyTAUI, updateSuggestions } from './settings/ui';
import { DEFAULT_TRIE } from './dictionary/dictionary';
import { Trie } from './dictionary/trie';

// Helper functions
function inCodeBlock(editor: Editor, cursor: EditorPosition): boolean {
	const lines = editor.getValue().split('\n');
	let inCodeBlock = false;

	for (let i = 0; i <= cursor.line; i++) {
		const line = lines[i].trim();
		if (line.startsWith('```')) {
			inCodeBlock = !inCodeBlock;
		}
	}

	return inCodeBlock;
}

// Classes
export default class TAPlugin extends Plugin {
	settings: TASettings;
	wordTrie: Trie;
	lastCursor: EditorPosition | null;
	settingsTab: TASettingsTab | null;

	// Load plugin settings
	async onload() {
		await this.loadSettings();
		await this.loadWordTrie();
		this.settingsTab = new TASettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		// Event listeners for autocomplete triggers, keydowns, and extensions
		this.registerEvent(this.app.workspace.on('editor-change', this.handleEditorChange.bind(this)));
		this.registerEvent(this.app.workspace.on('editor-menu', this.handleContextMenu.bind(this)));
		this.registerDomEvent(document, 'keydown', this.handleKeyDown.bind(this), { capture: true });
		this.registerEditorExtension(createTAUI());
	}

	// Cleanup
	onunload() {
		destroyTAUI();
	}

	// Load respective plugin data
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async loadWordTrie() {
		this.wordTrie = DEFAULT_TRIE;
		this.settings.customDict.forEach(word => this.wordTrie.insert(word));
	}

	// Save settings
	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Handles event of text being typed in document
	handleEditorChange(editor: Editor) {
		if (!this.settings.enabled) return; // Only continue if autocomplete is enabled

		const cursor = editor.getCursor(); // Position in current
		const line = editor.getLine(cursor.line); // Current line in doc
		const beforeCursor = line.substring(0, cursor.ch); // Current line up to cursor
		const afterCursor = line.substring(cursor.ch);

		// For now, prevent autocomplete inside code blocks
		// TODO - Add code block support
		if (inCodeBlock(editor, cursor)) {
			destroyTAUI();
			this.lastCursor = cursor;
			return;
		}

		// Destroy dropdown if cursor is moved from something other than typing
		if (this.lastCursor) { // There exists a last cursor
			const sameLine = this.lastCursor.line === cursor.line;
			const movedForward = this.lastCursor.ch + 1 === cursor.ch || this.lastCursor.ch - 1 === cursor.ch;

			// Destroy dropdown if cursor is in a word or before punctation
			if (/^[\w.,;:!?'"()\[\]{}\-_+=<>@#$%^&*]/.test(afterCursor)) {
				destroyTAUI();
				return;
			}

			const match = beforeCursor.match(/(\b[\w']+)$/);; // Match contains word at the end of string
			// No matches (word at the end of the string) 
			if (!match) {
				destroyTAUI();
				return;
			}

			// if (!sameLine || !movedForward) {
			// 	destroyTAUI();
			// 	this.lastCursor = cursor;
			// 	return;
			// }
		}
		this.lastCursor = cursor;

		// Destroy dropdown if cursor is in a word or before punctation
		if (/^[\w.,;:!?'"()\[\]{}\-_+=<>@#$%^&*]/.test(afterCursor)) {
			destroyTAUI();
			return;
		}

		const match = beforeCursor.match(/(\b[\w']+)$/);; // Match contains word at the end of string
		// No matches (word at the end of the string) 
		if (!match) {
			destroyTAUI();
			return;
		}

		const word: string = match[1];
		const suggestions: string[] = this.wordTrie.findWordsWithPrefix(word, this.settings.maxSuggestions)
			.filter((w: string) => w !== word);

		if (suggestions.length > 0) {
			updateSuggestions(suggestions, editor, this.settings);
		} else {
			destroyTAUI(); // Should never happen but is a safety check
		}
	}

	// Handles plugin interaction from the context menu
	handleContextMenu(menu: Menu, editor: Editor) {
		const selectedText = editor.getSelection()?.trim();
		if (selectedText && /^.*$/.test(selectedText)) {
			menu.addItem(item =>
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

	// Handles keydown events like ENTER\TAB for trigger and arrow up/down for navigation
	handleKeyDown(evt: KeyboardEvent) {
		if (!this.settings.enabled) return;
		if (evt.key === 'Enter' && evt.shiftKey) return;

		const dropdown = document.querySelector('.autocomplete-dropdown');
		if (!dropdown) return; // Dropdown not visible (no suggestions)

		if (['Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Escape'].includes(evt.key)) {
			evt.preventDefault(); // Keyboard event default action prevented

			if (evt.key === 'Escape') {
				destroyTAUI();
				return;
			}

			const items = Array.from(dropdown.querySelectorAll('li'));
			const active = dropdown.querySelector('li.active'); // The active element in the dropdown
			let index = items.indexOf(active as HTMLLIElement);

			if (evt.key === 'Enter' || evt.key === 'Tab') {
				const selected = active || items[0]; // Defaults to first suggestion
				if (selected) selected.dispatchEvent(new Event('mousedown'));
				destroyTAUI();
				return;
			}
			if (evt.key === 'ArrowDown') index = (index + 1) % items.length;
			if (evt.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;

			items.forEach((item, i) => item.classList.toggle('active', i === index)); // Updates which suggestion is tagged active
		}
	}
}