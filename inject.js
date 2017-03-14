window.addEventListener('DOMContentLoaded', function() {

	// 自动最大化播放器
	if( window.location.href.indexOf('video/av') > -1 ) {
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

	// 移除app广告
	let ad = document.getElementById('b_app_link');
	if( ad ) {
		ad.style.left = '-99999px';
	}
	
});