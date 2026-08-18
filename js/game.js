/**
 * Motor interactivo del juego de crucigrama:
 * - Borrado correcto con Backspace: borra la letra actual y retrocede, o sólo retrocede si ya está vacía.
 * - Navegación fluida con flechas saltando casillas negras.
 * - Autoverificación y bloqueo de palabras resueltas correctamente.
 */
class CrosswordGame {
    constructor(boardData, scoreManager, slotNum, onStateChange, onVictory, onWordSolved) {
        this.board = boardData;
        this.scoreManager = scoreManager;
        this.slotNum = slotNum;
        this.onStateChange = onStateChange;
        this.onVictory = onVictory;
        this.onWordSolved = onWordSolved;

        this.selectedRow = -1;
        this.selectedCol = -1;
        this.direction = 'across';
        this.userGrid = Array.from({ length: this.board.rows }, () => Array(this.board.cols).fill(''));
        // lockedGrid = solo celdas reveladas con ayuda (no palabras autoverificadas normales)
        this.lockedGrid = Array.from({ length: this.board.rows }, () => Array(this.board.cols).fill(false));
        // solvedWordIds = palabras cuyo contenido es 100% correcto
        this.solvedWordIds = new Set();
        this.isComplete = false;

        this._initSelection();
    }

    _initSelection() {
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                if (!this.board.grid[r][c].isBlack) {
                    this.selectedRow = r;
                    this.selectedCol = c;
                    this.direction = this.board.grid[r][c].acrossWordId ? 'across' : 'down';
                    return;
                }
            }
        }
    }

    selectCell(row, col) {
        if (this.board.grid[row][col].isBlack) return;

        if (this.selectedRow === row && this.selectedCol === col) {
            this.toggleDirection();
            return;
        }

        this.selectedRow = row;
        this.selectedCol = col;
        const cell = this.board.grid[row][col];
        // Adaptar dirección si la celda no soporta la dirección actual
        if (this.direction === 'across' && !cell.acrossWordId && cell.downWordId) {
            this.direction = 'down';
        } else if (this.direction === 'down' && !cell.downWordId && cell.acrossWordId) {
            this.direction = 'across';
        }

        this.notifyChange();
    }

    toggleDirection() {
        const cell = this.board.grid[this.selectedRow][this.selectedCol];
        if (this.direction === 'across' && cell.downWordId) {
            this.direction = 'down';
        } else if (this.direction === 'down' && cell.acrossWordId) {
            this.direction = 'across';
        }
        this.notifyChange();
    }

    selectClue(orientation, number) {
        const word = this.board.placedWords.find(w => w.orientation === orientation && w.number === number);
        if (!word) return;
        this.direction = orientation;
        this.selectedRow = word.row;
        this.selectedCol = word.col;
        this.notifyChange();
    }

    getActiveWord() {
        if (this.selectedRow === -1 || this.selectedCol === -1) return null;
        const cell = this.board.grid[this.selectedRow][this.selectedCol];
        if (!cell || cell.isBlack) return null;
        const wordId = this.direction === 'across' ? cell.acrossWordId : cell.downWordId;
        if (!wordId) return null;
        const [orientation, numStr] = wordId.split('_');
        const num = parseInt(numStr, 10);
        return this.board.placedWords.find(w => w.orientation === orientation && w.number === num) || null;
    }

    isCurrentWordSolved() {
        const aw = this.getActiveWord();
        if (!aw) return false;
        return this.solvedWordIds.has(`${aw.orientation}_${aw.number}`);
    }

    /**
     * Ingreso de letra.
     * Si la palabra ya está resuelta correctamente, salta a la siguiente palabra incompleta.
     * Si la celda está bloqueada (revelada por ayuda), avanza sin escribir.
     */
    handleInput(char) {
        if (this.isComplete || this.selectedRow === -1 || this.selectedCol === -1) return;

        if (this.isCurrentWordSolved()) {
            this.nextUnsolvedWord();
            return;
        }

        const r = this.selectedRow;
        const c = this.selectedCol;
        const cell = this.board.grid[r][c];
        if (cell.isBlack) return;

        // Si la celda está bloqueada por ayuda, sólo avanzar
        if (this.lockedGrid[r][c]) {
            this.moveNext();
            this.notifyChange();
            return;
        }

        const upper = cleanSpanishWord(char);
        if (!upper || upper.length !== 1) return;

        this.userGrid[r][c] = upper;

        // Obtener palabra activa ANTES de mover el cursor
        const activeWord = this.getActiveWord();

        // Animar entrada y avanzar
        this.notifyChange({ popRow: r, popCol: c });
        this.moveNext();

        // Verificar si la palabra quedó completa y correcta
        this._autoVerifyWords(activeWord);
        this.checkVictory();
    }

    /**
     * Borrado con Backspace:
     * - Si la palabra está resuelta (correcta), NO se puede borrar.
     * - Si la celda actual tiene letra (no bloqueada por ayuda), la borra y deja el cursor ahí.
     * - Si la celda actual ya está vacía, retrocede y borra la celda anterior (si no está bloqueada).
     */
    handleBackspace() {
        if (this.isComplete || this.selectedRow === -1 || this.selectedCol === -1) return;

        if (this.isCurrentWordSolved()) {
            // Palabra correcta: protegida. Sólo avanzar a la siguiente palabra incompleta.
            this.nextUnsolvedWord();
            return;
        }

        const r = this.selectedRow;
        const c = this.selectedCol;

        if (this.userGrid[r][c] !== '' && !this.lockedGrid[r][c]) {
            // Hay letra en la celda actual: borrarla y quedarse aquí
            this.userGrid[r][c] = '';
            this.notifyChange();
        } else {
            // Celda vacía (o bloqueada): retroceder y borrar la celda anterior
            this.movePrev();
            const prevR = this.selectedRow;
            const prevC = this.selectedCol;
            if (!this.lockedGrid[prevR][prevC]) {
                this.userGrid[prevR][prevC] = '';
            }
            this.notifyChange();
        }
    }

    /**
     * Verifica autométicamente si la palabra activa (u otras que cruzan) quedaron correctas.
     * Agrega al Set de solvedWordIds sin bloquear las celdas (el usuario puede seguir editando
     * otras palabras que compartan letras con la resuelta, pero no puede borrar la resuelta).
     */
    _autoVerifyWords(activeWord) {
        if (!activeWord) return;

        // Verificar primero la palabra activa
        const wordId = `${activeWord.orientation}_${activeWord.number}`;
        if (!this.solvedWordIds.has(wordId) && this._isWordCorrect(activeWord)) {
            this.solvedWordIds.add(wordId);
            this.scoreManager.addPoints(50);
            if (this.onWordSolved) this.onWordSolved(activeWord);
            setTimeout(() => {
                if (!this.isComplete) this.nextUnsolvedWord();
            }, 350);
        }

        // Verificar palabras que cruzan con la activa (pueden haberse completado indirectamente)
        for (const w of this.board.placedWords) {
            const wId = `${w.orientation}_${w.number}`;
            if (!this.solvedWordIds.has(wId) && this._isWordCorrect(w)) {
                this.solvedWordIds.add(wId);
                this.scoreManager.addPoints(50);
                if (this.onWordSolved) this.onWordSolved(w);
            }
        }
    }

    _isWordCorrect(word) {
        for (let i = 0; i < word.word.length; i++) {
            const r = word.orientation === 'across' ? word.row : word.row + i;
            const c = word.orientation === 'across' ? word.col + i : word.col;
            if (this.userGrid[r][c] !== this.board.grid[r][c].solution) return false;
        }
        return true;
    }

    /**
     * Avanzar al siguiente slot libre dentro de la palabra activa.
     */
    moveNext() {
        const aw = this.getActiveWord();
        if (!aw) return;

        if (this.direction === 'across') {
            if (this.selectedCol + 1 < aw.col + aw.word.length) {
                this.selectedCol++;
            }
        } else {
            if (this.selectedRow + 1 < aw.row + aw.word.length) {
                this.selectedRow++;
            }
        }
    }

    /**
     * Retroceder al slot anterior dentro de la palabra activa.
     */
    movePrev() {
        const aw = this.getActiveWord();
        if (!aw) return;

        if (this.direction === 'across') {
            if (this.selectedCol - 1 >= aw.col) {
                this.selectedCol--;
            }
        } else {
            if (this.selectedRow - 1 >= aw.row) {
                this.selectedRow--;
            }
        }
    }

    /**
     * Navegación con flechas del teclado.
     * Salta casillas negras hasta encontrar una casilla jugable.
     * Actualiza la dirección según el eje del movimiento.
     */
    navigateArrow(dir) {
        const moves = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
        const [dr, dc] = moves[dir] || [0, 0];
        if (dr === 0 && dc === 0) return;

        let curR = this.selectedRow + dr;
        let curC = this.selectedCol + dc;

        while (curR >= 0 && curR < this.board.rows && curC >= 0 && curC < this.board.cols) {
            if (!this.board.grid[curR][curC].isBlack) {
                this.selectedRow = curR;
                this.selectedCol = curC;

                const cell = this.board.grid[curR][curC];
                if (dc !== 0) {
                    // Movimiento horizontal → preferir orientación 'across'
                    if (cell.acrossWordId) this.direction = 'across';
                    else if (cell.downWordId) this.direction = 'down';
                } else {
                    // Movimiento vertical → preferir orientación 'down'
                    if (cell.downWordId) this.direction = 'down';
                    else if (cell.acrossWordId) this.direction = 'across';
                }

                this.notifyChange();
                return;
            }
            curR += dr;
            curC += dc;
        }
    }

    nextWord() {
        const words = this.board.placedWords;
        const current = this.getActiveWord();
        if (!current) return;
        const idx = words.indexOf(current);
        const next = words[(idx + 1) % words.length];
        this.direction = next.orientation;
        this.selectedRow = next.row;
        this.selectedCol = next.col;
        this.notifyChange();
    }

    prevWord() {
        const words = this.board.placedWords;
        const current = this.getActiveWord();
        if (!current) return;
        const idx = words.indexOf(current);
        const prev = words[(idx - 1 + words.length) % words.length];
        this.direction = prev.orientation;
        this.selectedRow = prev.row;
        this.selectedCol = prev.col;
        this.notifyChange();
    }

    /**
     * Saltar a la siguiente palabra que aún no está resuelta,
     * posicionando el cursor en su primera celda vacía.
     */
    nextUnsolvedWord() {
        const words = this.board.placedWords;
        const current = this.getActiveWord();
        const startIdx = current ? words.indexOf(current) : 0;

        for (let i = 1; i <= words.length; i++) {
            const candidate = words[(startIdx + i) % words.length];
            const wId = `${candidate.orientation}_${candidate.number}`;
            if (!this.solvedWordIds.has(wId)) {
                this.direction = candidate.orientation;
                // Buscar primera celda vacía de la palabra
                for (let k = 0; k < candidate.word.length; k++) {
                    const r = candidate.orientation === 'across' ? candidate.row : candidate.row + k;
                    const c = candidate.orientation === 'across' ? candidate.col + k : candidate.col;
                    if (this.userGrid[r][c] === '') {
                        this.selectedRow = r;
                        this.selectedCol = c;
                        this.notifyChange();
                        return;
                    }
                }
                // Si todas están llenas (pero mal), ir al inicio de la palabra
                this.selectedRow = candidate.row;
                this.selectedCol = candidate.col;
                this.notifyChange();
                return;
            }
        }
    }

    revealCurrentCell() {
        if (this.isComplete || this.selectedRow === -1 || this.selectedCol === -1) return;
        const r = this.selectedRow;
        const c = this.selectedCol;
        const cell = this.board.grid[r][c];
        if (cell.isBlack || this.lockedGrid[r][c]) return;

        this.userGrid[r][c] = cell.solution;
        this.lockedGrid[r][c] = true;
        this.scoreManager.deductPoints(25);

        this.notifyChange({ popRow: r, popCol: c });
        this._autoVerifyWords(this.getActiveWord());
        this.checkVictory();
    }

    revealCurrentWord() {
        if (this.isComplete) return;
        const activeWord = this.getActiveWord();
        if (!activeWord) return;

        for (let i = 0; i < activeWord.word.length; i++) {
            const r = activeWord.orientation === 'across' ? activeWord.row : activeWord.row + i;
            const c = activeWord.orientation === 'across' ? activeWord.col + i : activeWord.col;
            this.userGrid[r][c] = this.board.grid[r][c].solution;
            this.lockedGrid[r][c] = true;
        }

        this.scoreManager.deductPoints(100);
        this.solvedWordIds.add(`${activeWord.orientation}_${activeWord.number}`);
        this.notifyChange();
        this.checkVictory();
    }

    checkErrors() {
        const errorCells = [];
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const cell = this.board.grid[r][c];
                if (!cell.isBlack && this.userGrid[r][c] !== '' && this.userGrid[r][c] !== cell.solution) {
                    errorCells.push({ row: r, col: c });
                }
            }
        }
        this.scoreManager.deductPoints(15);
        return { errorsFound: errorCells.length, errorCells };
    }

    checkVictory() {
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const cell = this.board.grid[r][c];
                if (!cell.isBlack && this.userGrid[r][c] !== cell.solution) return false;
            }
        }

        this.isComplete = true;
        this.scoreManager.stopTimer();
        const finalResults = this.scoreManager.calculateFinalScore(this.board.placedWords.length);
        const stats = this.scoreManager.saveDailyVictory(this.slotNum, finalResults);
        if (this.onVictory) this.onVictory(this.slotNum, finalResults, stats);
        return true;
    }

    notifyChange(extra = {}) {
        if (this.onStateChange) {
            this.onStateChange({
                selectedRow: this.selectedRow,
                selectedCol: this.selectedCol,
                direction: this.direction,
                activeWord: this.getActiveWord(),
                userGrid: this.userGrid,
                lockedGrid: this.lockedGrid,
                solvedWordIds: this.solvedWordIds,
                score: this.scoreManager.score,
                isComplete: this.isComplete,
                ...extra
            });
        }
    }
}
