// VoiceMaster Content Script - Lightweight Version
// Only activates when user triggers it

(function() {
  // Prevent multiple initializations
  if (window.voiceMasterInitialized) return;
  window.voiceMasterInitialized = true;

  let recognition = null;
  let isRecording = false;
  let floatingMic = null;
  let dictationBox = null;
  let statusIndicator = null;
  let currentElement = null;
  let lastText = '';
  let liveInsertion = null;

  // Cached sound settings - updated when user saves
  let cachedSoundOn = null;
  let cachedSoundOff = null;

  // ==================== SPEECH RECOGNITION ====================
  
  function createRecognition() {
    if (recognition) return recognition;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('VoiceMaster: Speech recognition not supported');
      return null;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      isRecording = true;
      updateUI(true);
    };
    
    recognition.onend = () => {
      if (isRecording) {
        setTimeout(() => {
          if (isRecording && recognition) {
            try { recognition.start(); } catch(e) { isRecording = false; updateUI(false); }
          }
        }, 300);
      } else {
        updateUI(false);
      }
    };
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        // Pick best alternative (usually first, but check confidence)
        let bestAlt = event.results[i][0];
        for (let j = 1; j < event.results[i].length; j++) {
          if (event.results[i][j].confidence > bestAlt.confidence) {
            bestAlt = event.results[i][j];
          }
        }
        
        if (event.results[i].isFinal) {
          finalTranscript += bestAlt.transcript;
        } else {
          interimTranscript += bestAlt.transcript;
        }
      }
      
      if (finalTranscript) {
        const processedFinal = processCommands(finalTranscript);
        if (processedFinal.trim()) {
          commitLiveText(processedFinal);
          lastText = processedFinal;
        }
      }

      if (interimTranscript) {
        const processedInterim = processCommands(interimTranscript);
        showStatus(processedInterim);
        updateLiveText(processedInterim);
      }
    };
    
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        showStatus('⚠️ Microphone access denied');
        isRecording = false;
        updateUI(false);
      }
    };
    
    return recognition;
  }

  // ==================== VOICE COMMANDS ====================
  
  function processCommands(text) {
    const commands = {
      'period': '.',
      'full stop': '.',
      'comma': ',',
      'question mark': '?',
      'exclamation mark': '!',
      'exclamation point': '!',
      'colon': ':',
      'semicolon': ';',
      'new line': '\n',
      'newline': '\n',
      'new paragraph': '\n\n',
      'open quote': '"',
      'close quote': '"',
      'open parenthesis': '(',
      'close parenthesis': ')',
      'dash': '-',
      'hyphen': '-',
      'at sign': '@',
      'hashtag': '#',
      'dollar sign': '$',
      'percent sign': '%',
      'ampersand': '&',
      'asterisk': '*',
      'underscore': '_',
      'ellipsis': '...',
    };
    
    let result = text;
    
    for (const [cmd, replacement] of Object.entries(commands)) {
      const regex = new RegExp('\\b' + cmd + '\\b', 'gi');
      result = result.replace(regex, replacement);
    }
    
    return result;
  }

  // ==================== TEXT INSERTION ====================
  
  function insertText(text) {
    clearLiveInsertion();
    // Check if dictation box textarea is focused - only then insert there
    if (dictationBox && dictationBox.style.display !== 'none') {
      const textarea = dictationBox.querySelector('textarea');
      if (textarea && document.activeElement === textarea) {
        textarea.value += (textarea.value ? ' ' : '') + text.trim();
        return;
      }
    }
    
    const target = getTargetElement();
    if (!target) {
      showDictationBox(text);
      return;
    }
    
    // Focus target
    target.focus();
    
    // Try execCommand first
    try {
      if (document.execCommand('insertText', false, text + ' ')) return;
    } catch(e) {}
    
    // Try input value method
    if (tryInputValue(target, text)) return;
    
    // Try contenteditable
    if (tryContentEditable(target, text)) return;
    
    // Last resort
    showDictationBox(text);
  }
  
  function tryExecCommand(el, text) {
    try {
      el.focus();
      return document.execCommand('insertText', false, formatSpokenText(text));
    } catch(e) {
      return false;
    }
  }
  
  // Character-by-character input simulation for Google/YouTube/Gmail
  async function typeCharByChar(el, text) {
    el.focus();
    const textToInsert = formatSpokenText(text);

    for (let i = 0; i < textToInsert.length; i++) {
      const char = textToInsert[i];
      const keyCode = char.charCodeAt(0);

      // Create realistic keyboard events
      const keydownEvent = new KeyboardEvent('keydown', {
        key: char,
        code: char === ' ' ? 'Space' : 'Key' + char.toUpperCase(),
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true
      });

      const keypressEvent = new KeyboardEvent('keypress', {
        key: char,
        code: char === ' ' ? 'Space' : 'Key' + char.toUpperCase(),
        keyCode: keyCode,
        charCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true
      });

      const keyupEvent = new KeyboardEvent('keyup', {
        key: char,
        code: char === ' ' ? 'Space' : 'Key' + char.toUpperCase(),
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true
      });

      // Dispatch keydown
      el.dispatchEvent(keydownEvent);

      // Update value and dispatch input
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

      const newValue = el.value.slice(0, start) + char + el.value.slice(end);
      if (nativeSetter) {
        nativeSetter.call(el, newValue);
      } else {
        el.value = newValue;
      }

      try { el.setSelectionRange(start + 1, start + 1); } catch(e) {}

      // Dispatch keypress
      el.dispatchEvent(keypressEvent);

      // Dispatch input event
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: char
      }));

      // Dispatch keyup
      el.dispatchEvent(keyupEvent);

      // Small delay between characters for framework processing
      if (i % 5 === 4) {
        await new Promise(r => setTimeout(r, 1));
      }
    }

    // Final change event
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function tryInputValue(el, text) {
    if (!('value' in el)) return false;

    const isGoogle = window.location.hostname.includes('google.');
    const isYouTube = window.location.hostname.includes('youtube.');
    const isGmail = window.location.hostname.includes('mail.google.');

    // Use character-by-character for Google sites
    if (isGoogle || isYouTube || isGmail) {
      typeCharByChar(el, text);
      return true;
    }

    try {
      el.focus();

      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const textToInsert = formatSpokenText(text);
      const newValue = el.value.slice(0, start) + textToInsert + el.value.slice(end);

      // Use native setter for React
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

      if (nativeSetter) {
        nativeSetter.call(el, newValue);
      } else {
        el.value = newValue;
      }

      // Set cursor
      const newPos = start + textToInsert.length;
      try { el.setSelectionRange(newPos, newPos); } catch(e) {}

      // Fire keyboard events first
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Unidentified' }));

      // Fire proper InputEvent
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: textToInsert
      }));

      // Fire keyup
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' }));

      // Fire change
      el.dispatchEvent(new Event('change', { bubbles: true }));

      return true;
    } catch(e) {
      return false;
    }
  }
  
  function tryContentEditable(el, text) {
    if (!el.isContentEditable) return false;

    const isYouTube = window.location.hostname.includes('youtube.');
    const isGmail = window.location.hostname.includes('mail.google.');

    try {
      el.focus();

      // For YouTube comments, they use a special placeholder system
      if (isYouTube) {
        // Clear placeholder if present
        const placeholder = el.querySelector('#placeholder');
        if (placeholder) {
          placeholder.style.display = 'none';
        }
      }

      const selection = window.getSelection();
      if (!selection.rangeCount) {
        // Create a range at end of element
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(formatSpokenText(text));
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // Fire comprehensive events for YouTube/Gmail
      if (isYouTube || isGmail) {
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: true,
          inputType: 'insertText',
          data: text
        }));

        el.dispatchEvent(new Event('change', { bubbles: true }));

        // For YouTube, also trigger their custom events
        if (isYouTube) {
          el.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Unidentified',
            bubbles: true,
            cancelable: true,
            composed: true
          }));
        }
      } else {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      return true;
    } catch(e) {
      console.error('VoiceMaster contenteditable error:', e);
      return false;
    }
  }
  
  function getTargetElement() {
    const isGoogle = window.location.hostname.includes('google.');
    const isYouTube = window.location.hostname.includes('youtube.');
    const isGmail = window.location.hostname.includes('mail.google.');

    // First check if user has an active focused element
    const active = document.activeElement;
    if (active && isEditable(active) && active !== document.body) {
      currentElement = active;
      return active;
    }

    // For Gmail - prioritize compose area
    if (isGmail) {
      const composeBody = document.querySelector('[aria-label="Message Body"][contenteditable="true"], div[g_editable="true"], div.editable[contenteditable="true"]');
      if (composeBody) {
        currentElement = composeBody;
        return composeBody;
      }
      const subjectInput = document.querySelector('input[name="subjectbox"]');
      if (subjectInput) {
        currentElement = subjectInput;
        return subjectInput;
      }
    }

    // For Google Search
    if (isGoogle && !isGmail) {
      const gInput = document.querySelector('textarea.gLFyf, input.gLFyf, textarea[name="q"], input[name="q"], input[aria-label="Search"]');
      if (gInput) {
        currentElement = gInput;
        return gInput;
      }
    }

    // For YouTube
    if (isYouTube) {
      // Check for comment box first (contenteditable)
      const commentBox = document.querySelector('#contenteditable-root[contenteditable="true"], yt-formatted-string#contenteditable-root[contenteditable="true"]');
      if (commentBox) {
        currentElement = commentBox;
        return commentBox;
      }
      // Then search box
      const ytInput = document.querySelector('input#search, input[name="search_query"]');
      if (ytInput) {
        currentElement = ytInput;
        return ytInput;
      }
    }

    // Check stored element
    if (currentElement && document.contains(currentElement) && isEditable(currentElement)) {
      return currentElement;
    }

    // Search for any focused editable
    const focused = document.querySelector('input:focus, textarea:focus, [contenteditable="true"]:focus');
    if (focused && isEditable(focused)) {
      currentElement = focused;
      return focused;
    }

    // Generic search input fallback
    const searchInput = document.querySelector('input[type="search"], input[aria-label*="earch"]');
    if (searchInput) {
      currentElement = searchInput;
      return searchInput;
    }

    return null;
  }

  function formatSpokenText(text) {
    return text.replace(/\s+$/u, '') + ' ';
  }

  function isTextInput(el) {
    if (!el) return false;
    return el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text','email','search','url','tel','password','number',''].includes((el.type || 'text').toLowerCase()));
  }

  function ensureLiveInsertion(target) {
    if (liveInsertion && liveInsertion.target === target) return liveInsertion;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    liveInsertion = {
      target,
      baseValue: target.value,
      start,
      end,
      rawText: ''
    };
    return liveInsertion;
  }

  function clearLiveInsertion() {
    liveInsertion = null;
  }

  function applyInputValue(el, newValue, cursorPos, dataValue) {
    const isGoogle = window.location.hostname.includes('google.');
    const isYouTube = window.location.hostname.includes('youtube.');
    const isGmail = window.location.hostname.includes('mail.google.');

    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(el, newValue);
    } else {
      el.value = newValue;
    }

    try { el.setSelectionRange(cursorPos, cursorPos); } catch(e) {}

    // For Google/YouTube, fire more realistic events
    if (isGoogle || isYouTube || isGmail) {
      // Simulate typing completion
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Unidentified',
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: dataValue
      }));

      el.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Unidentified',
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      // Also trigger compositionend for some Google inputs
      el.dispatchEvent(new CompositionEvent('compositionend', {
        bubbles: true,
        cancelable: true,
        composed: true,
        data: dataValue
      }));
    } else {
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Unidentified' }));
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: dataValue
      }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' }));
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function updateLiveText(text) {
    const target = getTargetElement();
    if (!target || !isTextInput(target)) {
      return;
    }

    target.focus();
    const insertText = formatSpokenText(text);
    const live = ensureLiveInsertion(target);
    live.rawText = text;
    const newValue = live.baseValue.slice(0, live.start) + insertText + live.baseValue.slice(live.end);
    const newPos = live.start + insertText.length;
    applyInputValue(target, newValue, newPos, insertText);
  }

  function commitLiveText(text) {
    if (liveInsertion && liveInsertion.target && isTextInput(liveInsertion.target)) {
      const target = liveInsertion.target;
      target.focus();
      const insertText = formatSpokenText(text);
      const newValue = liveInsertion.baseValue.slice(0, liveInsertion.start) + insertText + liveInsertion.baseValue.slice(liveInsertion.end);
      const newPos = liveInsertion.start + insertText.length;
      applyInputValue(target, newValue, newPos, insertText);
      clearLiveInsertion();
      return;
    }

    insertText(text);
  }
  
  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return ['text','email','search','url','tel','password','number',''].includes(type);
    }
    if (el.isContentEditable) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    if (el.getAttribute('role') === 'textbox' || el.getAttribute('role') === 'combobox') return true;
    return false;
  }

  // ==================== UI ELEMENTS ====================
  
  function createFloatingMic() {
    if (floatingMic) return floatingMic;
    
    floatingMic = document.createElement('div');
    floatingMic.id = 'vm-mic';
    floatingMic.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    `;
    
    // Make draggable
    let isDragging = false;
    let wasDragged = false;
    let startX, startY, startLeft, startTop;
    
    // Load saved position
    chrome.storage.local.get('micPosition', (data) => {
      if (data.micPosition) {
        floatingMic.style.right = 'auto';
        floatingMic.style.bottom = 'auto';
        floatingMic.style.left = data.micPosition.left + 'px';
        floatingMic.style.top = data.micPosition.top + 'px';
      }
    });
    
    floatingMic.onmousedown = (e) => {
      isDragging = true;
      wasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = floatingMic.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    };
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Only count as drag if moved more than 5px
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        wasDragged = true;
      }
      
      floatingMic.style.right = 'auto';
      floatingMic.style.bottom = 'auto';
      floatingMic.style.left = (startLeft + dx) + 'px';
      floatingMic.style.top = (startTop + dy) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging && wasDragged) {
        // Save position
        const rect = floatingMic.getBoundingClientRect();
        chrome.storage.local.set({ micPosition: { left: rect.left, top: rect.top } });
      }
      isDragging = false;
    });
    
    floatingMic.onclick = (e) => {
      // Only toggle if wasn't dragged
      if (!wasDragged) {
        toggleRecording();
      }
    };
    
    document.body.appendChild(floatingMic);
    return floatingMic;
  }
  
  // ==================== SOUND EFFECTS ====================
  
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const SOUNDS = {
    // Simple beeps
    'beep-high': { freq: 880, duration: 0.1, type: 'sine' },
    'beep-low': { freq: 440, duration: 0.1, type: 'sine' },
    'beep-double': { freq: 660, duration: 0.08, type: 'sine', repeat: 2 },
    'beep-triple': { freq: 770, duration: 0.06, type: 'sine', repeat: 3 },
    
    // Soft tones
    'soft-on': { freq: 520, duration: 0.15, type: 'sine', ramp: 'up' },
    'soft-off': { freq: 420, duration: 0.15, type: 'sine', ramp: 'down' },
    'soft-chime': { freq: 800, duration: 0.2, type: 'sine' },
    
    // Tech sounds
    'tech-blip': { freq: 1200, duration: 0.05, type: 'square' },
    'tech-buzz': { freq: 200, duration: 0.1, type: 'sawtooth' },
    'tech-click': { freq: 1000, duration: 0.02, type: 'square' },
    
    // Musical
    'ding': { freq: 1047, duration: 0.3, type: 'sine' },
    'dong': { freq: 523, duration: 0.3, type: 'sine' },
    'chime-up': { freq: [523, 659, 784], duration: 0.12, type: 'sine' },
    'chime-down': { freq: [784, 659, 523], duration: 0.12, type: 'sine' },
    
    // Alerts
    'alert-1': { freq: 600, duration: 0.1, type: 'triangle' },
    'alert-2': { freq: 900, duration: 0.08, type: 'triangle' },
    'alert-soft': { freq: 700, duration: 0.15, type: 'sine' },
    
    // Pops
    'pop-high': { freq: 1500, duration: 0.03, type: 'sine' },
    'pop-low': { freq: 300, duration: 0.05, type: 'sine' },
    'pop-mid': { freq: 800, duration: 0.04, type: 'sine' },
    
    // Rising/Falling
    'rise-fast': { freq: [400, 800], duration: 0.1, type: 'sine', sweep: true },
    'fall-fast': { freq: [800, 400], duration: 0.1, type: 'sine', sweep: true },
    'rise-slow': { freq: [300, 600], duration: 0.2, type: 'sine', sweep: true },
    'fall-slow': { freq: [600, 300], duration: 0.2, type: 'sine', sweep: true },
    
    // Subtle
    'tick': { freq: 2000, duration: 0.01, type: 'square' },
    'tock': { freq: 1000, duration: 0.015, type: 'square' },
    'tap': { freq: 1500, duration: 0.02, type: 'triangle' },
    
    // Voice-like
    'boop': { freq: [600, 400], duration: 0.08, type: 'sine', sweep: true },
    'beep-boop': { freq: 500, duration: 0.1, type: 'sine', repeat: 2, gap: 0.05 },
    'blip-blop': { freq: [800, 500], duration: 0.08, type: 'sine' },
    
    // Notifications
    'notify-1': { freq: [523, 659], duration: 0.1, type: 'sine' },
    'notify-2': { freq: [659, 784], duration: 0.1, type: 'sine' },
    'notify-3': { freq: [784, 1047], duration: 0.1, type: 'sine' },
    
    // Gentle
    'gentle-on': { freq: 550, duration: 0.2, type: 'sine', ramp: 'up' },
    'gentle-off': { freq: 450, duration: 0.2, type: 'sine', ramp: 'down' },
    
    // Crisp
    'crisp-1': { freq: 1100, duration: 0.05, type: 'sine' },
    'crisp-2': { freq: 1300, duration: 0.04, type: 'sine' },
    
    // Modern
    'modern-on': { freq: [400, 600, 800], duration: 0.08, type: 'sine' },
    'modern-off': { freq: [800, 600, 400], duration: 0.08, type: 'sine' },
    
    // Minimal
    'min-click': { freq: 1800, duration: 0.015, type: 'sine' },
    'min-tap': { freq: 1200, duration: 0.02, type: 'sine' },
    
    // Classic
    'classic-on': { freq: 880, duration: 0.12, type: 'sine' },
    'classic-off': { freq: 440, duration: 0.12, type: 'sine' },
    
    // Retro
    'retro-1': { freq: 660, duration: 0.08, type: 'square' },
    'retro-2': { freq: 880, duration: 0.08, type: 'square' },
    
    // None
    'none': null
  };
  
  function playSound(soundName) {
    const sound = SOUNDS[soundName];
    if (!sound) return;
    
    // Resume audio context if suspended
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const freqs = Array.isArray(sound.freq) ? sound.freq : [sound.freq];
    const repeat = sound.repeat || 1;
    const gap = sound.gap || 0.1;
    
    for (let r = 0; r < repeat; r++) {
      const startTime = audioCtx.currentTime + (r * (sound.duration + gap));
      
      if (sound.sweep && freqs.length === 2) {
        // Frequency sweep
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = sound.type;
        osc.frequency.setValueAtTime(freqs[0], startTime);
        osc.frequency.linearRampToValueAtTime(freqs[1], startTime + sound.duration);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + sound.duration);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + sound.duration);
      } else {
        // Multiple frequencies (chord or sequence)
        freqs.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = sound.type;
          osc.frequency.value = freq;
          
          const noteStart = startTime + (i * sound.duration);
          
          if (sound.ramp === 'up') {
            gain.gain.setValueAtTime(0.01, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.3, noteStart + sound.duration * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + sound.duration);
          } else if (sound.ramp === 'down') {
            gain.gain.setValueAtTime(0.3, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + sound.duration);
          } else {
            gain.gain.setValueAtTime(0.3, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + sound.duration * 0.8);
          }
          
          osc.connect(gain).connect(audioCtx.destination);
          osc.start(noteStart);
          osc.stop(noteStart + sound.duration);
        });
      }
    }
  }
  
  function playSoundOn() {
    if (cachedSoundOn) {
      playSound(cachedSoundOn);
    } else {
      chrome.storage.local.get('soundOn', (data) => {
        cachedSoundOn = data.soundOn || 'soft-on';
        playSound(cachedSoundOn);
      });
    }
  }

  function playSoundOff() {
    if (cachedSoundOff) {
      playSound(cachedSoundOff);
    } else {
      chrome.storage.local.get('soundOff', (data) => {
        cachedSoundOff = data.soundOff || 'soft-off';
        playSound(cachedSoundOff);
      });
    }
  }

  // Load sound settings on init
  function loadSoundSettings() {
    chrome.storage.local.get(['soundOn', 'soundOff'], (data) => {
      cachedSoundOn = data.soundOn || 'soft-on';
      cachedSoundOff = data.soundOff || 'soft-off';
      console.log('VoiceMaster sounds loaded:', cachedSoundOn, cachedSoundOff);
    });
  }
  
  function createDictationBox() {
    if (dictationBox) return dictationBox;
    
    dictationBox = document.createElement('div');
    dictationBox.id = 'vm-box';
    dictationBox.innerHTML = `
      <div class="vm-box-header">
        <span>🎤 Dictation Box</span>
        <button class="vm-box-close">✕</button>
      </div>
      <textarea placeholder="Your speech will appear here..."></textarea>
      <div class="vm-box-footer">
        <button class="vm-box-copy">📋 Copy</button>
        <button class="vm-box-clear">🗑️ Clear</button>
      </div>
    `;
    
    dictationBox.querySelector('.vm-box-close').onclick = () => {
      dictationBox.style.display = 'none';
    };
    
    dictationBox.querySelector('.vm-box-copy').onclick = () => {
      const text = dictationBox.querySelector('textarea').value;
      navigator.clipboard.writeText(text);
      showStatus('✓ Copied!');
    };
    
    dictationBox.querySelector('.vm-box-clear').onclick = () => {
      dictationBox.querySelector('textarea').value = '';
    };
    
    // Make draggable
    let isDragging = false, startX, startY, startLeft, startTop;
    const header = dictationBox.querySelector('.vm-box-header');
    
    header.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = dictationBox.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
    };
    
    document.onmousemove = (e) => {
      if (!isDragging) return;
      dictationBox.style.left = (startLeft + e.clientX - startX) + 'px';
      dictationBox.style.top = (startTop + e.clientY - startY) + 'px';
      dictationBox.style.transform = 'none';
    };
    
    document.onmouseup = () => isDragging = false;
    
    dictationBox.style.display = 'none';
    document.body.appendChild(dictationBox);
    return dictationBox;
  }
  
  function createStatusIndicator() {
    if (statusIndicator) return statusIndicator;
    
    statusIndicator = document.createElement('div');
    statusIndicator.id = 'vm-status';
    document.body.appendChild(statusIndicator);
    return statusIndicator;
  }
  
  function showDictationBox(text) {
    createDictationBox();
    dictationBox.style.display = 'block';
    if (text) {
      const textarea = dictationBox.querySelector('textarea');
      textarea.value += (textarea.value ? ' ' : '') + text;
    }
  }
  
  function showStatus(text) {
    createStatusIndicator();
    statusIndicator.textContent = text;
    statusIndicator.classList.add('visible');
    
    clearTimeout(statusIndicator.hideTimeout);
    statusIndicator.hideTimeout = setTimeout(() => {
      statusIndicator.classList.remove('visible');
    }, 2000);
  }
  
  function updateUI(recording) {
    if (floatingMic) {
      floatingMic.classList.toggle('recording', recording);
    }
    
    // Update badge via background
    chrome.runtime.sendMessage({ 
      action: recording ? 'startDictation' : 'stopDictation' 
    }).catch(() => {});
  }

  // ==================== CONTROLS ====================
  
  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
  
  function startRecording() {
    const rec = createRecognition();
    if (!rec) {
      showStatus('⚠️ Speech recognition not supported');
      return;
    }
    
    try {
      isRecording = true;
      rec.start();
      playSoundOn();
      showStatus('🎤 Listening...');
    } catch(e) {
      if (e.message.includes('already started')) {
        // Already running
      } else {
        console.error('VoiceMaster:', e);
        showStatus('⚠️ Could not start');
        isRecording = false;
      }
    }
  }
  
  function stopRecording() {
    isRecording = false;
    if (liveInsertion && liveInsertion.rawText.trim()) {
      commitLiveText(liveInsertion.rawText);
    } else {
      clearLiveInsertion();
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch(e) {}
    }
    playSoundOff();
    updateUI(false);
    showStatus('⏹️ Stopped');
  }

  // ==================== MESSAGE HANDLING ====================
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch(msg.action) {
      case 'toggleDictation':
        toggleRecording();
        break;
      case 'startDictation':
        startRecording();
        break;
      case 'stopDictation':
        stopRecording();
        break;
      case 'toggleDictationBox':
        createDictationBox();
        dictationBox.style.display = dictationBox.style.display === 'none' ? 'block' : 'none';
        break;
      case 'playSound':
        playSound(msg.sound);
        break;
      case 'refreshSoundSettings':
        cachedSoundOn = msg.soundOn;
        cachedSoundOff = msg.soundOff;
        console.log('VoiceMaster sounds refreshed:', cachedSoundOn, cachedSoundOff);
        break;
      case 'resetMicPosition':
        if (floatingMic) {
          floatingMic.style.left = 'auto';
          floatingMic.style.top = 'auto';
          floatingMic.style.right = '24px';
          floatingMic.style.bottom = '24px';
        }
        break;
    }
    sendResponse({ ok: true });
  });

  // ==================== INIT ====================
  
  // Auto-stop when leaving tab
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRecording) {
      stopRecording();
    }
  });
  
  // Track focused element - both focusin AND click for Google
  document.addEventListener('focusin', (e) => {
    if (isEditable(e.target)) currentElement = e.target;
  }, true);
  
  document.addEventListener('click', (e) => {
    if (isEditable(e.target)) currentElement = e.target;
  }, true);
  
  // Create floating mic button (lazy - only creates DOM element, doesn't start anything)
  setTimeout(() => createFloatingMic(), 1000);

  // Load saved sound settings on init
  loadSoundSettings();

  console.log('VoiceMaster loaded');
})();
