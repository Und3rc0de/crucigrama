/**
 * Motor de Generación de Crucigramas de Alta Densidad (23 a 40 palabras)
 * Garantiza numeración secuencial estándar de periódico (sin números duplicados) y palabras únicas.
 */
class CrosswordGenerator {
    constructor(dictionary = CROSSWORD_DICTIONARY) {
        this.dictionary = dictionary;
        this.wordsByLength = this._indexDictionary();
    }

    _indexDictionary() {
        const index = {};
        for (let entry of this.dictionary) {
            const clean = cleanSpanishWord(entry.word);
            const len = clean.length;
            if (!index[len]) index[len] = [];
            index[len].push({
                word: clean,
                rawWord: clean,
                clue: entry.clue,
                category: entry.category
            });
        }
        return index;
    }

    _createRNG(seedStr) {
        if (!seedStr) return Math.random;
        let h = 1779033703 ^ seedStr.length;
        for (let i = 0; i < seedStr.length; i++) {
            h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        let s = h;
        return function() {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    _getTemplates() {
        return [
            // Plantilla 1: Circular / Diamante con cruz central (11x11)
            {
                rows: 11,
                cols: 11,
                grid: [
                    "###.....###",
                    "#.........#",
                    "...........",
                    "....#.#....",
                    "....###....",
                    "..#######..",
                    "....###....",
                    "....#.#....",
                    "...........",
                    "#.........#",
                    "###.....###"
                ]
            },
            // Plantilla 2: Diamante y bloques simétricos (11x11)
            {
                rows: 11,
                cols: 11,
                grid: [
                    "##.......##",
                    "#.........#",
                    "....#.#....",
                    "...#####...",
                    "....#.#....",
                    "...........",
                    "....#.#....",
                    "...#####...",
                    "....#.#....",
                    "#.........#",
                    "##.......##"
                ]
            },
            // Plantilla 3: Cuadrícula periódica 12x12
            {
                rows: 12,
                cols: 12,
                grid: [
                    "##........##",
                    "#..........#",
                    "....##..##..",
                    "....#....#..",
                    "........####",
                    "..###..###..",
                    "..###..###..",
                    "####........",
                    "..#....#....",
                    "..##..##....",
                    "#..........#",
                    "##........##"
                ]
            }
        ];
    }

    generate(options = {}) {
        const seedStr = options.seed || null;
        const rng = this._createRNG(seedStr);
        const templates = this._getTemplates();
        
        const templateIdx = Math.floor(rng() * templates.length);
        const template = templates[templateIdx];

        let board = this._solveTemplate(template, rng);
        
        if (!board || board.placedWords.length < 22) {
            board = this._generateProceduralDense(12, 12, 24, 36, rng);
        }

        return this._finalizeBoard(board);
    }

    _solveTemplate(template, rng) {
        const rows = template.rows;
        const cols = template.cols;
        const grid = template.grid.map(row => row.split(''));
        
        const slots = [];
        
        // Extraer slots horizontales (longitud >= 2)
        for (let r = 0; r < rows; r++) {
            let start = -1;
            for (let c = 0; c <= cols; c++) {
                if (c < cols && grid[r][c] === '.') {
                    if (start === -1) start = c;
                } else {
                    if (start !== -1) {
                        const len = c - start;
                        if (len >= 2) {
                            slots.push({ id: `across_${r}_${start}`, orientation: 'across', row: r, col: start, length: len });
                        }
                        start = -1;
                    }
                }
            }
        }

        // Extraer slots verticales (longitud >= 2)
        for (let c = 0; c < cols; c++) {
            let start = -1;
            for (let r = 0; r <= rows; r++) {
                if (r < rows && grid[r][c] === '.') {
                    if (start === -1) start = r;
                } else {
                    if (start !== -1) {
                        const len = r - start;
                        if (len >= 2) {
                            slots.push({ id: `down_${start}_${c}`, orientation: 'down', row: start, col: c, length: len });
                        }
                        start = -1;
                    }
                }
            }
        }

        const letterGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] === '#') {
                    letterGrid[r][c] = '#';
                }
            }
        }

        slots.sort((a, b) => b.length - a.length);

        const usedWords = new Set();
        const assignments = {};
        let steps = 0;
        const maxSteps = 3500;

        const solve = (slotIndex) => {
            steps++;
            if (steps > maxSteps) return false;
            if (slotIndex >= slots.length) return true;

            const slot = slots[slotIndex];
            const candidateWords = this._getCandidatesForSlot(letterGrid, slot, rng);

            for (let candidate of candidateWords) {
                if (usedWords.has(candidate.word)) continue;

                const backup = this._placeCandidate(letterGrid, slot, candidate.word);
                usedWords.add(candidate.word);
                assignments[slot.id] = candidate;

                if (solve(slotIndex + 1)) {
                    return true;
                }

                this._restoreCandidate(letterGrid, slot, backup);
                usedWords.delete(candidate.word);
                delete assignments[slot.id];
            }

            return false;
        };

