// ---- Constants & State ----
let state = {
  language: 'english',
  showEnglish: false,
  currentPage: 1,
  totalPages: 1,
  languages: [],
  pages: [],
  audio: null,
  animating: false
};

// ---- Stop Video Playback and Reset Display ----
function stopVideo() {
  const currentPageElement = document.querySelector(`.page[data-page="${state.currentPage}"]`);
  if (!currentPageElement) return;

  const video = currentPageElement.querySelector('.storybook-video');
  if (video) {
    console.log('[DEBUG] Stopping current video playback');
    video.pause();
    video.currentTime = 0;
    video.style.display = 'none';
    video.removeEventListener('ended', handleVideoEnd);
    video.removeEventListener('error', handleVideoError);
  }

  const img = currentPageElement.querySelector('.storybook-image');
  if (img) {
    img.style.display = 'block';
  }
}

function handleVideoEnd() {
  console.log('[DEBUG] Video playback ended - returning to image');
  stopVideo();
}

function handleVideoError(e) {
  console.error('[ERROR] Video playback failed:', e);
  stopVideo();
}

// ---- Startup ----
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[DEBUG] DOMContentLoaded fired. Initializing storybook...');
  try {
    await fetchLanguages();
    await fetchPages();
    setupListeners();
    renderPage();
    console.log('[DEBUG] Storybook initialized successfully.');
  } catch (e) {
    console.error('[ERROR] Failed to load storybook:', e);
    showError('Failed to load storybook. Check backend.');
  }
});

