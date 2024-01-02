const router = require('express').Router(),
    globalRouter = require('../global'),
    models = require('../../models');

const { Op } = require('sequelize');

var URL = '/User/';

router.get('/Report/Select/Post', async(req,res) => {
    await models.CommunityPostDeclare.findAll({
        where : { IsProcessed : 0},
        order : [
            ['id', 'DESC']
        ],
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.log(URL + '/Report/Select/Post CommunityPostDeclare findAll failed ' + err);
        res.status(404).send(null);
    })
});

router.get('/Report/Select/Reply', async(req, res) => {
    await models.CommunityPostReplyDeclare.findAll({
        where : { IsProcessed : 0},
        order : [
            ['id', 'DESC']
        ],
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.log(URL + '/Report/Select/Reply CommunityPostReplyDeclare findAll failed ' + err);
        res.status(404).send(null);
    })
});

router.get('/Report/Select/ReplyReply', async(req, res) => {
    await models.CommunityPostReplyReplyDeclare.findAll({
        where : { IsProcessed : 0},
        order : [
            ['id', 'DESC']
        ],
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.log(URL + '/Report/Select/ReplyReply CommunityPostReplyReplyDeclare findAll failed ' + err);
        res.status(404).send(null);
    })
});

router.get('/Report/Select/User', async(req, res) => {
    await models.Declare.findAll({
        where : { IsProcessed : 0},
        order : [
            ['id', 'DESC']
        ],
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.log(URL + '/Report/Select/User Declare findAll failed ' + err);
        res.status(404).send(null);
    })
});

router.post('/Report/Select/ByTargetID', async(req, res) => {
    switch(req.body.type){
        case 0 : 
        {
            await models.CommunityPostDeclare.findAll({
                where : {
                    PostID : req.body.targetID
                }
            }).then(result =>{
                res.status(200).send(result);
            }).catch(err => {
                res.status(404).send(null);
            });
        }
        break;
        case 1 : 
        {
            await models.CommunityPostReplyDeclare.findAll({
                where : {
                    ReplyID : req.body.targetID
                }
            }).then(result =>{
                res.status(200).send(result);
            }).catch(err => {
                res.status(404).send(null);
            });
        }
        break;
        case 2 : 
        {
            await models.CommunityPostReplyReplyDeclare.findAll({
                where : {
                    ReplyReplyID : req.body.targetID
                }
            }).then(result =>{
                res.status(200).send(result);
            }).catch(err => {
                res.status(404).send(null);
            });
        }
        break;
        case 3 : 
        {
            await models.Declare.findAll({
                where : {
                    DeclareID : req.body.targetID
                }
            }).then(result =>{
                res.status(200).send(result);
            }).catch(err => {
                res.status(404).send(null);
            });
        }
        break;
    }

    res.status(200).send(false);
});

router.post('/Post/Select/Detail', async(req, res) => {
    await models.CommunityPost.findOne({
        where : { id : req.body.id },
        include: [
            {
                model : models.CommunityPhoto,
                required : false,
                limit : 5,
                order : [
                    ['Index', 'ASC']
                ]
            },
            {
                model : models.CommunityPostReply,
                required : false,
            },
            {
                model : models.CommunityPostLike,
                required : false
            },
            {
                model : models.CommunityPostDeclare,
                required : false
            }
        ],
    }).then(async result => {
        var community = result;
        var resData = {
            community
        };
        if(result.Type == 2){ //모여라
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
                console.error(URL + '/Post/Select/Detail CommunityPost Gathering findOne Failed ' + err );
                res.status(400).send(null);
            })

            resData['gathering'] = gathering;
        }

        res.status(200).send(resData);
    }).catch(err => {
        console.error(URL + '/Post/Select/Detail CommunityPost findOne Failed ' + err );
        res.status(400).send(null);
    })
});

router.post('/Post/Select/ReplyDetail', async(req, res) => {
    await models.CommunityPostReply.findOne({
        where : { id : req.body.id },
        include : [
            {
                model : models.CommunityPostReplyReply,
                require : false
            },
            {
                model : models.CommunityPostReplyLike,
                require : false
            },
            {
                model : models.CommunityPostReplyDeclare,
                require : false
            }
        ]
    }).then(async result => {
        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + '/Post/Select/ReplyDetail CommunityPostReply findOne Failed ' + err );
        res.status(400).send(null);
    })
});

router.post('/Post/Select/ReplyReplyDetail', async(req, res) => {
    await models.CommunityPostReplyReply.findOne({
        where : { id : req.body.id},
        include : [
            {
                model : models.CommunityPostReplyReplyDeclare,
                require : false
            }
        ]
    }).then(async result => {
        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + '/Post/Select/ReplyReplyDetail CommunityPostReply findOne Failed ' + err );
        res.status(400).send(null);
    })
});

