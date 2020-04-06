const ipc = require('electron').ipcRenderer;

window.addEventListener('DOMContentLoaded', function() {
  // 默认字体设置
  let fontFamilyCss = document.createElement('style');
  fontFamilyCss.type = 'text/css';
  fontFamilyCss.innerHTML = "html{font-family:'Helvetica Neue', Helvetica, 'Hiragino Sans GB', 'Segoe UI', 'Microsoft Yahei', Tahoma, Arial, STHeiti, sans-serif}"
  document.head.appendChild(fontFamilyCss);

  // 首页、分区首页支持多列
  if( /bilibili\.com\/index\.html$/.test(window.location.href) || /\/channel\/\d+\.html$/.test(window.location.href) ) {
    let css = document.createElement('style');
    css.type = 'text/css';
    css.innerHTML = "@media (min-width: 840px) { .index__item__src-commonComponent-Item-{ width: 33%; } }" + 
                    "@media (min-width: 1040px) { .index__item__src-commonComponent-Item-{ width: 25%; } }" +
                    "@media (min-width: 1240px) { .index__item__src-commonComponent-Item-{ width: 20%; } }";
    document.head.appendChild(css);
  }

  // 普通视频页：自动最大化播放器
  else if( window.location.href.indexOf('video/av') > -1 || 
      window.location.href.indexOf('video/BV') > -1 ||
      window.location.href.indexOf('html5player.html') > -1 ||
      window.location.href.indexOf('bangumi/play/') > -1 ) {
    let playerInitCheck = setInterval(() => {
      let wideScreenButton;
      if( wideScreenButton = document.querySelector('[class*="bilibili-player-iconfont-web-fullscreen"]') ) {
        wideScreenButton.click();
        // 隐藏全屏播放器（在某些情况下会出现）的滚动条
        document.body.style.overflow = 'hidden';
        // 从app层面把 上、下 按键传进来，方便播放器控制音量
        ipc.on('change-volume', (ev, arg) => {
          let event = new KeyboardEvent('keydown', {
            bubbles: true
          });
          // 傻逼玩意儿which和keycode因为deprecated变成只读了，替代的属性又还没通用，搞条毛？
          Object.defineProperties(event, {
            keyCode: { writeable: true, value: arg == 'up' ? 38 : 40 }
          });
          let volume = document.querySelector('.bilibili-player-iconfont-volume-max');
          volume.dispatchEvent(event);
        });
        clearInterval(playerInitCheck);
      } else if( ++checkCount > 100 ) {
        clearInterval(playerInitCheck);
      }
    }, 50), checkCount = 0;
  }

  // 番剧页：获取播放器iframe地址并转跳
  else if( /anime\/\d+\/play/.test(window.location.href) ) {
    var playerInitCheck = setInterval(() => {
      let ifr;
      if( ifr = document.querySelector('iframe') ) {
        if( ifr.src.indexOf('iframemessage.html') == -1 ) {
          window.location.href = ifr.src;
          clearInterval(playerInitCheck);
        }
      } else if( ++checkCount > 400 ) {
        clearInterval(playerInitCheck);
      }
    }, 50), checkCount = 0;
  }

  // 动态页重做样式
  else if( window.location.href.includes('t.bilibili.com/?tab=8') ) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = '#bili-header-m, .left-panel, .right-panel, .center-panel > .section-block, .sticky-bar { display: none !important }' +
                      '.home-content, .center-panel { width: 100% !important; }' +
                      '.card { min-width: 0 !important;}'
    document.head.appendChild(style)
  }

  // /blanc/:id才是真正的直播播放器所在页面
  // 它有时会作为iframe嵌入到直播间里，此时无法直接操作到播放器，所以转跳到实际播放器所在页面
  const liveId = /\/\/live\.bilibili\.com\/(\d+)/.exec(window.location.href);
  if ( liveId ) {
    window.location.href = `https://live.bilibili.com/blanc/${liveId[1]}?liteVersion=true`;
  }

  // 直播使用桌面版 HTML5 直播播放器
  else if ( /\/\/live\.bilibili\.com\/blanc\/\d+/.test(window.location.href) ) {
    let playerInitCheck = setInterval(() => {
      // 通过查询 HTML5 播放器 DIV 来判断页面加载
      if( document.querySelector('.bp-no-flash-tips') ) {
        // 切换 HTML5 播放器
        window.EmbedPlayer.loader();
      } else if( document.querySelector('.bilibili-live-player') ) {
        // 全屏播放器并隐藏聊天栏
        document.getElementsByTagName('body')[0].classList.add('player-full-win', 'hide-aside-area');
        // 隐藏聊天栏显示按钮
        let aside = document.getElementsByClassName('aside-area-toggle-btn')[0];
        aside.style.display = 'none';
        // 隐藏 haruna
        let haruna = document.getElementsByClassName('haruna-ctnr')[0];
        haruna.style.display = 'none';
        // 隐藏全屏播放器（在某些情况下会出现）的滚动条
        document.body.style.overflow = 'hidden';
        clearInterval(playerInitCheck);
      } else if( ++checkCount > 1000 ) {
        clearInterval(playerInitCheck);
      }
    }, 100), checkCount = 0;
  }

  // 移除app广告
  function removeAppAd() {
    appAdNode = document.querySelectorAll('[class*="OpenApp" i]');
    appAdNode.forEach((node) => {
      node.remove();
    });
  }
  removeAppAd();
});
