const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  sendMessages: (token, recipients, message) =>
    ipcRenderer.invoke('send-discord-messages', { token, recipients, message }),
  getUserChannels: (token) =>
    ipcRenderer.invoke('get-user-channels', token),
});

console.log('✅ Preload script loaded successfully - electron API exposed');
