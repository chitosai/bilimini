const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;
const utils = require('./js/utils.js');

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
function openMainWindow() {
  if( mainWindow ) {
    mainWindow.close();
  }
  // 根据透明度设置决定是否要创建transparent窗口
  // 不论在windows还是在mac下，正常窗口都会比transparent窗口多一个好看的阴影
  // 所以我们不希望为了方便始终使用transparent
  var opacity = utils.config.get('opacity'),
      windowParams = {width: 375, height: 500, frame: false};
  if( opacity < 1 ) {
    windowParams.transparent = true;
  }
  mainWindow = new electron.BrowserWindow(windowParams);
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.setAlwaysOnTop(true, 'torn-off-menu');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  // mainWindow.webContents.openDevTools();
}

function initMainWindow() {
  ipc.on('recreate-main-window', openMainWindow);
  ipc.on('close-main-window', () => {
    if( platform == 'darwin' ) {
      mainWindow.close();
      selectPartWindow.hide();
      configWindow.hide();
    } else {
      app.quit();
    }
  });
  openMainWindow();
}

// 初始化选分p窗口
var selectPartWindow = null;
function initSelectPartWindow() {
  selectPartWindow = new electron.BrowserWindow({
    width: 200, height: 300, frame: false, show: false
  });
  selectPartWindow.loadURL('file://' + __dirname + '/selectP.html');
  selectPartWindow.on('closed', () => {
    selectPartWindow = null;
  });
  // 切换、可开可关
  ipc.on('toggle-select-part-window', () => {
    if( selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    } else {
      showSelectPartWindow();
    }
  });
  // 仅开启
  ipc.on('show-select-part-window', showSelectPartWindow);
  // selectPartWindow.openDevTools();
}

function showSelectPartWindow() {
  if( !mainWindow || !selectPartWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = mainWindow.getSize(),
      pos = [p[0] + s[0] + 10, p[1]];
  selectPartWindow.setPosition(pos[0], pos[1]);
  selectPartWindow.show();
}

// 初始化设置窗口
var configWindow = null;
function initConfigWindow() {
  configWindow = new electron.BrowserWindow({
    width: 200, height: 200, frame: false, show: false
  });
  configWindow.loadURL('file://' + __dirname + '/config.html');
  configWindow.on('closed', () => {
    configWindow = null;
  });
  // 切换、可开可关
  ipc.on('toggle-config-window', () => {
    if( configWindow && configWindow.isVisible() ) {
      configWindow.hide();
    } else {
      showConfigWindow();
    }
  });
  // 仅开启
  ipc.on('show-config-window', showConfigWindow);
  // configWindow.openDevTools();
}

function showConfigWindow() {
  if( !mainWindow || !configWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = configWindow.getSize(),
      pos = [p[0] - s[0] - 10, p[1]];
  configWindow.setPosition(pos[0], pos[1]);
  configWindow.show();
}

function initExchangeMessageForRenderers() {
  // 转发分p数据，真的只能用这么蠢的方法实现么。。。
  ipc.on('update-part', (ev, args) => {
    if( !args && selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    } else {
      selectPartWindow && selectPartWindow.webContents.send('update-part', args);
    }
  });
  // 转发番剧分p消息，这俩的格式是不一样的，番剧的分p里带了playurl
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
  // 设置主窗口透明度
  ipc.on('set-opacity', () => {
    mainWindow && mainWindow.webContents.send('set-opacity');
  });
}

// 当主窗口收到各种消息时的反应
function initActionOnMessage() {
  // mainWindow在default/mini尺寸间切换时同时移动selectPartWindow
  ipc.on('main-window-resized', (ev, pos, size) => {
    if( selectPartWindow.isVisible() ) {
      showSelectPartWindow();
    }
    if( configWindow.isVisible() ) {
      showConfigWindow();
    }
  });
  // 用户设置proxy时更新session代理
  ipc.on('set-proxy', setProxy)
}

// 更新webview代理设置
function setProxy(isUpdate) {
  var proxy = utils.config.get('proxy');
  // 如果是用户手动设置代理，那么要允许用户通过设置空白代理来删除代理，反之当初始化时忽略空白代理
  if( proxy == '' && !isUpdate ) {
    return false;
  }
  if( mainWindow ) {
    mainWindow.webContents.session.setProxy({
      proxyRules: proxy
    }, () => {
      if( isUpdate ) {
        dialog.showMessageBox({
          message: '设置代理成功'
        });
      }
    });
  }
}

function init() {
  initGlobalShortcut();
  initMenu();
  initMainWindow();
  initSelectPartWindow();
  initConfigWindow();
  initActionOnMessage();
  setProxy();
  initExchangeMessageForRenderers();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init);

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if( mainWindow === null ) {
    openMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  if( platform != 'darwin' ) {
    app.quit();
  }
});

// 菜单
function initMenu() {
  // 本来我们是不需要菜单的，但是因为mac上app必须有菜单，所以只在mac上做一下
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
          label: 'Inspect Main Window',
          accelerator: 'CmdOrCtrl+1',
          click() { mainWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Select Part Window',
          accelerator: 'CmdOrCtrl+2',
          click() { selectPartWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Config Window',
          accelerator: 'CmdOrCtrl+3',
          click() { configWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Webview',
          accelerator: 'CmdOrCtrl+4',
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
function bindGlobalShortcut(isUpdate) {
  var shortcut = utils.config.get('hideShortcut');
  let bindRes = globalShortcut.register(shortcut, () => {
    if( mainWindow ) {
      if( mainWindow.isVisible() ) {
        mainWindow.hide();
        selectPartWindow && selectPartWindow.isVisible() && selectPartWindow.hide();
        configWindow && configWindow.isVisible() && configWindow.hide();
      } else {
        mainWindow.showInactive();
      }
    } else {
      openMainWindow();
    }
  });
  if( !bindRes ) {
    dialog.showErrorBox(`修改老板键失败，「${shortcut}」可能不能用作全局快捷键或已被其他程序占用`, '');
  } else if( isUpdate ) {
    // 通过设置页面修改快捷键成功时弹个窗提示修改成功
    dialog.showMessageBox({
      type: 'info',
      message: `修改成功，老板键已替换为「${shortcut}」`
    });
  }
}

function initGlobalShortcut() {
  ipc.on('update-hide-shortcut', (ev, args) => {
    globalShortcut.unregister(args);
    bindGlobalShortcut(true);
  });
  bindGlobalShortcut();
}