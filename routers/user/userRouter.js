const router = require('express').Router(),
    globalRouter = require('../global'),
    models = require('../../models'),
    fs_extra = require('fs-extra'),
    fs = require('fs');

const config = require('../../config/configure'); //for secret data
const crypto = require('crypto');
const limiter = require('../../config/limiter');
const tokenController = require('../../controllers/tokeninfo');
const passwordController = require('../../controllers/encryptpwd');
const moment = require('moment');

const { Op } = require('sequelize');
const verify = require('../../controllers/parameterToken');

const client = globalRouter.client;
const util = require('node:util');
const getallAsync = util.promisify(client.get).bind(client);

const ACCESS_TOKEN = 0;
const REFRESH_TOKEN = 1;

var URL = '/User/';

router.post('/Insert', async (req, res) => {
    const marketingAgreeTime = req.body.marketingAgree == 1 ? moment().format('YYYY-MM-DD HH:mm:ss') : null;
    const payload = {
      Email : req.body.email
    };

    const secret = tokenController.getSecret(ACCESS_TOKEN);
    const refsecret = tokenController.getSecret(REFRESH_TOKEN);

    const token = tokenController.getToken(payload, secret, ACCESS_TOKEN);
    const reftoken = tokenController.getToken(payload, refsecret, REFRESH_TOKEN);

    await models.User.findOrCreate({
        where : {
            Email : req.body.email
        },
        defaults: {
            Email: req.body.email,
            NickName : req.body.nickName,
            WBTIType : req.body.wbtiType,
            Job : req.body.job,
            LoginType : req.body.loginType,
            RefreshToken : reftoken,
            MarketingAgree: req.body.marketingAgree,
            MarketingAgreeTime: marketingAgreeTime,
        }
    }).then(result => {
      if (result[1]) { 
        
        let body = {
          "isOnline" : 0,
          'count': 0,
          'startTime': moment().unix(),
          'banTime': 0,
        }
      
        client.set(globalRouter.serverName+String(req.body.userID),JSON.stringify(body));

        console.log("refreshtoken:" + reftoken);

        let value = {
            RefreshToken: reftoken 
        }

        var user = result[0]
    
        var resData = {
            user,
            AccessToken: token,
            RefreshToken: reftoken,
            AccessTokenExpiredAt: (tokenController.getExpired(token)).toString(),
        };

        res.status(200).send(resData);
    } else { //만약 이미 있는 회원 아이디이면 result[1] == false 임
        console.log('already member ' + req.body.email);
        res.status(400).send(false);
    }
    }).catch(err => {
      console.error(URL + '/Insert failed is error ' + err);
      res.status(404).send(null);
    })
});

router.post('/EditInfo', require('../../controllers/verifyToken'), limiter, async(req, res) => {
  await models.User.update(
    {
      NickName : req.body.nickName,
      WBTIType : req.body.wbtiType,
      Job: req.body.job,
      Gender : req.body.gender,
      Birthday : req.body.birthday
    },
    {
      where : {
        UserID : req.body.userID
      }
    }
  ).then(result => {
    res.status(200).send(true);
  }).catch(err => {
    console.log(URL + '/EditInfo failed is error ' + err);
    res.statsu(404).send(null);
  })
});

router.post('/Login', async(req,res) => {
  await models.User.findOne({
    where : {
        Email : req.body.email,
        LoginType : req.body.loginType
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
    if(globalRouter.IsEmpty(result)) res.status(200).send(false);
    else{
      if(result.LoginState == 1){ //탈퇴한 회원
        var resData = {
          user : result
        }

        res.status(200).send(resData);
      }else{
        const payload = {
          Email : req.body.email
        };

        const secret = tokenController.getSecret(ACCESS_TOKEN);
        const refsecret = tokenController.getSecret(REFRESH_TOKEN);
    
        const token = tokenController.getToken(payload, secret, ACCESS_TOKEN);
        const reftoken = tokenController.getToken(payload, refsecret, REFRESH_TOKEN);
        const alarm = await models.NotificationList.findAll({where : {TargetID: result.UserID, isSend : 0}});

        let body = {
          "isOnline" : 1,
          'count': 0,
          'startTime': moment().unix(),
          'banTime': 0,
        }

        client.set(globalRouter.serverName+String(result.UserID),JSON.stringify(body));

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
            where : { Email : req.body.email }
          }
        ).then(result2 => {
          res.status(200).send(resData);
        }).catch(err => {
          console.error(URL + '/DebugLogin User Update is failed' + err);
          res.status(404).send(null);
        })
      }
    }
  }).catch(err => {
    console.error(URL + '/Login failed is error ' + err);
    res.status(404).send(null);
  })
})

