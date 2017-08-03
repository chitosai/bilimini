const ipc = require('electron').ipcRenderer;
const remote = require('electron').remote;
const dialog = remote.dialog;
const shell = require('electron').shell;
const appData = require('./package.json');
const utils = require('./js/utils.js');
const userAgent = {
  desktop: 'bilimini Desktop like Mozilla/233 (Chrome and Safari)',
  mobile: 'bilimini Mobile like (iPhone or Android) whatever AppleWebKit/124.50 Mobile/BI233'
};
const videoUrlPrefix = 'http://www.bilibili.com/video/av';
const videoUrlPattern = /video\/av(\d+(?:\/index_\d+\.html)?(?:\/#page=\d+)?)/;
const bangumiUrl = (aid, pid) => `http://bangumi.bilibili.com/anime/${aid}/play#${pid}`;
const bangumiUrlPattern = /bangumi\/i\/(\d+)/;
let wv, wrapper;

// 保存用户浏览记录
var _history = {
  stack: ['https://m.bilibili.com/index.html'],
  pos: 0,
  go: function(target, noNewHistory) {
    // 显示loading mask
    wrapper.classList.add('loading');
    let m;
    if(m = videoUrlPattern.exec(target)) {
      // case 1 普通视频播放页，转跳对应pc页
      wv.loadURL(videoUrlPrefix + m[1], {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(videoUrlPrefix + m[1]);
      // 抓分p
      getPartOfVideo(m[1]);
      v.disableDanmakuButton = false;
      utils.log(`路由：类型① 视频详情页\n原地址：${target}\n转跳地址：${videoUrlPrefix+m[1]}`);
    } else if(m = bangumiUrlPattern.exec(target)) {
      // case 2 番剧，转跳对应pc页
      let url = bangumiUrl(m[1]);
      wv.loadURL(url, {
        userAgent: userAgent.desktop
      });
      // 因为番剧页最终目标是/blackboard/html5player.html，这里获取到的url只是中间步骤，所以就不加到history里了
      // modefied：因为存在从av号以普通视频的形式进入番剧播放页的情况，此时先以正常av号的形式add了一条历史记录，
      // inject.js用location.href触发跳转后又增加了一条/html5player.html的记录，会造成goBack失效
      // 所以放弃最初的方法，改为从anime/:bid入口进入时也临时增加一条历史记录，但在inject.js生效进行二次跳转
      // 的时候用replace删除最后一条历史记录
      _history.add(url);
      // 抓分p
      getPartOfBangumi(m[1]);
      v.disableDanmakuButton = false;
      utils.log(`路由：类型② 番剧详情页\n原地址：${target}\n转跳地址：${url}`);
    } else if(/bangumi\.bilibili\.com\/anime\/\d+\/play#\d+/.test(target)) {
      // 另一种番剧地址，这个可以直接用pc端打开播放，不用做任何处理
      wv.loadURL(target, {
        userAgent: userAgent.desktop
      });
      _history.replace(target);
      v.disableDanmakuButton = false;
      utils.log(`路由：类型③ 番剧详情页2\n原地址：${target}\n转跳地址：${target}`);
    } else {
      // 其他链接不做操作直接打开
      wv.loadURL(target, {
        userAgent: userAgent.mobile
      });
      // 我们假设html5player的页面都是通过inject.js转跳进入的，所以删除上一条历史记录来保证goBack操作的正确
      // 如果用户自己输入一个html5player的播放地址，那就管不了了
      if(target.indexOf('html5player.html') > -1) {
        _history.replace(target);
      } else {
        !noNewHistory && _history.add(target);
        // 清除分p
        ipc.send('update-part', null);
      }
      v.disableDanmakuButton = true;
      utils.log(`路由：类型④ 未归类\n原地址：${target}\n转跳地址：${target}`);
    }
  },
  goPart: function(pid) {
    let av = /av(\d+)/.exec(wv.getURL());
    if(av) {
      let url = `${videoUrlPrefix}${av[1]}/index_${pid}.html`;
      wv.loadURL(url, {
        userAgent: userAgent.desktop
      });
      _history.replace(url);
      utils.log(`路由：选择分p，选中第${pid}，转跳地址：${url}`);
    }
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

function getPartOfVideo(av) {
  utils.ajax.get(`http://m.bilibili.com/video/av${av}.html`, (res) => {
    var m = /"pageTitle":(\{.*?\})/g.exec(res);
    utils.log(`获取 av${av} 的分P数据`, m);
    if(m) {
      try {
        var data = JSON.parse(m[1]);
        ipc.send('update-part', data);
        // 有超过1p时自动开启分p窗口
        if(data[2]) {
          ipc.send('show-select-part-window');
          v.disablePartButton = false;
        }
      } catch(e) {
        ipc.send('update-part', null);
        v.disablePartButton = true;
      }
    } else {
      ipc.send('update-part', null);
      v.disablePartButton = true;
    }
  }, 'mobile');
}

function getPartOfBangumi(aid) {
  utils.ajax.get(`http://bangumi.bilibili.com/jsonp/seasoninfo/${aid}.ver?callback=seasonListCallback`, (res) => {
    var json = res.replace(/^seasonListCallback\(/, '').replace(/\);$/, '');
    try {
      var data = JSON.parse(json),
        partList = data.result.episodes.map((p) => {
          return {
            index: p.index,
            title: p.index_title,
            url: p.webplay_url
          }
        }).reverse();
      utils.log(`获取番剧 ${aid} 分P数据`, partList);
      ipc.send('update-bangumi-part', partList);
      if(partList[2]) {
        ipc.send('show-select-part-window');
        v.disablePartButton = false;
      }
    } catch(e) {
      utils.error(`分析 ${aid} 的分P数据失败\n${e}`, json);
      ipc.send('update-part', null);
      v.disablePartButton = true;
    }
  });
}

// UI逻辑
const v = new Vue({
  el: '#wrapper',
  data: {
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
      utils.log(`路由：手动输入地址 ${target}`);
      // 包含bilibili.com的字符串和纯数字是合法的跳转目标
      if(target.startsWith('http') && target.indexOf('bilibili.com') > -1) {
        _history.go(target);
        this.naviGotoHide();
      } else if(/^(\d+)$/.test(target)) {
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
      wv.executeJavaScript(`document.getElementsByName('ctlbar_danmuku_on').length`, function(result) {
        let isDanmakuOn = result == 1;
        if(isDanmakuOn) {
          wv.executeJavaScript(`document.querySelector('.bilibili-player-iconfont-danmaku-off').click()`)
        } else {
          wv.executeJavaScript(`document.querySelector('.bilibili-player-iconfont-danmaku').click()`)
        }
      });
    }
  }
});

// 给body加上platform flag
function detectPlatform() {
  if(process.platform.startsWith('win')) {
    window.platform = 'win';
    document.body.classList.add('win');
  } else if(process.platform == 'darwin') {
    window.platform = 'darwin';
    document.body.classList.add('macos');
  }
}

// 检查更新
function checkUpdateOnInit() {
  utils.ajax.get('http://rakuen.thec.me/bilimini/beacon?_t=' + new Date().getTime(), (res) => {
    var data = JSON.parse(res),
      order = 1,
      buttons = ['取消', '去下载'];
    if(window.platform == 'win') {
      order = 0;
      buttons = ['去下载', '取消'];
    }
    // 提示更新
    var lastVersionArr = data.version.split('.'),
      lastVersion = lastVersionArr[0] * 10000 + lastVersionArr[1] * 100 + lastVersionArr[2],
      currentVersionArr = appData.version.split('.'),
      currentVersion = currentVersionArr[0] * 10000 + currentVersionArr[1] * 100 + currentVersionArr[2];
    if(lastVersion > currentVersion) {
      dialog.showMessageBox(null, {
        buttons: buttons,
        message: `检查到新版本v${data.version}，您正在使用的版本是v${appData.version}，是否打开下载页面？`
      }, (res, checkboxChecked) => {
        if(res == order) {
          shell.openExternal(`https://pan.baidu.com/s/1jIHnRk6#list/path=%2Fbilimini%2Fv${data.version}`);
        }
      });
    }
    // 显示额外的公告
    if(data.announcement != '' && !localStorage.getItem(data.announcement)) {
      dialog.showMessageBox(null, {
        buttons: ['了解'],
        message: data.announcement
      }, () => {
        localStorage.setItem(data.announcement, 1);
      });
    }
  });
}

// 当用户拖拽窗口时保存窗口尺寸
function saveWindowSizeOnResize() {
  var saveWindowSizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(saveWindowSizeTimer);
    saveWindowSizeTimer = setTimeout(function() {
      // 暂时只保存视频播放页的尺寸
      if(currentWindowType == 'windowSizeMini') {
        utils.config.set(currentWindowType, [window.innerWidth, window.innerHeight]);
      }
    }, 600);
  });
}

// 根据用户访问的url决定app窗口尺寸
var currentWindowType = 'default';

function resizeMainWindow() {
  let targetWindowType, url = wv.getURL();
  if(url.indexOf('video/av') > -1 || url.indexOf('html5player.html') > -1 ||
    /\/\/live\.bilibili\.com\/h5\/\d+/.test(url)) {
    targetWindowType = 'windowSizeMini';
  } else {
    targetWindowType = 'windowSizeDefault';
  }
  if(targetWindowType != currentWindowType) {
    let mw = remote.getCurrentWindow(),
      currentSize = mw.getSize(),
      leftTopPosition = mw.getPosition(),
      rightBottomPosition = [leftTopPosition[0] + currentSize[0], leftTopPosition[1] + currentSize[1]],
      targetSize = utils.config.get(targetWindowType),
      targetPosition = [rightBottomPosition[0] - targetSize[0], rightBottomPosition[1] - targetSize[1]];

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

// 根据设置调整页面的透明度
function initSetBodyOpacity() {
  function update() {
    var opacity = utils.config.get('opacity');
    document.body.style.opacity = opacity;
  }
  ipc.on('set-opacity', update);
  update();
}

// webview跳转相关
function initActionOnWebviewNavigate() {
  // 判断是否能前进/后退
  wv.addEventListener('did-finish-load', function() {
    utils.log(`触发did-finish-load事件，当前url是${wv.getURL()}`);
    v.naviCanGoBack = _history.canGoBack();
    v.naviCanGoForward = _history.canGoForward();
    // 改变窗口尺寸
    resizeMainWindow();
    // 关闭loading遮罩
    wrapper.classList.remove('loading');
  });
  // 当用户点到视频播放页时跳到桌面版页面，桌面版的h5播放器弹幕效果清晰一点
  wv.addEventListener('will-navigate', function(e) {
    utils.log(`触发will-navigate事件，目标${e.url}`);
    _history.go(e.url);
  });
  // webview中点击target="_blank"的链接时在当前webview打开
  wv.addEventListener('new-window', function(e) {
    utils.log(`触发new-window事件，目标${e.url}`);
    _history.go(e.url);
  });
}

// 无法正常打开页面时显示错误页面
// function displayErrorPageWhenLoadFail() {
//     wv.addEventListener('did-fail-load', () => {
//         wv.loadURL('file://' + __dirname + '/error.html');
//     });
// }

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
  ipc.on('select-bangumi-part', (ev, url) => {
    _history.go(url);
  });
}

// windows下frameless window没法正确检测到mouseout事件，只能根据光标位置做个dirtyCheck了
function initMouseStateDirtyCheck() {
  // 统一改为由js判断，一旦鼠标进入主窗口的上较近才显示topbar
  var getMousePosition = remote.screen.getCursorScreenPoint,
    mw = remote.getCurrentWindow();
  setInterval(function() {
    let mousePos = getMousePosition(),
      windowPos = mw.getPosition(),
      windowSize = mw.getSize();
    if((mousePos.x > windowPos[0]) && (mousePos.x < windowPos[0] + windowSize[0]) &&
      (mousePos.y > windowPos[1]) && (mousePos.y < windowPos[1] + 0.1*windowSize[1])) {
      wrapper.classList.add('showTopBar');
    } else {
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
    // 我看console.error的level是2，那>1的就都log下来吧
    if(err.level > 1) {
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
  saveWindowSizeOnResize();
  initMouseStateDirtyCheck();
  openWebviewConsoleOnMenuClick();
  redirectOnSelectPart();
  initSetBodyOpacity();
  logWebviewError();
});

window.onerror = function(err, f, line) {
  var id = f.split('/');
  utils.error(`${id[id.length-1]} : Line ${line}\n> ${err}`);
}
