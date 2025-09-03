import { ViewPlugin, ViewUpdate, PluginValue } from '@codemirror/view';
import { Editor, EditorRange } from 'obsidian';
import { TASettings } from './settings';

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

                    const cursor = update.state.selection.main.head;
                    const doc = update.state.doc;
                    if (!cursor) return;
                    const lineStart = doc.lineAt(cursor).from;
                    const line = doc.lineAt(cursor).text;
                    const beforeCursor = line.substring(0, cursor - lineStart); // Current line up to cursor
                    const afterCursor = line.substring(cursor - lineStart);

                    // Destroy dropdown if cursor is in a word or before punctation
                    if (/^[\w.,;:!?'"()\[\]{}\-_+=<>@#$%^&*]/.test(afterCursor)) {
                        destroyTAUI();
                        this.lastCursor = cursor;
                        return;
                    }

                    const match = beforeCursor.match(/(\b[\w']+)$/); // Match contains word at the end of string
                    // No matches (word at the end of the string) 
                    if (!match) {
                        destroyTAUI();
                        this.lastCursor = cursor;
                        return;
                    }

                    if (!this.lastCursor) return;
                    const typing: boolean = this.lastCursor === cursor + 1 || this.lastCursor === cursor - 1;

                    if (!typing) {
                        destroyTAUI();
                    }
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

export function updateSuggestions(suggestions: string[], editor: Editor, settings: TASettings) {
    destroyTAUI();

    const cm = (editor as CodeMirrorEditor).cm;
    const pos = cm.state.selection.main.head;
    const coords = cm.coordsAtPos(pos);
    if (!coords) return;

    dropdownEl = createEl('ul');
    dropdownEl.className = 'autocomplete-dropdown';

    suggestions.forEach(suggestion => {
        const li = createEl('li');
        li.textContent = suggestion;
        li.addEventListener('mousedown', () => {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            const beforeCursor = line.substring(0, cursor.ch);
            const match = beforeCursor.match(/(\b[\w']+)$/);
            if (match) {
                if (settings.addSpace) suggestion += " ";
                editor.replaceRange(
                    suggestion,
                    { line: cursor.line, ch: cursor.ch - match[1].length }, // start position (line, position in line)
                    cursor // end position (line, position in line)
                );
            }
            destroyTAUI();
        });
        dropdownEl?.appendChild(li);
    });

    (dropdownEl.firstChild as HTMLLIElement)?.classList.add('active'); // First suggestion will by default be tagged as active

    dropdownEl.setCssStyles({
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

    document.body.appendChild(dropdownEl);
}