/**
 * Keyboard mapping and scale definitions for iHarmonium.
 *
 * Maps physical keyboard keys to MIDI note numbers.
 * Layout mirrors a real harmonium: bottom row = white keys, top row = black keys.
 */

const KEY_MAP = {
    // White keys: A S D F G H J K L ;
    'a': { note: 0,  type: 'white', label: 'A' },  // C  (Sa)
    's': { note: 2,  type: 'white', label: 'S' },  // D  (Re)
    'd': { note: 4,  type: 'white', label: 'D' },  // E  (Ga)
    'f': { note: 5,  type: 'white', label: 'F' },  // F  (Ma)
    'g': { note: 7,  type: 'white', label: 'G' },  // G  (Pa)
    'h': { note: 9,  type: 'white', label: 'H' },  // A  (Dha)
    'j': { note: 11, type: 'white', label: 'J' },  // B  (Ni)
    'k': { note: 12, type: 'white', label: 'K' },  // C' (Sa')
    'l': { note: 14, type: 'white', label: 'L' },  // D' (Re')
    ';': { note: 16, type: 'white', label: ';' },  // E' (Ga')

    // Black keys: W E   T Y U   O P
    'w': { note: 1,  type: 'black', label: 'W' },  // C# (Komal Re)
    'e': { note: 3,  type: 'black', label: 'E' },  // D# (Komal Ga)
    't': { note: 6,  type: 'black', label: 'T' },  // F# (Tivra Ma)
    'y': { note: 8,  type: 'black', label: 'Y' },  // G# (Komal Dha)
    'u': { note: 10, type: 'black', label: 'U' },  // A# (Komal Ni)
    'o': { note: 13, type: 'black', label: 'O' },  // C#'
    'p': { note: 15, type: 'black', label: 'P' },  // D#'
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SARGAM_NAMES = ['Sa', 'r', 'Re', 'g', 'Ga', 'Ma', 'm', 'Pa', 'd', 'Dha', 'n', 'Ni'];

// Scale note sets (semitones from root included in scale)
const SCALES = {
    chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
    major:     [0,2,4,5,7,9,11],           // Bilawal thaat
    bhairav:   [0,1,4,5,7,8,11],           // Bhairav raga
    yaman:     [0,2,4,6,7,9,11],           // Yaman raga (Kalyan thaat)
    kafi:      [0,2,3,5,7,9,10],           // Kafi thaat
};

/**
 * Visual keyboard layout order for rendering.
 * Each entry = { key, note (semitones from C), type, label }
 */
const KEYBOARD_LAYOUT = [
    // First octave
    { key: 'a', note: 0,  type: 'white', label: 'A',  noteName: 'Sa' },
    { key: 'w', note: 1,  type: 'black', label: 'W',  noteName: 'r'  },
    { key: 's', note: 2,  type: 'white', label: 'S',  noteName: 'Re' },
    { key: 'e', note: 3,  type: 'black', label: 'E',  noteName: 'g'  },
    { key: 'd', note: 4,  type: 'white', label: 'D',  noteName: 'Ga' },
    { key: 'f', note: 5,  type: 'white', label: 'F',  noteName: 'Ma' },
    { key: 't', note: 6,  type: 'black', label: 'T',  noteName: 'm'  },
    { key: 'g', note: 7,  type: 'white', label: 'G',  noteName: 'Pa' },
    { key: 'y', note: 8,  type: 'black', label: 'Y',  noteName: 'd'  },
    { key: 'h', note: 9,  type: 'white', label: 'H',  noteName: 'Dha'},
    { key: 'u', note: 10, type: 'black', label: 'U',  noteName: 'n'  },
    { key: 'j', note: 11, type: 'white', label: 'J',  noteName: 'Ni' },
    // Second octave partial
    { key: 'k', note: 12, type: 'white', label: 'K',  noteName: "Sa'"},
    { key: 'o', note: 13, type: 'black', label: 'O',  noteName: "r'" },
    { key: 'l', note: 14, type: 'white', label: 'L',  noteName: "Re'"},
    { key: 'p', note: 15, type: 'black', label: 'P',  noteName: "g'" },
    { key: ';', note: 16, type: 'white', label: ';',  noteName: "Ga'"},
];

/**
 * Convert a note offset + octave to a MIDI note number.
 */
function toMidi(noteOffset, octave) {
    return (octave + 1) * 12 + noteOffset;
}

/**
 * Check if a note (semitone from C) is in the given scale.
 */
function isInScale(noteSemitone, scaleName) {
    const scale = SCALES[scaleName] || SCALES.chromatic;
    return scale.includes(noteSemitone % 12);
}

window.HarmoniumKeys = {
    KEY_MAP,
    NOTE_NAMES,
    SARGAM_NAMES,
    SCALES,
    KEYBOARD_LAYOUT,
    toMidi,
    isInScale,
};
