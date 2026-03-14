import { Editor, EditorPosition, Plugin, Menu, MenuItem, Notice } from 'obsidian';
import { TASettingsTab, DEFAULT_SETTINGS, TASettings, DictionaryFile } from './settings/settings';
import { createTAUI, destroyTAUI, updateSuggestions } from './settings/ui';
import { inCodeBlock, Result, stringInWordOrBeforePunctuation, wordBeforeString } from './utils';
import { DEFAULT_DICTIONARIES, Dictionary } from './dictionary/dictionary';
import { Trie } from './dictionary/trie';
import { ACCEPTED_SUGGESTION_BUMP, CUSTOM_WORD_SCORE, DEFAULT_WORD_SCORE, DUPLICATE_FILE, DUPLICATE_WORD, EMPTY_FILE, IMPORT_WORD_SCORE, NOT_OK, OK } from './constants';

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
		this.wordTrie = new Trie(this.settings.maxSuggestions);

		DEFAULT_DICTIONARIES.forEach((dict: Dictionary) => {
			dict.words.forEach((word: string) => {
				const score: number = this.settings.wordScores[word] ?? DEFAULT_WORD_SCORE;
				this.settings.wordScores[word] = score;
				this.wordTrie.insert(word, score);
			});
		});

		this.settings.customDict.forEach((word: string) => {
			const score: number = this.settings.wordScores[word] ?? CUSTOM_WORD_SCORE;
			this.settings.wordScores[word] = score;
			this.wordTrie.insert(word, score);
		});

		this.settings.dictFiles.forEach((file: DictionaryFile) => {
			file.words.forEach((word: string) => {
				const score: number = this.settings.wordScores[word] ?? IMPORT_WORD_SCORE;
				this.settings.wordScores[word] = score;
				this.wordTrie.insert(word)
			});
		});

		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	handleEditorChange(editor: Editor) {
		if (!this.settings.enabled) return;

		const cursor: EditorPosition = editor.getCursor();
		const line: string = editor.getLine(cursor.line);
		const beforeCursor: string = line.substring(0, cursor.ch);
		const afterCursor: string = line.substring(cursor.ch);

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
		const suggestions: string[] = this.wordTrie.findWordsWithPrefix(
			word, 
			this.settings.maxSuggestions, 
			this.settings.caseSensitive
		);

		if (suggestions.length > 0) {
			updateSuggestions(suggestions, editor, this);
		} else {
			destroyTAUI();
		}
	}

	handleContextMenu(menu: Menu, editor: Editor) {
		const selectedText: string = editor.getSelection()?.trim();
		if (!selectedText) return;

		menu.addItem((item: MenuItem) =>
			item.setTitle(`Add "${selectedText}" to custom dictionary`)
				.onClick(async () => {
					const result: Result = await this.addCustomWord(selectedText);
					if (result.ok) {
						new Notice(`Added "${selectedText}" to custom dictionary`, 1000);
						this.refreshSettingsTab();
					} else if (result === DUPLICATE_WORD){
						new Notice(`"${selectedText}" is already in custom dictionary`, 1000);
					}
				})
		);
	}

	handleKeyDown(evt: KeyboardEvent) {
		if (!this.settings.enabled) return;
		if (evt.key === 'Enter' && evt.shiftKey) return;

		const dropdown: Element | null = document.querySelector('.autocomplete-dropdown');
		if (!dropdown) return;

		if (['Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Escape'].includes(evt.key)) {
			evt.preventDefault();

			if (evt.key === 'Escape') {
				destroyTAUI();
				return;
			}

			const items: HTMLLIElement[] = Array.from(dropdown.querySelectorAll('li'));
			const active: Element | null = dropdown.querySelector('li.active');
			let index: number = items.indexOf(active as HTMLLIElement);

			if (evt.key === 'Enter' || evt.key === 'Tab') {
				const selected = active || items[0];
				if (selected) {
					selected.dispatchEvent(new Event('mousedown'));
				}
				destroyTAUI();
				return;
			}
			if (evt.key === 'ArrowDown') index = (index + 1) % items.length;
			if (evt.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;

			items.forEach((item, i) => item.classList.toggle('active', i === index));
		}
	}

	private refreshSettingsTab(): void {
		if (this.settingsTab) this.settingsTab.display();
	}

	async bumpAcceptedWord(word: string): Promise<void> {
		this.wordTrie.bumpWordScore(word, ACCEPTED_SUGGESTION_BUMP);
		this.settings.wordScores[word] = this.wordTrie.getScore(word);
		await this.saveSettings();
	}

	async addCustomWord(word: string): Promise<Result> {
		if (!word) return EMPTY_FILE;
		if (this.settings.customDict.includes(word)) return DUPLICATE_WORD;

		this.settings.customDict.push(word);

		const score: number = this.settings.wordScores[word] ?? CUSTOM_WORD_SCORE;
		this.settings.wordScores[word] = score;

		this.wordTrie.insert(word, score);
		await this.saveSettings();
		return OK;
	}

	async removeCustomWord(index: number): Promise<Result> {
		const word: string = this.settings.customDict[index];
		if (!word) return NOT_OK;

		this.settings.customDict.splice(index, 1);

		if (!this.wordExistsInAnotherDict(word, -1)) {
			this.wordTrie.remove(word);
			delete this.settings.wordScores[word];
		}
		
		await this.saveSettings();
		return OK;
	}

	async clearCustomWords(): Promise<void> {
		this.settings.customDict.forEach((word: string) => {
			if (!this.wordExistsInAnotherDict(word, -1)) {
				this.wordTrie.remove(word);
				delete this.settings.wordScores[word];
			}
		});
		
		this.settings.customDict = [];
		await this.saveSettings();
	}

	async importDictFile(file: File): Promise<{ result: Result , wordCount?: number }> {
		if (this.settings.dictFiles.some((f) => f.filename === file.name)) {
			return { result: DUPLICATE_FILE };
		}

		const text: string = await file.text();
		let words: string[] = text
			.split(/\r?\n/)
			.map((w: string) => w.trim())
			.filter((w: string) => w.length > 0);
		words = [...new Set(words)];

		if (words.length === 0) return { result: EMPTY_FILE };

		words.forEach((word: string) => {
			const score: number = this.settings.wordScores[word] ?? IMPORT_WORD_SCORE;
			this.settings.wordScores[word] = score;
			this.wordTrie.insert(word, score);
		});

		const dictFile: DictionaryFile = {
			filename: file.name,
			words: words
		};
		this.settings.dictFiles.push(dictFile);

		await this.saveSettings();
		return { result: OK, wordCount: words.length };
	}

	async removeImportedDictFile(index: number): Promise<Result> {
		const dictFile: DictionaryFile = this.settings.dictFiles[index];
		if (!dictFile) return NOT_OK;

		dictFile.words.forEach((word: string) => {
			if (!this.wordExistsInAnotherDict(word, index)) {
				this.wordTrie.remove(word);
				delete this.settings.wordScores[word];
			}
		});
		this.settings.dictFiles.splice(index, 1);

		await this.saveSettings();
		return OK;
	}

	private wordExistsInAnotherDict(word: string, referenceDictIndex: number): boolean {
		let customDict: boolean = false;
		if (referenceDictIndex === -1) {
			referenceDictIndex = this.settings.dictFiles.length + 1;
		} else {
			customDict = this.settings.customDict.includes(word);
		}

		return this.settings.dictFiles.some((dict, dictIndex) => 
			dictIndex !== referenceDictIndex && dict.words.includes(word)	
		) || customDict;
	}
}