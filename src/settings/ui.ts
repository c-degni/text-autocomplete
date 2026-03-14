import { ViewPlugin, ViewUpdate, PluginValue } from '@codemirror/view';
import { Editor } from 'obsidian';
import { stringInWordOrBeforePunctuation, wordBeforeString } from 'src/utils';
import TAPlugin from 'src/main';

let dropdownEl: HTMLUListElement | null = null;

interface CodeMirrorEditor extends Editor {
    cm: {
        state: {
            selection: {
                main: {
                    head: number;
                };
            };
        };
        coordsAtPos: (pos: number) => { left: number; top: number; bottom: number } | null;
    };
}

export function createTAUI() {
    return [
        ViewPlugin.fromClass(
            class implements PluginValue {
                lastCursor: number | null;

                update(update: ViewUpdate) {
                    if (!update.selectionSet && !update.docChanged && !update.focusChanged) return;

                    const cursor: number = update.state.selection.main.head;
                    const doc = update.state.doc;
                    if (!cursor) return;
                    const lineStart: number = doc.lineAt(cursor).from;
                    const line: string = doc.lineAt(cursor).text;
                    const beforeCursor: string = line.substring(0, cursor - lineStart); // Current line up to cursor
                    const afterCursor: string = line.substring(cursor - lineStart);

                    if (stringInWordOrBeforePunctuation(afterCursor) || !wordBeforeString(beforeCursor)) {
                        destroyTAUI();
                        this.lastCursor = cursor;
                        return;
                    }

                    if (!this.lastCursor) return;
                    const typing: boolean = this.lastCursor === cursor + 1 || this.lastCursor === cursor - 1;

                    if (!typing) destroyTAUI();
                    this.lastCursor = cursor;
                }
            }
        )
    ];
}

export function destroyTAUI() {
    dropdownEl?.remove();
    dropdownEl = null;
}

export function updateSuggestions(suggestions: string[], editor: Editor, plugin: TAPlugin) {
    destroyTAUI();

    const cm = (editor as CodeMirrorEditor).cm;
    const pos = cm.state.selection.main.head;
    const coords = cm.coordsAtPos(pos);
    if (!coords) return;

    dropdownEl = createEl('ul');
    dropdownEl!.className = 'autocomplete-dropdown';

    suggestions.forEach((suggestion: string) => {
        const li = createEl('li');
        li.textContent = suggestion;
        li.addEventListener('mousedown', async () => {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            const beforeCursor = line.substring(0, cursor.ch);
            const match = wordBeforeString(beforeCursor);

            if (match) {
                let insert: string = `${suggestion}`; 
                if (plugin.settings.addSpace) insert += " ";
                editor.replaceRange(
                    insert,
                    { line: cursor.line, ch: cursor.ch - match[1].length }, // start position (line, position in line)
                    cursor // end position (line, position in line)
                );
                await plugin.bumpAcceptedWord(suggestion);
            }

            destroyTAUI();
        });
        dropdownEl?.appendChild(li);
    });

    (dropdownEl!.firstChild as HTMLLIElement)?.classList.add('active');

    dropdownEl!.setCssStyles({
        position: 'absolute',
        top: `${coords.bottom + window.scrollY}px`,
        left: `${coords.left + window.scrollX}px`,
        zIndex: '50',
        backgroundColor: 'var(--background-primary)',
        border: '1px solid var(--divider-color)',
        borderRadius: '4px',
        padding: '4px 0',
        listStyle: 'none',
        margin: '0',
        width: '200px',
    });

    document.body.appendChild(dropdownEl!);
}