const express = require('express');
const methodOverride = require('method-override');		//Post,Delete,Update 관련 Module
const bodyParser = require('body-parser');			//Json으로 데이터 통신 Module
const helmet = require('helmet');				//http 보안관련 Module
const cookieParser = require('cookie-parser');			//Cookie Module
const path = require('path');
const dateutil = require('date-utils');
const { promisify } = require('util');          //동기화 module
const imageSize = promisify(require('image-size'));        //이미지 사이즈 가져오는 Module
const schedule = require('node-schedule');
require('dotenv').config()

const formidable = require('formidable');
const fs_extra = require('fs-extra');
const fs = require('fs');
const models = require("./models/index.js");

const FcmRouter = require('./routers/fcm/fcmRouter.js');

const GlobalFuncRouter = require('./routers/global.js'),
		fcmFuncRouter = require('./routers/fcm/fcmFuncRouter.js');

const app = express();

app.use(helmet());
app.use(methodOverride('_method'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/Fcm', FcmRouter);

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/communityphtos/'));

var moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
var jobList= [];

const getallAsync = promisify(GlobalFuncRouter.client.get).bind(GlobalFuncRouter.client);

app.set('port', process.argv[2] || 40000);
const server = app.listen(app.get('port'), () => {
	console.log('Express nolilteo '  + GlobalFuncRouter.serverName + ' server listening on port ' + app.get('port'));
});

const { Op } = require('sequelize');
// sequelize 연동
models.sequelize.sync().then( async () => {
    console.log("DB Connect Success");

    // GlobalFuncRouter.client.flushdb( function (err, succeeded) {
    //     console.log(succeeded); // will be true if successfull
    // });

	//redis 초기화
    await models.User.findAll({
	}).then(result => {
		let body = {
			"isOnline" : 0,
			'count': 0,
			'startTime': moment().unix(),
			'banTime': 0,
		}
		for(var i = 0 ; i < result.length; ++i){
			GlobalFuncRouter.client.set(GlobalFuncRouter.serverName + String(result[i].UserID),JSON.stringify(body));
		}	
	})
	
	//사진 임시파일 삭제
	var job = schedule.scheduleJob('00 00 11 * * *', function() {
		//Temp에 등록된 데이터 삭제
		let mNow = new Date();
		console.log('remove temp folder call');
		console.log(mNow);
		GlobalFuncRouter.removefiles('./allphotos/temp/');
	});
	
	//핫 순위 갱ㅇ신
	var categories = await models.CategoryTable.findAll({});
		for(var i = 0 ; i < categories.length ; ++i){
			await models.CommunityPost.findAll({
				where :{
					DeleteType : 0,
					Category : {[Op.like] : '%' + categories[i].Name + '%'} ,
					Type: {[Op.not] : 2} //모여라 제외 
					// createdAt : {
					// 	[Op.gte] : moment().subtract(24 * 14, 'H').toDate()
					// },
				}
			}).then(async result => {
				if(!GlobalFuncRouter.IsEmpty(result)){
					if(result.length == 1) {
						var point = calculateHotPoint(result[0]);
						if(point <= 10.0) {
							var post = await models.CommunityHotPost.findOne({
								where : {
									PostID : result[0].id
								}
							})

							if(!GlobalFuncRouter.IsEmpty(post)){
								post.destroy({});
							}

							return;
						}	

						await models.CommunityHotPost.findOrCreate({
							where: {
								PostID : result[0].id,
								Type : result[0].Type,
								Category : result[0].Category,
								Tag : result[0].Tag,
							},
							defaults: {
								PostID : result[0].id,
								Type : result[0].Type,
								Category : result[0].Category,
								Tag : result[0].Tag,
								Point : point
							}
						}).then(async result2 => {
							//기존에 있으면
							if(false == result2[1]) {
								await result2[0].update({Point : point});
							}
						}).catch(err => {
							console.error(URL + '/Schedule CommunityHotPost findOrCreate Failed' + err);
						})
					}else{
						for(var j = 0 ; j < result.length ; ++j){
							var point = calculateHotPoint(result[j]);
							if(point <= 10.0) {
								var post = await models.CommunityHotPost.findOne({
									where : {
										PostID : result[j].id
									}
								})
	
								if(!GlobalFuncRouter.IsEmpty(post)){
									post.destroy({});
								}
	
								return;
							}

							await models.CommunityHotPost.findOrCreate({
								where: {
									PostID : result[j].id,
									Type : result[j].Type,
									Category : result[j].Category,
									Tag : result[j].Tag,
								},
								defaults: {
									PostID : result[j].id,
									Type : result[j].Type,
									Category : result[j].Category,
									Tag : result[j].Tag,
									Point : point
								}
							}).then(async result2 => {
								//기존에 있으면
								if(false == result2[1]) {
									await result2[0].update({Point : point});
								}
							}).catch(err => {
								console.error(URL + '/Schedule CommunityHotPost findOrCreate Failed' + err);
							})
						}
					}
				}
			})
		}

	//매시간 핫 순위 갱신
	var job2 = schedule.scheduleJob('00 00 * * * *', async function() {
		let mNow = new Date();
		console.log('calculate hot posts call');
		console.log(mNow);

		//기존꺼 다 날림
		//await models.CommunityHotPost.destroy({truncate: {cascade:false}});

		var categories = await models.CategoryTable.findAll({});

		for(var i = 0 ; i < categories.length ; ++i){
			await models.CommunityPost.findAll({
				where :{
					DeleteType : 0,
					Category : {[Op.like] : '%' + categories[i].Name + '%'} ,
					Type: {[Op.not] : 2} //모여라 제외 
					// createdAt : {
					// 	[Op.gte] : moment().subtract(24 * 14, 'H').toDate()
					// },
				},
				order : [
					['id', 'DESC']
				],
				limit : 10000
			}).then(async result => {
				if(!GlobalFuncRouter.IsEmpty(result)){
					if(result.length == 1) {
						var point = calculateHotPoint(result[0]);
						if(point <= 10.0) {
							var post = await models.CommunityHotPost.findOne({
								where : {
									PostID : result[0].id
								}
							})
	
							if(!GlobalFuncRouter.IsEmpty(post)){
								post.destroy({});
							}
						}else{
							await models.CommunityHotPost.findOrCreate({
								where: {
									PostID : result[0].id,
									Type : result[0].Type,
									Category : result[0].Category,
									Tag : result[0].Tag,
								},
								defaults: {
									PostID : result[0].id,
									Type : result[0].Type,
									Category : result[0].Category,
									Tag : result[0].Tag,
									Point : point
								}
							}).then(async result2 => {
								//기존에 있으면
								if(false == result2[1]) {
									await result2[0].update({Point : point});
								}
							}).catch(err => {
								console.error(URL + '/Schedule CommunityHotPost findOrCreate Failed' + err);
							})
						}	
					}else{
						for(var j = 0 ; j < result.length ; ++j){
							var point = calculateHotPoint(result[j]);
							if(point <= 10.0) {
								var post = await models.CommunityHotPost.findOne({
									where : {
										PostID : result[j].id
									}
								})
	
								if(!GlobalFuncRouter.IsEmpty(post)){
									post.destroy({});
								}
							}else{
								await models.CommunityHotPost.findOrCreate({
									where: {
										PostID : result[j].id,
										Type : result[j].Type,
										Category : result[j].Category,
										Tag : result[j].Tag,
									},
									defaults: {
										PostID : result[j].id,
										Type : result[j].Type,
										Category : result[j].Category,
										Tag : result[j].Tag,
										Point : point
									}
								}).then(async result2 => {
									//기존에 있으면
									if(false == result2[1]) {
										await result2[0].update({Point : point});
									}
								}).catch(err => {
									console.error(URL + '/Schedule CommunityHotPost findOrCreate Failed' + err);
								})
							}
						}
					}
				}
			})
		}
	});

	//매일오전 8시 전일자 핫게시글
	var job3 = schedule.scheduleJob('00 00 08 * * *', async function() {
		let mNow = new Date();
		console.log('calculate daily best post call');
		console.log(mNow);

		var categories = await models.CategoryTable.findAll({});

		var max = 0;
		var id = 0;
		var post;
		for(var i = 0 ; i < categories.length ; ++i){
			await models.CommunityPost.findAll({
				where :{
					DeleteType : 0,
					Category : {[Op.like] : '%' + categories[i].Name + '%'} ,
					Type: {[Op.not] : 2}, //모여라 제외 
					createdAt : {
						[Op.gte] : moment().subtract(24, 'H').toDate()
					},
				}
			}).then(async result => {
				if(!GlobalFuncRouter.IsEmpty(result)){
					for(var j = 0 ; j < result.length ; ++j){
						var point = calculateRecommendPost(result[j]);
						if(max < point){
							max = point;
							
							if(max > 10){
								id = result[j].id;
								post = result[j];
							}
						}
					}
				}
			}).catch(err => {
				console.error(URL + '/Schedule CommunityPost findAll Failed' + err);
			})
		}

		if(id != 0){
			await models.User.findAll({
				order : [
					['updatedAt', 'DESC']
				]
			}).then(async result => {

				for(var i = 0 ; i < result.length; ++i){
					var getAllRes = await getallAsync(GlobalFuncRouter.serverName+String(result[i].UserID));
					var resJson = JSON.parse(getAllRes);

					if(!GlobalFuncRouter.IsEmpty(resJson))
					{
						var data = JSON.stringify({
							userID : result[i].UserID,
							targetID : result[i].UserID,
							postTitle : post.Title,
							notiTitle : "",
							nickName : ' ',
							type : GlobalFuncRouter.notiEventEnum.POST_DAILY_POPULAR.value,
							cType : post.Type,
							subscribe : 1,
							tableIndex : post.id,
							subTableIndex : 0,
							body : "띵동~!🔔 지금은 당 충전할 시간이예요.",
							isSend : resJson.isOnline
						})
			
						fcmFuncRouter.SendFcmEvent( data );
					}
				}
			}).catch(err => {
				console.error(URL + '/Schedule User findAll Failed' + err);
			})
		}
	});

	//매주 월요일 11시 주간 핫게시글
	var job4 = schedule.scheduleJob('00 00 11 * * 1', async function() {
		let mNow = new Date();
		console.log('calculate weekly best post call');
		console.log(mNow);

		var categories = await models.CategoryTable.findAll({});

		var max = 0;
		var id = 0;
		var post;
		for(var i = 0 ; i < categories.length ; ++i){
			await models.CommunityPost.findAll({
				where :{
					DeleteType : 0,
					Category : {[Op.like] : '%' + categories[i].Name + '%'} ,
					Type: {[Op.not] : 2}, //모여라 제외 
					createdAt : {
						[Op.gte] : moment().subtract(1, 'w').toDate()
					},
				}
			}).then(async result => {
				if(!GlobalFuncRouter.IsEmpty(result)){
					for(var j = 0 ; j < result.length ; ++j){
						var point = calculateRecommendPost(result[j]);
						if(max < point){
							max = point;
							
							if(max > 10){
								id = result[j].id;
								post = result[j];
							}
						}
					}
				}
			}).catch(err => {
				console.error(URL + '/Schedule CommunityPost findAll Failed' + err);
			})
		}

		if(id != 0){
			await models.User.findAll({
				order : [
					['updatedAt', 'DESC']
				]
			}).then(async result => {

				for(var i = 0 ; i < result.length; ++i){
					var getAllRes = await getallAsync(GlobalFuncRouter.serverName+String(result[i].UserID));
					var resJson = JSON.parse(getAllRes);

					if(!GlobalFuncRouter.IsEmpty(resJson))
					{
						var data = JSON.stringify({
							userID : result[i].UserID,
							targetID : result[i].UserID,
							postTitle : post.Title,
							notiTitle : "",
							nickName : ' ',
							type : GlobalFuncRouter.notiEventEnum.POST_WEEKLY_BEST.value,
							cType : post.Type,
							subscribe : 1,
							tableIndex : post.id,
							subTableIndex : 0,
							body : "두둥~!💌 주간 베스트 게시글이 도착했어요.",
							isSend : resJson.isOnline
						})
			
						fcmFuncRouter.SendFcmEvent( data );
					}
				}
			}).catch(err => {
				console.error(URL + '/Schedule User findAll Failed' + err);
			})
		}
	});

	//게시글 조회수 조작
	var job5 = schedule.scheduleJob('00 0/15 * * * *', function() {
		//Temp에 등록된 데이터 삭제
		let mNow = new Date();
		var hitMaxCount = GlobalFuncRouter.rand(100,350);
		models.CommunityPost.findAll({
			where : {
				DeleteType : 0,
				Type: {[Op.not] : 2}, //모여라 제외 
				createdAt : {
					[Op.gte] : moment().subtract(1, 'w').toDate()
				},
				HitCount : {
					[Op.lte] : hitMaxCount
				}
			}
		}).then(async result => {
			for(var i = 0 ; i < result.length ; ++i){
				var hitcount = GlobalFuncRouter.rand(3,7);
				var iserror = false;
				await models.CommunityPost.update(
					{
						HitCount : result[i].HitCount + hitcount
					},
					{
						where : {
							id : result[i].id
						}
					}
				).catch(err => {
					console.error(URL + '/Schedule CommunityPost update Failed' + err);
					iserror = true;
				});

				if(iserror) break;
			}
		});
	});
	
	jobList.push(job);
	jobList.push(job2);
	jobList.push(job3);
	jobList.push(job4);
	jobList.push(job5);
}).catch( err => {
    console.error("DB Connect Faield");
    console.error(err);
})



function calculateHotPoint(data) {
	if(GlobalFuncRouter.IsEmpty(data)) return;
	var nowDate = moment();
	var createdDate = data.createdAt;	
	var diffHour = Math.round((nowDate-createdDate)/(1000*60*60));
	var point = (data.LikeCount * 1.0) + (data.HitCount * 0.005) + (data.ReplyCount * 1.0) - (data.DeclareCount * 2.0) - (diffHour * 0.5) + 4.5; //9시간계산

	return Math.round(point * 100) / 100;
}

function calculateRecommendPost(data) {
	if(GlobalFuncRouter.IsEmpty(data)) return;
	var point = (data.LikeCount * 1.0) + (data.HitCount * 0.005) + (data.ReplyCount * 1.0) - (data.DeclareCount * 2.0); //9시간계산

	return Math.round(point * 100) / 100;
}

