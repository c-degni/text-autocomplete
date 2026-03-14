import { Result } from "./utils";

export const DEFAULT_WORD_SCORE: number = 1;
export const IMPORT_WORD_SCORE: number = 2;
export const CUSTOM_WORD_SCORE: number = 5;
export const ACCEPTED_SUGGESTION_BUMP: number = 3;

export const OK: Result = { ok: true };
export const NOT_OK: Result = { ok: false };
export const EMPTY_FILE: Result = { ok: false, reason: 'emptyFile' };
export const DUPLICATE_FILE: Result = { ok: false, reason: 'duplicateFile' };
export const EMPTY_WORD: Result = { ok: false, reason: 'emptyWord' };
export const DUPLICATE_WORD: Result = { ok: false, reason: 'duplicateWord'};