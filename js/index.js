const ipc = require('electron').ipcRenderer;
const remote = require('electron').remote;
const dialog = remote.dialog;
const shell = require('electron').shell;
const appData = require('./package.json');
const utils = require('./js/utils.js');
const userAgent = {
  desktop: 'bilimini Desktop like Mozilla/233 (Windows NT or OSX) AppleWebKit like Gecko or not (Chrome and Safari both OK)',
  mobile: 'bilimini Mobile like (iPhone or Android) whatever AppleWebKit/124.50 Mobile/BI233'
};
const videoUrlPrefix = 'https://www.bilibili.com/video/';
const liveUrlPrefix  = 'https://live.bilibili.com/blanc/';
let wv, wrapper;

// 保存用户浏览记录
let _lastNavigation = new Date();
var _history = {
  stack: ['https://m.bilibili.com/index.html'],
  pos: 0,
  lastTarget: '', // 这是最后一次传入go方法的url
  lastLoadedUrl: '', // 这是最后一次webview实际加载完成的url，这个是在下面webview的did-finish-load事件的时候更新的
  go: function(target, noNewHistory) {
    // 防止重复加载同页面
    if( target == _history.lastTarget ) {
      // utils.log(`代码尝试重复加载页面：${target}`);
      return false;
    }
    _history.lastTarget = target;
    // 显示loading mask
    wrapper.classList.add('loading');
    let vid = utils.getVidWithP(target);
    let live;
    // 如果两次转跳的时间间隔小于3s，就认为是B站发起的redirect
    // 这时为保证后退时不会陷入循环，手动删除一条历史
    const now = new Date();
    if( now - _lastNavigation < 3000 ) {
      utils.log('两次转跳间隔小于3s，疑似redirect');
      _history.pop();
    }
    _lastNavigation = now;
    if( vid ) {
      // case 1 普通视频播放页，转跳对应pc页
      wv.loadURL(videoUrlPrefix + vid, {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(videoUrlPrefix + vid);
      v.disableDanmakuButton = false;
      utils.log(`路由：类型① 视频详情页\n原地址：${target}\n转跳地址：${videoUrlPrefix+vid}`);
    } else if( target.indexOf('bangumi/play/') > -1 ) {
      // case 2 番剧播放页
      wv.loadURL(target, {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(target);
      v.disableDanmakuButton = false;
      utils.log(`路由：类型② 番剧播放页\n地址：${target}`);
    } else if ( live = /live\.bilibili\.com\/(h5\/||blanc\/)?(\d+).*/.exec(target) ) {
      wv.loadURL(liveUrlPrefix + live[2], {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(liveUrlPrefix + live[2]);
      v.disableDanmakuButton = false;
      utils.log(`路由：类型③ 直播页面\n原地址：${target}\n转跳地址：${liveUrlPrefix+live[2]}`);
    } else {
      // 其他链接不做操作直接打开
      wv.loadURL(target, {
        userAgent: userAgent.mobile
      });
      !noNewHistory && _history.add(target);
      // 清除分p
      ipc.send('update-part', null);
      v.disableDanmakuButton = true;
      utils.log(`路由：类型④ 未归类\n原地址：${target}\n转跳地址：${target}`);
    }
  },
  goPart: function(pid) {
    wrapper.classList.add('loading');
    // 因为utils.getVidWithP返回的地址是通用的，里面可能已经带了/?p=，所以这里我们单独获取吧
    const vid = utils.getVid(wv.getURL());
    if(vid) {
      let url = `${videoUrlPrefix}${vid}/?p=${pid}`;
      wv.loadURL(url, {
        userAgent: userAgent.desktop
      });
      _history.replace(url);
      utils.log(`路由：选择分p，选中第${pid}，转跳地址：${url}`);
    }
  },
  goBangumiPart(ep) {
    utils.log(`路由：选择番剧分p`);
    _history.go(videoUrlPrefix + ep.bvid);
  },
  add: function(url) {
    // 丢掉当前位置往后的history
    _history.stack.length = _history.pos + 1;
    _history.stack.push(url);
    _history.pos++;
  },
  replace: function(url) {
    _history.stack[_history.stack.length - 1] = url;
  },
  pop: function() {
    _history.stack.pop();
    _history.pos--;
  },
  goBack: function() {
    if(!_history.canGoBack()) {
      return false;
    }
    utils.log('路由：后退');
    _history.go(_history.stack[--_history.pos], true);
  },
  goForward: function() {
    if(!_history.canGoForward()) {
      return false;
    }
    utils.log('路由：前进');
    _history.go(_history.stack[++_history.pos], true);
  },
  canGoBack: function() {
    return _history.pos > 0;
  },
  canGoForward: function() {
    return _history.pos + 1 < _history.stack.length;
  }
};

function getPartOfVideo(vid) {
  utils.ajax.get(videoUrlPrefix + vid, (res = '') => {
    // 分 P 信息存储在 window.__INITIAL_STATE__= 中 根据 object 类型的特性最后一个 } 后面不会有 , ] } 使用正则匹配
    const match = res.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\})[^,\]\}]/m)
    if (!match[1]) {
      utils.log('获取番剧分p数据失败', res);
      return false;
    }
    const json = JSON.parse(match[1]);
    let parts;
    try {
      parts = json.videoData.pages;
    } catch(err) {
      utils.log(`解析视频分p失败：${err}`, json);
      return false;
    }
    utils.log(`获取视频 ${vid} 的分P数据成功`);
    if( parts.length ) {
      ipc.send('update-part', parts.map(p => p.part));
      // 有超过1p时自动开启分p窗口
      if( parts.length > 1 ) {
        ipc.send('show-select-part-window');
        v.disablePartButton = false;
      }
    } else {
      ipc.send('update-part', null);
      v.disablePartButton = true;
    }
  });
}

function getPartOfBangumi(url) {
  utils.ajax.get(url, (res = '') => {
    // 分 P 信息存储在 window.__INITIAL_STATE__= 中 根据 object 类型的特性最后一个 } 后面不会有 , ] } 使用正则匹配
    const match = res.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\})[^,\]\}]/m)
    if (!match[1]) {
      utils.log('获取番剧分p数据失败', res);
      return false;
    }
    const json = JSON.parse(match[1]);
    let parts;
    let currentPartId = 0;
    try {
      parts = json.epList;
      currentPartId = json.epInfo.i;
    } catch(err) {
      utils.log(`解析番剧分p失败：${err}`, json);
      return false;
    }
    utils.log(`获取番剧 ${url} 的分P数据成功`);
    if( parts.length ) {
      ipc.send('update-bangumi-part', {
        currentPartId,
        parts: parts.map(p => {
          return {
            epid: p.i,
            aid: p.aid,
            bvid: p.bvid,
            title: p.longTitle
          };
        })
      });
      if( parts.length > 1 ) {
        ipc.send('show-select-part-window');
        v.disablePartButton = false;
      }
    } else {
      ipc.send('update-part', null);
      v.disablePartButton = true;
    }
  });
}

