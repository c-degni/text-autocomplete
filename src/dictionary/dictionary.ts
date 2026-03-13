import { Trie } from './trie';
import { DEFAULT_WORDS, CS_WORDS } from './words'

let DEFAULT_TRIE = new Trie();
DEFAULT_WORDS.forEach(word => DEFAULT_TRIE.insert(word));
CS_WORDS.forEach(word => DEFAULT_TRIE.insert(word));

export { DEFAULT_TRIE };