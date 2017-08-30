class Count {
	constructor() {
		this.map = {};
	}
	add(key) {
		if( typeof this.map[key] == 'undefined' ) {
			this.map[key] = 1;
		} else {
			this.map[key]++;
		}
	}
	display() {
		let r = [];
		for( let key in this.map ) {
			r.push({name: key, count: this.map[key]});
		}
		r.sort((a, b) => {
			return b.count - a.count;
		});
		return r.slice(0, 10).map((obj) => {
			return `${obj.name} : ${obj.count}`;
		}).join('\r\n');
	}
}

function main() {
	let argv = require('process').argv.slice(2);
	let date = argv[0];
	var fileReader = require('readline').createInterface({
	  input: require('fs').createReadStream('./access.log')
	});
	let log = [];
	let userReg = /^([\d\.]+)/, user = new Count();
	let versionReg = /bilimini\/([\d\.])+/, version = new Count();
	let osReg = /Mozilla\/5\.0 \((.+?)\)/, os = new Count();
	fileReader.on('line', (line) => {
		new Promise((resolve) => {
			if( date ) {
				if( line.indexOf(date) > -1 ) {
					log.push(line);
					resolve();
				}
			} else {
				log.push(line);
				resolve();
			}
		}).then(() => {
	  	let u = userReg.exec(line);
	  	if( u ) {
		  	user.add(u[0]);
	  	}
	  	let v = versionReg.exec(line);
	  	if( v ) {
	  		version.add(v[0]);
	  	}
	  	let o = osReg.exec(line);
	  	if( o ) {
	  		os.add(o[1]);
	  	}
		}).catch(() => {});
	});
	fileReader.on('close', () => {
		console.log(`Total: ${log.length}\n`);
		console.log(`Version: \n${version.display()}\n`);
		console.log(`OS: \n${os.display()}\n`);
		console.log(`User List: \n${user.display()}\n`);
	});
}

main();