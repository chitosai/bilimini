window.addEventListener('DOMContentLoaded', function() {
	let playerInitCheck = setInterval(() => {
		if( typeof player == 'object' ) {
			var fsButton = document.querySelector('.bilibili-player-iconfont-web-fullscreen');
			fsButton.click();
			clearInterval(playerInitCheck);
		}
	}, 50);
});