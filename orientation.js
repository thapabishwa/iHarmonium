/**
 * Bellows controller for iHarmonium.
 *
 * Uses webcam brightness to detect lid angle:
 * - Lid open = bright = high pressure
 * - Lid closing = darker = less pressure
 *
 * Falls back to spacebar pump if camera is denied.
 */

class BellowsController {
    constructor(onPressureChange) {
        this.onPressureChange = onPressureChange;
        this.pressure = 0;
        this.pumping = false;
        this.dragging = false;
        this.cameraActive = false;

        // Camera brightness tracking
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.maxBrightness = -1;
        this.minBrightness = Infinity;
        this.calibrated = false;
    }

    init() {
        this._setupSpacebar();
        this._setupDrag();
        this._updateMethodDisplay('spacebar');

        // Auto-request camera
        this._startCamera();

        this._loop();
    }

    async _startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 64, height: 48, facingMode: 'user' }
            });

            this.video = document.createElement('video');
            this.video.srcObject = stream;
            this.video.setAttribute('playsinline', '');
            await this.video.play();

            this.canvas = document.createElement('canvas');
            this.canvas.width = 64;
            this.canvas.height = 48;
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

            this.cameraActive = true;
            this._updateMethodDisplay('camera (calibrating...)');

            // Calibrate: record brightness range over 3 seconds
            // User should slowly close and open lid during this time
            this._calibrationPhase = true;
            setTimeout(() => {
                this._calibrationPhase = false;
                this.calibrated = true;

                // If range is too narrow, use current as max and near-zero as min
                if (this.maxBrightness - this.minBrightness < 20) {
                    this.maxBrightness = Math.max(this.maxBrightness, this.minBrightness);
                    this.minBrightness = 5;
                }

                this._updateMethodDisplay('camera');
            }, 3000);

        } catch (e) {
            // Camera denied — stay on spacebar
            console.log('[iHarmonium] Camera denied, using spacebar');
        }
    }

    _getBrightness() {
        if (!this.video || this.video.readyState < 2) return -1;
        this.ctx.drawImage(this.video, 0, 0, 64, 48);
        const data = this.ctx.getImageData(0, 0, 64, 48).data;
        let total = 0;
        const count = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
            total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        }
        return total / count;
    }

    _setupSpacebar() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                this.pumping = true;
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.pumping = false;
            }
        });
    }

    _setupDrag() {
        const bar = document.getElementById('bellows-bar');
        bar.style.cursor = 'pointer';

        bar.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.dragging = true;
            this._updateFromPointer(e, bar);
            bar.setPointerCapture(e.pointerId);
        });
        bar.addEventListener('pointermove', (e) => {
            if (!this.dragging) return;
            this._updateFromPointer(e, bar);
        });
        bar.addEventListener('pointerup', () => { this.dragging = false; });
    }

    _updateFromPointer(e, bar) {
        const rect = bar.getBoundingClientRect();
        this.pressure = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }

    _updateMethodDisplay(method) {
        const el = document.getElementById('bellows-method');
        if (el) el.textContent = method;

        const hint = document.getElementById('pump-hint');
        if (hint) {
            if (method === 'spacebar') {
                hint.innerHTML = 'Hold <kbd>Space</kbd> to pump (allow camera for lid control)';
            } else if (method.startsWith('camera')) {
                hint.textContent = method.includes('calibrating')
                    ? 'Slowly close and open your lid now...'
                    : 'Move lid to control bellows';
            }
        }
    }

    _loop() {
        if (this.cameraActive && !this.dragging) {
            const brightness = this._getBrightness();
            if (brightness >= 0) {
                // Update calibration range
                if (this._calibrationPhase) {
                    if (brightness > this.maxBrightness) this.maxBrightness = brightness;
                    if (brightness < this.minBrightness) this.minBrightness = brightness;
                } else {
                    // Slowly adapt over time
                    if (brightness > this.maxBrightness) {
                        this.maxBrightness = this.maxBrightness * 0.95 + brightness * 0.05;
                    }
                    if (brightness < this.minBrightness) {
                        this.minBrightness = this.minBrightness * 0.95 + brightness * 0.05;
                    }
                }

                const range = this.maxBrightness - this.minBrightness;
                if (range > 5) {
                    this.pressure = Math.max(0, Math.min(1,
                        (brightness - this.minBrightness) / range
                    ));
                } else {
                    // Narrow range — use absolute brightness
                    this.pressure = Math.min(1, brightness / 120);
                }
            }

            // Space can still boost pressure when camera is active
            if (this.pumping) {
                this.pressure = Math.min(1, this.pressure + 0.03);
            }
        } else if (!this.cameraActive) {
            // Spacebar-only mode
            if (this.pumping && !this.dragging) {
                this.pressure = Math.min(1, this.pressure + 0.06);
            } else if (!this.dragging) {
                const leakRate = window._activeNoteCount > 0 ? 0.012 : 0.004;
                this.pressure = Math.max(0, this.pressure - leakRate);
            }
        }

        const angle = this.pressure * 180;
        this.onPressureChange(angle, this.pressure);
        requestAnimationFrame(() => this._loop());
    }
}

window.OrientationDetector = BellowsController;
