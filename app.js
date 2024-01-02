const express = require('express');
const methodOverride = require('method-override');		//Post,Delete,Update 관련 Module
const bodyParser = require('body-parser');			//Json으로 데이터 통신 Module
const helmet = require('helmet');				//http 보안관련 Module
const cookieParser = require('cookie-parser');			//Cookie Module
const path = require('path');
const dateutil = require('date-utils');
const cors = require('cors');
const { promisify } = require('util');          //동기화 module
const imageSize = promisify(require('image-size'));        //이미지 사이즈 가져오는 Module
const schedule = require('node-schedule');
require('dotenv').config()

const formidable = require('formidable');
const fs_extra = require('fs-extra');
const fs = require('fs');
const models = require("./models/index.js");

const FcmRouter = require('./routers/fcm/fcmRouter.js'),
        CommunityRouter = require('./routers/community/communityRouter.js'),
        UserRouter = require('./routers/user/userRouter.js'),
        NotificationRouter = require('./routers/notification/notificationRouter.js');

const GlobalFuncRouter = require('./routers/global.js'),
		fcmFuncRouter = require('./routers/fcm/fcmFuncRouter.js'),
		NotificationFuncRouter = require('./routers/notification/notificationFuncRouter.js');

const app = express();

app.use(helmet());
app.use(cors());
app.use(methodOverride('_method'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(__dirname));

app.use('/Fcm', FcmRouter);
app.use('/Notification', NotificationRouter);
app.use('/User', UserRouter);
app.use('/Community', CommunityRouter);

var moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");

app.set('port', process.argv[2] || process.env.PORT || 50101); //50100,50101,50102
const server = app.listen(app.get('port'), () => {
	console.log('Express nolilteo '  + GlobalFuncRouter.serverName + ' server listening on port ' + app.get('port'));
});

const https = require('https');
const options = {
	key: fs.readFileSync('./keys/nolilteo.com_202211239BC9C.key.pem'),
	cert: fs.readFileSync('./keys/nolilteo.com_202211239BC9C.crt.pem'), 
	ca: fs.readFileSync('./keys/RootChain/ca-chain-bundle.pem'), 
  };

  //https.createServer(options, app).listen(app.get('port'));	//15~18

const { Op } = require('sequelize');
// sequelize 연동
models.sequelize.sync().then( async () => {
    console.log("DB Connect Success");

    // GlobalFuncRouter.client.flushdb( function (err, succeeded) {
    //     console.log(succeeded); // will be true if successfull
    // });

}).catch( err => {
    console.error("DB Connect Faield");
    console.error(err);
})

app.post('/OnResume', async(req, res) => {
	let body = {
		"isOnline" : 1,
		'count': 0,
		'startTime': moment().unix(),
		'banTime': 0,
	}

	GlobalFuncRouter.client.set(GlobalFuncRouter.serverName+String(req.body.userID),JSON.stringify(body));

	await models.FcmTokenList.update(
		{
			BadgeCount : 0
		},
		{
			where : {UserID : req.body.userID}
		}
	).catch(err => {
		console.log('/OnResume fcmtokenlist badgecount update is failed ' + err);
	})

	res.status(200).send(await NotificationFuncRouter.UnSendSelect(req.body.userID));
})

app.post('/OnPause', async(req, res) => {
	let body = {
		"isOnline" : 0,
		'count': 0,
		'startTime': moment().unix(),
		'banTime': 0,
	}

	GlobalFuncRouter.client.set(GlobalFuncRouter.serverName+String(req.body.userID),JSON.stringify(body));

	res.status(200).send(true);
})

app.post('/Test', async(req, res) => {
	
	//접속중인 사용자들에게 새 글 작성 알림
	await models.User.findAll({
		where : {
				//[Op.not] : { UserID : req.body.userID},
				updatedAt : { 
					//30분 이내
					[Op.gte] : moment().subtract(1, 'H').toDate()
			},
		}
	}).then(async userResult => {

		for(var i = 0 ; i < userResult.length ; ++i){
			
			await models.FcmTokenList.findOne({
				where : {
					UserID : userResult[i].UserID
				},
				order : [
					['id', 'DESC']
				]
			}).then(result => {
				console.log(result);
			})
				
		}
	}).catch(err => {
		console.log(err);
	})

	res.status(200).send(true);
})

// function calculateHotPoint(data) {
// 	if(GlobalFuncRouter.IsEmpty(data)) return;
// 	var nowToMin = ((parseInt(moment().format("H")) * 60) + parseInt(moment().format("mm")));
// 	var create = data.createdAt.toString();
// 	var minDiff = nowToMin - ((parseInt(create.substring(16,18)) * 60) + parseInt(create.substring(19,21)));
// 	if(minDiff < 0) minDiff = minDiff + (24 * 60);
// 	var point = (data.LikeCount * 1.0) + (data.HitCount * 0.05) + (data.ReplyCount * 0.7) - (data.DeclareCount * 2.0) - (minDiff * 0.05);

// 	if(point > 10){
// 		console.log(data.id + ' : ' + data.LikeCount * 1.0 + ' + ' + data.HitCount*0.2 + ' + ' + data.ReplyCount * 0.7 + ' - ' + minDiff*0.05 ) ;
// 	}
	

// 	return Math.round(point * 100) / 100;
// }

function calculateHotPoint(data) {
	if(GlobalFuncRouter.IsEmpty(data)) return;
	var nowDate = moment();
	var createdDate = data.createdAt;	
	var diffHour = Math.round((nowDate-createdDate)/(1000*60*60));
	var point = (data.LikeCount * 1.0) + (data.HitCount * 0.2) + (data.ReplyCount * 1.0) - (data.DeclareCount * 2.0) - (diffHour * 0.5) + 4.5; //9시간계산

	return Math.round(point * 100) / 100;
}