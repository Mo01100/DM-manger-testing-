const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  console.log('Loading URL:', startUrl);
  console.log('Preload path:', path.join(__dirname, 'preload.js'));
  
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for Discord API
ipcMain.handle('send-discord-messages', async (event, { token, recipients, message }) => {
  try {
    const axios = require('axios');
    
    for (const recipientId of recipients) {
      await axios.post(
        `https://discord.com/api/v10/channels/${recipientId}/messages`,
        { content: message },
        { headers: { Authorization: `Bot ${token}` } }
      );
    }
    
    return { success: true, count: recipients.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-user-channels', async (event, token) => {
  try {
    const axios = require('axios');
    const response = await axios.get('https://discord.com/api/v10/users/@me/channels', {
      headers: { Authorization: `Bot ${token}` },
    });
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
});
