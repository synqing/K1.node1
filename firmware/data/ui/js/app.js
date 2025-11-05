async function loadPatterns() {
    try {
        const res = await fetch('/api/patterns');
        if (!res.ok) {
            console.error('[K1] Failed to fetch patterns:', res.status);
            return;
        }
        const data = await res.json();
        const container = document.getElementById('patterns');

        container.innerHTML = data.patterns.map(p => {
            const active = p.index === data.current_pattern ? 'active' : '';
            return '<div class="pattern-card ' + active + '" onclick="selectPattern(' + p.index + ')">' +
                '<div class="pattern-name">' + p.name + '</div>' +
                '<div class="pattern-desc">' + (p.description || '') + '</div>' +
                '</div>';
        }).join('');
        console.log('[K1] Patterns loaded, current:', data.current_pattern);
    } catch (err) {
        console.error('[K1] Error loading patterns:', err);
    }
}

async function loadParams() {
    try {
        const res = await fetch('/api/params');
        if (!res.ok) {
            console.error('[K1] Failed to fetch params:', res.status);
            return;
        }
        const params = await res.json();

        // Update all slider elements with device parameters
        Object.keys(params).forEach(key => {
            const elem = document.getElementById(key);
            if (elem && elem.type === 'range') {
                // Set slider to actual device value
                elem.value = params[key];
                // Update display without triggering update back to device
                updateDisplay(key, true);
            }
        });

        // Update color mode indicator based on current color_range
        if (typeof params.color_range === 'number') {
            updateColorModeIndicator(params.color_range);
        }

        console.log('[K1] Parameters loaded from device:', params);
    } catch (err) {
        console.error('[K1] Error loading parameters:', err);
    }
}

async function selectPattern(index) {
    await fetch('/api/select', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({index})
    });
    loadPatterns();
}

function updateDisplay(id, skipUpdate) {
    const elem = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (elem && val) {
        val.textContent = parseFloat(elem.value).toFixed(2);
        if (id === 'color_range') {
            updateColorModeIndicator(parseFloat(elem.value));
        }
        if (!skipUpdate) {
            if (id === 'brightness') {
                scheduleBrightnessUpdate();
            } else {
                updateParams();
            }
        }
    }
}

// Debounce brightness changes to avoid flooding device with updates
let brightnessDebounceTimer = null;
const BRIGHTNESS_DEBOUNCE_MS = 150;
function scheduleBrightnessUpdate() {
    if (brightnessDebounceTimer) {
        clearTimeout(brightnessDebounceTimer);
    }
    brightnessDebounceTimer = setTimeout(() => {
        updateParams();
        brightnessDebounceTimer = null;
    }, BRIGHTNESS_DEBOUNCE_MS);
}

async function updateParams() {
    const paletteSelect = document.getElementById('palette-select');
    const params = {
        brightness: parseFloat(document.getElementById('brightness').value),
        softness: parseFloat(document.getElementById('softness').value),
        color: parseFloat(document.getElementById('color').value),
        color_range: parseFloat(document.getElementById('color_range').value),
        saturation: parseFloat(document.getElementById('saturation').value),
        warmth: parseFloat(document.getElementById('warmth').value),
        background: parseFloat(document.getElementById('background').value),
        speed: parseFloat(document.getElementById('speed').value),
        palette_id: parseInt(paletteSelect.value)
    };
    await fetch('/api/params', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(params)
    });
}

async function loadAudioConfig() {
    try {
        const res = await fetch('/api/audio-config');
        if (!res.ok) {
            console.error('[K1] Failed to fetch audio config:', res.status);
            return;
        }
        const config = await res.json();

        const gainElem = document.getElementById('microphone-gain');
        const gainVal = document.getElementById('microphone-gain-val');

        if (gainElem && config.microphone_gain) {
            gainElem.value = config.microphone_gain;
            gainVal.textContent = config.microphone_gain.toFixed(2) + 'x';
        }
        console.log('[K1] Audio config loaded:', config);
    } catch (err) {
        console.error('[K1] Error loading audio config:', err);
    }
}

async function updateMicrophoneGain() {
    const gainElem = document.getElementById('microphone-gain');
    const gainVal = document.getElementById('microphone-gain-val');

    const gain = parseFloat(gainElem.value);
    gainVal.textContent = gain.toFixed(2) + 'x';

    await fetch('/api/audio-config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ microphone_gain: gain })
    });
}

// Palette cache and API management
let paletteCache = null;
let paletteLoadPromise = null;

