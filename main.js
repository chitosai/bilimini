const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const shortcut = electron.globalShortcut;

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mw = null;

function openMainWindow() {
  mw = new electron.BrowserWindow({width: 375, height: 500, frame: false});
  mw.loadURL('file://' + __dirname + '/index.html');
  mw.setAlwaysOnTop(true, 'torn-off-menu');
  mw.on('closed', () => {
    mw = null;
  });
  mw.webContents.openDevTools();
}

function init() {
  openMainWindow();
  bindGloablShortcut();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if( process.platform !== 'darwin' ) {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if( mw === null ) {
    openMainWindow();
  } else {
    mw.show();
  }
});

// 老板键
function bindGloablShortcut() {
  shortcut.register('alt+p', () => {
    if( !mw ) return false;
    if( mw.isVisible() ) {
      mw.hide();
    } else {
      mw.showInactive();
    }
  });
}