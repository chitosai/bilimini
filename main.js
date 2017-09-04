const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;
const utils = require('./js/utils.js');

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

// handle uncaught exception
process.on('uncaughtException', (err) => {
  console.error('主线程意外报错', err);
  utils.error(`主线程意外报错\n${err}`);
  dialog.showErrorBox('肥肠抱歉', 
    '好像似乎也许可能出现了意料之外的错误，我建议您现在关闭程序并到bilimini的根目录下找到一个名为bilimini.log的文件，并把这个文件通过电子邮件发送给我：i@thec.me。\n这份文件会帮助我了解您的程序在进行什么操作时出现了问题，因此它会包含您最近一次运行bilimini的浏览记录，如果您介意也可以选择不发送。_(:з」∠)_');
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically hen the JavaScript object is garbage collected.
var mainWindow = null, mainWindowIsClosed = null;
function openMainWindow() {
  utils.log('主窗口：开始创建');
  if( mainWindow ) {
    utils.log('主窗口：检测到主窗口已存在，正在关闭她');
    mainWindow.close();
    utils.log('主窗口：原主窗口已关闭');
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
    utils.log('主窗口：已关闭');
    // 主窗口关闭后如果3s都没有重新创建，就认为程序是被不正常退出了（例如windows下直接alt+f4），关闭整个程序
    if( platform != 'darwin' ) {
      mainWindowIsClosed = setTimeout(() => {
        utils.log('主窗口：关闭超过 3s 未重新创建，程序自动退出');
        app.quit();
      }, 3000);
    }
  });
  clearTimeout(mainWindowIsClosed);
  utils.log('主窗口：已创建');
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
  utils.log('选p窗口：开始创建');
  selectPartWindow = new electron.BrowserWindow({
    width: 200, height: 300, frame: false, show: false
  });
  selectPartWindow.loadURL('file://' + __dirname + '/selectP.html');
  selectPartWindow.setAlwaysOnTop(true, 'modal-panel');
  selectPartWindow.on('closed', () => {
    selectPartWindow = null;
    utils.log('选p窗口：已关闭');
  });
  utils.log('选p窗口：已创建');
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
  utils.log('选p窗口：打开');
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
  utils.log('设置窗口：开始创建');
  configWindow = new electron.BrowserWindow({
    width: 200, height: 200, frame: false, show: false
  });
  configWindow.loadURL('file://' + __dirname + '/config.html');
  configWindow.setAlwaysOnTop(true, 'modal-panel');
  configWindow.on('closed', () => {
    configWindow = null;
    utils.log('设置窗口：已关闭');
  });
  utils.log('设置窗口：已创建');
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
  utils.log('设置窗口：打开');
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
  ipc.on('set-proxy', () => {
    setProxy(true);
  });
}

// 更新webview代理设置
function setProxy(isUpdate) {
  var proxy = utils.config.get('proxy');
  // 如果是用户手动设置代理，那么要允许用户通过设置空白代理来删除代理，反之当初始化时忽略空白代理
  if( proxy == '' && !isUpdate ) {
    return false;
  }
  utils.log(`代理：设置代理 ${proxy}, isUpdate：${!!isUpdate}`);
  if( mainWindow ) {
    mainWindow.webContents.session.setProxy({
      proxyRules: proxy
    }, () => {
      if( isUpdate ) {
        dialog.showMessageBox({
          message: '设置代理成功'
        });
      }
      utils.log('代理：设置成功');
    });
  }
}

function init() {
  utils.log(`主线程：初始化；Platform：${process.platform}`, null, true);
  initGlobalShortcut();
  initMenu();
  initMainWindow();
  initSelectPartWindow();
  initConfigWindow();
  initActionOnMessage();
  setProxy();
  initExchangeMessageForRenderers();
  utils.log('主线程：初始化流程结束');
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
  utils.log('主线程：所有窗口关闭');
  if( platform != 'darwin' ) {
    utils.log('主线程：非OSX平台，程序即将退出');
    app.quit();
  }
});

// 菜单
function initMenu() {
  utils.log('菜单：初始化');
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
      label: 'Shortcuts',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' },
        {
          label: 'Backward',
          accelerator: 'Esc',
          click() { mainWindow.webContents.send('press-esc'); }
        }, { 
          label: 'Volume+',
          accelerator: 'Up',
          click() { mainWindow.webContents.send('change-volume', 'up'); }
        }, {
          label: 'Volume-',
          accelerator: 'Down',
          click() { mainWindow.webContents.send('change-volume', 'down'); }
        }
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
  utils.log('菜单：初始化结束');
}

// 老板键
function bindGlobalShortcut(isUpdate) {
  utils.log(`老板键：开始注册，isUpdate: ${!!isUpdate}`);
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
    utils.log('老板键：注册失败');
    dialog.showErrorBox(`修改老板键失败，「${shortcut}」可能不能用作全局快捷键或已被其他程序占用`, '');
    return false;
  } else if( isUpdate ) {
    // 通过设置页面修改快捷键成功时弹个窗提示修改成功
    dialog.showMessageBox({
      type: 'info',
      message: `修改成功，老板键已替换为「${shortcut}」`
    });
  }
  utils.log('老板键：注册成功');
}

function initGlobalShortcut() {
  ipc.on('update-hide-shortcut', (ev, args) => {
    globalShortcut.unregister(args);
    bindGlobalShortcut(true);
  });
  bindGlobalShortcut();
}