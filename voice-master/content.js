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
      
      if (interimTranscript) showStatus(interimTranscript);
      
      if (finalTranscript) {
        const processed = processCommands(finalTranscript);
        if (processed.trim()) {
          insertText(processed);
          lastText = processed;
        }
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
    // Check if dictation box textarea is focused - only then insert there
    if (dictationBox && dictationBox.style.display !== 'none') {
      const textarea = dictationBox.querySelector('textarea');
      if (textarea && document.activeElement === textarea) {
        textarea.value += (textarea.value ? ' ' : '') + text;
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
      return document.execCommand('insertText', false, text + ' ');
    } catch(e) {
      return false;
    }
  }
  
  function tryInputValue(el, text) {
    if (!('value' in el)) return false;
    
    try {
      el.focus();
      
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const textToInsert = text + ' ';
      const newValue = el.value.slice(0, start) + textToInsert + el.value.slice(end);
      
      // Use native setter for React/Google/YouTube
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
      
      // Fire keyboard events first (Google/YouTube need these)
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
    
    try {
      el.focus();
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text + ' ');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } catch(e) {
      return false;
    }
  }
  
  function getTargetElement() {
    // For Google/YouTube - ALWAYS try to find their search box first if on those sites
    const isGoogle = window.location.hostname.includes('google.');
    const isYouTube = window.location.hostname.includes('youtube.');
    
    if (isGoogle) {
      const gInput = document.querySelector('textarea.gLFyf, input.gLFyf, textarea[name="q"], input[name="q"]');
      if (gInput) {
        currentElement = gInput;
        return gInput;
      }
    }
    
    if (isYouTube) {
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
    
    // Check active element
    const active = document.activeElement;
    if (isEditable(active)) {
      currentElement = active;
      return active;
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
    chrome.storage.local.get('soundOn', (data) => {
      playSound(data.soundOn || 'soft-on');
    });
  }
  
  function playSoundOff() {
    chrome.storage.local.get('soundOff', (data) => {
      playSound(data.soundOff || 'soft-off');
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
  
  console.log('VoiceMaster loaded');
})();
