window.addEventListener('DOMContentLoaded', function() {

  // 普通视频页：自动最大化播放器
  if( window.location.href.indexOf('video/av') > -1 || window.location.href.indexOf('html5player.html') > -1 ) {
    let playerInitCheck = setInterval(() => {
      let wideScreenButton;
      if( wideScreenButton = document.querySelector('.bilibili-player-iconfont-web-fullscreen') ) {
        wideScreenButton.click();
        clearInterval(playerInitCheck);
      } else if( ++checkCount > 100 ) {
        clearInterval(playerInitCheck);
      }
    }, 50), checkCount = 0;
  }

  // 番剧页：获取播放器iframe地址并转跳
  if( /anime\/\d+\/play/.test(window.location.href) ) {
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

  // 直播使用了hls，原生pc-chrome不支持，我们需要手动让它支持
  if( /\/\/live\.bilibili\.com\/h5\/\d+/.exec(window.location.href) ) {
    var Hls = require('hls.js');
    if( !Hls.isSupported() ) {
      console.error(`内核不支持hls.js？！ ${navigator.userAgent}`);
      return false;
    }
    var video, checkCount = 0;
    var videoCheck = setInterval(() => {
      if( video = document.querySelector('.live-player') ) {
        video.addEventListener('loadstart', () => {
          // 获取直播的推流地址
          var src = video.querySelector('source').src,
              hls = new Hls(),
              player = document.createElement('video'),
              stage = document.querySelector('.canvas-ctnr'),
              danmaku = document.querySelector('#danmu-canvas');
          // 准备舞台
          document.body.style.overflow = 'hidden';
          stage.style.cssText = 'background: #000; display: block; position: fixed; top: 0; left: 0; z-index: 12450; width: 100%; height: 100%;';
          danmaku.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 33; width: 100%; height: 100%;';
          // 页面中自带的<video>经常被操作，我们只能自己创建一个新的<video>覆盖在他上面
          player.style.cssText = 'position: relative; z-index: 22; width: 100%; height: 100%;';
          stage.appendChild(player);
          // 播放@
          hls.loadSource(src);
          hls.attachMedia(player);
          hls.on(Hls.Events.MANIFEST_PARSED,function() {
            player.play();
          });
        });
        // 帮用户按下「播放」按钮
        setTimeout(function() {
          document.querySelector('.tv-play-button').click();
        }, 200)
        clearInterval(videoCheck);
      } else if( ++checkCount > 200 ) {
        clearInterval(videoCheck);
      }
    }, 50);
  }

  // 移除app广告
  let appAdCheck, appAdNode;
  appAdCheck = setInterval(function() {
    // 第一次check，如果上一次获取到的dom引用还在，我们就假设上一次设定的left: -99999px还有效，不做任何操作
    if( appAdNode ) {
      return;
    }
    // 如果上一次的引用已经丢失了，就再次去获取元素
    // 如果获取不到该元素，就假设当前页面没有广告
    appAdNode = document.getElementById('b_app_link');
    if( !appAdNode ) {
      return;
    }
    // 如果获取成功，就重新设置一次left样式
    if( window.getComputedStyle(appAdNode)['left'] == '0px' ) {
      appAdNode.style.left = '-999999px';
    }
    // 我觉得这样的dirty check开销是最小的
  }, 500);
  
});