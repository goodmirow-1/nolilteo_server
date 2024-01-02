const express = require('express');
const methodOverride = require('method-override');		//Post,Delete,Update 관련 Module
const bodyParser = require('body-parser');			//Json으로 데이터 통신 Module
const helmet = require('helmet');				//http 보안관련 Module
const cookieParser = require('cookie-parser');			//Cookie Module
const path = require('path');
const dateutil = require('date-utils');
const speakeasy = require('speakeasy');
const requestIp = require('request-ip');
const cors = require('cors');
require('dotenv').config()


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
app.use(cors());
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
var jobList= [];

app.set('port', process.argv[2] || 50113);
const server = app.listen(app.get('port'),'0.0.0.0', () => {
	console.log('Express nolilteo '  + GlobalFuncRouter.serverName + ' server listening on port ' + app.get('port'));
});

const { Op } = require('sequelize');
// sequelize 연동
models.sequelize.sync().then( async () => {
    console.log("DB Connect Success");
}).catch( err => {
    console.error("DB Connect Faield");
    console.error(err);
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

