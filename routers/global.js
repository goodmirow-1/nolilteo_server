require('dotenv').config()
const fs = require('fs'),
moment = require('moment'),
sharp = require('sharp'),
Enum = require('enum'),
path = require('path');

const redis = require('redis');
const client = redis.createClient(6379, "127.0.0.1");

var notiEventEnum = new Enum({
	'POST_LIKE': 1, "POST_REPLY" : 2, "POST_REPLY_LIKE" : 3, "POST_REPLY_REPLY" : 4, 
	"GATHERING_JOIN" : 5, "POST_NEW_UPDATE" : 6,"POST_DAILY_POPULAR" : 7, "POST_WEEKLY_BEST":8});
var SERVER_NAME = process.env.SERVER_NAME;

require('moment-timezone');

moment.tz.setDefault("Asia/Seoul");

function makeFolder(dir) { //폴더 만드는 로직
if (!fs.existsSync(dir)) { //만약 폴더 경로가 없다면
	fs.mkdirSync(dir); //폴더를 만들어주시오
} else {
	console.log('already folder exist!');
}
}

function print(txt) {
	console.log(txt);
}

function stringifyToJson(data) {
	return JSON.stringify(data);
}

async function CreateOrUpdate(model, where, newItem) {
	const foundItem = await model.findOne({ where });

	if (!foundItem) {
		const item = await model.create(newItem);
		return { item, created: true };
	}

	await model.update(newItem, { where });

	const item = foundItem;

	return { item, created: false };
}

async function CreateOrDestroy(model, where) {
	const foundItem = await model.findOne({ where });
	if (!foundItem) {
		const item = await model.create(where);
		return { item, created: true };
	}

	const item = await model.destroy({ where });
	return { item, created: false };
}

function getfilename(x) {
	var splitFileName = x.split(".");
	var name = splitFileName[0];
	return name;
}

function getImgMime(x) {
	var splitFileName = x.split(".");
	var mime = splitFileName[1];
	return mime;
}

//디렉토리랑 mime type 까지 싹다 인자로 받기

function removefiles(p) {
	try { // D
		const files = fs.readdirSync(p);  
		if (files.length) 
		  files.forEach(f => removePath(path.join(p, f), printResult)); 
	  } catch (err) {
		if (err) return console.log(err);
	  }	  
}

const removePath = (p, callback) => { // A 
	fs.stat(p, (err, stats) => { 
	  if (err) return callback(err);
  
	  if (!stats.isDirectory()) { // B 
		console.log('이 경로는 파일');
		return fs.unlink(p, err => err ? callback(err) : callback(null, p));
	  }
  
	  console.log('이 경로는 폴더');  // C 
	  fs.rmdir(p, (err) => {  
		if (err) return callback(err);
  
		return callback(null, p);
	  });
	});
  };

const printResult = (err, result) => {
	if (err) return console.log(err);

	console.log(`${result} 를 정상적으로 삭제했습니다`);
};

function IsEmpty(value) {
if (value == "" ||
	value == null ||
	value == undefined ||
	(Array.isArray(value) && value.length < 1) ||
	(value != null && typeof value == "object" && !Object.keys(value).length) ||
	(value != null && value == -100)
) {
	return true //비어있는 거임
}
else {
	return false
}
};

function getWordLen(x) { //검색 필터 단어 나누는 용
    var splitFileName = x.split("|");
    var len = splitFileName.length;
    return len;
}
    
function getWords(x) { //검색 필터 단어 나누는 용
    var splitFileName = x.split("|");
    return splitFileName;
}

function getAllLocationWords(x) {
	var splitFileName = x.split(" ");
    return splitFileName;
}
    
function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}   

function getWBTI() {
	var num = Math.floor(Math.random() * 16);

	var res = 'infp';
	switch(num){
		case 0: res = 'enfj'; break;
		case 1: res = 'enfp'; break;
		case 2: res = 'entj'; break;
		case 3: res = 'entp'; break;
		case 4: res = 'esfj'; break;
		case 5: res = 'esfp'; break;
		case 6: res = 'estj'; break;
		case 7: res = 'estp'; break;
		case 8: res = 'infj'; break;
		case 9: res = 'infp'; break;
		case 10: res = 'intj'; break;
		case 11: res = 'intp'; break;
		case 12: res = 'isfj'; break;
		case 13: res = 'isfp'; break;
		case 14: res = 'istj'; break;
		case 15: res = 'istp'; break;
	}

	return res;
}

function rand(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
  }

module.exports.client = client;
module.exports.notiEventEnum = notiEventEnum;
module.exports.serverName = SERVER_NAME;
//전역함수
module.exports.makeFolder = makeFolder;
module.exports.print = print;
module.exports.stringifyToJson = stringifyToJson;
module.exports.CreateOrUpdate = CreateOrUpdate;
module.exports.CreateOrDestroy = CreateOrDestroy;

module.exports.getfilename = getfilename;
module.exports.getImgMime = getImgMime;
module.exports.removefiles = removefiles;
module.exports.IsEmpty = IsEmpty;

module.exports.getWordLen = getWordLen;
module.exports.getWords = getWords;
module.exports.getAllLocationWords = getAllLocationWords;
module.exports.getWBTI = getWBTI;
module.exports.rand = rand;

module.exports.sleep = sleep;