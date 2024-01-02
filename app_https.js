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
const speakeasy = require('speakeasy');
const requestIp = require('request-ip');
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

const tokenController = require('./controllers/tokeninfo');
const passwordController = require('./controllers/encryptpwd');
const ACCESS_TOKEN = 0;
const REFRESH_TOKEN = 1;

const app = express();

app.use(helmet());

const corsOptions = {
    origin: 'https://nolilteo.com'
};

app.use(cors(corsOptions));
app.use(methodOverride('_method'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/communityphtos/'));

app.use('/Fcm', FcmRouter);
app.use('/Notification', NotificationRouter);
app.use('/User', UserRouter);
app.use('/Community', CommunityRouter);

var moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");

app.set('port', process.argv[2] || process.env.HTTPS_PORT || 50119); //50119..

const https = require('https');
const options = {
	key: fs.readFileSync('./keys/nolilteo.com_202211239BC9C.key.pem'),
	cert: fs.readFileSync('./keys/nolilteo.com_202211239BC9C.crt.pem'), 
	ca: fs.readFileSync('./keys/RootChain/ca-chain-bundle.pem'), 
  };

https.createServer(options, app).listen(app.get('port'),'0.0.0.0', () => {
	console.log('Express nolilteo '  + GlobalFuncRouter.serverName + ' server listening on port ' + app.get('port'));
});	//19~

const { Op } = require('sequelize');
// sequelize 연동
models.sequelize.sync().then( async () => {
    console.log("DB Connect Success");
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

	//새 글 업데이트
	var rule = {};
	if(0 == req.body.needAll){
		var categoryList = GlobalFuncRouter.IsEmpty(req.body.categoryList) ? [] : GlobalFuncRouter.getWords(req.body.categoryList);
		var tagList = GlobalFuncRouter.IsEmpty(req.body.tagList) ? [] : GlobalFuncRouter.getWords(req.body.tagList);
		var locationList = GlobalFuncRouter.IsEmpty(req.body.locationList) ? [] : GlobalFuncRouter.getWords(req.body.locationList);
	
		var filterData = [];
		for(var i = 0 ; i < categoryList.length ; ++i){
			filterData.push({Category : categoryList[i]});
		}
	
		for(var i = 0 ; i < tagList.length ; ++i){
			filterData.push({Tag : tagList[i]});
		}

		var locationFilterData = [];
		for(var i = 0 ; i < locationList.length; ++i){
			var tokenList = GlobalFuncRouter.getAllLocationWords(locationList[i]);

			if(tokenList[1] == 'ALL'){
				locationFilterData.push({[Op.like] : '%' + tokenList[0] + '%'},);
			}else{
				locationFilterData.push({[Op.like] : '%' + locationList[i] + '%'},);
			}
		}

		rule = {
			[Op.or] : filterData,
			Location : {
				[Op.or] : locationFilterData
			}
		}
	}else{
		var locationList = GlobalFuncRouter.IsEmpty(req.body.locationList) ? [] : GlobalFuncRouter.getWords(req.body.locationList);

		var locationFilterData = [];
		for(var i = 0 ; i < locationList.length; ++i){
			var tokenList = GlobalFuncRouter.getAllLocationWords(locationList[i]);

			if(tokenList[1] == 'ALL'){
				locationFilterData.push({[Op.like] : '%' + tokenList[0] + '%'},);
			}else{
				locationFilterData.push({[Op.like] : '%' + locationList[i] + '%'},);
			}
		}

		rule = {
			Location : {
				[Op.or] : locationFilterData
			}
		}
	}

	rule.Type = req.body.type;
	rule.DeleteType = 0;

	await models.CommunityPost.findOne({
		order : [
			['id', 'DESC']
		],
		where: rule
	}).then(async result => {

		if(!GlobalFuncRouter.IsEmpty(result)){
			//새 글 업데이트
			if(result.id != req.body.lastID){
				var data = JSON.stringify({
					targetID : req.body.userID,
					category : result.Category,
					tag : result.Tag,
					location : result.Location,
					notiTitle : "새로운 글",
					type : GlobalFuncRouter.notiEventEnum.POST_NEW_UPDATE.value,
					cType : result.Type,
					body : "새 글이 작성되었습니다.",
					isSend : 1,
				})

				if(fcmFuncRouter.SendFcmEvent(data)){
					console.log(URL + '/InsertOrModify POST_NEW_UPDATE fcm is true');
				}else{
					console.log(URL + '/InsertOrModify POST_NEW_UPDATE fcm is false');
				}
			}
		}
	}).catch(err => {
			console.error(URL + '/Select CommunityPost findAll Failed' + err);
			res.status(400).send(null);
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


var otpList = new Array();

function otpFunc(id){
    const idx = otpList.findIndex(function(item) {return item.id === id});
    if(idx > -1) otpList.splice(idx, 1);
}

app.post('/OTP/Generate', async(req, res) => {
    var date = moment().format('yyyy-MM-DD HH:mm:ss');

	var secret = speakeasy.generateSecret({length: 5, name : date, algorithm: 'sha512'});
    let ip = requestIp.getClientIp(req);

    const idx = otpList.findIndex(function(item) {return item.ip === ip});

    //해당 ip로 이미 발급된 key가 있음
    if(idx > -1){
        const otpData = otpList[idx];

        let data = {
            "id" : otpData.id,
            "ip" : ip,
            "secret" : secret.base32
        }
    
        setTimeout(otpFunc, 1000 * 60 * 3,otpData.id);

        otpList.splice(idx,1, data);
    }else{
        let id = otpList.length;

        let data = {
            "id" : id,
            "ip" : ip,
            "secret" : secret.base32
        }
    
        //3분
        setTimeout(otpFunc, 1000 * 60 * 3,id);
        
        otpList.push(data);
    }

    console.log(otpList);

    var otp = secret.base32;

    var result = {
        otp
    }

	res.status(200).send(result);
});

var successList = new Array();

app.post('/OTP/Check', async(req, res) => {
    if(otpList.length == 0){
        res.status(200).send(false);
    }else{
        var check = false;
        otpList.forEach(element => {
            if(element.secret == req.body.secret){
                let data = {
                    "userID" : req.body.userID,
                    "secret" : element.secret
                }

                successList.push(data);
    
                check = true;
            }
        });
    
        res.status(200).send(check);
    }
});

app.post('/OTP/Login', async(req, res) => {
    if(successList.length == 0){
        res.status(200).send(false);
    }else{
        successList.forEach(async element => {
            if(element.secret == req.body.secret){
             
                const idx = successList.findIndex(function(item) {return item.secret === req.body.secret});
                var successData;
                if(idx > -1) {
                    successData = successList[idx];
                    successList.splice(idx, 1);
                }

                if(GlobalFuncRouter.IsEmpty(successData)){
                    res.status(200).send(null);
                }else{
                    await models.User.findOne({
                        where : {
                            UserID : successData.userID,
                        },
                        include: [
                          {
                              model : models.BlockTime,
                              required : false,
                              order : [
                                  ['id', 'DESC']
                              ]
                          },
                        ],
                    }).then(async result => {
                    if(GlobalFuncRouter.IsEmpty(result)) res.status(200).send(null);
                    else{
                
                        if(result.LoginState == 1){ //탈퇴한 회원
                          res.status(200).send(null);
                        }else{
                        const payload = {
                            Email : result.Email
                        };
                
                        const secret = tokenController.getSecret(ACCESS_TOKEN);
                        const refsecret = tokenController.getSecret(REFRESH_TOKEN);
                    
                        const token = tokenController.getToken(payload, secret, ACCESS_TOKEN);
                        const reftoken = tokenController.getToken(payload, refsecret, REFRESH_TOKEN);
                        const alarm = await models.NotificationList.findAll({where : {TargetID: result.UserID, isSend : 0}});
                
                        var user = result;
                    
                        var resData = {
                            user,
                            alarmCount : alarm.length,
                            AccessToken: token,
                            RefreshToken: reftoken,
                            AccessTokenExpiredAt: (tokenController.getExpired(token)).toString(),
                        };
                
                        await models.User.update(
                            {
                            RefreshToken: reftoken  
                            },
                            {
                            where : { Email : result.Email }
                            }
                        ).then(result2 => {
                
                            console.log(result2);
                            res.status(200).send(resData);
                        }).catch(err => {
                            console.error('/OTP/Login User Update is failed' + err);
                            res.status(404).send(null);
                        })
                        }
                    }
                
                    
                    }).catch(err => {
                    console.error('/OTP/Login failed is error ' + err);
                    res.status(404).send(null);
                    })
                }
            }
        });
    }
});

