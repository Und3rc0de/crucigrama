/**
 * Gestor de Puntuación, Límite Diario (Máx 2 por día) y Racha de Jugadas.
 */
class ScoreManager {
    constructor() {
        this.score = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        this.isTimerRunning = false;
        this.currentSlot = 1; // 1 o 2 (los 2 crucigramas del día)
        this.dailyData = this.loadDailyData();
        this.stats = this.loadStats();
    }

    /**
     * Retorna la fecha local en formato YYYY-MM-DD
     */
    getTodayKey() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Retorna la fecha formateada en español (ej: "18 de Agosto de 2026")
     */
    getFormattedDate() {
        const d = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formatted = d.toLocaleDateString('es-ES', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    loadDailyData() {
        const todayKey = this.getTodayKey();
        const CURRENT_VERSION = 'v2.3_clean';
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem('crucigrama_daily');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.date === todayKey && parsed.version === CURRENT_VERSION) {
                        return parsed;
                    }
                }
            }
        } catch (e) {
            console.warn("Error cargando daily data", e);
        }

        // Nuevo día o nueva versión: inicializar limpio
        const newDayData = {
            date: todayKey,
            version: CURRENT_VERSION,
            slots: {
                1: { completed: false, score: 0, time: '--:--', seconds: 0, savedState: null },
                2: { completed: false, score: 0, time: '--:--', seconds: 0, savedState: null }
            }
        };
        this.saveDailyData(newDayData);
        return newDayData;
    }

    resetSlot(slotNum) {
        this.dailyData.slots[slotNum] = { completed: false, score: 0, time: '--:--', seconds: 0, savedState: null };
        this.saveDailyData();
    }

    saveDailyData(data = this.dailyData) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('crucigrama_daily', JSON.stringify(data));
            }
        } catch (e) {
            console.warn("Error guardando daily data", e);
        }
    }

    getDailyCompletedCount() {
        let count = 0;
        if (this.dailyData.slots[1].completed) count++;
        if (this.dailyData.slots[2].completed) count++;
        return count;
    }

    isDailyFullyCompleted() {
        return this.getDailyCompletedCount() >= 2;
    }

    startTimer(onTick) {
        this.resetTimer();
        this.startTime = Date.now() - (this.elapsedSeconds * 1000);
        this.isTimerRunning = true;

        this.timerInterval = setInterval(() => {
            if (!this.isTimerRunning) return;
            this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            if (onTick) onTick(this.formatTime(this.elapsedSeconds));
        }, 1000);
    }

    stopTimer() {
        this.isTimerRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.stopTimer();
        this.elapsedSeconds = 0;
    }

    formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    resetScore() {
        this.score = 0;
    }

    addPoints(amount) {
        this.score = Math.max(0, this.score + amount);
        return this.score;
    }

    deductPoints(amount) {
        this.score = Math.max(0, this.score - amount);
        return this.score;
    }

    calculateFinalScore(totalWords) {
        // Bonificación de tiempo que premia velocidad
        const timeBonus = Math.max(0, Math.floor(1500 - this.elapsedSeconds * 2.5));
        const finalTotal = Math.max(100, Math.floor(this.score + timeBonus));
        return {
            baseScore: this.score,
            timeBonus: timeBonus,
            finalScore: finalTotal,
            formattedTime: this.formatTime(this.elapsedSeconds),
            seconds: this.elapsedSeconds
        };
    }

    saveDailyVictory(slotNum, result) {
        this.dailyData.slots[slotNum] = {
            completed: true,
            score: result.finalScore,
            time: result.formattedTime,
            seconds: result.seconds,
            savedState: null
        };
        this.saveDailyData();

        // Actualizar estadísticas globales
        this.stats.gamesPlayed++;
        this.stats.gamesWon++;

        if (result.finalScore > this.stats.highScore) {
            this.stats.highScore = result.finalScore;
        }

        if (this.stats.bestTimeSeconds === null || result.seconds < this.stats.bestTimeSeconds) {
            this.stats.bestTimeSeconds = result.seconds;
        }

        // Actualizar racha diaria
        this.updateStreak();

        this.stats.recentScores.unshift({
            date: `${this.getTodayKey()} (Reto ${slotNum})`,
            score: result.finalScore,
            time: result.formattedTime
        });

        if (this.stats.recentScores.length > 10) {
            this.stats.recentScores.pop();
        }

        this.saveStats();
        return this.stats;
    }

    updateStreak() {
        const today = this.getTodayKey();
        if (this.stats.lastPlayedDate === today) {
            return; // Ya computada hoy
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

        if (this.stats.lastPlayedDate === yKey) {
            this.stats.currentStreak++;
        } else {
            this.stats.currentStreak = 1;
        }

        if (this.stats.currentStreak > this.stats.maxStreak) {
            this.stats.maxStreak = this.stats.currentStreak;
        }

        this.stats.lastPlayedDate = today;
    }

    loadStats() {
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem('crucigrama_stats');
                if (raw) {
                    return JSON.parse(raw);
                }
            }
        } catch (e) {
            console.warn("Error cargando stats", e);
        }
        return {
            highScore: 0,
            bestTimeSeconds: null,
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            lastPlayedDate: null,
            recentScores: []
        };
    }

    saveStats() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('crucigrama_stats', JSON.stringify(this.stats));
            }
        } catch (e) {
            console.warn("Error guardando stats", e);
        }
    }

    getTimeUntilMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = Math.floor((midnight - now) / 1000);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}
