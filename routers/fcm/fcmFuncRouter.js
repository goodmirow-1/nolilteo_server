const router = require('express').Router(),
    admin = require('firebase-admin'),
    moment = require('moment'),
    models = require('../../models'),
    globalRouter = require('../global'),
    notificationFuncRouter = require('../notification/notificationFuncRouter');

module.exports = {
    SendFcmEvent : async function SendFcmEvent( body ) {
        var data = JSON.parse(body);

        await models.FcmTokenList.findOne({
            where : {
                UserID : data.targetID
            },
            order : [
                ['id', 'DESC']
            ]
        }).then( async result => {
            if(data.type == globalRouter.notiEventEnum.POST_NEW_UPDATE.value){
                if(!globalRouter.IsEmpty(result) && !globalRouter.IsEmpty(result.Token)){
                    if(data.isSend == 1){
                        var res = '';
                        var date = moment().format('yyyy-MM-DD HH:mm:ss');
                        res = data.type + '|' + data.cType + '|' + data.category + '|' + data.tag + '|' + data.location;
    
                        var message;
                        message = {
                            data : {
                                body : res,
                            },
                            token : result.Token,
                        }
                        console.log(message);
    
                        admin.messaging().send(message)
                        .then( fcmResult => {
                            console.log('fcm send is success' + fcmResult);
                            return true;
                        })
                        .catch( e => {
                            console.error(e);
                            return false; 
                        })
                    }
                }
            }else{
                if (globalRouter.IsEmpty(result) || globalRouter.IsEmpty(result.Token)) {
                    data.isSend == 0;
                    await notificationFuncRouter.Insert(data);
                    console.error('fcmFuncRouter UserID' + data.targetID + ' Token is worng');
                    return false;
                }
                
                var fcmData = data;
                fcmData = await notificationFuncRouter.Insert(data);
    
                var isBan = false;
                if(data.subscribe == 1){
                    if(data.type == globalRouter.notiEventEnum.POST_DAILY_POPULAR.value || data.type == globalRouter.notiEventEnum.POST_WEEKLY_BEST.value){
                        if(result.RecommendAlarm == 0) isBan = true;
                    }else{
                        if(result.SubscribeAlarm == 0) isBan = true;
                    }
                }else{
                    if(data.cType == 0){
                        if(result.PlayAlarm == 0) isBan = true;
                    }else if(data.cType == 1){
                        if(result.WorkAlarm == 0) isBan = true;
                    }else{
                        if(result.GatherAlarm == 0) isBan = true;
                    }
                }
    
                var page = 'NOTIFICATION';
                if(data.type == globalRouter.notiEventEnum.POST_LIKE.value || data.type == globalRouter.notiEventEnum.POST_REPLY.value 
                    || data.type == globalRouter.notiEventEnum.POST_REPLY_LIKE.value || data.type == globalRouter.notiEventEnum.POST_DAILY_POPULAR
                    || data.type == globalRouter.notiEventEnum.POST_WEEKLY_BEST.value){
                    page = 'COMMUNITY';
                }else if(data.type == globalRouter.notiEventEnum.POST_REPLY_REPLY.value){
                    page = 'COMMUNITY_REPLY_REPLY';
                }else if(data.type == globalRouter.notiEventEnum.GATHERING_JOIN.value){
                    page = 'GATHERING';
                }
    
                var res = '';
                var date = moment().format('yyyy-MM-DD HH:mm:ss');
                if(globalRouter.IsEmpty(fcmData) == false)
                    res = fcmData.Type + '|' + fcmData.id + "|" + fcmData.UserID + '|' + fcmData.TargetID + '|' + fcmData.Title + '|' + fcmData.NickName + '|' + fcmData.SubData + '|' + date;
    
                let message;
                var badgeCount = result.BadgeCount;
                var notiBody = data.notiTitle + ' : ' + data.body;
                if(data.type == globalRouter.notiEventEnum.POST_DAILY_POPULAR|| data.type == globalRouter.notiEventEnum.POST_WEEKLY_BEST.value){
                    notiBody = data.body;
                }
                if(data.isSend == 1 || isBan == true){
                    message = {
                        data : {
                            title : "놀일터",
                            notibody : notiBody,
                            body : res,
                            click_action : "FLUTTER_NOTIFICATION_CLICK",
                            screen: page
                        },
                        token : result.Token,
                    }
                }else{
                    message = {
                        notification : {
                            title : "놀일터",
                            body : notiBody,
                        },
                        data : {
                            body : res,
                            click_action : "FLUTTER_NOTIFICATION_CLICK",
                            screen: page
                        },
                        apns: {
                            payload: {
                              aps: {
                                badge: badgeCount,
                                sound: 'default',
                              },
                            },
                        },
                        token : result.Token,
                    }
    
                    badgeCount =  Number(result.BadgeCount + 1);
                }
    
                admin.messaging().send(message)
                .then( fcmResult => {
                    result.update({BadgeCount : badgeCount});
                    console.log('fcm send is success' + fcmResult);
                    return true;
                })
                .catch( e => {
                    console.error(e);
                    return false; 
                })
            }
        }).catch( err => {
            console.error('FcmTokenList Select Faield ' + err);
            return false;
        })
    },
};
