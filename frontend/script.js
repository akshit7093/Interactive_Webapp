// ---- Constants & State ----
// config.js
const API_BASE_URL = 'http://localhost:8000/api';
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
    alert('Failed to load storybook. Check backend.');
  }
});

// ---- Fetch Functions ----
async function fetchLanguages() {
  console.log('[DEBUG] Fetching languages from:', `${API_BASE_URL}/languages`);
  const res = await fetch(`${API_BASE_URL}/languages`);
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
  console.log('[DEBUG] Fetching pages from:', `${API_BASE_URL}/sentences`);
  const res = await fetch(`${API_BASE_URL}/sentences`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  console.log('[DEBUG] Received pages data:', data);

  state.pages = data.pages;
  state.totalPages = data.metadata.total_pages;
  console.log(`[DEBUG] Loaded ${state.pages.length} pages. Total pages: ${state.totalPages}`);
}

// ---- Listeners ----
function setupListeners() {
  console.log('[DEBUG] Setting up event listeners...');

  document.getElementById('language-select').onchange = e => {
    console.log(`[DEBUG] Language changed to: ${e.target.value}`);
    state.language = e.target.value;
    renderPage();
  };

  document.getElementById('translation-toggle').onchange = e => {
    console.log(`[DEBUG] Translation toggle set to: ${e.target.checked}`);
    state.showEnglish = e.target.checked;
    renderPage();
  };

  document.getElementById('prev-page').onclick = () => {
    console.log(`[DEBUG] Prev page clicked. Current: ${state.currentPage}, Animating: ${state.animating}`);
    if (state.animating || state.currentPage === 1) {
      console.log('[DEBUG] Prev page action blocked (animating or at start)');
      return;
    }
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
      console.log('[DEBUG] Escape key pressed – stopping audio');
      stopAudio();
    }
  });

  console.log('[DEBUG] Event listeners setup complete.');
}

// ---- Main Renderer ----
function renderPage(animDirection = null) {
  console.log(`[DEBUG] Rendering page ${state.currentPage} (anim: ${animDirection || 'none'})`);

  const book = document.getElementById('book-container');
  while (book.firstChild) book.removeChild(book.firstChild);

  const pageData = state.pages.find(p => p.page === state.currentPage);
  if (!pageData) {
    console.warn(`[WARN] No page data found for page ${state.currentPage}`);
    return;
  }

  const page = document.createElement('div');
  page.className = 'page active';
  if (animDirection === 'next') page.classList.add('flip-in-right');
  if (animDirection === 'prev') page.classList.add('flip-in-left');

  // Left: image
  const left = document.createElement('div');
  left.className = 'page-left';
  const imgCont = document.createElement('div');
  imgCont.className = 'image-container';
  const img = document.createElement('img');
  img.src = `${API_BASE_URL}/${pageData.image}`;
  img.alt = `Page ${state.currentPage}`;
  img.className = 'storybook-image';
  imgCont.appendChild(img);
  left.appendChild(imgCont);

  const sticker = document.createElement('div');
  sticker.className = 'sticker-container';
  sticker.innerHTML = `<div class="sticker-number">${pageData.sticker_number}</div>`;
  left.appendChild(sticker);

  // Right: text
  const right = document.createElement('div');
  right.className = 'page-right';
  const textCont = document.createElement('div');
  textCont.className = 'text-container';

  const sentences = pageData.sentences[state.language];
  console.log(`[DEBUG] Rendering ${sentences?.length || 0} sentences in ${state.language}`);
  if (!sentences) {
    console.warn(`[WARN] No sentences found for language: ${state.language} on page ${state.currentPage}`);
  }

  sentences?.forEach((sent, i) => {
    const block = document.createElement('div');
    block.className = 'sentence-block';
    block.innerHTML = `<div class="speaker-label">${sent.speaker}:</div>`;
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

  const audInfo = document.createElement('div');
  audInfo.className = 'audio-instructions';
  audInfo.innerHTML = '<span class="audio-icon">🔊</span> <p>Click on words or sentences to hear pronunciation</p>';
  right.appendChild(audInfo);

  page.appendChild(left);
  page.appendChild(right);
  book.appendChild(page);

  setTimeout(() => {
    page.classList.remove('flip-in-right', 'flip-in-left');
    state.animating = false;
    console.log('[DEBUG] Animation completed. animating flag reset to false.');
  }, 500);

  document.getElementById('page-number').textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  updateNavBtns();
  console.log('[DEBUG] Page render complete.');
}

// ---- Mini Renderer Functions ----
function renderWords(container, sentence) {
  const words = sentence.text.split(/\s+/);
  console.log(`[DEBUG] Split sentence into ${words.length} words for audio`);
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
  const curr = book.querySelector('.page.active');
  if (curr) {
    curr.classList.add(dir === 'next' ? 'flip-out-left' : 'flip-out-right');
    setTimeout(() => {
      curr.remove();
      console.log('[DEBUG] Old page removed, invoking render callback');
      cb();
    }, 500);
  } else {
    console.log('[DEBUG] No active page found – calling render callback immediately');
    cb();
  }
}

// ---- Navigation Buttons ----
function updateNavBtns() {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  prevBtn.disabled = state.currentPage === 1;
  nextBtn.disabled = state.currentPage === state.totalPages;
  console.log(`[DEBUG] Nav buttons updated – Prev: ${!prevBtn.disabled}, Next: ${!nextBtn.disabled}`);
}

// ---- AUDIO ----
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
  console.log(`[DEBUG] Attempting to play audio: lang=${language}, sentence=${sentenceId}, type=${audioId}`);
  stopAudio();
  el.classList.add('playing');

  const url = `${API_BASE_URL}/audio/${language}/${sentenceId}/${audioId}`;
  console.log(`[DEBUG] Audio URL: ${url}`);

  const audioElem = new Audio(url);
  state.audio = audioElem;
  let played = false;

  audioElem.onended = () => {
    console.log('[DEBUG] Audio playback ended');
    el.classList.remove('playing');
  };

  audioElem.onerror = () => {
    console.error('[ERROR] Audio playback failed for:', url);
    if (!played) {
      console.log('[DEBUG] Falling back to hidden <audio> element');
      let fallback = document.createElement('audio');
      fallback.style.display = 'none';
      fallback.src = url;
      fallback.autoplay = true;
      fallback.onended = () => {
        el.classList.remove('playing');
        fallback.remove();
        console.log('[DEBUG] Fallback audio ended and removed');
      };
      fallback.onerror = () => {
        console.error('[ERROR] Fallback audio also failed');
        el.classList.remove('playing');
        fallback.remove();
      };
      document.body.appendChild(fallback);
      played = true;
    }
  };

  try {
    const playPromise = audioElem.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.error('[ERROR] Play promise rejected:', err);
        audioElem.onerror();
      });
    }
  } catch (err) {
    console.error('[ERROR] Exception during audio play:', err);
    audioElem.onerror();
  }
}

// ---- Error/Notification ----
function showError(msg) {
  console.error('[ALERT]', msg);
  alert(msg);
}