//userID:integer,index:integer,type:integer(0: 놀터, 1:일터, 2:모여라),categoryList:array<string>,tagList:array<string>
router.post('/Post/Select/List', async(req, res) => {

    var rule = {};
    if(req.body.type != 3){
        rule.Type = req.body.type * 1;
    }

    await models.CommunityPost.findAll({
        where : rule,
        limit : req.body.limit,
        offset : req.body.index * 1,
        order : [
            ['id', 'DESC']
        ],
        include: [
            {
                model : models.CommunityPhoto,
                required : false,
                limit : 5,
                order : [
                    ['Index', 'ASC']
                ]
            },
        ],
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + '/Post/Select/List CommunityPost findAll Failed ' + err );
        res.status(400).send(null);
    })
});

//userID:integer,index:integer,type:integer(0: 놀터, 1:일터),categoryList:List<string>,tagList:List<string>
router.post('/Post/Select/PopularList', async(req, res) => {
    var rule = {};
    if(req.body.type != 3){
        rule.Type = req.body.type * 1;
    }

    var postIndexies = await models.PopularPostIndex.findAll({
        limit : req.body.limit,
        offset : req.body.index * 1,
        order : [
            ['id', 'DESC']
        ],
        where : rule
    });

    var resData = [];
    for(var i = 0 ; i < postIndexies.length; ++i){
        await models.CommunityPost.findOne({
            where  : {
                id : postIndexies[i].PostID,
            },
            include: [
                {
                    model : models.CommunityPhoto,
                    required : false,
                    limit : 5,
                    order : [
                        ['Index', 'ASC']
                    ]
                }
            ],
        }).then(async result => { //모여라의 인기게시글은 없음
            var community = result;

            var data = {
                community,
            }

            resData.push(data);
        }).catch(err => {
            console.error(URL + '/Select CommunityPost findAll Failed' + err);
            res.status(400).send(null);
        })
    }
    if(globalRouter.IsEmpty(resData))
        resData = null;

    res.status(200).send(resData);
});


//userID:integer,type:integer,categoryList:List<string>,tagList:List<string>,index:integer
router.post('/Post/Select/HotList', async(req, res) => {
    var rule = {};
    if(req.body.type != 3){
        rule.Type = req.body.type * 1;
    }

    var hotPosts = await models.CommunityHotPost.findAll({
        limit : req.body.limit,
        offset : req.body.index * 1,
        order : [
            ['Point', 'DESC']
        ],
        where : rule
    });

    var resData = [];
    for(var i = 0 ; i < hotPosts.length ; ++i){
        await models.CommunityPost.findOne({
            where  : {
                id : hotPosts[i].PostID,
            },
            include: [
                {
                    model : models.CommunityPhoto,
                    required : false,
                    limit : 5,
                    order : [
                        ['Index', 'ASC']
                    ]
                }
            ],
        }).then(async result => { //모여라의 인기게시글은 없음
            if(!globalRouter.IsEmpty(result)){
                var community = result;
    
                var data = {
                    community
                }
    
                resData.push(data);
            }
        }).catch(err => {
            console.error(URL + '/Select/HotList CommunityPost findAll Failed' + err);
            res.status(400).send(null);
        })
    }

    if(globalRouter.IsEmpty(resData))
        resData = null;

    res.status(200).send(resData);
});


//제목 및 내용 검색
//keywords:string,index:integer,type:integer
router.post('/Search/Contents', async(req, res) => {
    var rule = {};
    rule = {
        [Op.or] : {
            Title : {[Op.like] : '%' + req.body.keywords + '%'},
            Contents : {[Op.like] : '%' + req.body.keywords + '%'},
        }
    }

    if(req.body.type != 3){
        rule.Type = req.body.type * 1;
    }

    await models.CommunityPost.findAll({
            limit : req.body.limit,
            index : req.body.index * 1,
            where : rule,
            include: [
                    {
                        model : models.CommunityPhoto,
                        required : false,
                        limit : 5,
                        order : [
                            ['Index', 'ASC']
                        ]
                    }
            ],
            order: [['id', 'DESC']],
    }).then(async result => {

            let resData = [];

            for(var i = 0 ; i < result.length; ++i){
                    var community = result[i];

                    var data = {
                        community,
                    }
    
                    resData.push(data);
            }

            if(globalRouter.IsEmpty(resData))
                    resData = null;

            res.status(200).send(resData);
    }).catch(err => {
            console.error(URL + '/Search CommunityPostReply findAll Failed' + err);
            res.status(400).send(null);
    })
});

