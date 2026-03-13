import { Editor, EditorPosition } from 'obsidian';

export interface Result {
    ok: boolean;
    reason?: string;
};

export const OK: Result = { ok: true };
export const NOT_OK: Result = { ok: false };
export const EMPTY_FILE: Result = { ok: false, reason: 'emptyFile' };
export const DUPLICATE_FILE: Result = { ok: false, reason: 'duplicateFile' };
export const EMPTY_WORD: Result = { ok: false, reason: 'emptyWord' };
export const DUPLICATE_WORD: Result = { ok: false, reason: 'duplicateWord'};

export const inCodeBlock = (editor: Editor, cursor: EditorPosition): boolean => {
    const lines = editor.getValue().split('\n');
    let inCodeBlock = false;

    for (let i = 0; i <= cursor.line; i++) {
        const line = lines[i].trim();
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }
    }

    return inCodeBlock;
};

export const stringInWordOrBeforePunctuation = (s: string): boolean => {
    return /^[\w.,;:!?'"()\[\]{}\-_+=<>@#$%^&*]/.test(s);
};

export const wordBeforeString = (s: string): RegExpMatchArray | null => {
    return s.match(/(\b[\w']+)$/);
};