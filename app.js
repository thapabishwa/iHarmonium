/**
 * iHarmonium — main application wiring.
 */
(function () {
    const audio = window.harmoniumAudio;
    const { KEY_MAP, KEYBOARD_LAYOUT, toMidi, isInScale } = window.HarmoniumKeys;

    let currentOctave = 4;
    let currentScale = 'chromatic';
    const pressedKeys = new Set();

    // Expose active note count for bellows leak rate
    window._activeNoteCount = 0;

    // --- Build visual keyboard ---
    function buildKeyboard() {
        const container = document.getElementById('harmonium-keyboard');
        container.innerHTML = '';

        for (const entry of KEYBOARD_LAYOUT) {
            const el = document.createElement('div');
            el.className = `key key-${entry.type}`;
            el.dataset.key = entry.key;
            el.dataset.note = entry.note;

            const noteName = document.createElement('span');
            noteName.className = 'note-name';
            noteName.textContent = entry.noteName;
            el.appendChild(noteName);

            const label = document.createElement('span');
            label.className = 'key-label';
            label.textContent = entry.label;
            el.appendChild(label);

            if (!isInScale(entry.note, currentScale)) {
                el.classList.add('disabled');
            } else if (entry.note % 12 === 0) {
                el.classList.add('highlight');
            }

            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                playKey(entry.key);
            });
            el.addEventListener('pointerup', () => stopKey(entry.key));
            el.addEventListener('pointerleave', () => stopKey(entry.key));
            el.addEventListener('pointercancel', () => stopKey(entry.key));

            // Prevent iOS scroll/zoom on keys
            el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

            container.appendChild(el);
        }
    }

    function updateScaleHighlights() {
        document.querySelectorAll('.key').forEach(el => {
            const note = parseInt(el.dataset.note);
            el.classList.remove('disabled', 'highlight');
            if (!isInScale(note, currentScale)) {
                el.classList.add('disabled');
            } else if (note % 12 === 0) {
                el.classList.add('highlight');
            }
        });
    }

    // --- Now playing display ---
    function updateNowPlaying() {
        const display = document.getElementById('now-playing');
        if (pressedKeys.size === 0) {
            display.textContent = '';
            return;
        }
        const names = [];
        for (const key of pressedKeys) {
            const entry = KEYBOARD_LAYOUT.find(e => e.key === key);
            if (entry) names.push(entry.noteName);
        }
        display.textContent = names.join(' ');
    }

    // --- Play / Stop ---
    function playKey(key) {
        const mapping = KEY_MAP[key];
        if (!mapping) return;
        if (!isInScale(mapping.note, currentScale)) return;

        audio.init();
        const midi = toMidi(mapping.note, currentOctave);
        audio.noteOn(midi);
        pressedKeys.add(key);
        window._activeNoteCount = pressedKeys.size;

        const el = document.querySelector(`.key[data-key="${key}"]`);
        if (el) el.classList.add('active');

        updateNowPlaying();
    }

    function stopKey(key) {
        if (!pressedKeys.has(key)) return;
        const mapping = KEY_MAP[key];
        if (!mapping) return;

        const midi = toMidi(mapping.note, currentOctave);
        audio.noteOff(midi);
        pressedKeys.delete(key);
        window._activeNoteCount = pressedKeys.size;

        const el = document.querySelector(`.key[data-key="${key}"]`);
        if (el) el.classList.remove('active');

        updateNowPlaying();
    }

    // --- Keyboard events ---
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        if (e.code === 'Space') return; // handled by bellows
        const key = e.key.toLowerCase();

        // Octave shift with Z / X
        if (key === 'z') {
            const sel = document.getElementById('octave-select');
            if (currentOctave > 3) {
                currentOctave--;
                sel.value = currentOctave;
                audio.stopAll();
                pressedKeys.clear();
                document.querySelectorAll('.key.active').forEach(el => el.classList.remove('active'));
                updateNowPlaying();
            }
            return;
        }
        if (key === 'x') {
            const sel = document.getElementById('octave-select');
            if (currentOctave < 5) {
                currentOctave++;
                sel.value = currentOctave;
                audio.stopAll();
                pressedKeys.clear();
                document.querySelectorAll('.key.active').forEach(el => el.classList.remove('active'));
                updateNowPlaying();
            }
            return;
        }

        if (KEY_MAP[key]) {
            e.preventDefault();
            playKey(key);
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') return;
        const key = e.key.toLowerCase();
        if (KEY_MAP[key]) {
            stopKey(key);
        }
    });

    window.addEventListener('blur', () => {
        for (const key of [...pressedKeys]) {
            stopKey(key);
        }
    });

    // --- Bellows ---
    function onAngleChange(angle, pressure) {
        document.getElementById('angle-value').textContent = Math.round(pressure * 100);
        document.getElementById('bellows-fill').style.width = (pressure * 100) + '%';

        // Animate bellows visual
        const lidAngle = Math.max(0, Math.min(80, pressure * 80));
        document.getElementById('laptop-lid').style.transform =
            `perspective(200px) rotateX(${lidAngle}deg)`;

        // Pump indicator
        const pumpHint = document.getElementById('pump-hint');
        if (pumpHint) {
            pumpHint.classList.toggle('pumping', pressure > 0.05);
        }

        audio.setBellowsPressure(pressure);
    }

    const bellows = new OrientationDetector(onAngleChange);
    bellows.init();

    // --- Controls ---
    document.getElementById('octave-select').addEventListener('change', (e) => {
        audio.stopAll();
        pressedKeys.clear();
        document.querySelectorAll('.key.active').forEach(el => el.classList.remove('active'));
        currentOctave = parseInt(e.target.value);
        updateNowPlaying();
    });

    document.getElementById('scale-select').addEventListener('change', (e) => {
        audio.stopAll();
        pressedKeys.clear();
        document.querySelectorAll('.key.active').forEach(el => el.classList.remove('active'));
        currentScale = e.target.value;
        updateScaleHighlights();
        updateNowPlaying();
    });

    document.getElementById('drone-toggle').addEventListener('click', (e) => {
        audio.init();
        const rootMidi = toMidi(0, currentOctave - 1);
        const isOn = audio.toggleDrone(rootMidi);
        e.target.textContent = isOn ? 'On' : 'Off';
        e.target.classList.toggle('active', isOn);
    });

    // --- iOS audio unlock via start overlay ---
    const overlay = document.getElementById('start-overlay');
    function unlockAudio() {
        audio.init();
        overlay.style.display = 'none';
        overlay.removeEventListener('touchend', unlockTouch);
        overlay.removeEventListener('click', unlockAudio);
    }
    function unlockTouch(e) {
        e.preventDefault();
        unlockAudio();
    }
    overlay.addEventListener('touchend', unlockTouch);
    overlay.addEventListener('click', unlockAudio);

    // --- Init ---
    buildKeyboard();
})();
