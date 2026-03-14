import { DEFAULT_WORDS, CS_WORDS } from './words'

export type Dictionary = {
    name: string,
    words: string[],
    baseScore: number
};

export const DEFAULT_DICTIONARIES: Dictionary[] = [
    { name: 'default', words: DEFAULT_WORDS, baseScore: 1 },
    { name: 'computer-science', words: CS_WORDS, baseScore: 1 },
];