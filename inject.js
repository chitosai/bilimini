window.addEventListener('DOMContentLoaded', function() {
	let playerInitCheck = setInterval(() => {
		if( typeof window.BiliH5Player == 'function' ) {
			var fsButton = document.querySelector('.icon-widescreen');
			fsButton.click();
			clearInterval(playerInitCheck);
		} else if( ++checkCount > 100 ) {
			clearInterval(playerInitCheck);
		}
	}, 50), checkCount = 0;
});