router.post('/Logout', async(req, res) => {
    await models.FcmTokenList.destroy({
        where : { UserID : req.body.userID }
    }).then(result => {
        res.status(200).send(true);
    }).catch(err => {
      console.error(URL + '/Logout failed is error ' + err);
      res.status(404).send(null);
    })
})

router.post('/Check/Token', async(req,res) => {

  console.log("1. from client:", req.body.refreshToken);
  //문제가 있다... 진자로
  await models.User.findOne({
    where: { UserID: req.body.userID }
  }).then(result => {
    if (result.RefreshToken == '') { ////해당 id 가 가진 reftoken 값이 비어있으면
      res.status(400).send("this User has no RefreshToken");
    } else { //있으면 
      //tableRefresh = result.RefreshToken; //테이블 reftoken 값 넣어!
      console.log("this User has RefreshToken");
      console.log("2. from table: ", result.RefreshToken); //이게 
      return result
    }
  }).then( async result =>{
    if (String(req.body.refreshToken) == String(result.RefreshToken)) {
      const VerifyRefresh = tokenController.VerifyRefToken(req.body.refreshToken);
      if (VerifyRefresh) { //인증 문제없이 되면
        const payload = {
          UserID: req.body.userID
        };
        const secret = tokenController.getSecret(ACCESS_TOKEN);
        const token = tokenController.getToken(payload, secret, ACCESS_TOKEN);
        //new access token 발급
        const response = {
          "AccessToken": token,
          "AccessTokenExpiredAt": tokenController.getExpired(token)
        }
        console.log(response); //response 값 확인
        res.status(200).json(response); //send new access token to client
      }
      else { //인증에 문제 생기면
        res.status(401).json({ success: false, message: 'Failed to authenticate refresh token. RE login please'/*, error: err */ });
      }
    }
    else { //DB 안의 refToken 값이랑 cli 에서 넘어온 refToken 값이랑 다르면
      res.status(404).send('Invalid request.. NOT refresh tkn expired error')
    }
  }).catch(err => {
    console.error('user register failed' + err);
    res.status(400).send(false);
  });
})

router.post('/Select', async(req, res) => {
  await models.User.findOne({
    attributes : [
      "UserID", "NickName" , "WBTIType", "Job"
    ],
    where : { UserID : req.body.userID }
  }).then(result => {
    res.status(200).send(result);
  }).catch(err => {
    console.error(URL + '/Select failed is error ' + err);
    res.status(200).send(null);
  })
})

router.post('/Select/BanList', async(req, res) => {
  await models.UserBan.findAll({
      where : {
          UserID : req.body.userID,
      },
  }).then(result => {
      res.status(200).send(result);
  }).catch(err => {
    console.error(URL + '/Select/BanList failed is error ' + err);
    res.status(200).send(null);
  })
})

router.post('/Insert/BanUser', limiter, async(req, res) => {
    await models.UserBan.findOrCreate({
        where : {
            UserID : req.body.userID,
            TargetID : req.body.targetID
        },
        defaults: {
            UserID : req.body.userID,
            TargetID : req.body.targetID
        }
    }).then(result => {
        res.status(200).send(true);
    }).catch(err => {
      console.error(URL + '/Insert/BanUser failed is error ' + err);
      res.status(404).send(null);
    })
})

router.post('/Delete/BanUser', limiter, async(req, res) => {
    await models.UserBan.destroy({
        where : {
            UserID : req.body.userID,
            TargetID : req.body.targetID
        }
    }).then(result => {
        res.status(200).send(true);
    }).catch(err => {
      console.error(URL + '/Delete/BanUser failed is error ' + err);
      res.status(404).send(null);
    })
})

