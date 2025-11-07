// Application configuration

const CONFIG = {
    // API Configuration
    api: {
        baseUrl: 'http://localhost:8000',
        timeout: 10000,
        retryAttempts: 3
    },
    
    // Application settings
    app: {
        defaultLanguage: 'english',
        enableKeyboardNavigation: true,
        enableTranslationToggle: true,
        autoPlayNextPage: false,
        pageTransitionDuration: 500
    },
    
    // Audio settings
    audio: {
        preloadNext: true,
        volume: 1.0,
        fadeInDuration: 100,
        fadeOutDuration: 100
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
        preloadPages: 1
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

// Detect and apply user preferences
function applyUserPreferences() {
    // Check for stored preferences
    const savedPrefs = StorageHelper.get('userPreferences');
    if (savedPrefs) {
        Object.assign(CONFIG, savedPrefs);
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
    StorageHelper.set('userPreferences', CONFIG);
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

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        applyUserPreferences,
        saveUserPreferences,
        getConfig,
        setConfig
    };
}
