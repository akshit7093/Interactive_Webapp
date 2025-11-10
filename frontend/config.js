// ---- Dynamic Environment Detection ----
// This function detects the correct base URL for the API.
// It works for both local development and when accessed via ngrok.
function getApiBaseUrl() {
    // Check if the page is being served from a file:// protocol
    if (window.location.protocol === 'file:') {
        console.warn('[CONFIG] Running from file://. Defaulting to localhost. This may cause CORS issues.');
        return 'http://localhost:8000';
    }
    // If the page is loaded from an ngrok URL, use that same URL for the API.
    // This prevents Mixed Content errors.
    if (window.location.hostname.includes('ngrok')) {
        // Use the origin (protocol + hostname) of the current page
        const origin = window.location.origin;
        console.log(`[CONFIG] Detected ngrok environment. Using API base URL: ${origin}`);
        return origin;
    }
    // Default to localhost for all other cases (e.g., accessing via http://localhost:8000)
    console.log('[CONFIG] Defaulting to local environment. Using API base URL: http://localhost:8000');
    return 'http://localhost:8000';
}

// ---- Application Configuration ----
const CONFIG = {
    // API Configuration
    api: {
        // The baseUrl is now set dynamically using the function above
        baseUrl: getApiBaseUrl(),
        timeout: 10000,
        retryAttempts: 3
    },
    
    // Application settings
    app: {
        defaultLanguage: 'english',
        enableKeyboardNavigation: true,
        enableTranslationToggle: true,
        autoPlayNextPage: false,
        pageTransitionDuration: 500,
        enableVideo: true  // New: Toggle video support (default: enabled)
    },
    
    // Audio settings
    audio: {
        preloadNext: true,
        volume: 1.0,
        fadeInDuration: 100,
        fadeOutDuration: 100
    },
    
    // Video settings (new section)
    video: {
        preloadNext: true,  // Preload next video (if enabled)
        volume: 1.0,        // Video volume (0.0 to 1.0)
        controls: false,    // Show video controls (default: hidden)
        autoplay: false,    // Auto-play video (default: manual play via click)
        loop: false,         // Loop video (default: play once)
        fadeInDuration: 200, // Duration to fade in video (ms)
        fadeOutDuration: 200 // Duration to fade out video (ms)
    },
    
    // UI settings
    ui: {
        theme: 'light', // 'light' or 'dark'
        animations: true,
        showPageNumbers: true,
        showStickerNumbers: true
    },
    
    // Performance settings
    performance: {
        lazyLoadImages: false,
        cacheAudio: true,
        preloadPages: 1,
        preloadVideos: true  // New: Preload videos (default: enabled)
    },
    
    // Accessibility settings
    accessibility: {
        highContrast: false,
        largeText: false,
        reduceMotion: false
    },
    
    // Debug settings
    debug: {
        enabled: false,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        showNetworkRequests: false
    }
};

// ---- Helper Functions ----
/**
 * Constructs a full API URL from an endpoint path.
 * @param {string} path - The API endpoint path (e.g., '/languages', '/images/page1.jpg').
 * @returns {string} The complete, absolute URL for the API endpoint.
 */
function getApiUrl(path) {
    if (!path.startsWith('/')) {
        path = '/' + path; // Ensure path starts with a slash
    }
    return `${CONFIG.api.baseUrl}/api${path}`; // Prefixes /api to the path
}

// Detect and apply user preferences
function applyUserPreferences() {
    // Check for stored preferences
    const savedPrefs = StorageHelper.get('userPreferences');
    if (savedPrefs) {
        Object.assign(CONFIG, savedPrefs); // Merge saved preferences (includes video settings)
    }
    
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        CONFIG.accessibility.reduceMotion = true;
        CONFIG.ui.animations = false;
    }
    
    // Check for dark mode preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        CONFIG.ui.theme = 'dark';
    }
}

// Save user preferences
function saveUserPreferences() {
    StorageHelper.set('userPreferences', CONFIG); // Saves entire config, including video settings
}

// Get config value
function getConfig(path) {
    const keys = path.split('.');
    let value = CONFIG;
    
    for (const key of keys) {
        if (value[key] === undefined) return null;
        value = value[key];
    }
    
    return value;
}

// Set config value
function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let obj = CONFIG;
    
    for (const key of keys) {
        if (obj[key] === undefined) obj[key] = {};
        obj = obj[key];
    }
    
    obj[lastKey] = value;
}

// Log the final API base URL for debugging
console.log(`[CONFIG] Final API Base URL is: ${CONFIG.api.baseUrl}`);

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        applyUserPreferences,
        saveUserPreferences,
        getConfig,
        setConfig,
        getApiUrl // Export the helper function
    };
}