// UI逻辑
const v = new Vue({
  el: '#wrapper',
  data: {
    version: remote.app.getVersion(),
    naviGotoTarget: '',
    naviGotoInputShow: false,
    naviCanGoBack: false,
    naviCanGoForward: false,
    showNaviGotoOverlay: false,
    showAboutOverlay: false,
    disableDanmakuButton: true,
    disablePartButton: true
  },
  methods: {
    // 后退
    naviBack: function() {
      _history.goBack();
    },
    // 前进
    naviForward: function() {
      _history.goForward();
    },
    // 回到首页
    naviGoHome: function() {
      _history.go('https://m.bilibili.com/index.html');
    },
    // 通过url或av号跳转
    naviGotoShow: function() {
      this.naviGotoTarget = '';
      this.naviGotoInputShow = true;
      this.showNaviGotoOverlay = true;
      document.getElementById('av-input').focus();
    },
    naviGotoHide: function() {
      this.naviGotoInputShow = this.showNaviGotoOverlay = false;
    },
    naviGoto: function() {
      var target = this.naviGotoTarget;
      let lv;
      utils.log(`路由：手动输入地址 ${target}`);
      // 包含bilibili.com的字符串和纯数字是合法的跳转目标
      if(target.startsWith('http') && target.indexOf('bilibili.com') > -1) {
        // 直接输入url
        _history.go(target);
        this.naviGotoHide();
      } else if (lv = /^lv(\d+)$/.exec(target)) {
        // 直播
        _history.go(liveUrlPrefix + lv[1]);
        this.naviGotoHide();
      } else if(/^(\d+)$/.test(target)) {
        // 纯数字是av号
        _history.go(videoUrlPrefix + 'av' + target);
        this.naviGotoHide();
      } else if(/^(BV\w+)/.test(target)) {
        // BV号
        _history.go(videoUrlPrefix + target);
        this.naviGotoHide();
      } else {
        // not a valid input
        alert('你确定输入的是b站链接或者av号吗？');
      }
    },
    // 关于
    showAbout: function() {
      utils.log('主窗口：点击关于');
      this.showAboutOverlay = !this.showAboutOverlay;
      wrapper.classList.toggle('showAbout');
    },
    hideAbout: function() {
      this.showAboutOverlay = false;
      wrapper.classList.remove('showAbout');
    },
    // 召唤选p窗口
    toggleSelectPartWindow: function() {
      if(this.disablePartButton) {
        return false;
      }
      utils.log('主窗口：点击P');
      ipc.send('toggle-select-part-window');
    },
    // 进入订阅
    showFeed() {
      utils.log('主窗口：点击订阅');
      _history.go('https://t.bilibili.com/?tab=8');
    },
    // 设置窗口
    toggleConfig: function() {
      utils.log('主窗口：点击设置');
      ipc.send('toggle-config-window');
    },
    // 关鸡 - 在osx下仅关闭当前窗口，在windows下直接退出整个程序
    turnOff: function() {
      utils.log('主窗口：点击退出');
      ipc.send('close-main-window');
    },
    // 显示、隐藏弹幕快捷键
    // pull request #1. Thanks to bumaociyuan
    toggleDanmaku: function() {
      if(this.disableDanmakuButton) {
        return false;
      }
      utils.log('主窗口：点击弹幕开关');
      // 2018-12-05 适配最新B站弹幕开关
      wv.executeJavaScript(`document.querySelector('.bilibili-player-video-danmaku-switch .bui-switch-input').click()`);
    }
  }
});

