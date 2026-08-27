const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  if (session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        if (sources.length > 0) {
          callback({ video: sources[0] });
        } else {
          callback({});
        }
      }).catch(err => {
        console.error(err);
        callback({});
      });
    });
  }

  // Handle getting screen / window sources with high resolution thumbnails
  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 3840, height: 2160 },
        fetchWindowIcons: true
      });
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
      }));
    } catch (e) {
      console.error('get-desktop-sources error:', e);
      return [];
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});