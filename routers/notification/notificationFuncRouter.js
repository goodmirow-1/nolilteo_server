const router = require('express').Router(),
        models = require('../../models'),
        moment = require('moment'),
        globalRouter = require('../global');

    require('moment-timezone');

    moment.tz.setDefault("Asia/Seoul");

module.exports = {
    Insert : async function InsertNotification( data ) {
        var date = moment().format('yyyy-MM-DD HH:mm:ss');

        var targetIndex = data.targetIndex;
        var teamIndex = data.teamIndex;

        if(globalRouter.IsEmpty(targetIndex)){
            targetIndex = 0
        }

        return new Promise((resolv, reject) => {

            var subData = data.tableIndex.toString() + '|' + data.subTableIndex.toString() + '|' + data.cType.toString();

            models.NotificationList.create({
                UserID: data.userID,
                TargetID : data.targetID,
                Title: data.postTitle,
                NickName: data.nickName,
                Type : data.type,
                SubData : subData,
                isSend : data.isSend
            }).then( result => {
                resolv(result);
            }).catch( err => {
                console.error('InsertNotification create failed ' + err);
                resolv(null);
            })
        });
    },
    UnSendSelect : async function UnSendSelect( userID ) {
        return new Promise((resolv, reject) => {
            models.NotificationList.findAll({
                where : {
                    TargetID : userID,
                    IsSend : 0
                }
            }).then( result => {
                if(globalRouter.IsEmpty(result)){
                    resolv(false);
                }else{
                    resolv(true);
                }
            }).catch( err => {
                console.error('UnSendSelect findAll failed ' + err);
                resolv(null);
            })
        });
    }
};
