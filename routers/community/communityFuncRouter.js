const router = require('express').Router(),
        models = require('../../models'),
        globalRouter = require('../global');

const { Op } = require('sequelize');

const LIKES_LIMIT = 999;

module.exports = {
    SelectByID : async function SelectByID( communityID , userID) {
        return new Promise(async (resolv, reject) => {
                await models.CommunityPost.findOne({
                        include: [
                                {
                                    model : models.CommunityPhoto,
                                    required : true,
                                    limit : 5,
                                    order : [
                                        ['Index', 'ASC']
                                    ]
                                }
                        ],
                        where : {
                                id : communityID,
                        }
                }).then(async result => {
                        if(globalRouter.IsEmpty(result)){
                                resolv(null);
                        }else{
                                var community = result;

                                if(result.Type == 2){ // GATHERING
                                    var gathering = await models.Gathering.findOne({
                                        where : { PostID : result.id },
                                        include : [
                                            {
                                                model : models.GatheringMembers,
                                                required : true,
                                                limit : 99
                                            }
                                        ]
                                    }).catch(err => {
                                        console.error(URL + '/Select/Detail CommunityPostReply Gathering findOne Failed ' + err );
                                        res.status(400).send(null);
                                    })

                                    var data = {
                                        community,
                                        gathering
                                    }

                                    resolv(data);
                                }else{
                                    var like = await models.CommunityPostLike.findOne({ where : { UserID : userID, PostID : result.id}});
                                    var isLike = globalRouter.IsEmpty(like) ? false : true;
                                    var reply = await models.CommunityPostReply.findOne({ where : { UserID : userID, PostID : result.id}});
                                    var isReply = globalRouter.IsEmpty(reply) ? false : true;
                                    var subscribe = await models.CommunityPostSubscriber.findOne({ where : { UserID : userID, PostID : result.id}});
                                    var isSubscribe = globalRouter.IsEmpty(subscribe) ? false : true;

                                    var data = {
                                        community,
                                        isLike,
                                        isReply,
                                        isSubscribe
                                    }

                                    resolv(data);
                                }
                        }
                }).catch(err => {
                        console.log('CommunityPost GetPostByID Failed' + err);
                        reject(null);
                })
        });
    },
    SelectOneByID : async function SelectOneByID( community ) {
        return new Promise(async (resolv, reject) => {
                console.log(community);

                var declares = await models.CommunityPostDeclare.findAll({where : {PostID : community.id}});
                var declareLength = declares.length;
                var community = community;

                var user = await models.User.findOne(
                        {
                                attributes: [ 
                                        "UserID", "NickName",
                                ],
                                where : {UserID : community.UserID}
                        }
                );

                var userID = user.UserID;
                var nickName = user.NickName;

                if(community.Type == 2){ // GATHERING
                    var gathering = await models.Gathering.findOne({
                        where : { PostID : community.id },
                        include : [
                            {
                                model : models.GatheringMembers,
                                required : true,
                                limit : 99
                            }
                        ]
                    }).catch(err => {
                        console.error(URL + '/Select/Detail CommunityPostReply Gathering findOne Failed ' + err );
                        reject(null);
                    })

                    var data = {
                        userID,
                        nickName,
                        community,
                        declareLength,
                        gathering
                    }

                    resolv(data);
                }else{
                    var data = {
                        userID,
                        nickName,
                        community,
                        declareLength
                    }

                    resolv(data);
                }
        });
    }
};