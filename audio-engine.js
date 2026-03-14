/**
 * Audio engine for iHarmonium — synthesizes harmonium-like tones
 * using additive synthesis with filtering via the Web Audio API.
 */
class HarmoniumAudio {
    constructor() {
        this.ctx = null;
        this.activeNotes = new Map();
        this.bellowsPressure = 0.7;
        this.masterGain = null;
        this.droneNodes = null;
        this.droneOn = false;
        this.reverbNode = null;
    }

    init() {
        if (this.ctx) {
            // iOS suspends AudioContext — resume on each user gesture
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx.resume();

        // iOS Safari requires playing a silent buffer to truly unlock audio
        const silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);

        // Master compressor
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;

        // Subtle reverb via convolver
        this.reverbNode = this._createReverb();

        // Reverb send
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.15;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.55;

        // Dry path
        this.masterGain.connect(this.compressor);
        // Wet path (reverb)
        this.masterGain.connect(this.reverbGain);
        this.reverbGain.connect(this.reverbNode);
        this.reverbNode.connect(this.compressor);

        this.compressor.connect(this.ctx.destination);
    }

    _createReverb() {
        const length = this.ctx.sampleRate * 1.5;
        const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            }
        }
        const convolver = this.ctx.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    noteOn(noteNumber) {
        this.init();
        if (this.activeNotes.has(noteNumber)) return;

        const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
        const now = this.ctx.currentTime;

        // Harmonium harmonic profile — reedy, nasal character
        const harmonics = [
            { ratio: 1,   gain: 1.0  },
            { ratio: 2,   gain: 0.55 },
            { ratio: 3,   gain: 0.35 },
            { ratio: 4,   gain: 0.2  },
            { ratio: 5,   gain: 0.12 },
            { ratio: 6,   gain: 0.08 },
            { ratio: 8,   gain: 0.04 },
        ];

        const noteGain = this.ctx.createGain();
        noteGain.gain.setValueAtTime(0, now);
        noteGain.gain.linearRampToValueAtTime(this.bellowsPressure * 0.28, now + 0.015);

        // Reed-like formant filter — gives the nasal harmonium character
        const formant = this.ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = Math.min(freq * 3, 3500);
        formant.Q.value = 1.5;

        // Brightness filter — rolls off harsh highs
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 2800 + this.bellowsPressure * 1200;
        lpf.Q.value = 0.7;

        noteGain.connect(formant);
        formant.connect(lpf);
        lpf.connect(this.masterGain);

        const oscillators = [];

        for (const h of harmonics) {
            const osc = this.ctx.createOscillator();
            osc.frequency.value = freq * h.ratio;
            osc.type = 'sawtooth';

            const hGain = this.ctx.createGain();
            hGain.gain.value = h.gain * 0.13;

            osc.connect(hGain);
            hGain.connect(noteGain);
            osc.start(now);
            oscillators.push({ osc, gain: hGain });

            // Detuned copy for chorus/warmth on lower harmonics
            if (h.ratio <= 3) {
                const osc2 = this.ctx.createOscillator();
                osc2.frequency.value = freq * h.ratio * 1.004;
                osc2.type = 'sawtooth';

                const hGain2 = this.ctx.createGain();
                hGain2.gain.value = h.gain * 0.07;

                osc2.connect(hGain2);
                hGain2.connect(noteGain);
                osc2.start(now);
                oscillators.push({ osc: osc2, gain: hGain2 });
            }
        }

        // Tremolo — bellows vibration
        const tremolo = this.ctx.createOscillator();
        tremolo.frequency.value = 5.2;
        const tremoloGain = this.ctx.createGain();
        tremoloGain.gain.value = 0.05;
        tremolo.connect(tremoloGain);
        tremoloGain.connect(noteGain.gain);
        tremolo.start(now);

        this.activeNotes.set(noteNumber, { oscillators, noteGain, tremolo, tremoloGain, formant, lpf });
    }

    noteOff(noteNumber) {
        const note = this.activeNotes.get(noteNumber);
        if (!note) return;

        const now = this.ctx.currentTime;
        note.noteGain.gain.cancelScheduledValues(now);
        note.noteGain.gain.setValueAtTime(note.noteGain.gain.value, now);
        note.noteGain.gain.linearRampToValueAtTime(0, now + 0.1);

        setTimeout(() => {
            note.oscillators.forEach(o => { try { o.osc.stop(); } catch(e) {} });
            try { note.tremolo.stop(); } catch(e) {}
            note.noteGain.disconnect();
            note.formant.disconnect();
            note.lpf.disconnect();
        }, 200);

        this.activeNotes.delete(noteNumber);
    }

    setBellowsPressure(pressure) {
        this.bellowsPressure = Math.max(0, Math.min(1, pressure));
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (const [, note] of this.activeNotes) {
            note.noteGain.gain.cancelScheduledValues(now);
            note.noteGain.gain.linearRampToValueAtTime(this.bellowsPressure * 0.28, now + 0.04);
            // Brighter at higher pressure
            note.lpf.frequency.linearRampToValueAtTime(2800 + this.bellowsPressure * 1200, now + 0.04);
        }
        if (this.droneNodes) {
            this.droneNodes.gain.gain.linearRampToValueAtTime(
                this.bellowsPressure * 0.07, now + 0.04
            );
        }
    }

    toggleDrone(rootNote) {
        this.init();
        this.droneOn = !this.droneOn;

        if (this.droneOn) {
            const freq = 440 * Math.pow(2, (rootNote - 69) / 12);
            const now = this.ctx.currentTime;

            const droneGain = this.ctx.createGain();
            droneGain.gain.setValueAtTime(0, now);
            droneGain.gain.linearRampToValueAtTime(this.bellowsPressure * 0.07, now + 1.5);

            const droneLpf = this.ctx.createBiquadFilter();
            droneLpf.type = 'lowpass';
            droneLpf.frequency.value = 1200;
            droneLpf.Q.value = 0.5;

            droneGain.connect(droneLpf);
            droneLpf.connect(this.masterGain);

            const oscs = [];
            // Sa, Pa, Sa' — classic tanpura tuning
            [1, 1.5, 2].forEach(ratio => {
                const osc = this.ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = freq * ratio;

                const g = this.ctx.createGain();
                g.gain.value = ratio === 1 ? 0.4 : 0.2;

                // Slight detune for richness
                const osc2 = this.ctx.createOscillator();
                osc2.type = 'sawtooth';
                osc2.frequency.value = freq * ratio * 1.002;
                const g2 = this.ctx.createGain();
                g2.gain.value = ratio === 1 ? 0.15 : 0.08;

                osc.connect(g);
                g.connect(droneGain);
                osc.start(now);
                osc2.connect(g2);
                g2.connect(droneGain);
                osc2.start(now);
                oscs.push(osc, osc2);
            });

            this.droneNodes = { oscs, gain: droneGain, lpf: droneLpf };
        } else {
            if (this.droneNodes) {
                const now = this.ctx.currentTime;
                this.droneNodes.gain.gain.linearRampToValueAtTime(0, now + 0.6);
                const nodes = this.droneNodes;
                setTimeout(() => {
                    nodes.oscs.forEach(o => { try { o.stop(); } catch(e) {} });
                    nodes.gain.disconnect();
                    nodes.lpf.disconnect();
                }, 700);
                this.droneNodes = null;
            }
        }
        return this.droneOn;
    }

    stopAll() {
        for (const [noteNum] of this.activeNotes) {
            this.noteOff(noteNum);
        }
    }
}

window.harmoniumAudio = new HarmoniumAudio();