async function loadPalettes() {
    if (paletteCache) {
        return paletteCache;
    }

    if (paletteLoadPromise) {
        return paletteLoadPromise;
    }

    paletteLoadPromise = (async () => {
        try {
            const loadingIndicator = document.getElementById('palette-loading');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'inline';
            }

            const res = await fetch('/api/palettes');
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            paletteCache = data;
            console.log('[K1] Loaded', data.count, 'palettes from API');
            return data;
        } catch (err) {
            console.error('[K1] Failed to load palettes:', err);
            // Fallback to basic palette names
            paletteCache = {
                palettes: Array.from({length: 33}, (_, i) => ({
                    id: i,
                    name: `Palette ${i}`,
                    colors: []
                })),
                count: 33
            };
            return paletteCache;
        } finally {
            const loadingIndicator = document.getElementById('palette-loading');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            paletteLoadPromise = null;
        }
    })();

    return paletteLoadPromise;
}

async function initPalettes() {
    try {
        // Load palette metadata from API
        const paletteData = await loadPalettes();
        const paletteSelect = document.getElementById('palette-select');
        const paletteName = document.getElementById('palette-name');

        // Clear existing options
        paletteSelect.innerHTML = '';
        paletteSelect.disabled = false;

        // Populate dropdown with API data
        paletteData.palettes.forEach(palette => {
            const option = document.createElement('option');
            option.value = palette.id;
            option.textContent = palette.name;

            // Add color preview as title attribute
            if (palette.colors && palette.colors.length > 0) {
                const colorPreview = palette.colors.map(c =>
                    `rgb(${c.r},${c.g},${c.b})`
                ).join(', ');
                option.title = `Colors: ${colorPreview}`;
            }

            paletteSelect.appendChild(option);
        });

        // Get current parameters and set selection
        const paramsRes = await fetch('/api/params');
        if (paramsRes.ok) {
            const params = await paramsRes.json();
            if (params.palette_id !== undefined) {
                paletteSelect.value = params.palette_id;
                const selectedPalette = paletteData.palettes.find(p => p.id === params.palette_id);
                paletteName.textContent = selectedPalette ? selectedPalette.name : 'Unknown';
            }
            console.log('[K1] Palette initialized:', params.palette_id);
        } else {
            console.error('[K1] Failed to fetch current params');
            paletteName.textContent = paletteData.palettes[0]?.name || 'Unknown';
        }
    } catch (err) {
        console.error('[K1] Error initializing palettes:', err);
        const paletteSelect = document.getElementById('palette-select');
        const paletteName = document.getElementById('palette-name');

        paletteSelect.innerHTML = '<option value="0">Error loading palettes</option>';
        paletteSelect.disabled = true;
        paletteName.textContent = 'Error';
    }
}

async function updatePalette() {
    const paletteSelect = document.getElementById('palette-select');
    const paletteName = document.getElementById('palette-name');

    const paletteId = parseInt(paletteSelect.value);
    if (paletteName && paletteCache) {
        const palette = paletteCache.palettes.find(p => p.id === paletteId);
        paletteName.textContent = palette ? palette.name : 'Unknown';
    }

    await fetch('/api/params', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ palette_id: paletteId })
    });
}

// WiFi link option API helpers
async function loadWifiLinkOptions() {
    try {
        const res = await fetch('/api/wifi/link-options');
        if (!res.ok) return;
        const data = await res.json();
        const bg = !!data.force_bg_only;
        const ht = !!data.force_ht20;
        document.getElementById('bg-only').checked = bg;
        document.getElementById('ht20').checked = ht;
        document.getElementById('bg-only-val').textContent = bg ? 'ON' : 'OFF';
        document.getElementById('ht20-val').textContent = ht ? 'ON' : 'OFF';
        console.log('[K1] WiFi link options loaded:', data);
    } catch (e) {
        console.error('[K1] Failed to load WiFi link options', e);
    }
}

async function updateWifiLinkOptions() {
    const bg = document.getElementById('bg-only').checked;
    const ht = document.getElementById('ht20').checked;
    document.getElementById('bg-only-val').textContent = bg ? 'ON' : 'OFF';
    document.getElementById('ht20-val').textContent = ht ? 'ON' : 'OFF';
    try {
        await fetch('/api/wifi/link-options', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ force_bg_only: bg, force_ht20: ht })
        });
        console.log('[K1] WiFi link options updated:', {bg, ht});
    } catch (e) {
        console.error('[K1] Failed to update WiFi link options', e);
    }
}

function updateColorModeIndicator(rangeValue) {
    const modeElem = document.getElementById('color-mode');
    if (!modeElem) return;
    const mode = rangeValue <= 0.5 ? 'HSV Mode' : 'Palette Mode';
    modeElem.textContent = mode;
    modeElem.dataset.mode = rangeValue <= 0.5 ? 'hsv' : 'palette';
}

// Load all UI state from device on page load (wait for all to complete)
(async () => {
    await loadPatterns();
    await loadParams();
    await loadAudioConfig();
    await initPalettes();
    await loadWifiLinkOptions();
})();