// ---- Fetch Functions ----
async function fetchLanguages() {
  const url = getApiUrl('/api/languages');
  console.log('[DEBUG] Fetching languages from:', url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  console.log('[DEBUG] Received languages data:', data);
  
  state.languages = data.languages;
  state.language = data.default_language || 'english';
  console.log(`[DEBUG] Set language to: ${state.language}`);
  const sel = document.getElementById('language-select');
  sel.innerHTML = '';
  for (let lang of state.languages) {
    let opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.display_name;
    sel.appendChild(opt);
  }
  sel.value = state.language;
  console.log('[DEBUG] Language select dropdown populated.');
}

async function fetchPages() {
  const url = getApiUrl('/api/sentences');
  console.log('[DEBUG] Fetching pages from:', url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  console.log('[DEBUG] Received pages data:', data);
  
  if (!data.pages) {
    console.error('[ERROR] Missing "pages" array in sentences data');
    throw new Error('Invalid sentences data structure');
  }
  state.pages = data.pages;
  state.totalPages = data.metadata.total_pages;
  console.log(`[DEBUG] Loaded ${state.pages.length} pages. Total pages: ${state.totalPages}`);
  
  // CRITICAL: Verify video fields exist in page data
  console.log('[DEBUG] === PAGE DATA STRUCTURE VERIFICATION ===');
  state.pages.forEach(page => {
    console.log(`Page ${page.page}: Has video field? ${!!page.video}, Value: "${page.video}"`);
    if (!page.video) {
      console.warn(`[WARN] Page ${page.page} is missing video field! Videos will not play.`);
    }
  });
}

// ---- Listeners ----
function setupListeners() {
  console.log('[DEBUG] Setting up event listeners...');
  document.getElementById('language-select').onchange = e => {
    console.log(`[DEBUG] Language changed to: ${e.target.value}`);
    state.language = e.target.value;
    stopAudio(); 
    stopVideo(); 
    renderPage();
  };
  document.getElementById('translation-toggle').onchange = e => {
    console.log(`[DEBUG] Translation toggle set to: ${e.target.checked}`);
    state.showEnglish = e.target.checked;
    stopAudio(); 
    stopVideo(); 
    renderPage();
  };
  document.getElementById('prev-page').onclick = () => {
    console.log(`[DEBUG] Prev page clicked. Current: ${state.currentPage}, Animating: ${state.animating}`);
    if (state.animating || state.currentPage === 1) {
      console.log('[DEBUG] Prev page action blocked (animating or at start)');
      return;
    }
    stopAudio(); 
    stopVideo(); 
    animateFlip('prev', () => {
      state.currentPage--;
      console.log(`[DEBUG] Navigated to page: ${state.currentPage} (prev)`);
      renderPage('prev');
    });
  };
  document.getElementById('next-page').onclick = () => {
    console.log(`[DEBUG] Next page clicked. Current: ${state.currentPage}, Total: ${state.totalPages}, Animating: ${state.animating}`);
    if (state.animating || state.currentPage === state.totalPages) {
      console.log('[DEBUG] Next page action blocked (animating or at end)');
      return;
    }
    stopAudio(); 
    stopVideo(); 
    animateFlip('next', () => {
      state.currentPage++;
      console.log(`[DEBUG] Navigated to page: ${state.currentPage} (next)`);
      renderPage('next');
    });
  };
  document.addEventListener('keydown', e => {
    console.log(`[DEBUG] Key pressed: ${e.key}`);
    if (e.key === 'ArrowLeft') {
      document.getElementById('prev-page').click();
    } else if (e.key === 'ArrowRight') {
      document.getElementById('next-page').click();
    } else if (e.key === 'Escape') {
      console.log('[DEBUG] Escape key pressed – stopping audio and video');
      stopAudio();
      stopVideo();
    }
  });
  console.log('[DEBUG] Event listeners setup complete.');
}

// ---- Main Renderer ----
function renderPage(animDirection = null) {
  console.log(`[DEBUG] Rendering page ${state.currentPage} (anim: ${animDirection || 'none'})`);
  const book = document.getElementById('book-container');
  
  if (!animDirection) {
    while (book.firstChild) {
      book.removeChild(book.firstChild);
    }
  }

  const pageData = state.pages.find(p => p.page === state.currentPage);
  if (!pageData) {
    console.warn(`[WARN] No page data found for page ${state.currentPage}`);
    return;
  }
  console.log(`[DEBUG] Current page data (page ${state.currentPage}):`, pageData);

  const page = document.createElement('div');
  page.className = `page ${animDirection ? `flip-in-${animDirection}` : ''}`;
  page.dataset.page = state.currentPage.toString();

  // Left Side: Image/Video Container
  const left = document.createElement('div');
  left.className = 'page-left';
  const imgCont = document.createElement('div');
  imgCont.className = 'image-container';

  // Image Element (always present)
  const img = document.createElement('img');
  img.src = getApiUrl(`/api/images/${pageData.image}`);
  img.alt = `Page ${state.currentPage} image`;
  img.className = 'storybook-image';
  img.style.display = 'block';
  imgCont.appendChild(img);

  // Video Element (added if page has video)
  if (pageData.video) {
    console.log(`[DEBUG] ✅ Video field found for page ${state.currentPage}: "${pageData.video}"`);
    
    const video = document.createElement('video');
    // DO NOT set the src here - we'll set it dynamically when needed
    console.log(`[DEBUG] Video element created (src will be set on click)`);
    
    video.className = 'storybook-video';
    video.style.display = 'none';  // Hidden by default, shown when audio plays
    video.controls = false;
    video.autoplay = false;
    video.loop = false;
    video.muted = true;  // Critical for autoplay to work in modern browsers
    video.playsInline = true;
    video.preload = 'none'; // Don't preload videos until needed
    
    // Error handling
    video.onerror = (e) => {
      console.error(`[ERROR] Video loading failed for "${pageData.video}":`, e.target.error);
      handleVideoError(e);
    };
    
    imgCont.appendChild(video);
    console.log(`[DEBUG] Video element created and appended to DOM for page ${state.currentPage}`);
  } else {
    console.warn(`[WARN] ❌ No video field found for page ${state.currentPage}. Check your sentences.json data.`);
  }

  left.appendChild(imgCont);
  
  // Sticker Container
  const sticker = document.createElement('div');
  sticker.className = 'sticker-container';
  sticker.innerHTML = `<div class="sticker-number">${pageData.sticker_number}</div>`;
  left.appendChild(sticker);

  // Right Side: Text Content
  const right = document.createElement('div');
  right.className = 'page-right';
  const textCont = document.createElement('div');
  textCont.className = 'text-container';

  const sentences = pageData.sentences[state.language];
  console.log(`[DEBUG] Rendering sentences for language ${state.language} (page ${state.currentPage}):`, sentences);
  if (!sentences || sentences.length === 0) {
    console.warn(`[WARN] No sentences found for language ${state.language} on page ${state.currentPage}`);
    return;
  }

  sentences.forEach((sent, i) => {
    const block = document.createElement('div');
    block.className = 'sentence-block';
    const speakerLabel = document.createElement('div');
    speakerLabel.className = 'speaker-label';
    speakerLabel.textContent = `${sent.speaker}:`;
    block.appendChild(speakerLabel);

    const line = document.createElement('div');
    line.className = 'sentence-text';

    if (sent.audio_granularity === 'word' && sent.words?.length > 0) {
      console.log(`[DEBUG] Rendering word-level audio for sentence ${i}`);
      renderWords(line, sent);
    } else {
      console.log(`[DEBUG] Rendering sentence-level audio for sentence ${i}`);
      renderSentence(line, sent);
    }
    block.appendChild(line);

    if (state.showEnglish && state.language !== 'english') {
      const enSent = pageData.sentences.english?.[i];
      if (enSent) {
        const tr = document.createElement('div');
        tr.className = 'translation-text';
        tr.textContent = enSent.text;
        block.appendChild(tr);
        console.log(`[DEBUG] Added English translation for sentence ${i}`);
      } else {
        console.warn(`[WARN] English translation missing for sentence ${i} on page ${state.currentPage}`);
      }
    }

    textCont.appendChild(block);
  });

  right.appendChild(textCont);

  // Audio Instructions
  const audInfo = document.createElement('div');
  audInfo.className = 'audio-instructions';
  audInfo.innerHTML = '<span class="audio-icon">🔊</span> <p>Click on words or sentences to hear pronunciation and watch animation</p>';
  right.appendChild(audInfo);

  page.appendChild(left);
  page.appendChild(right);
  book.appendChild(page);

  document.getElementById('page-number').textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  updateNavBtns();
  console.log('[DEBUG] Page render complete.');
}

// ---- Mini Renderer Functions ----
function renderWords(container, sentence) {
  const words = sentence.text.split(/\s+/);
  console.log(`[DEBUG] Split sentence into ${words.length} words for audio (sentence ID: ${sentence.id})`);
  words.forEach((word, idx) => {
    const span = document.createElement('span');
    span.className = 'word-clickable';
    const clean = word.toLowerCase().replace(/[.,!?;:'"()\[\]]/g, '');
    span.textContent = word;
    span.onclick = () => {
      console.log(`[DEBUG] Word clicked: "${word}" → clean: "${clean}" (sentence ID: ${sentence.id})`);
      playAudio(state.language, sentence.id, clean, span);
    };
    container.appendChild(span);
    if (idx < words.length - 1) container.appendChild(document.createTextNode(' '));
  });
}

function renderSentence(container, sentence) {
  const span = document.createElement('span');
  span.className = 'sentence-clickable';
  span.textContent = sentence.text;
  span.onclick = () => {
    console.log(`[DEBUG] Sentence clicked (ID: ${sentence.id})`);
    playAudio(state.language, sentence.id, 'full_sentence', span);
  };
  container.appendChild(span);
}

// ---- Animation ----
function animateFlip(dir, cb) {
  state.animating = true;
  console.log(`[DEBUG] Starting ${dir} page flip animation`);
  const book = document.getElementById('book-container');
  const currentPage = book.querySelector('.page');

  // Hide new page initially
  cb(); 
  const newPage = book.lastElementChild;
  if (newPage) {
    newPage.style.zIndex = '1';
  }

  // Apply flip-out animation to current page
  if (currentPage) {
    currentPage.style.zIndex = '10';
    currentPage.classList.add(dir === 'next' ? 'flip-out-left' : 'flip-out-right');
  }

  // Cleanup after animation
  setTimeout(() => {
    if (currentPage) {
      currentPage.remove();
    }
    if (newPage) {
      newPage.style.zIndex = '';
      newPage.classList.remove('flip-in-right', 'flip-in-left');
    }
    state.animating = false;
    console.log('[DEBUG] Animation completed. animating flag reset to false.');
  }, 500); // Default animation duration
}

// ---- Navigation Buttons ----
function updateNavBtns() {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  prevBtn.disabled = state.currentPage === 1;
  nextBtn.disabled = state.currentPage === state.totalPages;
  console.log(`[DEBUG] Nav buttons updated – Prev: ${!prevBtn.disabled}, Next: ${!nextBtn.disabled}`);
}

// ---- AUDIO & VIDEO ----
function stopAudio() {
  if (state.audio) {
    console.log('[DEBUG] Stopping current audio playback');
    state.audio.pause();
    state.audio = null;
    document.querySelectorAll('.word-clickable.playing, .sentence-clickable.playing')
      .forEach(el => el.classList.remove('playing'));
  }
}

function playAudio(language, sentenceId, audioId, el) {
  console.log(`[DEBUG] 🔊 Attempting to play audio: lang=${language}, sentence=${sentenceId}, type=${audioId}`);
  stopAudio();
  stopVideo();

  el.classList.add('playing');

  const currentPageData = state.pages.find(p => p.page === state.currentPage);
  if (!currentPageData) {
    console.warn('[WARN] No current page data found');
    el.classList.remove('playing');
    return;
  }
  
  // CRITICAL: Check if this page has a video field
  console.log(`[DEBUG] 📄 Current page data for playback (page ${state.currentPage}):`, currentPageData);
  console.log(`[DEBUG] 🎥 Does page ${state.currentPage} have video? ${!!currentPageData.video}, Value: "${currentPageData.video}"`);

  // Audio handling - ALWAYS make the API call
  const audioUrl = getApiUrl(`/api/audio/${language}/${sentenceId}/${audioId}`);
  console.log(`[DEBUG] 📢 Requesting audio from URL: ${audioUrl}`);
  const audioElem = new Audio(audioUrl);
  state.audio = audioElem;

  // Handle audio playback errors
  const playPromise = audioElem.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.error('[ERROR] Audio play promise rejected:', err);
      el.classList.remove('playing');
    });
  }

  // VIDEO HANDLING - ONLY IF VIDEO FIELD EXISTS
  if (currentPageData.video) {
    console.log(`[DEBUG] 🎬 VIDEO FIELD DETECTED - Setting up video playback`);
    
    // Wait for DOM to be fully ready
    setTimeout(() => {
      console.log(`[DEBUG] ⏱️ Starting video setup for page ${state.currentPage}`);
      
      const currentPageElement = document.querySelector(`.page[data-page="${state.currentPage}"]`);
      if (!currentPageElement) {
        console.warn('[WARN] Page element not found in DOM for video playback');
        return;
      }

      const video = currentPageElement.querySelector('.storybook-video');
      const img = currentPageElement.querySelector('.storybook-image');
      
      console.log(`[DEBUG] DOM elements status - Video: ${!!video}, Image: ${!!img}`);
      
      if (video && img) {
        // Set the video src dynamically HERE (critical fix)
        const videoUrl = getApiUrl(`/api/videos/${encodeURIComponent(currentPageData.video)}`);
        console.log(`[DEBUG] 🎥 Requesting video from URL: ${videoUrl}`);
        
        // Only update src if it's different
        if (video.src !== videoUrl) {
          video.src = videoUrl;
          console.log(`[DEBUG] Video src set to: ${videoUrl}`);
        }
        
        video.style.display = 'block';
        img.style.display = 'none';
        
        // Setup event listeners
        video.removeEventListener('ended', handleVideoEnd); // Remove any existing listeners
        video.removeEventListener('error', handleVideoError);
        video.addEventListener('ended', handleVideoEnd);
        video.addEventListener('error', handleVideoError);
        
        // Load the video to ensure it's ready to play
        video.load();
        
        // Attempt to play video
        video.play()
          .then(() => {
            console.log('[DEBUG] 🎥 Video playback started successfully');
          })
          .catch(err => {
            console.error('[ERROR] ❌ Video play rejected:', err);
            // Reset display if playback fails
            video.style.display = 'none';
            img.style.display = 'block';
            handleVideoError(err);
          });
      } else {
        console.warn('[WARN] ❌ Video or image element missing in current page DOM');
      }
    }, 50); // Shorter delay since we're setting src dynamically
  } else {
    console.log(`[DEBUG] ⏭️ No video field for page ${state.currentPage} - only playing audio`);
  }

  // Audio cleanup
  audioElem.onended = () => {
    console.log('[DEBUG] 🔊 Audio playback ended');
    el.classList.remove('playing');
    // Don't call stopVideo() here - let video end naturally
  };

  audioElem.onerror = () => {
    console.error('[ERROR] ❌ Audio playback failed for URL:', audioUrl);
    el.classList.remove('playing');
    stopVideo();
  };
}

// ---- Error/Notification ----
function showError(msg) {
  console.error('[ALERT]', msg);
  alert(msg);
}

// ---- Utility function (if not defined elsewhere) ----
function getApiUrl(path) {
  // If you have a config.js with API_BASE_URL, use that
  // Otherwise default to relative path
  const baseUrl = window.CONFIG?.api?.baseUrl || '';
  return baseUrl + path;
}