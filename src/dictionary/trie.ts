class TrieNode {
    children: Record<string, TrieNode>;
    endOfWord: boolean;
    words: Set<string>;

    constructor() {
        this.children = {};
        this.endOfWord = false;
        this.words = new Set();
    }
}

export default class Trie {
    root: TrieNode;
    constructor() {
        this.root = new TrieNode();
    }

    insert(word: string): void {
        let tmp: TrieNode = this.root;
        const normalized: string = word.toLowerCase();
        for (const char of normalized) { 
            if (!tmp.children[char]) tmp.children[char] = new TrieNode();
            tmp = tmp.children[char];
        }
        tmp.endOfWord = true;
        tmp.words.add(word);
    }

    remove(word: string): void {
        if (word.length === 0) return;
        this.removeWord(this.root, word, 0);
    }

    findWordsWithPrefix(prefix: string, limit: number = Infinity, caseSensitive: boolean) : string[] {
        let tmp: TrieNode = this.root;
        const normalized: string = prefix.toLowerCase();
        for (const char of normalized) { 
            if (!tmp.children[char]) return [];
            tmp = tmp.children[char];
        }

        const results: string[] = [];
        this.collectWords(tmp, results, limit);

        if (caseSensitive) {
            return results.filter(word => word.startsWith(prefix));
        }

        return results;
    }

    private removeWord(node: TrieNode, word: string, index: number): boolean {
        // Base Case: currently at the end of word
        if (index === word.length) {
            if (!node.words.has(word)) return false;

            node.words.delete(word);
            if (node.words.size === 0) node.endOfWord = false;

            return !node.endOfWord && Object.keys(node.children).length === 0;
        }

        const char: string = word[index].toLowerCase();
        if (!node.children[char]) return false;

        const canDeleteChild: boolean = this.removeWord(node.children[char], word, index + 1);
        if (canDeleteChild) {
            delete node.children[char];
            return !node.endOfWord && Object.keys(node.children).length === 0;
        }
        return false;
    }

    private collectWords(node: TrieNode, results: string[], limit: number): void {
        // Base Case: result list has reached search limit
        if (results.length >= limit) return;

        if (node.endOfWord) { 
            for (const word of node.words) {
                results.push(word);
                if (results.length >= limit) return;
            }
        }

        for (const char in node.children) {
            this.collectWords(node.children[char], results, limit);
        }
    }
}

export { Trie };