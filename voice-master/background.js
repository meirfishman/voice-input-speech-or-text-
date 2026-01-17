// VoiceMaster Background Service Worker - Simple & Stable

let isRecording = false;

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  
  if (command === 'toggle-dictation') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleDictation' }).catch(() => {});
  } else if (command === 'toggle-dictation-box') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleDictationBox' }).catch(() => {});
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startDictation') {
    isRecording = true;
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else if (message.action === 'stopDictation') {
    isRecording = false;
    chrome.action.setBadgeText({ text: '' });
  } else if (message.action === 'getState') {
    sendResponse({ isRecording });
    return true;
  }
  
  sendResponse({ ok: true });
  return true;
});

console.log('VoiceMaster background loaded');
