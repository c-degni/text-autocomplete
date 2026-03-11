class TrieNode {
    children: Record<string, TrieNode>;
    endOfWord: boolean;

    constructor() {
        this.children = {};
        this.endOfWord = false;
    }
}

export default class Trie {
    root: TrieNode;
    constructor() {
        this.root = new TrieNode();
    }

    insert(word: string): void {
        let tmp = this.root;
        for (const char of word) { 
            if (!tmp.children[char]) tmp.children[char] = new TrieNode();
            tmp = tmp.children[char];
        }
        tmp.endOfWord = true;
    }

    private removeWord(node: TrieNode, word: string, index: number): boolean {
        // Base Case: currently at the end of word
        if (index === word.length) {
            if (!node.endOfWord) return false;
            node.endOfWord = false;
            return Object.keys(node.children).length === 0;
        }

        const char = word[index];
        if (!node.children[char]) return false;

        const canDeleteChild: boolean = this.removeWord(node.children[char], word, index + 1);
        if (canDeleteChild) {
            delete node.children[char];
            return !node.endOfWord && Object.keys(node.children).length === 0;
        }
        return false;
    }

    remove(word: string): void {
        if (word.length === 0) return;
        this.removeWord(this.root, word, 0);
    }

    collectWords(node: TrieNode, prefix: string, results: string[], limit: number): void {
        // Base Case: result list has reached search limit
        if (results.length >= limit) return;

        if (node.endOfWord && prefix !== '') results.push(prefix);

        for (const char in node.children) {
            this.collectWords(node.children[char], prefix + char, results, limit);
        }
    }

    findWordsWithPrefix(prefix: string, limit: number = Infinity) : string[] {
        let tmp = this.root;
        for (const char of prefix) { 
            if (!tmp.children[char]) return [];
            tmp = tmp.children[char];
        }

        const results: string[] = [];
        this.collectWords(tmp, prefix, results, limit);
        return results;
    }
}

export { Trie };