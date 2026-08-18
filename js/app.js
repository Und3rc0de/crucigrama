/**
 * Controlador principal de interfaz, sonido, autoverificación y slots diarios.
 */
document.addEventListener('DOMContentLoaded', () => {
    const generator = new CrosswordGenerator(CROSSWORD_DICTIONARY);
    const scoreManager = new ScoreManager();
    const sound = new SoundEffects();
    let game = null;
    let currentSlot = 1; // 1 o 2

    // Elementos del DOM
    const dateBanner = document.getElementById('daily-date-display');
    const streakDisplay = document.getElementById('streak-display');
    const slot1Btn = document.getElementById('btn-slot-1');
    const slot2Btn = document.getElementById('btn-slot-2');
    const gridContainer = document.getElementById('crossword-grid');
    const acrossCluesList = document.getElementById('across-clues');
    const downCluesList = document.getElementById('down-clues');
    const timerDisplay = document.getElementById('timer-display');
    const scoreDisplay = document.getElementById('score-display');
    const activeClueBar = document.getElementById('active-clue-text');
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const btnResetSlot = document.getElementById('btn-reset-slot');

    // Paneles y Bloqueos
    const completedBanner = document.getElementById('daily-completed-banner');
    const midnightCountdown = document.getElementById('midnight-countdown');

    // Botones de acción
    const btnCheckErrors = document.getElementById('btn-check');
    const btnRevealLetter = document.getElementById('btn-reveal-letter');
    const btnRevealWord = document.getElementById('btn-reveal-word');
    const btnStats = document.getElementById('btn-stats');
    const btnStatsClose = document.getElementById('btn-stats-close');
    const statsModal = document.getElementById('stats-modal');

    // Modal de Victoria
    const victoryModal = document.getElementById('victory-modal');
    const btnNextDaily = document.getElementById('btn-next-daily');

    function initHeader() {
        dateBanner.textContent = scoreManager.getFormattedDate();
        updateStreakUI();
        updateDailyTabsUI();
        startMidnightInterval();
        updateSoundButton();
    }

    function updateSoundButton() {
        if (btnSoundToggle) {
            btnSoundToggle.textContent = sound.enabled ? '🔊 Sonido' : '🔇 Silencio';
        }
    }

    if (btnSoundToggle) {
        btnSoundToggle.addEventListener('click', () => {
            const isEnabled = sound.toggle();
            updateSoundButton();
            showToast(isEnabled ? 'Sonido activado' : 'Sonido desactivado', 'info');
        });
    }

    function updateStreakUI() {
        const stats = scoreManager.loadStats();
        if (streakDisplay) {
            streakDisplay.textContent = `${stats.currentStreak || 0} 🔥`;
        }
    }

    function updateDailyTabsUI() {
        const daily = scoreManager.loadDailyData();

        // Slot 1
        if (daily.slots[1].completed) {
            slot1Btn.innerHTML = `<span>🧩 Reto 1</span> <small class="badge-done">✅ ${daily.slots[1].score} pts</small>`;
            slot1Btn.classList.add('tab-completed');
        } else {
            slot1Btn.innerHTML = `<span>🧩 Reto 1</span> <small class="badge-pending">Pendiente</small>`;
            slot1Btn.classList.remove('tab-completed');
        }

        // Slot 2
        if (daily.slots[2].completed) {
            slot2Btn.innerHTML = `<span>🧩 Reto 2</span> <small class="badge-done">✅ ${daily.slots[2].score} pts</small>`;
            slot2Btn.classList.add('tab-completed');
        } else {
            slot2Btn.innerHTML = `<span>🧩 Reto 2</span> <small class="badge-pending">Pendiente</small>`;
            slot2Btn.classList.remove('tab-completed');
        }

        slot1Btn.classList.toggle('tab-active', currentSlot === 1);
        slot2Btn.classList.toggle('tab-active', currentSlot === 2);

        if (scoreManager.isDailyFullyCompleted()) {
            completedBanner.classList.remove('hidden');
        } else {
            completedBanner.classList.add('hidden');
        }
    }

    function startMidnightInterval() {
        setInterval(() => {
            if (midnightCountdown) {
                midnightCountdown.textContent = scoreManager.getTimeUntilMidnight();
            }
        }, 1000);
    }

    // Cargar partida para el slot seleccionado
    function loadDailySlot(slotNum) {
        currentSlot = slotNum;
        scoreManager.currentSlot = slotNum;
        updateDailyTabsUI();

        const daily = scoreManager.loadDailyData();
        const slotData = daily.slots[slotNum];
        const todayKey = scoreManager.getTodayKey();
        const seedStr = `lavoz_daily_${todayKey}_slot_${slotNum}`;

        const boardData = generator.generate({
            rows: 12,
            cols: 12,
            minWords: 24,
            seed: seedStr
        });

        scoreManager.resetScore();

        if (slotData.completed) {
            scoreManager.stopTimer();
            scoreDisplay.textContent = slotData.score;
            timerDisplay.textContent = slotData.time;

            game = new CrosswordGame(
                boardData,
                scoreManager,
                slotNum,
                renderGameState,
                null,
                null
            );
            game.isComplete = true;

            for (let r = 0; r < boardData.rows; r++) {
                for (let c = 0; c < boardData.cols; c++) {
                    game.userGrid[r][c] = boardData.grid[r][c].solution;
                    game.lockedGrid[r][c] = true;
                }
            }

            boardData.placedWords.forEach(w => {
                game.solvedWordIds.add(`${w.orientation}_${w.number}`);
            });

            renderClueLists(boardData);
            renderGrid(boardData);
            game.notifyChange();
        } else {
            scoreDisplay.textContent = '0';
            timerDisplay.textContent = '00:00';

            game = new CrosswordGame(
                boardData,
                scoreManager,
                slotNum,
                renderGameState,
                onGameVictory,
                onWordSolved
            );

            scoreManager.startTimer((formattedTime) => {
                timerDisplay.textContent = formattedTime;
            });

            renderClueLists(boardData);
            renderGrid(boardData);
            game.notifyChange();
        }
    }

    // Reiniciar slot actual
    if (btnResetSlot) {
        btnResetSlot.addEventListener('click', () => {
            if (confirm(`¿Deseas reiniciar el Reto Diario #${currentSlot}?`)) {
                scoreManager.resetSlot(currentSlot);
                loadDailySlot(currentSlot);
                showToast(`Reto #${currentSlot} reiniciado`, 'info');
            }
        });
    }

    // Callback de Autoverificación cuando una palabra es correcta
    function onWordSolved(word) {
        sound.playWordSuccess();

        for (let i = 0; i < word.word.length; i++) {
            const r = word.orientation === 'across' ? word.row : word.row + i;
            const c = word.orientation === 'across' ? word.col + i : word.col;
            const cellDiv = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cellDiv) {
                setTimeout(() => {
                    cellDiv.classList.add('word-solved-anim');
                    setTimeout(() => cellDiv.classList.remove('word-solved-anim'), 600);
                }, i * 50);
            }
        }

        showToast(`¡Palabra "${word.word}" correcta! (+50 pts)`, 'success');
    }

    // Renderizado de las listas de pistas (Horizontales y Verticales)
    function renderClueLists(boardData) {
        acrossCluesList.innerHTML = '';
        downCluesList.innerHTML = '';

        boardData.acrossClues.forEach(clue => {
            const li = document.createElement('li');
            li.id = `clue-across-${clue.number}`;
            li.innerHTML = `<strong>${clue.number}</strong> <span>${clue.clue}</span>`;
            li.addEventListener('click', () => {
                if (game) game.selectClue('across', clue.number);
            });
            acrossCluesList.appendChild(li);
        });

        boardData.downClues.forEach(clue => {
            const li = document.createElement('li');
            li.id = `clue-down-${clue.number}`;
            li.innerHTML = `<strong>${clue.number}</strong> <span>${clue.clue}</span>`;
            li.addEventListener('click', () => {
                if (game) game.selectClue('down', clue.number);
            });
            downCluesList.appendChild(li);
        });
    }

    // Renderizado de la cuadrícula
    function renderGrid(boardData) {
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${boardData.cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${boardData.rows}, 1fr)`;

        for (let r = 0; r < boardData.rows; r++) {
            for (let c = 0; c < boardData.cols; c++) {
                const cellData = boardData.grid[r][c];
                const cellDiv = document.createElement('div');
                cellDiv.className = 'grid-cell';
                cellDiv.dataset.row = r;
                cellDiv.dataset.col = c;

                if (cellData.isBlack) {
                    cellDiv.classList.add('black-cell');
                } else {
                    if (cellData.clueNumber) {
                        const numSpan = document.createElement('span');
                        numSpan.className = 'clue-number';
                        numSpan.textContent = cellData.clueNumber;
                        cellDiv.appendChild(numSpan);
                    }

                    const valSpan = document.createElement('span');
                    valSpan.className = 'cell-value';
                    cellDiv.appendChild(valSpan);

                    cellDiv.addEventListener('click', () => {
                        if (game) game.selectCell(r, c);
                    });
                }

                gridContainer.appendChild(cellDiv);
            }
        }
    }

    // Actualización reactiva del tablero, pista activa y tachado de pistas resueltas
    function renderGameState(state) {
        scoreDisplay.textContent = state.score;

        const cells = gridContainer.querySelectorAll('.grid-cell:not(.black-cell)');
        const activeWord = state.activeWord;

        if (activeWord) {
            const dirLetter = activeWord.orientation === 'across' ? 'H' : 'V';
            activeClueBar.innerHTML = `<span class="clue-prefix">${activeWord.number}${dirLetter}:</span> <span>${activeWord.clue}</span>`;
        } else {
            activeClueBar.innerHTML = '<em>Haz clic en una casilla o pista para comenzar</em>';
        }

        // Limpiar todo primero, luego aplicar estados
        cells.forEach(cellDiv => {
            cellDiv.classList.remove('selected', 'in-word', 'locked', 'word-solved');
        });

        // Aplicar "word-solved" a celdas de palabras resueltas
        if (state.solvedWordIds) {
            state.solvedWordIds.forEach(wId => {
                const [ori, numStr] = wId.split('_');
                const num = parseInt(numStr, 10);
                const word = game.board.placedWords.find(w => w.orientation === ori && w.number === num);
                if (word) {
                    for (let i = 0; i < word.word.length; i++) {
                        const wr = ori === 'across' ? word.row : word.row + i;
                        const wc = ori === 'across' ? word.col + i : word.col;
                        const cell = gridContainer.querySelector(`[data-row="${wr}"][data-col="${wc}"]`);
                        if (cell) cell.classList.add('word-solved');
                    }
                }

                // Marcar la pista como resuelta en la lista lateral
                const li = document.getElementById(`clue-${ori}-${numStr}`);
                if (li) li.classList.add('clue-solved');
            });
        }

        // Encima de word-solved: aplicar in-word y selected (mayor prioridad visual)
        cells.forEach(cellDiv => {
            const r = parseInt(cellDiv.dataset.row, 10);
            const c = parseInt(cellDiv.dataset.col, 10);
            const valSpan = cellDiv.querySelector('.cell-value');

            valSpan.textContent = state.userGrid[r][c];

            if (state.popRow === r && state.popCol === c) {
                valSpan.classList.add('pop-anim');
                setTimeout(() => valSpan.classList.remove('pop-anim'), 200);
            }

            if (state.lockedGrid[r][c]) {
                cellDiv.classList.add('locked');
            }

            if (r === state.selectedRow && c === state.selectedCol) {
                cellDiv.classList.remove('word-solved', 'in-word');
                cellDiv.classList.add('selected');
            } else if (activeWord && isCellInWord(r, c, activeWord)) {
                cellDiv.classList.remove('word-solved');
                cellDiv.classList.add('in-word');
            }
        });

        // Resaltar pista activa en la lista
        document.querySelectorAll('.clues-list li').forEach(li => {
            li.classList.remove('active-clue');
        });

        if (activeWord) {
            const activeLi = document.getElementById(`clue-${activeWord.orientation}-${activeWord.number}`);
            if (activeLi) {
                activeLi.classList.add('active-clue');
                activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function isCellInWord(r, c, word) {
        if (word.orientation === 'across') {
            return r === word.row && c >= word.col && c < word.col + word.word.length;
        } else {
            return c === word.col && r >= word.row && r < word.row + word.word.length;
        }
    }

    // Victoria en Reto Diario
    function onGameVictory(slotNum, results, stats) {
        sound.playVictory();
        triggerConfetti();
        updateDailyTabsUI();
        updateStreakUI();

        document.getElementById('victory-title').textContent = `¡Reto Diario #${slotNum} Completado!`;
        document.getElementById('victory-base-score').textContent = results.baseScore;
        document.getElementById('victory-time-bonus').textContent = results.timeBonus;
        document.getElementById('victory-final-score').textContent = results.finalScore;
        document.getElementById('victory-time').textContent = results.formattedTime;

        const isRecord = results.finalScore === stats.highScore;
        const recordBadge = document.getElementById('record-badge');
        if (recordBadge) {
            recordBadge.style.display = isRecord ? 'block' : 'none';
        }

        const daily = scoreManager.loadDailyData();
        const otherSlot = slotNum === 1 ? 2 : 1;
        if (!daily.slots[otherSlot].completed) {
            btnNextDaily.textContent = `🎯 Jugar Reto Diario #${otherSlot}`;
            btnNextDaily.onclick = () => {
                victoryModal.classList.add('hidden');
                loadDailySlot(otherSlot);
            };
        } else {
            btnNextDaily.textContent = '🎉 ¡Retos de Hoy Completados!';
            btnNextDaily.onclick = () => {
                victoryModal.classList.add('hidden');
            };
        }

        victoryModal.classList.remove('hidden');
    }

    // Teclado físico
    window.addEventListener('keydown', (e) => {
        if (!game) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        // Navegación con flechas, tab y enter siempre habilitada
        if (e.key.startsWith('Arrow')) {
            game.navigateArrow(e.key);
            e.preventDefault();
            return;
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) game.prevWord();
            else game.nextWord();
            return;
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            game.toggleDirection();
            return;
        }

        // Si la partida está completada, no permitir escribir ni borrar
        if (game.isComplete) return;

        if (e.key >= 'a' && e.key <= 'z' || e.key >= 'A' && e.key <= 'Z' || e.key === 'ñ' || e.key === 'Ñ') {
            sound.playKey();
            game.handleInput(e.key);
            e.preventDefault();
        } else if (e.key === 'Backspace') {
            sound.playKey();
            game.handleBackspace();
            e.preventDefault();
        }
    });

    // Teclado virtual móvil
    const virtualKeyboard = document.getElementById('virtual-keyboard');
    if (virtualKeyboard) {
        virtualKeyboard.addEventListener('click', (e) => {
            const btn = e.target.closest('.key-btn');
            if (!btn || !game) return;

            const key = btn.dataset.key;
            if (key === 'SWITCH') {
                game.toggleDirection();
                return;
            }

            if (game.isComplete) return;

            sound.playKey();
            if (key === 'BACKSPACE') game.handleBackspace();
            else if (key) game.handleInput(key);
        });
    }

    slot1Btn.addEventListener('click', () => loadDailySlot(1));
    slot2Btn.addEventListener('click', () => loadDailySlot(2));

    // Botones de ayuda
    btnCheckErrors.addEventListener('click', () => {
        if (!game || game.isComplete) return;
        const result = game.checkErrors();
        
        result.errorCells.forEach(pos => {
            const cell = gridContainer.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
            if (cell) {
                cell.classList.add('cell-error');
                setTimeout(() => cell.classList.remove('cell-error'), 1200);
            }
        });

        if (result.errorsFound === 0) {
            sound.playWordSuccess();
            showToast('¡Todo lo ingresado hasta ahora es correcto!', 'success');
        } else {
            sound.playError();
            showToast(`Se detectaron ${result.errorsFound} casillas incorrectas (-15 pts)`, 'error');
        }
        game.notifyChange();
    });

    btnRevealLetter.addEventListener('click', () => {
        if (!game || game.isComplete) return;
        game.revealCurrentCell();
        showToast('Letra revelada (-25 pts)', 'info');
    });

    btnRevealWord.addEventListener('click', () => {
        if (!game || game.isComplete) return;
        game.revealCurrentWord();
        showToast('Palabra revelada (-100 pts)', 'info');
    });

    // Estadísticas
    btnStats.addEventListener('click', () => {
        const stats = scoreManager.loadStats();
        document.getElementById('stat-high-score').textContent = stats.highScore;
        document.getElementById('stat-best-time').textContent = stats.bestTimeSeconds ? scoreManager.formatTime(stats.bestTimeSeconds) : '--:--';
        document.getElementById('stat-streak').textContent = `${stats.currentStreak} días`;
        document.getElementById('stat-games-won').textContent = stats.gamesWon;

        const historyList = document.getElementById('stat-history-list');
        historyList.innerHTML = '';
        if (stats.recentScores && stats.recentScores.length > 0) {
            stats.recentScores.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span>📅 ${item.date}</span> <strong>⭐ ${item.score} pts</strong> <small>⏱️ ${item.time}</small>`;
                historyList.appendChild(li);
            });
        } else {
            historyList.innerHTML = '<li class="empty-msg">Aún no hay desafíos completados.</li>';
        }

        statsModal.classList.remove('hidden');
    });

    btnStatsClose.addEventListener('click', () => statsModal.classList.add('hidden'));
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) statsModal.classList.add('hidden');
    });

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-msg toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('toast-show'), 10);
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#2563eb', '#38bdf8', '#16a34a', '#facc15', '#ef4444', '#a855f7'];

        for (let i = 0; i < 160; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                r: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.5) * 18 - 4,
                gravity: 0.25,
                alpha: 1
            });
        }

        let frame = 0;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.alpha -= 0.008;

                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            frame++;
            if (frame < 180) {
                requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        animate();
    }

    initHeader();
    
    const initialDaily = scoreManager.loadDailyData();
    if (initialDaily.slots[1].completed && !initialDaily.slots[2].completed) {
        loadDailySlot(2);
    } else {
        loadDailySlot(1);
    }
});
