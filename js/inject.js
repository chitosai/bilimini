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