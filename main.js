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
    iw.close();
    iw = null;
  });
  // 带起来自己的interactiveWindow
  initInteractiveWindow();
  // mw.webContents.openDevTools();
}

// 初始化交互窗口，用于设置、选分p等
let iw = null;
function initInteractiveWindow() {
  iw = new electron.BrowserWindow({
    width: 200, height: 300, 
    parent: mw, frame: false, show: false
  });
  iw.loadURL('file://' + __dirname + '/interactive.html');
  // iw.openDevTools();
}

function openInteractiveWindow() {
  if( !mw || !iw ) {
    return;
  }
  var p = mw.getPosition(), s = mw.getSize(),
      pos = [p[0] + s[0] + 10, p[1]];
  iw.setPosition(pos[0], pos[1]);
  iw.show();
}

function openInteractiveWindowOnMessage() {
  // 切换、可开可关
  ipc.on('toggle-interactive-window', () => {
    if( iw && iw.isVisible() ) {
      iw.hide();
    } else {
      openInteractiveWindow();
    }
  });
  // 仅开启
  ipc.on('show-interactive-window', openInteractiveWindow);
}

function initExchangeMessageForRenderers() {
  // 转发分p数据，真的只能用这么蠢的方法实现么。。。
  ipc.on('update-part', (ev, args) => {
    if( !args && iw && iw.isVisible() ) {
      iw.hide();
    }
    iw && iw.webContents.send('update-part', args);
  });
  // 转发番剧分p消息，这俩的格式是不一样的，分局的分p里头带了playurl
  ipc.on('update-bangumi-part', (ev, args) => {
    iw && iw.webContents.send('update-bangumi-part', args);
  });
  // 转发选p消息
  ipc.on('select-part', (ev, args) => {
    mw && mw.webContents.send('select-part', args);
  });
  // 番剧选P
  ipc.on('select-bangumi-part', (ev, args) => {
    mw && mw.webContents.send('select-bangumi-part', args);
  });
}

  
// mainWindow在default/mini尺寸间切换时同时移动interactiveWindow
function reposInteractiveWindowOnMainWindowResize() {
  ipc.on('main-window-resized', (ev, pos, size) => {
    iw && iw.setPosition((pos[0] + size[0] + 10), pos[1], true);
  });
}

function init() {
  openMainWindow();
  bindGloablShortcut();
  initMenu();
  initInteractiveWindow();
  initExchangeMessageForRenderers();
  openInteractiveWindowOnMessage();
  reposInteractiveWindowOnMainWindowResize();
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
          label: 'Open Main Window Console',
          click() { mw.webContents.openDevTools(); }
        },
        {
          label: 'Open Config Window Console',
          click() { iw.webContents.openDevTools(); }
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