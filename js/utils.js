const store = require('electron-settings');

// 设置，比永久储存库多一个默认值，诶嘿 (<ゝω·)☆
var config = {
    get(key) {
        var val = store.get(key);
        return val ? val : config[key];
    },
    set(key, value) {
        if( typeof key == 'object' ) {
            for( let k in key ) {
                store.set(k, key[k]);
            }
        } else {
            store.set(key, value);
        }
    },
    windowSizeMini: [300, 187],
    windowSizeDefault: [375, 500],
    opacity: 1
}

// ajax
var ajax = {
    get: function(url, success, mode) {
        var r = new XMLHttpRequest();
        r.open("GET", url, true);
        if( mode in userAgent ) {
            r.setRequestHeader('userAgent', userAgent[mode]);
        }
        r.onreadystatechange = function () {
            if (r.readyState != 4 || r.status != 200) return;
            success(r.responseText);
        };
        r.send();
    }
}

module.exports = {
    config,
    ajax
}