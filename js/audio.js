/**
 * Sintetizador de efectos de sonido usando Web Audio API (sin archivos externos).
 */
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this._initStorage();
    }

    _initStorage() {
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('crucigrama_sound');
                if (saved !== null) {
                    this.enabled = saved === 'true';
                }
            }
        } catch (e) {}
    }

    toggle() {
        this.enabled = !this.enabled;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('crucigrama_sound', String(this.enabled));
            }
        } catch (e) {}
        return this.enabled;
    }

    _getAudioContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    playKey() {
        if (!this.enabled) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.04);
    }

    playWordSuccess() {
        if (!this.enabled) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // Acorde mayor C5, E5, G5, C6

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            gain.gain.setValueAtTime(0.12, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.22);
        });
    }

    playError() {
        if (!this.enabled) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.15);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playVictory() {
        if (!this.enabled) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        // Melodía triunfal
        const melody = [
            { f: 523.25, d: 0.12, t: 0.0 },  // C5
            { f: 659.25, d: 0.12, t: 0.14 }, // E5
            { f: 783.99, d: 0.12, t: 0.28 }, // G5
            { f: 1046.5, d: 0.35, t: 0.42 }  // C6
        ];

        melody.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.f, now + note.t);

            gain.gain.setValueAtTime(0.18, now + note.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + note.t);
            osc.stop(now + note.t + note.d);
        });
    }
}