        const solved = solve(0);

        if (solved) {
            const placedWords = slots.map(slot => {
                const assigned = assignments[slot.id];
                return {
                    word: assigned.word,
                    rawWord: assigned.word,
                    clue: assigned.clue,
                    category: assigned.category,
                    row: slot.row,
                    col: slot.col,
                    orientation: slot.orientation
                };
            });

            return { rows, cols, grid: letterGrid, placedWords };
        }

        return null;
    }

    _getCandidatesForSlot(letterGrid, slot, rng) {
        const len = slot.length;
        const pool = this.wordsByLength[len] || [];
        if (pool.length === 0) return [];

        const pattern = [];
        for (let i = 0; i < len; i++) {
            const r = slot.orientation === 'across' ? slot.row : slot.row + i;
            const c = slot.orientation === 'across' ? slot.col + i : slot.col;
            pattern.push(letterGrid[r][c]);
        }

        const matches = [];
        for (let item of pool) {
            let ok = true;
            for (let i = 0; i < len; i++) {
                if (pattern[i] !== null && pattern[i] !== item.word[i]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                matches.push(item);
            }
        }

        return matches.sort(() => rng() - 0.5);
    }

    _placeCandidate(letterGrid, slot, word) {
        const backup = [];
        for (let i = 0; i < word.length; i++) {
            const r = slot.orientation === 'across' ? slot.row : slot.row + i;
            const c = slot.orientation === 'across' ? slot.col + i : slot.col;
            backup.push(letterGrid[r][c]);
            letterGrid[r][c] = word[i];
        }
        return backup;
    }

    _restoreCandidate(letterGrid, slot, backup) {
        for (let i = 0; i < backup.length; i++) {
            const r = slot.orientation === 'across' ? slot.row : slot.row + i;
            const c = slot.orientation === 'across' ? slot.col + i : slot.col;
            letterGrid[r][c] = backup[i];
        }
    }

    _generateProceduralDense(rows, cols, targetMin, targetMax, rng) {
        let best = null;

        for (let attempt = 0; attempt < 30; attempt++) {
            const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
            const placedWords = [];
            const usedWords = new Set();
            const wordMap = { across: new Set(), down: new Set() };
            const shuffled = [...this.dictionary].sort(() => rng() - 0.5);

            const first = shuffled[0];
            const firstWord = cleanSpanishWord(first.word);
            const startR = Math.floor(rows / 2);
            const startC = Math.max(0, Math.floor((cols - firstWord.length) / 2));
            
            this._placeWordOnGrid(grid, firstWord, startR, startC, 'across');
            for (let k = 0; k < firstWord.length; k++) {
                wordMap.across.add(`${startR},${startC + k}`);
            }
            usedWords.add(firstWord);
            placedWords.push({
                word: firstWord,
                rawWord: first.word,
                clue: first.clue,
                category: first.category,
                row: startR,
                col: startC,
                orientation: 'across'
            });

            for (let wordObj of shuffled.slice(1)) {
                const word = cleanSpanishWord(wordObj.word);
                if (usedWords.has(word) || word.length > rows) continue;

                const placement = this._findPlacement(grid, wordMap, word, rows, cols, rng);
                if (placement) {
                    this._placeWordOnGrid(grid, word, placement.row, placement.col, placement.orientation);
                    for (let k = 0; k < word.length; k++) {
                        const r = placement.orientation === 'across' ? placement.row : placement.row + k;
                        const c = placement.orientation === 'across' ? placement.col + k : placement.col;
                        wordMap[placement.orientation].add(`${r},${c}`);
                    }
                    usedWords.add(word);
                    placedWords.push({
                        word: word,
                        rawWord: wordObj.word,
                        clue: wordObj.clue,
                        category: wordObj.category,
                        row: placement.row,
                        col: placement.col,
                        orientation: placement.orientation
                    });
                }
            }

            if (!best || placedWords.length > best.placedWords.length) {
                best = { rows, cols, grid, placedWords };
            }

            if (best.placedWords.length >= targetMin) {
                break;
            }
        }

        return best;
    }

    _findPlacement(grid, wordMap, word, rows, cols, rng) {
        const placements = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const char = grid[r][c];
                if (!char || char === '#') continue;

                for (let i = 0; i < word.length; i++) {
                    if (word[i] === char) {
                        const acrossCol = c - i;
                        if (this._canPlace(grid, wordMap, word, r, acrossCol, 'across', rows, cols)) {
                            placements.push({ row: r, col: acrossCol, orientation: 'across' });
                        }
                        const downRow = r - i;
                        if (this._canPlace(grid, wordMap, word, downRow, c, 'down', rows, cols)) {
                            placements.push({ row: downRow, col: c, orientation: 'down' });
                        }
                    }
                }
            }
        }

        if (placements.length === 0) return null;
        return placements[Math.floor(rng() * placements.length)];
    }

    _canPlace(grid, wordMap, word, row, col, orientation, rows, cols) {
        const len = word.length;
        if (orientation === 'across') {
            if (row < 0 || row >= rows || col < 0 || col + len > cols) return false;
            if (col > 0 && grid[row][col - 1] !== null && grid[row][col - 1] !== '#') return false;
            if (col + len < cols && grid[row][col + len] !== null && grid[row][col + len] !== '#') return false;

            let hasIntersection = false;

            for (let i = 0; i < len; i++) {
                const cur = grid[row][col + i];
                const key = `${row},${col + i}`;

                // No puede compartir celda con otra palabra horizontal
                if (wordMap.across.has(key)) return false;

                if (cur !== null && cur !== '#') {
                    if (cur !== word[i]) return false;
                    hasIntersection = true;
                } else {
                    if (row > 0 && grid[row - 1][col + i] !== null && grid[row - 1][col + i] !== '#') return false;
                    if (row < rows - 1 && grid[row + 1][col + i] !== null && grid[row + 1][col + i] !== '#') return false;
                }
            }
            return hasIntersection;
        } else {
            if (col < 0 || col >= cols || row < 0 || row + len > rows) return false;
            if (row > 0 && grid[row - 1][col] !== null && grid[row - 1][col] !== '#') return false;
            if (row + len < rows && grid[row + len][col] !== null && grid[row + len][col] !== '#') return false;

            let hasIntersection = false;

            for (let i = 0; i < len; i++) {
                const cur = grid[row + i][col];
                const key = `${row + i},${col}`;

                // No puede compartir celda con otra palabra vertical
                if (wordMap.down.has(key)) return false;

                if (cur !== null && cur !== '#') {
                    if (cur !== word[i]) return false;
                    hasIntersection = true;
                } else {
                    if (col > 0 && grid[row + i][col - 1] !== null && grid[row + i][col - 1] !== '#') return false;
                    if (col < cols - 1 && grid[row + i][col + 1] !== null && grid[row + i][col + 1] !== '#') return false;
                }
            }
            return hasIntersection;
        }
    }

    _placeWordOnGrid(grid, word, row, col, orientation) {
        for (let i = 0; i < word.length; i++) {
            const r = orientation === 'across' ? row : row + i;
            const c = orientation === 'across' ? col + i : col;
            grid[r][c] = word[i];
        }
    }

    /**
     * Asigna numeración secuencial estricta (1, 2, 3...) sin duplicados.
     */
    _finalizeBoard(boardData) {
        const { rows, cols, grid, placedWords } = boardData;
        const numberGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
        let nextClueNumber = 1;

        // Recorrer de arriba a abajo, izquierda a derecha
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] === null || grid[r][c] === '#') continue;

                // Verificar si alguna palabra empieza en esta casilla (r, c)
                const startsAcross = placedWords.some(w => w.orientation === 'across' && w.row === r && w.col === c);
                const startsDown = placedWords.some(w => w.orientation === 'down' && w.row === r && w.col === c);

                if (startsAcross || startsDown) {
                    const clueNum = nextClueNumber++;
                    numberGrid[r][c] = clueNum;

                    // Asignar el número a las palabras que inician aquí
                    placedWords.forEach(w => {
                        if (w.row === r && w.col === c) {
                            w.number = clueNum;
                        }
                    });
                }
            }
        }

        const acrossClues = placedWords
            .filter(w => w.orientation === 'across')
            .sort((a, b) => a.number - b.number);

        const downClues = placedWords
            .filter(w => w.orientation === 'down')
            .sort((a, b) => a.number - b.number);

        const cells = [];
        for (let r = 0; r < rows; r++) {
            const rowArr = [];
            for (let c = 0; c < cols; c++) {
                const letter = grid[r][c];
                const isBlack = letter === null || letter === '#';
                const clueNum = numberGrid[r][c];

                const acrossWord = placedWords.find(w => 
                    w.orientation === 'across' && w.row === r && c >= w.col && c < w.col + w.word.length
                );
                const downWord = placedWords.find(w => 
                    w.orientation === 'down' && w.col === c && r >= w.row && r < w.row + w.word.length
                );

                rowArr.push({
                    row: r,
                    col: c,
                    solution: isBlack ? '' : letter,
                    isBlack: isBlack,
                    clueNumber: clueNum,
                    acrossWordId: acrossWord ? `${acrossWord.orientation}_${acrossWord.number}` : null,
                    downWordId: downWord ? `${downWord.orientation}_${downWord.number}` : null
                });
            }
            cells.push(rowArr);
        }

        return {
            rows,
            cols,
            grid: cells,
            placedWords,
            acrossClues,
            downClues,
            totalWords: placedWords.length
        };
    }
}
