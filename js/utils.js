const Store = require('electron-store');
const store = new Store();
const fs = require('graceful-fs');

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
                log.write({
                    message: `更新用户设置：SET ${k} = ${JSON.stringify(key[k])}`
                });
            }
        } else {
            store.set(key, value);
            log.write({
                message: `更新用户设置：SET ${key} = ${JSON.stringify(value)}`
            });
        }
    },
    delete(key) {
        store.delete(key);
    },
    windowSizeMini: [300, 187],
    windowSizeDefault: [375, 500],
    opacity: 1,
    hideShortcut: process.platform == 'darwin' ? 'Alt + W' : 'Ctrl + E',
    proxy: ''
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

// log
// obj {
//    message: '' // 日志内容,
//    override: boolean, // 为true时清空之前的log，重新开始写入
// }
function getAppPath() {
    const slash = require('path').sep;
    var logFilePath = __dirname.split(slash);
    logFilePath.length = logFilePath.lastIndexOf('bilimini') + 1;
    logFilePath.push('');
    return logFilePath.join(slash);
}
const appPath = getAppPath();

Date.prototype.format = function() {
    return `${this.toLocaleDateString()} ${this.toTimeString().split(' ')[0]} ` + 
            ('000' + this.getMilliseconds()).slice(-3);
}
var log = {
    write(obj) {
        var logFileName = appPath + 'bilimini.log',
            now = new Date();
            _msg = '',
            LF = '\r\n' + ' '.repeat(23);
        // 让每个换行前都空出33个字符的距离，这样能让message对齐
        var message = obj.message.replace(/\n/g, LF);
        if( obj.data ) {
            message += `${LF} ${JSON.stringify(obj.data)}`;
        }
        if( obj.type ) {
            _msg = `* ${now.format()} ${obj.type} > ${message}\r\n`;
        } else {
            _msg = `${now.format()} ${message}\r\n`;
        }
        if( obj.override ) {
            fs.writeFile(logFileName, _msg);
        } else {
            fs.appendFile(logFileName, _msg);
        }
    }
}

module.exports = {
    config,
    ajax,
    log(message, data, override) {
        log.write({
            message,
            data,
            override
        });
    },
    error(message, data, override) {
        log.write({
            message, data, override, type: 'ERROR'
        });
    }
}