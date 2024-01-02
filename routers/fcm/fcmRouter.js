const router = require('express').Router(),
    admin = require('firebase-admin'),
    globalRouter = require('../global'),
    models = require('../../models');
    const { Op } = require('sequelize');

    var serviceAccount = require("../../keys/nolilteo-firebase-adminsdk-iriay-c33ec9f0e7.json");

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

var URL = '/Fcm/';

router.post('/Token/Save',async (req,res) => {
    let token = req.body['token'];
    let userID = req.body['userID'];

    var fcm = models.FcmTokenList.findOne({
        where : {
            UserID : userID,
            Token : token
        }
    })

    if(globalRouter.IsEmpty(fcm)){
        globalRouter.CreateOrUpdate(models.FcmTokenList, 
            {
                UserID : userID
            },
            {
                UserID : userID,
                Token : token,
            }
        ).then(function(result) {
            console.log(URL + "Token/Save new Success" + result);
            res.status(200).send(result);
        }).catch( err => {
            console.error(URL + "Token/Save Faield " + err);
            res.status(400).send(err);
        })
    }else{
        let badgeCount = fcm.BadgeCount;
        let play = fcm.PlayAlarm;
        let work = fcm.WorkAlarm;
        let gather = fcm.GatherAlarm;
        let subscribe = fcm.SubscribeAlarm;
        let recommend = fcm.RecommendAlarm;

        await models.FcmTokenList.destroy({
            where: {
                Token : token,
                UserID: {
                    [Op.ne]: userID
                }
            }
        }).then( function(result, err) {
            if(err) console.log(URL + 'Token/Save Destroy Failed' + err);
            else{
                console.log(URL + 'Token/Save Destroy success' + result);
            }
        })

        globalRouter.CreateOrUpdate(models.FcmTokenList, 
            {
                UserID : userID
            },
            {
                UserID : userID,
                Token : token,
                BadgeCount : badgeCount,
                PlayAlarm : play,
                WorkAlarm : work,
                GatherAlarm : gather,
                SubscribeAlarm : subscribe,
                RecommendAlarm : recommend
            }
        ).then(function(result) {
            console.log(URL + "Token/Save update Success" + result);
            res.status(200).send(result);
        }).catch( err => {
            console.error(URL + "Token/Save Faield " + err);
            res.status(400).send(err);
        })
    }
});

router.post('/Send', async (req,res) => {
    let from = req.body['token'];
    let msgTitle = req.body['title'];
    let msgBody = req.body['body'];
    let iosToken = "";
    let andToken = "";
    if(msgTitle == undefined || msgBody == undefined) res.json(null);
    let sendMsg = {
        notification:{
            title: msgTitle,
            body: msgBody
        },
        data : {
            token : from,
        },
        token: from
    };
    admin.messaging().send(sendMsg)
        .then((result) => res.status(200).send(true))
        .catch((e) => {
            console.log(e);
            res.status(400).send(null);   
        })
});

router.post('/DetailAlarmSetting', async(req,res) => {
    await models.FcmTokenList.update(
        {
            PlayAlarm: req.body.playAlarm,
            WorkAlarm: req.body.workAlarm,
            GatherAlarm : req.body.gatherAlarm,
            SubscribeAlarm: req.body.subscribeAlarm,
            RecommendAlarm : req.body.recommendAlarm
        },
        {
            where : {
                UserID : req.body.userID
            }
        },
    ).then( result => {
        res.status(200).send(result);
    }).catch(err => {
        console.log(URL + 'DetailAlarmSetting' + err);
        res.status(400).send(null);
    })
});

router.post('/BadgeCount/Reset', async(req, res) => {
    await models.FcmTokenList.update(
        {
            BadgeCount : 0
        },
        {
            where : {UserID : req.body.userID}
        }
    ).then( result => {
        console.log(URL + 'BadgeCount/Reset ' + result);
        res.status(200).send(result);
    }).catch(err => {
        console.log(URL + 'BadgeCount/Reset' + err);
        res.status(400).send(null);
    })
})


module.exports = router;