//String:keywords
router.post('/Search/Gathering/Contents', async(req, res) => {
    await models.CommunityPost.findAll({
            limit : req.body.limit,
            index : req.body.index * 1,
            where : {
                    [Op.or] : {
                            Title : {[Op.like] : '%' + req.body.keywords + '%'},
                            Contents : {[Op.like] : '%' + req.body.keywords + '%'},
                    },
                    Type : 2
            },
            include: [
                    {
                        model : models.CommunityPhoto,
                        required : false,
                        limit : 5,
                        order : [
                            ['Index', 'ASC']
                        ]
                    }
            ],
            order: [['id', 'DESC']],
    }).then(async result => {

            let resData = [];

            for(var i = 0 ; i < result.length; ++i){
                    var community = result[i];

                    var gathering = await models.Gathering.findOne({
                        where : { PostID : result[i].id },
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
    
                    resData.push(data);
            }

            if(globalRouter.IsEmpty(resData))
                    resData = null;

            res.status(200).send(resData);
    }).catch(err => {
            console.error(URL + '/Search CommunityPostReply findAll Failed' + err);
            res.status(400).send(null);
    })
});

//태그 검색
//name:string,index:integer,type:integer
router.post('/Search/Tag', async(req, res) => {
    try{
        const hashTags = await models.Tag.findAll({
            limit : req.body.limit,
            index : req.body.index * 1,
            where : { 
                Name : { [Op.like] : '%' + req.body.name + '%' }
            } ,
        }).catch(err => {
            console.log(URL + '/Search/Tag find error ' + err);
            res.status(400).send(null);
        })

        res.status(200).send(hashTags);

    } catch (err) {
        console.log(URL + '/Search/Tag error ' + err);
        res.status(400).send(null);
    }
})


//선택한 tag 게시글 가져오기
//tag:string,index:integer,type:integer(0:놀터, 1:일터, 2:모여라)
router.post('/Select/Tag', async(req, res) => {
    await models.CommunityPost.findAll({
        limit : req.body.limit,
        index : req.body.index * 1,
        include: [
            {
                model : models.CommunityPhoto,
                required : false,
                limit : 5,
                order : [
                    ['Index', 'ASC']
                ]
            }
        ],
        where: {
                Type : req.body.type * 1,
                Tag : req.body.tag,
        },
        order : [
            ['id', 'DESC']
        ],
    }).then(async result => {

        let resData = [];
        for(var i = 0 ; i < result.length; ++i){
                var community = result[i];

                if(result[i].Type == 2){ // GATHERING
                    var gathering = await models.Gathering.findOne({
                        where : { PostID : result[i].id },
                        include : [
                            {
                                model : models.GatheringMembers,
                                required : true,
                                limit : 99
                            }
                        ]
                    }).catch(err => {
                        console.error(URL + '/Select/Tag CommunityPost Gathering findOne Failed ' + err );
                        res.status(400).send(null);
                    })
    
                    var data = {
                        community,
                        gathering
                    }
    
                    resData.push(data);
                }else{
                    var data = {
                        community,
                    }
    
                    resData.push(data);
                }
        }

        if(globalRouter.IsEmpty(resData))
                resData = null;

        res.status(200).send(resData);
    }).catch(err => {
            console.error(URL + '/Select CommunityPost findAll Failed' + err);
            res.status(400).send(null);
    })
})

router.get('/Block/Select/UserList', async(req, res) => {
    await models.User.findAll({
        where : {
            [Op.or] : [{ LoginState : 2}, {LoginState : 3}],
        },
        include: [
            {
                model : models.BlockTime,
                required : true,
                order : [
                    ['id', 'DESC']
                ]
            },
        ],
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + '/Block/Select/UserList User findAll Failed ' + err );
        res.status(400).send(null);
    })
});

router.post('/User/Select/Detail', async(req, res) => {
    await models.User.findOne({
        where : {
            UserID : req.body.userID
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

        var user = result;
        var posts = await models.CommunityPost.findAll({where : {UserID : req.body.userID},        
            include: [
                {
                    model : models.CommunityPhoto,
                    required : false,
                    limit : 5,
                    order : [
                        ['Index', 'ASC']
                    ]
                },
            ],
        });
        var postDeclares = await models.CommunityPostDeclare.findAll({where : {UserID : req.body.userID}});
        var replies = await models.CommunityPostReply.findAll({where : {UserID : req.body.userID}});
        var replyDeclares = await models.CommunityPostReplyDeclare.findAll({where : {UserID : req.body.userID}});
        var replyreplies = await models.CommunityPostReplyReply.findAll({where : {UserID : req.body.userID}});
        var replyreplyDeclares = await models.CommunityPostReplyReplyDeclare.findAll({where : {UserID : req.body.userID}});
        var writeDeclares = await models.Declare.findAll({where : {UserID : req.body.userID}});
        var receiveDeclares = await models.Declare.findAll({where : {DeclareID: req.body.userID}});

        var data = {
            user,
            posts,
            postDeclares,
            replies,
            replyDeclares,
            replyreplies,
            replyreplyDeclares,
            writeDeclares,
            receiveDeclares
        }

        res.status(200).send(data);
    }).catch(err => {
        console.error(URL + '/User/Select/Detail User findOne Failed ' + err );
        res.status(400).send(null);
    })
})

router.post('/User/Update/LoginState', async(req, res) => {
    await models.User.update(
        {
            LoginState : req.body.loginState
        },
        {
            where : { UserID : req.body.userID}
        }
    ).then(async result => {

        if(!globalRouter.IsEmpty(req.body.endTime)){
            await models.BlockTime.create({
                UserID : req.body.userID,
                EndTime : req.body.endTime,
                Contents : req.body.contents
            }).catch(err => {
                console.error(URL + '/User/Update/LoginState BlockTime create Failed ' + err );
                res.status(400).send(null);        
            })
        }

        res.status(200).send(true);
    }).catch(err => {
        console.error(URL + '/User/Update/LoginState User update Failed ' + err );
        res.status(400).send(null);
    })
})

//단일 처리
router.post('/User/Declare/OneClear', async(req, res) => {
    switch(req.body.type){
        case 0:     //게시글
        {
            await models.CommunityPostDeclare.update(
                {
                    IsProcessed : 1
                },
                {
                    where : { id : req.body.id}       
                }
            ).catch(err => {
                console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                res.status(400).send(null);
            });
    
            res.status(200).send(true);
        }
        break;
        case 1:     //댓글
        {
            await models.CommunityPostReplyDeclare.update(
                {
                    IsProcessed : 1
                },
                {
                    where : { id : req.body.id}       
                }
            ).catch(err => {
                console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                res.status(400).send(null);
            });
    
            res.status(200).send(true);
        }
        break;
        case 2:     //답글
        {
            await models.CommunityPostReplyReplyDeclare.update(
                {
                    IsProcessed : 1
                },
                {
                    where : { id : req.body.id}       
                }
            ).catch(err => {
                console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                res.status(400).send(null);
            });
    
            res.status(200).send(true);
        }
        break;
        case 3:     //유저가,유저를
        {
            await models.Declare.update(
                {
                    IsProcessed : 1
                },
                {
                    where : { id : req.body.id}          
                }
            ).catch(err => {
                console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                res.status(400).send(null);
            });
    
            res.status(200).send(true);
        }
        break;
    }
})

router.post('/User/Declare/AllClear', async(req, res) => {
    if(globalRouter.IsEmpty(req.body.declareidlist)){
        res.status(200).send(false);
    }else{
        switch(req.body.type){
            case 0:     //게시글
            {
                for(var i = 0 ; i < req.body.declareidlist.length; ++i){
                    await models.CommunityPostDeclare.update(
                        {
                            IsProcessed : 1
                        },
                        {
                            where : { id : req.body.declareidlist[i]}       
                        }
                    ).catch(err => {
                        console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                        res.status(400).send(null);
                    });
                }
        
                res.status(200).send(true);
            }
            break;
            case 1:     //댓글
            {
                for(var i = 0 ; i < req.body.declareidlist.length; ++i){
                    await models.CommunityPostReplyDeclare.update(
                        {
                            IsProcessed : 1
                        },
                        {
                            where : { id : req.body.declareidlist[i]}       
                        }
                    ).catch(err => {
                        console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                        res.status(400).send(null);
                    });
                }
        
                res.status(200).send(true);
            }
            break;
            case 2:     //답글
            {
                for(var i = 0 ; i < req.body.declareidlist.length; ++i){
                    await models.CommunityPostReplyReplyDeclare.update(
                        {
                            IsProcessed : 1
                        },
                        {
                            where : { id : req.body.declareidlist[i]}       
                        }
                    ).catch(err => {
                        console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                        res.status(400).send(null);
                    });
                }
        
                res.status(200).send(true);
            }
            break;
            case 3:     //유저가,유저를
            {
                for(var i = 0 ; i < req.body.declareidlist.length; ++i){
                    await models.Declare.update(
                        {
                            IsProcessed : 1
                        },
                        {
                            where : { id : req.body.declareidlist[i]}       
                        }
                    ).catch(err => {
                        console.error(URL + '/User/Declare/AllClear declareidlist update Failed ' + err );
                        res.status(400).send(null);
                    });
                }
        
                res.status(200).send(true);
            }
            break;
        }
        
    }
});

module.exports = router;