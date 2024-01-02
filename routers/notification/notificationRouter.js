const router = require('express').Router(),
    globalRouter = require('../global'),
    models = require('../../models');

var URL = '/Notification/';

const { Op } = require('sequelize');

router.post('/UnSendSelect', async (req, res) => {
    let data = req.body;

    await models.NotificationList.findAll({
        where : {
            TargetID : data.userID,
            isSend : 0
        }    
    }).then(result => {

        let value = {
            isSend : 1,
        }

        for(let i = 0 ; i < result.length; ++i){
            result[i].update(value).then(result2 => {
                console.log(URL + "UnSendSelect update Success" + result2);
            })
        }

        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + "UnSendSelect error" + err);
        res.status(400).send(null);
    });
});

router.post('/Select', async( req, res) => {
    await models.NotificationList.findAll({
        order : [
            ['id', 'DESC']
        ],
        limit : 50,
        where : {
            TargetID : req.body.userID,
        },
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + "Select error" + err);
        res.status(400).send(null);
    });
})

router.post('/Update', async(req, res) => {
    await models.NotificationList.update(
        {
            isSend : 1
        },
        {
            where : { 
                TargetID : req.body.userID,
                id : {
                    [Op.lte] : req.body.id   
                }
             }
        }
    ).catch(err => {
        console.error(URL + "Update error" + err);
        res.status(400).send(null);
    });

    res.status(200).send(true);
})


module.exports = router;