router.post('/Exit/Member', async(req, res) => {
  try{
    //token 파괴
    await models.FcmTokenList.destroy({
      where : { UserID : req.body.userID }
    })

    //알림 삭제
    await models.NotificationList.destroy({ where : {UserID : req.body.userID}});
    //신고 삭제
    await models.Declare.destroy({ where : {UserID : req.body.userID}});
    //차단 삭제
    await models.UserBan.destroy({ where : {UserID : req.body.userID}});

    //탈퇴 이유 저장
    await models.ReasonByExit.create({
      UserID : req.body.userID,
      Type : req.body.type,
      Contents : req.body.contents
    })

    //탈퇴 상태로 변경
    await models.User.update(
      {
        LoginState : 1
      },
      {
        where : { UserID : req.body.userID }
      }
    )

    res.status(200).send(true);
  } catch(err) {
    console.error(URL + '/Exit/Member failed is error ' + err);
    res.status(404).send(null);
  }
})

router.post('/Check/NickName' , async(req, res) => {
  await models.User.findOne({
    where : { NickName : req.body.nickName}
  }).then(result => {
    if(globalRouter.IsEmpty(result)){
      res.status(200).send(true);
    }else{
      res.status(200).send(false);
    }
  }).catch(err => {
    console.error(URL + '/Check/NickName findOne is error ' + err);
    res.status(404).send(null);
  })
})

router.post('/Declare', limiter, async(req, res) => {
  await models.Declare.findOrCreate({
    where: {
      UserID : req.body.userID,
      DeclareID : req.body.targetID,
    },
    defaults: {
      UserID : req.body.userID,
      DeclareID : req.body.targetID,
      Contents : req.body.contents
    }
  }).then(async result => {
    res.status(200).send(result);
  }).catch( err => {
    console.error(URL + "/Declare findOrCreate Faield" + err);
    res.status(400).send(null);
  })
});

router.post('/Admin/Login', async(req, res) => {
  if(req.body.pw != process.env.ADMIN_PASSWORD){
    res.status(200).send(false);
  }else{
    const marketingAgreeTime = moment().format('YYYY-MM-DD HH:mm:ss');
    const payload = {
      Email : req.body.email
    };

    const secret = tokenController.getSecret(ACCESS_TOKEN);
    const refsecret = tokenController.getSecret(REFRESH_TOKEN);

    const token = tokenController.getToken(payload, secret, ACCESS_TOKEN);
    const reftoken = tokenController.getToken(payload, refsecret, REFRESH_TOKEN);

    var nickName = req.body.email.substr(0,req.body.email.indexOf('@'));

    await models.User.findOrCreate({
        where : {
            Email : req.body.email
        },
        defaults: {
            Email: req.body.email,
            NickName : nickName,
            WBTIType : globalRouter.getWBTI(),
            Job : '관리자',
            LoginType : 4,
            RefreshToken : reftoken,
            MarketingAgree: true,
            MarketingAgreeTime: marketingAgreeTime,
            LoginState: 0
        }
    }).then(async result => {
      console.log(result);
      if (result[1]) { 
        
        let body = {
          "isOnline" : 0,
          'count': 0,
          'startTime': moment().unix(),
          'banTime': 0,
        }
      
        client.set(globalRouter.serverName+String(req.body.userID),JSON.stringify(body));

        console.log("refreshtoken:" + reftoken);

        let value = {
            RefreshToken: reftoken 
        }

        var user = result[0];
    
        var resData = {
            user,
            alarmCount : 0,
            AccessToken: token,
            RefreshToken: reftoken,
            AccessTokenExpiredAt: (tokenController.getExpired(token)).toString(),
        };

        res.status(200).send(resData);
    } else { //만약 이미 있는 회원 아이디이면 result[1] == false 임
        const payload = {
          Email : req.body.email
        };

        const secret = tokenController.getSecret(ACCESS_TOKEN);
        const refsecret = tokenController.getSecret(REFRESH_TOKEN);
    
        const token = tokenController.getToken(payload, secret, ACCESS_TOKEN);
        const reftoken = tokenController.getToken(payload, refsecret, REFRESH_TOKEN);
        const alarm = await models.NotificationList.findAll({where : {TargetID: result[0].UserID, isSend : 0}});

        var user = result[0];
    
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
            where : { Email : req.body.email }
          }
        ).then(result2 => {

          console.log(result2);
          res.status(200).send(resData);
        }).catch(err => {
          console.error(URL + '/DebugLogin User Update is failed' + err);
          res.status(404).send(null);
        })  
    }
    }).catch(err => {
      console.error(URL + '/Admin/Login failed is error ' + err);
      res.status(404).send(null);
    })
  }
})

module.exports = router;