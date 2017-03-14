window.addEventListener('DOMContentLoaded', function() {

	// 自动最大化播放器
	let playerInitCheck = setInterval(() => {
		if( typeof window.BiliH5Player == 'function' ) {
			var fsButton = document.querySelector('.icon-widescreen');
			fsButton.click();
			clearInterval(playerInitCheck);
		} else if( ++checkCount > 100 ) {
			clearInterval(playerInitCheck);
		}
	}, 50), checkCount = 0;

	// 移除app广告
	let ad = document.getElementById('b_app_link');
	if( ad ) {
		ad.style.left = '-99999px';
	}
	
});