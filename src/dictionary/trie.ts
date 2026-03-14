class TrieNode {
    children: Record<string, TrieNode>;
    endOfWord: boolean;
    prefix: string;
    words: Set<string>;
    cache: string[];

    constructor(prefix: string = '') {
        this.children = {};
        this.endOfWord = false;
        this.prefix = prefix;
        this.words = new Set();
        this.cache = [];
    }
}

export default class Trie {
    root: TrieNode;
    wordScores: Map<string, number>;
    maxCacheSize: number;

    constructor(maxCacheSize: number = 10) {
        this.root = new TrieNode();
        this.wordScores = new Map();
        this.maxCacheSize = maxCacheSize;
    }

    insert(word: string, score: number = 0): void {
        if (word.length === 0) return;
        
        if (!this.wordScores.has(word)) {
            this.wordScores.set(word, score);
        }
        
        let tmp: TrieNode = this.root;
        let path: TrieNode[] = [this.root];
        const normalized: string = word.toLowerCase();

        for (const char of normalized) { 
            if (!tmp.children[char]) { 
                tmp.children[char] = new TrieNode(tmp.prefix + char);
            }
            tmp = tmp.children[char];
            path.push(tmp);
        }

        tmp.endOfWord = true;
        tmp.words.add(word);

        for (const node of path) {
            this.updateCache(node, word);
        }
    }

    remove(word: string): void {
        if (word.length === 0) return;
        this.removeWord(this.root, word, 0);
    }

    bumpWordScore(word: string, delta: number = 1): void {
        if (!this.wordScores.has(word)) return;

        this.wordScores.set(word, (this.getScore(word) ?? 0) + delta);

        const path: TrieNode[] | null = this.getPathNodes(word);
        if (!path) return;

        for (const node of path) {
            this.refreshCache(node);
        }
    }

    setWordScore(word: string, score: number): void {
        if (!this.wordScores.has(word)) return;

        this.wordScores.set(word, score);

        const path: TrieNode[] | null = this.getPathNodes(word);
        if (!path) return;

        for (const node of path) {
            this.refreshCache(node);
        }
    }

    findWordsWithPrefix(prefix: string, limit: number = Infinity, caseSensitive: boolean) : string[] {
        let tmp: TrieNode = this.root;
        const normalized: string = prefix.toLowerCase();
        for (const char of normalized) { 
            if (!tmp.children[char]) return [];
            tmp = tmp.children[char];
        }

        const results: string[] = [];
        const seen: Set<string> = new Set();

        for (const word of tmp.cache) {
            if (results.length >= limit) break;
            if (caseSensitive && !word.startsWith(prefix)) continue;
            if (seen.has(word)) continue;

            seen.add(word);
            results.push(word);
        }

        
        if (results.length < limit) {
            this.collectWords(tmp, results, seen, prefix, limit, caseSensitive);
        }

        return results;
    }

    getScore(word: string): number | undefined {
        return this.wordScores.get(word);
    }

    private removeWord(node: TrieNode, word: string, index: number): boolean {
        // Base Case: currently at the end of word
        if (index === word.length) {
            if (!node.words.has(word)) return false;

            node.words.delete(word);
            this.wordScores.delete(word);
            if (node.words.size === 0) node.endOfWord = false;

            this.refreshCache(node);

            return !node.endOfWord && this.hasNoChildren(node);
        }

        const char: string = word[index].toLowerCase();
        const child: TrieNode | undefined = node.children[char];
        if (!child) return false;

        const canDeleteChild: boolean = this.removeWord(child, word, index + 1);
        if (canDeleteChild) delete node.children[char];

        this.refreshCache(node);
        return !node.endOfWord && this.hasNoChildren(node);
    }

    private collectWords(
        node: TrieNode, 
        results: string[], 
        seen: Set<string>, 
        prefix: string, 
        limit: number, 
        caseSensitive: boolean
    ): void {
        // Base Case: result list has reached search limit
        if (results.length >= limit) return;

        if (node.endOfWord) {
            const terminalWords: string[] = Array.from(node.words)
                .sort((a: string, b: string) => this.compareWords(a, b));

            for (const word of terminalWords) {
                if (results.length >= limit) return;
                if (seen.has(word)) continue;
                if (caseSensitive && !word.startsWith(prefix)) continue;

                seen.add(word);
                results.push(word);
            }
        }

        const childEntries: Array<[string, TrieNode]> = Object.entries(node.children);
        childEntries.sort(([, childA], [, childB]) => {
            const bestA: string | undefined = childA.cache[0];
            const bestB: string | undefined = childB.cache[0];

            if (!bestA && !bestB) return 0;
            if (!bestA) return 1;
            if (!bestB) return -1;

            return this.compareWords(bestA, bestB);
        });

        for (const [, child] of childEntries) {
            if (results.length >= limit) return;
            this.collectWords(child, results, seen, prefix, limit, caseSensitive);
        }
    }

    private getPathNodes(word: string): TrieNode[] | null {
        let tmp: TrieNode = this.root;
        const normalized: string = word.toLowerCase();
        const path: TrieNode[] = [this.root];

        for (const char of normalized) {
            if (!tmp.children[char]) return null;
            tmp = tmp.children[char];
            path.push(tmp);
        }

        return path;
    }

    private updateCache(node: TrieNode, word: string): void {
        const existingIndex: number = node.cache.indexOf(word);
        if (existingIndex !== -1) {
            node.cache.splice(existingIndex, 1);
        }

        node.cache.push(word);
        node.cache.sort((a: string, b: string) => this.compareWords(a, b));

        if (node.cache.length > this.maxCacheSize) {
            node.cache.length = this.maxCacheSize;
        }
    }

    private refreshCache(node: TrieNode): void {
        const candidates: Set<string> = new Set();

        for (const word of node.words) {
            if (this.wordScores.has(word) && this.shouldCacheWord(node, word)) {
                candidates.add(word);
            }
        }

        for (const char in node.children) {
            for (const word of node.children[char].cache) {
                if (this.wordScores.has(word) && this.shouldCacheWord(node, word)) {
                    candidates.add(word);
                }
            }
        }

        node.cache = Array.from(candidates)
            .sort((a: string, b: string) => this.compareWords(a, b)) 
            .slice(0, this.maxCacheSize);
    }

    private shouldCacheWord(node: TrieNode, word: string): boolean {
        return word !== node.prefix;
    }

    private compareWords(a: string, b: string): number {
        const scoreA: number = this.getScore(a) ?? 0;
        const scoreB: number = this.getScore(b) ?? 0;

        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.localeCompare(b);
    }

    private hasNoChildren(node: TrieNode): boolean {
        for (const _ in node.children) return false;
        return true;
    }
}

export { Trie };