// 给body加上platform flag
function detectPlatform() {
  if( process.platform.startsWith('win') ) {
    window.platform = 'win';
    document.body.classList.add('win');
  } else if( process.platform == 'darwin' ) {
    window.platform = 'darwin';
    document.body.classList.add('macos');
  }
}

// 检查更新
function checkUpdateOnInit() {
  const now = new Date();
  const today = `${now.getFullYear()}/${now.getMonth()}/${now.getDate()}`; // 每一天只检查一次更新
  const lastCheckUpdateDate = utils.config.get('lastCheckUpdateDate');
  if( today == lastCheckUpdateDate ) {
    return;
  }
  utils.ajax.get('http://rakuen.thec.me/bilimini/beacon?_t=' + new Date().getTime(), (res) => {
    var data = JSON.parse(res),
      order = 1,
      buttons = ['取消', '去下载'];
    // already checked today
    utils.config.set('lastCheckUpdateDate', today);
    if(window.platform == 'win') {
      order = 0;
      buttons = ['去下载', '取消'];
    }
    // 提示更新
    var lastVersionArr = data.version.split('.'),
      lastVersion = lastVersionArr[0] * 10000 + lastVersionArr[1] * 100 + lastVersionArr[2],
      currentVersionArr = appData.version.split('.'),
      currentVersion = currentVersionArr[0] * 10000 + currentVersionArr[1] * 100 + currentVersionArr[2];
    if( lastVersion > currentVersion ) {
      dialog.showMessageBox(null, {
        buttons: buttons,
        message: `检查到新版本v${data.version}，您正在使用的版本是v${appData.version}，是否打开下载页面？`
      }, (res, checkboxChecked) => {
        if(res == order) {
          shell.openExternal(`https://github.com/chitosai/bilimini/releases/tag/v${data.version}`);
        }
      });
    }
    // 显示额外的公告
    if( data.announcement && data.announcement != '' && !localStorage.getItem(data.announcement) ) {
      dialog.showMessageBox(null, {
        buttons: ['了解'],
        message: data.announcement
      }, () => {
        localStorage.setItem(data.announcement, 1);
      });
    }
  });
}

// 当用户缩放窗口时保存窗口尺寸
function saveWindowSizeOnResize() {
  var saveWindowSizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(saveWindowSizeTimer);
    saveWindowSizeTimer = setTimeout(function() {
      const currentSize = utils.config.get(currentWindowType);
      const newSize = [window.innerWidth, window.innerHeight];
      if( (currentSize[0] != newSize[0]) || (currentSize[1] != newSize[1]) ) {
        utils.config.set(currentWindowType, newSize);
      }
    }, 600);
  });
}

// 根据用户访问的url决定app窗口尺寸
var currentWindowType = 'default';

