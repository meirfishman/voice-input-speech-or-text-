# VoiceMaster - Ultimate Speech to Text Chrome Extension

A powerful, **100% FREE** speech-to-text Chrome extension with ALL premium features unlocked. This is a complete alternative to Voice In Plus and similar paid extensions.

## 🚀 Features (ALL FREE!)

### Core Features
- ✅ **Unlimited Dictation** - No time limits, dictate as long as you want
- ✅ **Advanced Mode** - Works on ALL websites including:
  - Notion, Slack, Hubspot, X (Twitter)
  - Salesforce, Zoho, Zendesk
  - Teladoc and most EHRs
  - React, Vue, Angular apps
  - Any contenteditable element

### Premium Features (Free!)
- ✅ **30-Minute Idle Timeout** - Pause and think without losing your session
- ✅ **Cross-Tab Dictation** - Switch tabs without stopping dictation
- ✅ **Dictation Box** - Floating text box for difficult sites
- ✅ **Custom Voice Commands** - Create your own shortcuts
- ✅ **Undo/Delete Commands** - Fix mistakes with your voice
- ✅ **Language Switching** - Support for 35+ languages
- ✅ **Case Transformation** - Auto sentence case, UPPER, lower, Title
- ✅ **Tab Pinning** - Lock dictation to a specific tab
- ✅ **Profanity Filter Toggle** - Uncensored transcription option

### Technical Features
- Multiple text insertion strategies for maximum compatibility
- Works with React, Vue, Angular, and other frameworks
- No audio sent to external servers - all processing in browser
- Keyboard shortcuts for quick access

## 📦 Installation

### Method 1: Load Unpacked (Developer Mode)

1. Download and extract the `voice-master.zip` file
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the extracted `voice-master` folder
6. The extension is now installed!

### Method 2: Manual Installation

1. Extract all files to a folder on your computer
2. Follow the steps above to load unpacked

## 🎤 Usage

### Starting Dictation

1. **Click the floating mic** (bottom right of any page)
2. **Use keyboard shortcut:** `Ctrl+Shift+9` (or `Cmd+Shift+9` on Mac)
3. **Click the extension icon** in your browser toolbar

### Dictation Box

If a website doesn't work with direct insertion:
1. Press `Ctrl+Shift+8` to open the Dictation Box
2. Dictate into the box
3. Click "Insert Text" to paste into the target field

### Voice Commands

Built-in commands you can say:

**Punctuation:**
- "period" → .
- "comma" → ,
- "question mark" → ?
- "exclamation mark" → !
- "open quote" / "close quote" → "

**Formatting:**
- "new line" → line break
- "new paragraph" → double line break
- "tab" → tab character

**Editing:**
- "undo" → removes last dictation
- "delete word" → removes last word
- "delete two words" → removes last 2 words
- "clear all" → clears entire text
- "select all" → selects all text

**Special Characters:**
- "at sign" → @
- "hashtag" → #
- "dollar sign" → $
- "ampersand" → &

### Custom Commands

Create your own voice commands in Settings:

1. Click extension icon → Settings (gear icon)
2. Go to "Voice Commands" section
3. Add trigger phrase and replacement text
4. Example: "my email" → "yourname@example.com"

### Supported Languages

35+ languages including:
- English (US, UK, AU)
- Spanish (Spain, Mexico)
- French, German, Italian
- Portuguese (Brazil, Portugal)
- Dutch, Polish, Russian
- Japanese, Korean, Chinese
- Hindi, Arabic, Hebrew
- And many more!

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+9` | Start/Stop dictation |
| `Ctrl+Shift+8` | Toggle dictation box |

To customize shortcuts:
1. Go to `chrome://extensions/shortcuts`
2. Find "VoiceMaster"
3. Set your preferred shortcuts

## ⚙️ Settings

Access settings by:
1. Click extension icon
2. Click the gear icon (Settings)

### Available Settings

- **Language** - Set your primary dictation language
- **Idle Timeout** - 1min to Never (default: 30 minutes)
- **Advanced Mode** - Enable all text insertion strategies
- **Cross-Tab Dictation** - Continue when switching tabs
- **Case Transformation** - None, Sentence, UPPER, lower, Title
- **Profanity Filter** - Enable/disable word censoring

## 🔧 Troubleshooting

### Dictation not starting
1. Check microphone permissions in Chrome
2. Make sure no other app is using the microphone
3. Refresh the page and try again

### Text not inserting correctly
1. Try clicking directly in the text field first
2. Enable "Advanced Mode" in settings
3. Use the Dictation Box (`Ctrl+Shift+8`) as fallback

### Text being erased/overwritten
This happens on some React/Angular sites. Solutions:
1. Make sure "Advanced Mode" is enabled
2. Use the Dictation Box for these sites
3. The extension tries multiple insertion methods automatically

### Extension not working on certain sites
Some sites (like Google Docs) use special editors. Use the Dictation Box for these.

## 🔒 Privacy

- **No data collection** - All speech processing happens locally in your browser
- **No external servers** - Uses Chrome's built-in Web Speech API
- **No account required** - Works completely offline after installation
- **Minimal permissions** - Only requests what's necessary

## 📄 Technical Details

Built using:
- Chrome Web Speech API (SpeechRecognition)
- Chrome Extension Manifest V3
- Multiple text insertion strategies:
  - execCommand('insertText')
  - Input event simulation (React/Vue compatible)
  - Direct value property
  - Selection API
  - Clipboard fallback

## 🆓 Why Free?

This extension was built as an open alternative to expensive speech-to-text tools. All features that other extensions charge $60+/year for are included free!

## License

MIT License - Free to use, modify, and distribute.

---

**Enjoy unlimited voice typing! 🎤**
