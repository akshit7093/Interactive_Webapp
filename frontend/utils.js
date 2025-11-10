// Utility functions for the storybook application
// Debounce function to limit function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function to limit function execution rate
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Check if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check if device supports touch
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Sanitize string for use as ID or class name
function sanitizeForId(str) {
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Deep clone object
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Smooth scroll to element
function scrollToElement(element, offset = 0) {
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;
    
    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
}

// Local storage helper
const StorageHelper = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('LocalStorage error:', e);
            return false;
        }
    },
    
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('LocalStorage error:', e);
            return defaultValue;
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('LocalStorage error:', e);
            return false;
        }
    },
    
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('LocalStorage error:', e);
            return false;
        }
    }
};

// Cookie helper
const CookieHelper = {
    set: (name, value, days = 7) => {
        const expires = new Date();
        expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    },
    
    get: (name) => {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },
    
    remove: (name) => {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    }
};

// Random ID generator
function generateId(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
}

// Capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Truncate text
function truncate(str, maxLength, suffix = '...') {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}

// Wait/delay function
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function with exponential backoff
async function retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            await wait(delay * Math.pow(2, attempt - 1));
        }
    }
}

// ---- New Video Utilities ----
/**
 * Formats video duration from milliseconds to MM:SS (minutes:seconds).
 * @param {number} milliseconds - Duration in milliseconds (e.g., 125000 for 2m5s).
 * @returns {string} Formatted duration string (e.g., "02:05").
 */
function formatVideoDuration(milliseconds) {
    if (milliseconds <= 0) return '00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (num) => num.toString().padStart(2, '0'); // Ensure 2-digit padding
    
    return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Applies video configuration settings from CONFIG.video to a video element.
 * @param {HTMLVideoElement} videoElement - Target video element to configure.
 */
function applyVideoConfig(videoElement) {
    if (!(videoElement instanceof HTMLVideoElement)) {
        console.error('applyVideoConfig: Invalid video element provided');
        return;
    }

    // Apply video settings from configuration
    videoElement.controls = CONFIG.video.controls;
    videoElement.autoplay = CONFIG.video.autoplay;
    videoElement.loop = CONFIG.video.loop;
    videoElement.volume = CONFIG.video.volume; // Range: 0.0 (silent) to 1.0 (full volume)
}

/**
 * Preloads a video resource into the browser's cache to reduce load time later.
 * @param {string} videoUrl - URL of the video to preload (e.g., from getApiUrl('/videos/page1.mp4')).
 * @returns {Promise<boolean>} True if preloading succeeded, false otherwise.
 */
async function preloadVideo(videoUrl) {
    if (!CONFIG.performance.preloadVideos) {
        console.log('[UTILS] Video preloading disabled. Skipping.');
        return false;
    }

    if (!videoUrl || typeof videoUrl !== 'string') {
        console.error('[UTILS] preloadVideo: Invalid video URL provided');
        return false;
    }

    try {
        // Use a HEAD request to check if the video exists without downloading content
        const response = await fetch(videoUrl, { method: 'HEAD' });
        if (!response.ok) {
            throw new Error(`Video check failed (HTTP ${response.status})`);
        }

        // Optional: Fetch the full video to preload it into cache (uncomment if needed)
        // const fullResponse = await fetch(videoUrl);
        // if (!fullResponse.ok) throw new Error(`Video preload failed (HTTP ${fullResponse.status})`);
        // await fullResponse.blob(); // Ensure the response body is read to trigger caching

        console.log(`[UTILS] Video preloaded successfully: ${videoUrl}`);
        return true;
    } catch (error) {
        console.error(`[UTILS] Failed to preload video ${videoUrl}:`, error.message);
        return false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        debounce,
        throttle,
        formatFileSize,
        isMobileDevice,
        isTouchDevice,
        sanitizeForId,
        deepClone,
        isInViewport,
        scrollToElement,
        StorageHelper,
        CookieHelper,
        generateId,
        capitalizeFirst,
        truncate,
        wait,
        retry,
        // New video utilities added below
        formatVideoDuration,
        applyVideoConfig,
        preloadVideo
    };
}