function resizeMainWindow() {
  let targetWindowType, url = wv.getURL();
  if( url.indexOf('/video/') > -1 || url.indexOf('html5player.html') > -1 ||
    /\/\/live\.bilibili\.com\/blanc\/\d+/.test(url) || url.indexOf('bangumi/play/') > -1 ) {
    targetWindowType = 'windowSizeMini';
  } else if( url.indexOf('t.bilibili.com/?tab=8') > -1 ) {
    targetWindowType = 'windowSizeFeed';
  } else {
    targetWindowType = 'windowSizeDefault';
  }
  if( targetWindowType != currentWindowType ) {
    let mw = remote.getCurrentWindow(),
      currentSize = mw.getSize(),
      leftTopPosition = mw.getPosition(),
      rightBottomPosition = [leftTopPosition[0] + currentSize[0], leftTopPosition[1] + currentSize[1]],
      targetSize = utils.config.get(targetWindowType),
      targetPosition = [rightBottomPosition[0] - targetSize[0], rightBottomPosition[1] - targetSize[1]];
    
    // 原先只考虑了一块屏幕的情况，其实有副屏时x轴是有可能为负数的
    // 所以我们取一个简单的方法，只有一块屏幕时鼠标最小坐标是0，窗口不可能被拖到x<-width的位置上。所以如果这个窗口的x小于-width，那一定是被拖到副屏上了
    // 只有在他的x处于[-width, 10]之间时，此时窗口应该横跨在左右两块屏幕的交界上，这时我们强行把窗口挪到主屏的x=10位置
    if (targetPosition[0] > -targetSize[0] && targetPosition[0] < 10) {
      targetPosition[0] = 10;
    }
    targetPosition[1] = targetPosition[1] > 10 ? targetPosition[1] : 10;

    mw.setBounds({
      x: targetPosition[0],
      y: targetPosition[1],
      width: targetSize[0],
      height: targetSize[1]
    }, true);

    currentWindowType = targetWindowType;

    // 通知设置窗口改变位置
    ipc.send('main-window-resized', targetPosition, targetSize);
  }
}

// webview跳转相关
function initActionOnWebviewNavigate() {
  let _lastVid = 0;
  // 判断是否能前进/后退
  wv.addEventListener('did-finish-load', function() {
    let url = wv.getURL();
    utils.log(`触发 did-finish-load 事件，当前url是: ${url}`);
    v.naviCanGoBack = _history.canGoBack();
    v.naviCanGoForward = _history.canGoForward();
    // 把当前webview的实际url记录下来
    _history.lastLoadedUrl = url;
    // 改变窗口尺寸
    resizeMainWindow();
    // 关闭loading遮罩
    wrapper.classList.remove('loading');
    // 根据url格式判断是获取普通分p还是番剧分p
    const vid = utils.getVid(url);
    if( vid ) {
      // 现在存在同一个视频自动跳下一p的可能，这时也会触发路由重新加载页面，但是这时不应该重新获取分p数据
      if (vid !== _lastVid) {
        getPartOfVideo(vid);
        _lastVid = vid;
      }
    } else if( url.indexOf('bangumi/play/') > -1 ) {
      getPartOfBangumi(url);
    }
    ipc.send('url-changed', url);
  });
  wv.addEventListener('will-navigate', function(e) {
    if( e.url.startsWith('bilibili://') ) {
      utils.log(`网页端尝试拉起App: ${e.url}`);
      e.preventDefault();
      return false;
    } else {
      utils.log(`触发 will-navigate 事件，目标: ${e.url}`);
      _history.go(e.url);
    }
  });
  // b站mobile版看起来是改用pushstate做单页应用了，没法从webview上监听到will-navigate事件了
  // 只能祭出古老的dirty check了
  setInterval(function() {
    const nowUrl = wv.getURL();
    // 用新url和history堆栈的最后一个记录作对比，如果不同就说明webview里加载了新页面
    // lastLoadedUrl是为了防止在后退操作时，_history中的堆栈已经改变了，但是webview因为还没有加载完成，被dirtycheck检测到url和_history
    // 的最后一条数据对不上，而再次调用_history.go方法造成无法后退的情况
    if( nowUrl != _history.stack[_history.pos] && nowUrl != _history.lastLoadedUrl ) {
      utils.log(`Dirty-check检测到Webview的url改变，目标: ${nowUrl}`);
      _history.go(nowUrl);
    }
  }, 500);
  // webview中点击target="_blank"的链接时在当前webview打开
  wv.addEventListener('new-window', function(e) {
    utils.log(`触发 new-window 事件，目标: ${e.url}`);
    _history.go(e.url);
  });
}

