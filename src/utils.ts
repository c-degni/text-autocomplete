import { Editor, EditorPosition } from 'obsidian';

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