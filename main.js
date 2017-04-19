const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;

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
  // mw.webContents.openDevTools();
}

function init() {
  openMainWindow();
  bindGloablShortcut();
  initMenu();
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

// 菜单
function initMenu() {
  // 本来我们是不需要菜单的，但是因为mac上app必须有菜单，所以只在mac上做一下
  if( platform != 'darwin' ) return;
  var template = [{
      label: app.getName(),
      submenu: [
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }, {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    }, {
      label: 'Debug',
      submenu: [
        {
          label: 'Open Renderrer Console',
          click() { mw.webContents.openDevTools(); }
        },
        {
          label: 'Open Webview Console',
          click() { mw.webContents.send('openWebviewDevTools'); }
        }
      ]
    }, {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 老板键
function bindGloablShortcut() {
  let shortcut = platform == 'win' ? 'ctrl+e' : 'alt+w';
  let bindRes = globalShortcut.register(shortcut, () => {
    if( !mw ) return false;
    if( mw.isVisible() ) {
      mw.hide();
    } else {
      mw.showInactive();
    }
  });
  if( !bindRes ) {
    console.log('Fail to bind globalShortcut');
  }
}