// 点击菜单「webview console」时打开webview
function openWebviewConsoleOnMenuClick() {
  ipc.on('openWebviewDevTools', () => {
    wv.openDevTools();
  });
}

// 收到选p消息时跳p
function redirectOnSelectPart() {
  ipc.on('select-part', (ev, pid) => {
    _history.goPart(pid);
  });
  ipc.on('select-bangumi-part', (ev, ep) => {
    _history.goBangumiPart(ep);
  });
}

// 按下ESC键
function initActionOnEsc() {
  ipc.on('press-esc', (ev) => {
    let url = wv.getURL();
    // 如果在播放页按下esc就触发后退
    if( utils.getVidWithP(url) || url.indexOf('bangumi/play') > -1 ) {
      utils.log('在播放器页面按下ESC，后退至上一页');
      _history.goBack();
    }
  });
}

// 用户按↑、↓键时，把事件传递到webview里去实现修改音量功能
function initWebviewVolumeContrlShortcuts() {
  ipc.on('change-volume', (ev, arg) => {
    wv.send('change-volume', arg);
  });
}

// 用户按老板键触发隐藏时自动停止播放视频
function initActionOnBossButtonPressed() {
  ipc.on('hide-hide-hide', () => {
    if (utils.config.get('autoPause')) {
      wv.send('hide-hide-hide');
    }
  });
}

// windows下frameless window没法正确检测到mouseout事件，只能根据光标位置做个dirtyCheck了
function initMouseStateDirtyCheck() {
  // 统一改为由js判断，一旦鼠标进入主窗口的上较近才显示topbar
  var getMousePosition = remote.screen.getCursorScreenPoint,
    mw = remote.getCurrentWindow(), 
    lastStatus = 'OUT';
  setInterval(function() {
    let mousePos = getMousePosition(),
      windowPos = mw.getPosition(),
      windowSize = mw.getSize();
    // 在窗口最右边留出滚动条的宽度，用户操作滚动条时不会触发showTopbar；
    // 但是如果showTopbar已经触发，即用户已经在操作工具栏了，那么就暂时屏蔽这个规则
    function getTriggerAreaWidth() {
      return lastStatus == 'IN' ? 0 : 16;
    }
    // 如果topbar已经下来了，就主动把触发区域变高一点，防止鼠标稍微向下滑动就触发收起
    function getTriggerAreaHeight() {
      let h = 0.1 * windowSize[1],
          minHeight = lastStatus == 'IN' ? 120 : 36; 
      return h > minHeight ? h : minHeight;
    }
    if( (mousePos.x > windowPos[0]) && (mousePos.x < windowPos[0] + windowSize[0] - getTriggerAreaWidth()) &&
        (mousePos.y > windowPos[1]) && (mousePos.y < windowPos[1] + getTriggerAreaHeight()) ) {
      if( lastStatus == 'OUT' ) {
        wrapper.classList.add('showTopBar');
        lastStatus = 'IN';
      }
    } else if( lastStatus == 'IN' ) {
      lastStatus = 'OUT';
      wrapper.classList.remove('showTopBar');
    }
  }, 200);
}

// 外链
function openExternalLink(url) {
  shell.openExternal(url);
}

// 把webview里的报错信息log下来
function logWebviewError() {
  wv.addEventListener('console-message', (err) => {
    // 目测 0 = verbose 1 = info 2 = warning 3 = error
    if(err.level > 2) {
      utils.error(`Webview报错\nLine ${err.line}: ${err.message}\nwebview当前url: ${wv.getURL()}`)
    }
  });
}

window.addEventListener('DOMContentLoaded', function() {
  wrapper = document.getElementById('wrapper');
  wv = document.getElementById('wv');
  detectPlatform();
  checkUpdateOnInit();
  initActionOnWebviewNavigate();
  initActionOnEsc();
  initActionOnBossButtonPressed();
  initWebviewVolumeContrlShortcuts();
  saveWindowSizeOnResize();
  initMouseStateDirtyCheck();
  openWebviewConsoleOnMenuClick();
  redirectOnSelectPart();
  logWebviewError();
});

window.onerror = function(err, f, line) {
  var id = f.split('/');
  utils.error(`${id[id.length-1]} : Line ${line}\n> ${err}`);
}
