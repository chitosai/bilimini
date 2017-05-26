const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
function openMainWindow() {
  mainWindow = new electron.BrowserWindow({width: 375, height: 500, frame: false});
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.setAlwaysOnTop(true, 'torn-off-menu');
  mainWindow.on('closed', () => {
    mainWindow = null;
    if( selectPartWindow ) {
      selectPartWindow.close();
      selectPartWindow = null;
    }
  });
  // 带起来自己的分p选择页
  initSelectPartWindow();
  // mainWindow.webContents.openDevTools();
}

// 初始化交互窗口，用于设置、选分p等
let selectPartWindow = null;
function initSelectPartWindow() {
  selectPartWindow = new electron.BrowserWindow({
    width: 200, height: 300, 
    parent: mainWindow, frame: false, show: false
  });
  selectPartWindow.hide();
  selectPartWindow.loadURL('file://' + __dirname + '/selectP.html');
  selectPartWindow.on('closed', () => {
    selectPartWindow = null;
  });
  // selectPartWindow.openDevTools();
}

function openSelectPartWindow() {
  if( !mainWindow || !selectPartWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = mainWindow.getSize(),
      pos = [p[0] + s[0] + 10, p[1]];
  selectPartWindow.setPosition(pos[0], pos[1]);
  selectPartWindow.show();
}

function openSelectPartWindowOnMessage() {
  // 切换、可开可关
  ipc.on('toggle-select-part-window', () => {
    if( selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    } else {
      openSelectPartWindow();
    }
  });
  // 仅开启
  ipc.on('show-select-part-window', openSelectPartWindow);
}

function initExchangeMessageForRenderers() {
  // 转发分p数据，真的只能用这么蠢的方法实现么。。。
  ipc.on('update-part', (ev, args) => {
    if( !args && selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    }
    selectPartWindow && selectPartWindow.webContents.send('update-part', args);
  });
  // 转发番剧分p消息，这俩的格式是不一样的，分局的分p里头带了playurl
  ipc.on('update-bangumi-part', (ev, args) => {
    selectPartWindow && selectPartWindow.webContents.send('update-bangumi-part', args);
  });
  // 转发选p消息
  ipc.on('select-part', (ev, args) => {
    mainWindow && mainWindow.webContents.send('select-part', args);
  });
  // 番剧选P
  ipc.on('select-bangumi-part', (ev, args) => {
    mainWindow && mainWindow.webContents.send('select-bangumi-part', args);
  });
}

  
// mainWindow在default/mini尺寸间切换时同时移动selectPartWindow
function reposSelectPartWindowOnMainWindowResize() {
  ipc.on('main-window-resized', (ev, pos, size) => {
    selectPartWindow && selectPartWindow.setPosition((pos[0] + size[0] + 10), pos[1], true);
  });
}

function init() {
  openMainWindow();
  bindGloablShortcut();
  initMenu();
  initExchangeMessageForRenderers();
  openSelectPartWindowOnMessage();
  reposSelectPartWindowOnMainWindowResize();
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
  if( mainWindow === null ) {
    openMainWindow();
  } else {
    mainWindow.show();
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
          click() { mainWindow.webContents.openDevTools(); }
        },
        {
          label: 'Open Config Window Console',
          click() { selectPartWindow.webContents.openDevTools(); }
        },
        {
          label: 'Open Webview Console',
          click() { mainWindow.webContents.send('openWebviewDevTools'); }
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
  let shortcut = platform == 'darwin' ? 'alt+w' : 'ctrl+e';
  let bindRes = globalShortcut.register(shortcut, () => {
    if( mainWindow ) {
      if( mainWindow.isVisible() ) {
        mainWindow.hide();
        selectPartWindow && selectPartWindow.isVisible() && selectPartWindow.hide();
      } else {
        mainWindow.showInactive();
      }
    }
  });
  if( !bindRes ) {
    console.log('Fail to bind globalShortcut');
  }
}