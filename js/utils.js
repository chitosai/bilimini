// 保存用户设置
var Config = {
    load: function(key) {
        var value = JSON.parse(localStorage.getItem(key));
        if( value != null ) {
            Config[key] = value;
        }
        return value;
    },
    set: function(key, value) {
        if( typeof key == 'object' ) {
            for( let _k of key ) {
                Config[_k] = key[_k];
                window.localStorage.setItem(_k, JSON.stringify(key[_k]));
                Config.applyCallback(key, key[_k]);
            }
        } else if( typeof key == 'string' && value ) {
            Config[key] = value;
            window.localStorage.setItem(key, JSON.stringify(value));
            Config.applyCallback(key, value);
        }
    },
    applyCallback: function(key, value) {
        var arr = Config.callbacks[key];
        if( arr && arr.length ) {
            arr.forEach((fn) => {
                fn(value);
            });
        }
    },
    onSet: function(key, callback) {
        var arr = Config.callbacks[key];
        if( !arr ) {
            arr = Config.callbacks[key] = [];
        }
        arr.push(callback);
    },
    callbacks: {},
    windowSizeMini: [300, 187],
    windowSizeDefault: [375, 500],
    opacity: 1
};

// 初始化时读取用户设置
function loadUserConfig() {
    // 读取用户拖的视频播放窗口尺寸
    Config.load('windowSizeMini');
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