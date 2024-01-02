const router = require('express').Router(),
    globalRouter = require('../global'),
    models = require('../../models'),
    formidable = require('formidable'),
    fs_extra = require('fs-extra'),
    moment = require('moment'),
    fs = require('fs');


const fcmFuncRouter = require('../fcm/fcmFuncRouter');
const communityFuncRouter = require('./communityFuncRouter');
const verify = require('../../controllers/parameterToken');
const limiter = require('../../config/limiter');
const client = globalRouter.client;

const { Op } = require('sequelize');

const { promisify } = require("util");
const getallAsync = promisify(client.get).bind(client);

let URL = '/CommunityPost';
const LIKES_LIMIT = 999;
const PHOTOS_MAX = 5;
const POPULAR_BASE = 5;
const CONTENTS_MAX = 30;

//등록및수정 - formidable
//생성시 : userID:integer,category:string,tag:string,title:string,contents:string,type:integer,isCreate:1,accessToken:string,이미지파일 ,nickName:string,location:string
//수정시 : 위와 동일 + isCreate:0,id:integer(게시글 id),removeindexlist:array<int>(삭제할 이미지 index list), imageurllist:array<int>(수정되는 사진들 id list)
//type이 2일경우(모여라) : detailLocation:string,Date:string(ex: 2022-08-20 08:25:44) 형식으로 보낼 것,maxMemberNum:integer,minAge:integer,maxAge:integer,needGender:integer,link:string
router.post('/InsertOrModify',  limiter, async (req, res) => {
    console.log(URL + '/InsertOrModify flow start');

    var fields = new Map();

    var remove_id_values = [];
    var image_url_ids = [];
    var image_url_indexies = [];
    var file_indexies = [];
    var file_widths = [];
    var file_heights = [];
    var file_descs = [];

    var files = [];

    var form = new formidable.IncomingForm();

    form.encoding = 'utf-8';
    form.uploadDir = './allphotos/temp';
    form.multiples = true;
    form.keepExtensions = true;


    form.on('field', function (field, value) { //값 하나당 한번씩 돌아가므로,
        console.log(field + ' ' + value);
        fields.set(field, value);
        if(field == 'removeidlist') remove_id_values.push(value);
        else if(field == 'imageurllist') image_url_ids.push(value);
        else if(field == 'imageurlindexlist') image_url_indexies.push(value);
        else if(field == 'fileindexlist') file_indexies.push(value);
        else if(field == 'filewidthlist') file_widths.push(value);
        else if(field == 'fileheightlist') file_heights.push(value);
        else if(field == 'filedesclist') file_descs.push(value);
    });

    form.on('file', function (field, file) {
        files.push(file);
        console.log("what is file name in form.on file", file.name);
    }).on('end', async function() {
        if(await verify.verifyToken(fields.get('accessToken')) == false){
                if(fields.get('isCreate') == 1){
                        res.status(400).send(null);
                }else{
                        res.status(200).send(await communityFuncRouter.SelectByID(fields.get('id')));
                }
                
        }else{
                if(fields.get('isCreate') == 1) {
                    await models.CommunityPost.create({
                            UserID : fields.get('userID'),
                            Category : fields.get('category'),
                            Tag : fields.get('tag'),
                            Location: fields.get('location'), 
                            Title : fields.get('title'),
                            NickName : fields.get('nickName'),
                            Contents : fields.get('contents'),
                            Type : fields.get('type'),
                            DeleteType : 0
                    }).then(async result => {

                        globalRouter.makeFolder('communityphotos/' + result.id); //생성된 커뮤니티 글 id 값으로 폴더 생성 //한번만 만들어짐 !
                        for (var i = 0; i < files.length; ++i) {
                            var folderName = 'communityphotos/' + result.id;
                            var fileName = Date.now() + '.' + files[i].name.split('.').pop();
                            var resUrl = folderName + '/' + fileName

                            fs_extra.rename(files[i].path, resUrl); //파일 앞서 만든 폴더에 저장

                            await models.CommunityPhoto.create({
                                PostID : result.id,
                                Index : i,
                                ImageURL : resUrl,
                                Width : file_widths[i],
                                Height : file_heights[i],
                                Description : globalRouter.IsEmpty(file_descs) ? '' : file_descs[i]
                            }).catch(err => {
                                console.error(URL + '/InsertOrModify CommunityPhoto create Failed ' + err);
                            })
                        }

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
                                if(userResult[i].UserID == fields.get('userID')) continue;

                                var getAllRes = await getallAsync(globalRouter.serverName+String(userResult[i].UserID));

                                if(globalRouter.IsEmpty(getAllRes)) continue;
                                var resJson = JSON.parse(getAllRes);

                                var data = JSON.stringify({
                                    targetID : userResult[i].UserID,
                                    category : fields.get('category'),
                                    tag : fields.get('tag'),
                                    location : fields.get('location'),
                                    notiTitle : "새로운 글",
                                    type : globalRouter.notiEventEnum.POST_NEW_UPDATE.value,
                                    cType : result.Type,
                                    body : "새 글이 작성되었습니다.",
                                    isSend : resJson.isOnline,
                                })

                                if(fcmFuncRouter.SendFcmEvent(data)){
                                        console.log(URL + '/InsertOrModify POST_NEW_UPDATE fcm is true');
                                }else{
                                        console.log(URL + '/InsertOrModify POST_NEW_UPDATE fcm is false');
                                }
                                    
                            }
                        })

                        // //태그 등록
                        if(fields.get('tag') != ''){
                            var tag = await models.Tag.findOne({ where : {Name: fields.get('tag')}});

                            var playcount = fields.get('type') == 0 ? 1 : 0;
                            var workcount = fields.get('type') == 1 ? 1 : 0;
                            var gathercount = fields.get('type') == 2 ? 1 : 0;
                            var wbticount = fields.get('type') == 3 ? 1 : 0;

                            if(globalRouter.IsEmpty(tag)){
                                await models.Tag.create({
                                    Name : fields.get('tag'),
                                    PlayCount : playcount,
                                    WorkCount : workcount,
                                    GatherCount : gathercount,
                                    WbtiCount : wbticount,
                                }).catch (err => {
                                    console.log(URL + '/InsertOrModify tag create error ' + err);
                                })
                            }else{
                                playcount = fields.get('type') == 0 ? tag.PlayCount + 1 : tag.PlayCount;
                                workcount = fields.get('type') == 1 ? tag.WorkCount + 1 : tag.WorkCount;
                                gathercount = fields.get('type') == 2 ? tag.GatherCount + 1 : tag.GatherCount;
                                wbticount = fields.get('type') == 3 ? tag.WbtiCount + 1 : tag.WbtiCount;

                                tag.update(
                                    {
                                        PlayCount : playcount,
                                        WorkCount : workcount,
                                        GatherCount : gathercount,
                                        WbtiCount : wbticount,
                                    }
                                ).catch (err => {
                                    console.log(URL + '/InsertOrModify update create error ' + err);
                                })
                            }
                        }

                        if(fields.get('type') == 2){ //gathering
                            await models.Gathering.create({
                                PostID : result.id,
                                DetailLocation : fields.get('detailLocation'),
                                Date: fields.get('date'),
                                MaxMemberNum: fields.get('maxMemberNum'),
                                MinAge: fields.get('minAge'),
                                MaxAge: fields.get('maxAge'),
                                NeedGender: fields.get('needGender'),
                                Link: fields.get('link')
                            }).then(async result2 => {
                                await models.GatheringMembers.create({
                                    GatheringID : result2.id,
                                    UserID : fields.get('userID')
                                }).then(async result3 => {
                                    res.status(200).send(await communityFuncRouter.SelectByID(result.id, fields.get('userID')));
                                }).catch (err => {
                                    console.log(URL + '/Gathering/Join GatheringMembers create error ' + err);
                                    res.status(400).send(null);
                                })
                            }).catch(err => {
                                console.error(URL + '/InsertOrModify gathering create Failed ' + err);
                                res.status(400).send(null);
                            })
                        }else{
                            res.status(200).send(await communityFuncRouter.SelectByID(result.id, fields.get('userID')));
                        }
                    }).catch(err => {
                            console.error(URL + '/InsertOrModify CommunityPost create Failed ' + err);
                            res.status(400).send(null);
                    })
                }else{
                    var community = await models.CommunityPost.findOne({ where : { id : fields.get('id')}});

                    community.update(
                        {
                            Title : fields.get('title'),
                            Contents : fields.get('contents'),
                            IsModify : true
                        },
                        {
                            where : { UserID : fields.get('userID')}
                        }
                    ).then(async result => {
                        for(var i = 0 ; i < remove_id_values.length; ++i){
                            var photo = await models.CommunityPhoto.findOne({ where : {id : remove_id_values[i]}});

                            fs.unlink(photo.ImageURL, function(err) {
                                photo.destroy();

                                if(err){
                                    console.error(URL + '/InsertOrModify error while delete communityphoto ' + err);
                                    res.status(400).send(null);
                                }
                            })
                        }

                        for(var i = 0 ; i < image_url_ids.length; ++i){
                            await models.CommunityPhoto.update(
                                {
                                    Index : image_url_indexies[i] * 1,
                                    Description : globalRouter.IsEmpty(file_descs) ? '' : file_descs[i]
                                },
                                {
                                    where : { id : image_url_ids[i]}
                                }
                            ).catch (err => {
                                console.error(URL + '/InsertOrModify error while delete communityphoto ' + err);
                                res.status(400).send(null);
                            })
                        }

                        for(var i = image_url_ids.length ; i < image_url_ids.length + files.length; ++i){
                            var index = i - image_url_ids.length;

                            var folderName = 'communityphotos/' + community.id;
                            var fileName = Date.now() + '.' + files[index].name.split('.').pop();
                            var resUrl = folderName + '/' + fileName;

                            fs_extra.rename(files[index].path, resUrl); //파일 앞서 만든 폴더에 저장

                            await models.CommunityPhoto.create({
                                    PostID : community.id,
                                    Index : file_indexies[index] * 1,
                                    ImageURL : resUrl,
                                    Width : file_widths[i] * 1,
                                    Height : file_heights[i] * 1 ,
                                    Description : file_descs[i]
                            }).then(petPhotoResult => {
                            }).catch(err => {
                                    console.error(URL + '/InsertOrModify PetPhoto create Failed ' + err);
                                    res.status(400).send(null);
                            })
                        }

                        if(fields.get('type') == 2){ //gathering
                            await models.Gathering.update(
                                {
                                    DetailLocation : fields.get('detailLocation'),
                                    Date: fields.get('date'),
                                    MaxMemberNum: fields.get('maxMemberNum'),
                                    MinAge: fields.get('minAge'),
                                    MaxAge: fields.get('maxAge'),
                                    NeedGender: fields.get('needGender'),
                                    Link: fields.get('link')
                                },
                                {
                                    where : { PostID : community.id, }
                                }
                            ).catch(err => {
                                console.error(URL + '/InsertOrModify gathering create Failed ' + err);
                            })
                        }

                        res.status(200).send(await communityFuncRouter.SelectByID(community.id, fields.get('userID')));
                    })
                }
        }
    }).on('error', function (err) {
            console.error('[error] error ' + err);
            globalRouter.removefiles('./AllPhotos/Temp/');
            res.status(400).send(null);
    });

    form.parse(req, function (error, field, file) {
            console.log('[parse()] error : ' + error + ', field : ' + field + ', file : ' + file);
            console.log(URL + '/modify success');
    });
});

//게시글 가져오기
//userID:integer,index:integer,type:integer(0: 놀터, 1:일터, 2:모여라),categoryList:array<string>,tagList:array<string>
router.post('/Select', async(req, res) => {
    var rule = {};

    if(0 == req.body.needAll){
        var categoryList = globalRouter.IsEmpty(req.body.categoryList) ? [] : globalRouter.getWords(req.body.categoryList);
        var tagList = globalRouter.IsEmpty(req.body.tagList) ? [] : globalRouter.getWords(req.body.tagList);
        var locationList = globalRouter.IsEmpty(req.body.locationList) ? [] : globalRouter.getWords(req.body.locationList);
    
        var filterData = [];
        for(var i = 0 ; i < categoryList.length ; ++i){
            filterData.push({Category : categoryList[i]});
        }
    
        for(var i = 0 ; i < tagList.length ; ++i){
            filterData.push({Tag : tagList[i]});
        }

        var locationFilterData = [];
        for(var i = 0 ; i < locationList.length; ++i){
            var tokenList = globalRouter.getAllLocationWords(locationList[i]);

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
        var locationList = globalRouter.IsEmpty(req.body.locationList) ? [] : globalRouter.getWords(req.body.locationList);

        var locationFilterData = [];
        for(var i = 0 ; i < locationList.length; ++i){
            var tokenList = globalRouter.getAllLocationWords(locationList[i]);

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

    console.log(rule);

    await models.CommunityPost.findAll({
            limit : CONTENTS_MAX,
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
            where: rule
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
                        console.error(URL + '/Select/Detail CommunityPostReply Gathering findOne Failed ' + err );
                        res.status(400).send(null);
                    })

                    var data = {
                        community,
                        gathering
                    }

                    resData.push(data);
                }else{
                    var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
                    var isLike = globalRouter.IsEmpty(like) ? false : true;
                    var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
                    var isReply = globalRouter.IsEmpty(reply) ? false : true;

                    var data = {
                        community,
                        isLike,
                        isReply
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

//인기글 가져오기
//userID:integer,index:integer,type:integer(0: 놀터, 1:일터),categoryList:List<string>,tagList:List<string>
router.post('/Select/PopularList', async(req,res) => {

    var rule = {};
    var categoryList = globalRouter.IsEmpty(req.body.categoryList) ? [] : globalRouter.getWords(req.body.categoryList);
    var tagList = globalRouter.IsEmpty(req.body.tagList) ? [] : globalRouter.getWords(req.body.tagList);

    var filterData = [];
    for(var i = 0 ; i < categoryList.length ; ++i){
        filterData.push({Category : categoryList[i]});
    }

    for(var i = 0 ; i < tagList.length ; ++i){
        filterData.push({Tag : tagList[i] });
    }

    if(false == globalRouter.IsEmpty(filterData)){
        rule = {
            [Op.or] : filterData
        }
    }

    rule.Type = req.body.type * 1;

    console.log(rule);

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
                DeleteType : 0
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

            var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result.id}});
            var isLike = globalRouter.IsEmpty(like) ? false : true;
            var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result.id}});
            var isReply = globalRouter.IsEmpty(reply) ? false : true;

            var data = {
                community,
                isLike,
                isReply
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

//게시글 실시간등록 가져오기
router.post('/Select/PopularList/ByNow', async(req, res) => {
    var postIndexies = await models.PopularPostIndex.findAll({
        limit : req.body.limit * 1,
        offset : req.body.index * 1,
        order : [
            ['id', 'DESC']
        ],
    });

    var resData = [];
    for(var i = 0 ; i < postIndexies.length; ++i){
        await models.CommunityPost.findOne({
            where  : {
                id : postIndexies[i].PostID,
                DeleteType : 0
            },
            attributes : ["id", "Title", "Category"]
        }).then(result => { //모여라의 인기게시글은 없음
            if(!globalRouter.IsEmpty(result)){
                resData.push(result);
            }
        }).catch(err => {
            console.error(URL + '/PopularList/ByNow CommunityPost findAll Failed' + err);
            res.status(400).send(null);
        })
    }

    if(globalRouter.IsEmpty(resData))
        resData = null;

    res.status(200).send(resData);
})

//핫글 가져오기
//userID:integer,type:integer,categoryList:List<string>,tagList:List<string>,index:integer
router.post('/Select/HotList', async(req, res) => {
    var rule = {};
    var categoryList = globalRouter.IsEmpty(req.body.categoryList) ? [] : globalRouter.getWords(req.body.categoryList);
    var tagList = globalRouter.IsEmpty(req.body.tagList) ? [] : globalRouter.getWords(req.body.tagList);

    var filterData = [];
    for(var i = 0 ; i < categoryList.length ; ++i){
        filterData.push({Category : categoryList[i]});
    }

    for(var i = 0 ; i < tagList.length ; ++i){
        filterData.push({Tag : tagList[i] });
    }

    if(false == globalRouter.IsEmpty(filterData)){
        rule = {
            [Op.or] : filterData
        }
    }

    rule.Type = req.body.type * 1;
    
    var hotPosts = await models.CommunityHotPost.findAll({
        limit : 5,
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
                DeleteType : 0
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

                var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result.id}});
                var isLike = globalRouter.IsEmpty(like) ? false : true;
                var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result.id}});
                var isReply = globalRouter.IsEmpty(reply) ? false : true;
    
                var data = {
                    community,
                    isLike,
                    isReply
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
})

//시간별 핫 게시글 가져오기
router.post('/Select/HotList/ByHour', async(req, res) => {
    var hotPosts = await models.CommunityHotPost.findAll({
        limit : req.body.limit * 1,
        offset : req.body.index * 1,
        order : [
            ['Point', 'DESC']
        ],
    });

    var resData = [];
    for(var i = 0 ; i < hotPosts.length ; ++i){
        await models.CommunityPost.findOne({
            where  : {
                id : hotPosts[i].PostID,
                DeleteType : 0
            },
            attributes : ["id", "Title", "Category", "UserID" , "Tag", "Type"]
        }).then(result => {
            if(!globalRouter.IsEmpty(result)){
                resData.push(result);
            }
        }).catch(err => {
            console.error(URL + '/Select/HotList/ByHour CommunityPost findAll Failed' + err);
            res.status(400).send(null);
        })
    }

    if(globalRouter.IsEmpty(resData))
        resData = null;

    res.status(200).send(resData);
})

//좋아요한 목록 가져오기
//userID:integer,type:integer,index:integer
router.post('/Select/LikeList', async(req,res) => {
    var likes =  await models.CommunityPostLike.findAll({
        where : { UserID : req.body.userID ,Type : req.body.type },
        order : [
            ['id', 'DESC']
        ],
        limit : CONTENTS_MAX,
        offset : req.body.index * 1
    });

    var resData = [];
    for(var i = 0 ; i < likes.length; ++i){
        await models.CommunityPost.findOne({
            where  : {
                id : likes[i].PostID,
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
            ]
        }).then(async result => {

            var community = result;
            var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result.id}});
            var isLike = globalRouter.IsEmpty(like) ? false : true;
            var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result.id}});
            var isReply = globalRouter.IsEmpty(reply) ? false : true;

            var data = {
                community,
                isLike,
                isReply
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

//댓글목록 가져오기
//userID:integer,index:integer
router.post('/Select/ReplyList', async(req, res) => {
    var replies =  await models.CommunityPostReply.findAll({
        where : { UserID : req.body.userID },
        order : [
            ['id', 'DESC']
        ],
        limit : CONTENTS_MAX,
        offset : req.body.index * 1,
    });

    var resData = [];
    for(var i = 0 ; i < replies.length; ++i){
        await models.CommunityPost.findOne({
            attributes : [
                "id" , "Title"
            ],
            where  : {
                id : replies[i].PostID
            },
        }).then(async result => {
            var community = result;
            var like = await models.CommunityPostReplyLike.findOne({ where : { UserID : req.body.userID, ReplyID : replies[i].id}});
            var isLike = globalRouter.IsEmpty(like) ? false : true;

            var reply = replies[i];

            var data = {
                community,
                reply,
                isLike,
            }

            resData.push(data);
        }).catch(err => {
            console.error(URL + '/Select CommunityPostReply findAll Failed' + err);
            res.status(400).send(null);
        })
    }

    if(globalRouter.IsEmpty(resData))
        resData = null;

    res.status(200).send(resData);
});

//대댓글 가져오기
//userID:integer,index:integer
router.post('/Select/ReplyReplyList', async(req, res) => {
    await models.CommunityPostReplyReply.findAll({
        where : { UserID : req.body.userID },
        order : [
            ['id', 'DESC']
        ],
        limit : CONTENTS_MAX,
        offset : req.body.index * 1,
    }).then(result => {
        res.status(200).send(result);
    }).catch(err => {
        console.error(URL + '/Select CommunityPostReply findAll Failed' + err);
        res.status(400).send(null);
    });
});

//활동한 모여라 가져오기
//userID:integer,index:integer
router.post('/Select/GatheringList', async(req,res) => {
    var members = await models.GatheringMembers.findAll({
        where : { UserID : req.body.userID },
        order : [
            ['id', 'DESC']
        ],
        limit : CONTENTS_MAX,
        offset : req.body.index * 1,
    })

    var resData = [];
    for(var i = 0 ; i < members.length; ++i){
        var gather = await models.Gathering.findOne({where : { id : members[i].GatheringID}});

        await models.CommunityPost.findOne({
            where  : {
                id : gather.PostID,
            },
            include: [
                {
                    model : models.CommunityPhoto,
                    required : false,
                    limit : 5,
                    order : [
                        ['Index', 'ASC']
                    ]
                },
            ]
        }).then(async result => {
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

            var community = result;

            var data = {
                community,
                gathering
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

//특정게시글 id로 가져오기
//id:integer,
router.post('/Select/ID', async(req, res) => {
    console.log('/Select/ID call');
    res.status(200).send(await communityFuncRouter.SelectByID(req.body.id, req.body.userID));
})

//특정 놀일터 userid 게시글 가져오기
//userID:integer,targetID:integer,index:inger,type:integer
router.post('/Select/PlayWork/UserID', async(req, res) => {
    await models.CommunityPost.findAll({
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
        where : {
            UserID : req.body.targetID,
            Type: req.body.type,
            DeleteType: 0
        },
        limit : CONTENTS_MAX,
        offset : req.body.index * 1,
        order : [
            ['id', 'DESC']
        ],
    }).then(async result => {

        var resData = [];
        for(var i = 0 ; i < result.length ; ++i){
            var community = result[i];

            var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
            var isLike = globalRouter.IsEmpty(like) ? false : true;
            var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
            var isReply = globalRouter.IsEmpty(reply) ? false : true;

            var data = {
                community,
                isLike,
                isReply
            }

            resData.push(data);
        }

        res.status(200).send(resData);
    }).catch(err => {
        console.error(URL + '/Select/UserID CommunityPost findOne Failed' + err);
        res.status(400).send(null);
    })
});

//특정 모여라 userid 게시글 가져오기
//userID:integer,targetID:integer,index:integer
router.post('/Select/Gathering/UserID', async(req, res) => {
    await models.CommunityPost.findAll({
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
                model : models.Gathering,
                required : true,
                include : [
                    {
                        model : models.GatheringMembers,
                        required : true,
                        limit : 99
                    }
                ]
            }
        ],
        where : {
            UserID : req.body.targetID,
            Type: 2 //gathering만
        },
        limit : CONTENTS_MAX,
        offset : req.body.index * 1,
        order : [
            ['id', 'DESC']
        ],
    }).then(async result => {

        var resData = [];
        for(var i = 0 ; i < result.length ; ++i){
            var community = result[i];

            var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
            var isLike = globalRouter.IsEmpty(like) ? false : true;
            var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
            var isReply = globalRouter.IsEmpty(reply) ? false : true;

            var data = {
                community,
                isLike,
                isReply
            }

            resData.push(data);
        }

        res.status(200).send(resData);
    }).catch(err => {
        console.error(URL + '/Select/UserID CommunityPost findOne Failed' + err);
        res.status(400).send(null);
    })
});

//게시글 디테일 가져오기
//id:integer,userID:integer,index:integer,limit:integer
router.post('/Select/Detail', async(req, res) => {
    await models.CommunityPost.findOne({
        where : {
            id : req.body.id,
        }
    }).then(async result => {
        if(globalRouter.IsEmpty(result)){
            console.error('empty or delete post');
            res.status(200).send(null);
        }else{
            await models.CommunityPostReply.findAll({
                limit : req.body.limit * 1,
                offset : req.body.index * 1,
                where : {
                    PostID : req.body.id
                },
                include : [
                    {
                        model : models.CommunityPostReplyReply,
                        required : false,
                        limit : LIKES_LIMIT,
                    },
                ]
            }).then(async result2 => {
                if(result.type == 2) { //gathering
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

                    var reply = result2;

                    var data = {
                        reply,
                        gathering
                    }

                    if(!globalRouter.IsEmpty(req.body.userID)){
                        result.update({HitCount : result.HitCount + 1});
                    }
                    
                    res.status(200).send(data);
                }else{
                    if(!globalRouter.IsEmpty(req.body.userID)){
                        var user = await models.User.findOne({where : {UserID : req.body.userID}});
                        var hitCount = 1;
                        if(user.LoginType == 4){
                            hitCount = globalRouter.rand(5,13);
                        }
                        result.update({HitCount : result.HitCount + hitCount});
                    }

                    var resData = [];
                    for(var i = 0 ; i < result2.length ; ++i){
                        var like = await models.CommunityPostReplyLike.findOne({ where : { UserID : req.body.userID, ReplyID : result2[i].id}});
                        var isLike = globalRouter.IsEmpty(like) ? false : true;
                        var reply = result2[i];

                        var data = {
                            reply,
                            isLike
                        }
                        
                        resData.push(data);
                    }

                    res.status(200).send(resData);
                }
            }).catch(err => {
                console.error(URL + '/Select/Detail CommunityPostReply findAll Failed ' + err );
                res.status(400).send(null);
            })
        }
    }).catch(err => {
        console.error(URL + '/Select/Detail CommunityPost findOne Failed' + err);
        res.status(400).send(null);
    })
})

//선택한 tag 게시글 가져오기
//tag:string,index:integer,type:integer(0:놀터, 1:일터, 2:모여라)
router.post('/Select/Tag', async(req, res) => {
    await models.CommunityPost.findAll({
        limit : CONTENTS_MAX,
        offset : req.body.index * 1,
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
                DeleteType : 0,
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
                        where : { PostID : result.id },
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
                    var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
                    var isLike = globalRouter.IsEmpty(like) ? false : true;
                    var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
                    var isReply = globalRouter.IsEmpty(reply) ? false : true;

                    var data = {
                        community,
                        isLike,
                        isReply
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

//좋아요 하기
//userID:integer,nickName:string,postID:integer
router.post('/Insert/Like', require('../../controllers/verifyToken'), limiter, async(req, res) => {
    globalRouter.CreateOrDestroy(models.CommunityPostLike,
        {
                UserID : req.body.userID,
                PostID : req.body.postID,
                Type: globalRouter.IsEmpty(req.body.type) ? 0 : req.body.type
        }, 
    ).then(async result => {
        var post = await models.CommunityPost.findOne({where : {
            id : req.body.postID
        }});

        if(false == result['created']){
            post.update({LikeCount : post.LikeCount - 1});
            res.status(200).send(result);
        }else{
            post.update({LikeCount : post.LikeCount + 1});
            //인기글 등록
            if(((post.LikeCount + 1) - post.DeclareCount) >= POPULAR_BASE){
                await models.PopularPostIndex.findOrCreate({
                    where: {
                        PostID : req.body.postID,
                        Type: post.Type,
                        Category: post.Category,
                        Tag: post.Tag
                    },
                    defaults: {
                        PostID : req.body.postID,
                        Type: post.Type,
                        Category: post.Category,
                        Tag: post.Tag
                    }
                });
            }

            //자기자신 알림 제외
            if(post.UserID != req.body.userID){
                var tarUser = await models.User.findOne({where: {UserID: post.UserID}});
                if(tarUser.LoginState == 0){
                    var getAllRes = await getallAsync(globalRouter.serverName+String(post.UserID));
                    var resJson = JSON.parse(getAllRes);

                    var sendUser = await models.User.findOne({where: {UserID : req.body.userID}});
                                    
                    var data = JSON.stringify({
                            userID : req.body.userID,
                            targetID : post.UserID,
                            postTitle : post.Title,
                            notiTitle : "게시글",
                            nickName : sendUser.NickName + '/' + sendUser.WBTIType + '/' + sendUser.Job,
                            type : globalRouter.notiEventEnum.POST_LIKE.value,
                            cType : post.Type,
                            subscribe : 0,
                            tableIndex : req.body.postID,
                            subTableIndex : 0,
                            body : sendUser.NickName + "님이 좋아요 를 눌렀습니다.",
                            isSend : resJson.isOnline
                    })  
    
                    fcmFuncRouter.SendFcmEvent( data );
                }
            }

            res.status(200).send(result);
        }
    }).catch(err => {
        console.error(URL + '/Insert/Like CommunityPostReply findAll Failed' + err);
        res.status(400).send(null);
    })
});

//댓글 쓰기
//userID:integer,nickName:string,postID:integer,contents:strin,agree:bool,nickName:string
router.post('/Insert/Reply', require('../../controllers/verifyToken'), limiter, async(req, res) => {
    var postID = req.body.postID * 1;
    var userID = req.body.userID * 1;

    let communityPost = await models.CommunityPost.findOne({
            where : {
                    id : postID,
                    DeleteType : 0,
            }
    })

    if(globalRouter.IsEmpty(communityPost)){
        res.status(400).send(null);
        return;
    }else{
        await models.CommunityPostReply.create({
                UserID : userID,
                PostID : postID,
                PostTitle : communityPost.Title,
                Contents : req.body.contents,
                NickName : req.body.nickName
        }).then( async result => {

            communityPost.update({ReplyCount : communityPost.ReplyCount + 1});
            var sendUser = await models.User.findOne({where: {UserID : userID}});
            if(userID != communityPost.UserID){
                //글 작성자한테 보냄
                {
                    var tarUser = await models.User.findOne({where : {UserID : communityPost.UserID,}});
                    if(tarUser.LoginState == 0){
                        var getAllRes = await getallAsync(globalRouter.serverName+String(communityPost.UserID));
                        var resJson = JSON.parse(getAllRes);

                        if(!globalRouter.IsEmpty(resJson))
                        {
                            var data = JSON.stringify({
                                userID : userID,
                                targetID : communityPost.UserID,
                                postTitle : communityPost.Title.length > 50 ? communityPost.Title.substring(0, 50) : communityPost.Title ,
                                notiTitle : "새로운 댓글",
                                nickName : sendUser.NickName + '/' + sendUser.WBTIType + '/' + sendUser.Job,
                                type : globalRouter.notiEventEnum.POST_REPLY.value,
                                cType : communityPost.Type,
                                subscribe : 0,
                                tableIndex : postID,
                                subTableIndex : result.id,
                                body : sendUser.NickName + "님이 댓글을 달았습니다.",
                                isSend : resJson.isOnline,
                            })
            
                            if(fcmFuncRouter.SendFcmEvent(data)){
                                console.log(URL + '/Insert/Reply fcm is true');
                            }else{
                                console.log(URL + '/Insert/Reply fcm is false');
                            }
                        }
                    }
                }
                

                if(req.body.agree){
                    //댓글 쓰면 구독 등록
                    await models.CommunityPostSubscriber.findOrCreate({
                        where: {
                                UserID : userID,
                                PostID : postID,
                        },
                        defaults: {
                                UserID : userID,
                                PostID : postID,
                        }
                    });
                }
                
                //FCM
                await models.CommunityPostSubscriber.findAll({
                    where : {
                            PostID : postID
                    }
                }).then(async subResult => {
                    for(var i = 0 ; i < subResult.length; ++i){
                        if(subResult[i].UserID == userID) continue;

                        var tarUser = await models.User.findOne({where : {UserID : subResult[i].UserID}});
                        console.log(tarUser);
                        if(tarUser.LoginState == 0){
                            var getAllRes = await getallAsync(globalRouter.serverName+String(subResult[i].UserID));
                            var resJson = JSON.parse(getAllRes)

                            if(!globalRouter.IsEmpty(resJson))
                            {
                                var data = JSON.stringify({
                                    userID : userID,
                                    targetID : subResult[i].UserID,
                                    postTitle : communityPost.Title,
                                    notiTitle : "새로운 댓글",
                                    nickName : sendUser.NickName + '/' + sendUser.WBTIType + '/' + sendUser.Job,
                                    type : globalRouter.notiEventEnum.POST_REPLY.value,
                                    cType : communityPost.Type,
                                    subscribe : 1,
                                    tableIndex : postID,
                                    subTableIndex : result.id,
                                    body : sendUser.NickName + "님이 댓글을 달았습니다.",
                                    isSend : resJson.isOnline,
                                })

                                if(fcmFuncRouter.SendFcmEvent(data)){
                                        console.log(URL + '/Insert/Reply fcm is true');
                                }else{
                                        console.log(URL + '/Insert/Reply fcm is false');
                                }
                            }
                        }
                    }
                }).catch(err => {
                    console.log(URL + '/Insert/Reply CommunitySubscriber findAll Failed' + err);
                })
            }

            res.status(200).send(result);
        }).catch(err => {
                console.log(URL + '/Insert/Reply CommunityPostReply create Failed' + err);
                res.status(400).send(null);
        })
    }
})

//댓글 좋아요
//userID:integer,nickName:string,replyID:integer,postID:integer
router.post('/Insert/Reply/Like', require('../../controllers/verifyToken'), limiter, async(req, res) => {
    globalRouter.CreateOrDestroy(models.CommunityPostReplyLike,
        {
                UserID : req.body.userID,
                ReplyID : req.body.replyID,
        }, 
    ).then(async result => {
        var reply = await models.CommunityPostReply.findOne({where : {
            id : req.body.replyID
        }});

        if(false == result['created']){
            reply.update({LikeCount : reply.LikeCount - 1});
            res.status(200).send(result);
        }else{
            reply.update({LikeCount : reply.LikeCount + 1});

            //자기자신 알림 제외
            if(reply.UserID != req.body.userID){
                var tarUser = await models.User.findOne({where: {UserID: reply.UserID}});
                var sendUser = await models.User.findOne({where: {UserID : req.body.userID}});
                if(tarUser.LoginState == 0){
                    var getAllRes = await getallAsync(globalRouter.serverName+String(reply.UserID));
                    var resJson = JSON.parse(getAllRes);

                    var post = await models.CommunityPost.findOne({where : {id : req.body.postID}});
                                    
                    if(!globalRouter.IsEmpty(resJson))
                    {
                        var data = JSON.stringify({
                            userID : req.body.userID,
                            targetID : reply.UserID,
                            postTitle : post.Title,
                            notiTitle : "게시글",
                            nickName : sendUser.NickName + '/' + sendUser.WBTIType + '/' + sendUser.Job,
                            type : globalRouter.notiEventEnum.POST_REPLY_LIKE.value,
                            cType : post.Type,
                            subscribe : 0,
                            tableIndex : req.body.postID,
                            subTableIndex : req.body.replyID,
                            body : sendUser.NickName + "님이 댓글에 좋아요 를 눌렀습니다.",
                            isSend : resJson.isOnline
                        })  
        
                        fcmFuncRouter.SendFcmEvent( data );
                    }
                }
            }

            res.status(200).send(result);
        }
    }).catch(err => {
        console.error(URL + '/Insert/Reply/Like CommunityPostReplyLike findAll Failed' + err);
        res.status(400).send(null);
    })
});

//대댓글 쓰기
//userID:integer,nickName:string,replyID:integer,contents:string,nickName:string
router.post('/Insert/ReplyReply', require('../../controllers/verifyToken'), limiter, async(req, res) => {
    let reply = await models.CommunityPostReply.findOne({
            where : {
                    id : req.body.replyID,
                    DeleteType : 0
            }
    })
    
    if(globalRouter.IsEmpty(reply)){
            res.status(400).send(null);
    }else{
            let replyPost = await models.CommunityPost.findOne({
                    where : {
                            id : reply.PostID,
                            DeleteType : 0
                    }
            })

            if(globalRouter.IsEmpty(replyPost)){
                    res.status(400).send(null);
            }else{
                await models.CommunityPostReplyReply.create({
                        UserID : req.body.userID,
                        ReplyID : req.body.replyID,
                        ReplyContents : reply.Contents.length > 50 ? reply.Contents.substring(0,50) : reply.Contents,
                        Contents : req.body.contents,
                        NickName : req.body.nickName
                }).then(async result => {

                    reply.update({ReplyReplyCount : reply.ReplyReplyCount + 1});
                    if(req.body.userID != reply.UserID){
                        var tarUser = await models.User.findOne({where: {UserID: replyPost.UserID}});
                        var sendUser = await models.User.findOne({where: {UserID : req.body.userID}});
                        if(tarUser.LoginState == 0){
                            var getAllRes = await getallAsync(globalRouter.serverName+String(reply.UserID));
                            var resJson = JSON.parse(getAllRes);

                            if(!globalRouter.IsEmpty(resJson))
                            {
                                var data = JSON.stringify({
                                    userID : req.body.userID,
                                    targetID : reply.UserID,
                                    postTitle : replyPost.Title,
                                    notiTitle : "답글",
                                    nickName : sendUser.NickName + '/' + sendUser.WBTIType + '/' + sendUser.Job,
                                    type : globalRouter.notiEventEnum.POST_REPLY_REPLY.value,
                                    cType : replyPost.Type,
                                    subscribe : 0,
                                    tableIndex : reply.PostID,
                                    subTableIndex : req.body.replyID,
                                    body : sendUser.NickName + "님이 답글을 달았습니다.",
                                    isSend : resJson.isOnline,
                                })
        
                                //댓글 작성자한테 fcm
                                if(fcmFuncRouter.SendFcmEvent( data )){
                                }else{
                                        console.error(URL + '/Insert/ReplyReply CommunityPostReplyReply create Failed' + err);
                                }
                            }
                        }
                    }

                    res.status(200).send(result);
                }).catch(err => {
                        console.error(URL + '/Insert/ReplyReply CommunityPostReplyReply create Failed' + err);
                        res.status(400).send(null);
                })
            }
    }
})

router.post('/Modify/Reply', require('../../controllers/verifyToken'), async(req, res) => {
    await models.CommunityPostReply.update(
        {
            Contents : req.body.contents,
            IsModify : true
        },
        {
            where : { id : req.body.id }
        }
    ).then(result => {
        res.status(200).send(true);
    }).catch(err => {
        console.log(URL + '/Modify/Reply CommunityPostReply update failed ' + err);
        res.status(404).send(null);
    })
});

router.post('/Modify/ReplyReply', require('../../controllers/verifyToken'), async(req, res) => {
    await models.CommunityPostReplyReply.update(
        {
            Contents : req.body.contents,
            IsModify : true
        },
        {
            where : { id : req.body.id }
        }
    ).then(result => {
        res.status(200).send(true);
    }).catch(err => {
        console.log(URL + '/Modify/ReplyReply CommunityPostReply update failed ' + err);
        res.status(404).send(null);
    })
});


//게시글 삭제
//id:integer,postType:integer,type:integer
router.post('/Delete', require('../../controllers/verifyToken'), async(req, res) => {
    switch(req.body.postType * 1){
        case 0 :
        {
            // fs_extra.emptyDirSync('communityphotos/' + req.body.id, function(err) {
            //     if(err){
            //         console.error(URL + '/Delete fs_extra emptyDirSync ' + err);
            //         res.status(400).send(null);
            //     }
            // })
        
            // await models.CommunityPost.destroy({
            //     where : {id : req.body.id}
            // }).catch(err => {
            //     console.error(URL + '/Delete destroy Failed ' + err);
            //     res.status(400).send(null);
            // })

            var post = await models.CommunityPost.findOne({where : {id : req.body.id}}).catch(err => {
                console.error(URL + 'Delete update is Failed ' + err);
                res.status(400).send(null);
            });
            var updateRes = await post.update({DeleteType : 1}).catch(err => {
                console.error(URL + 'Delete update is Failed ' + err);
                res.status(400).send(null);
            });

            if(updateRes){
                if(post.Tag != ''){
                    var tag = await models.Tag.findOne({where : {Name : post.Tag}});

                    if(req.body.type == 0) tag.update({PlayCount : tag.PlayCount - 1})
                    else if(req.body.type == 1) tag.update({WorkCount : tag.WorkCount - 1})
                    else if(req.body.type == 2) tag.update({GatherCount : tag.GatherCount - 1})
                    else if(req.body.type == 3) tag.update({WbtiCount: tag.WbtiCount - 1})
                }
            }

            res.status(200).send(true);
        }
        break;
        case 1 :
        {
            await models.CommunityPostReply.update(
                {
                        DeleteType : 1
                },
                {
                        where : { id : req.body.id }
                }
            ).then(result => {
                models.CommunityPost.update(
                    {
                        ReplyCount : result.ReplyCount - 1
                    },
                    {
                        where : { id : req.body.id }
                    }
                )
                res.status(200).send(true);
            }).catch(err => {
                console.error(URL + 'Delete update is Failed ' + err);
                res.status(400).send(null);
            });
        }
        break;
        case 2 : 
        {
            await models.CommunityPostReplyReply.update(
                {
                        DeleteType : 1
                },
                {
                        where : { id : req.body.id }
                }
            ).then(result => {
                models.CommunityPostReply.update(
                    {
                        ReplyReplyCount : result.ReplyReplyCount - 1
                    },
                    {
                        where : { id : req.body.id }
                    }
                )
                res.status(200).send(true);
            }).catch(err => {
                console.error(URL + 'Delete update is Failed ' + err);
                res.status(400).send(null);
            });
        }
        break;
    }
})

//신고하기
//게시글 : userID:integer,targetID:integer,contents:string,type:integer
router.post('/Declare', require('../../controllers/verifyToken'), limiter, async (req, res) => {
    switch(req.body.postType * 1){
      case 0:
        {
          await models.CommunityPostDeclare.findOrCreate({
            where: {
              UserID : req.body.userID,
              PostID : req.body.targetID,
            },
            defaults: {
              UserID : req.body.userID,
              PostID : req.body.targetID,
              Contents : req.body.contents
            }
          }).then(async result => {

            if(result[1]){
                var post = await models.CommunityPost.findOne({where : {id : req.body.targetID}});

                post.update({DeclareCount : post.DeclareCount + 1});
            }
                
            res.status(200).send(result);
          }).catch( err => {
            console.error(URL + "/Declare findOrCreate Faield" + err);
            res.status(400).send(null);
          })
        }
        break;
      case 1:
        {
          await models.CommunityPostReplyDeclare.findOrCreate({
            where: {
              UserID : req.body.userID,
              ReplyID : req.body.targetID,
            },
            defaults: {
              UserID : req.body.userID,
              ReplyID : req.body.targetID,
              Contents : req.body.contents
            }
          }).then(async result => {
            if(result[1]){
                var reply = await models.CommunityPostReply.findOne({where : { id : req.body.targetID}});

                reply.update({DeclareCount : reply.DeclareCount + 1});
            }
            
            res.status(200).send(result);
          }).catch( err => {
            console.error(URL + "/Declare CommunityReplyDeclare findOrCreate Faield" + err);
            res.status(400).send(null);
          })
        }
        break;
      case 2:
        {
          await models.CommunityPostReplyReplyDeclare.findOrCreate({
            where: {
              UserID : req.body.userID,
              ReplyReplyID : req.body.targetID,
            },
            defaults: {
              UserID : req.body.userID,
              ReplyReplyID : req.body.targetID,
              Contents : req.body.contents
            }
          }).then(async result => {
            if(result[1]){
                var replyReply = await models.CommunityPostReplyReply.findOne({where : { id : req.body.targetID}});

                replyReply.update({DeclareCount : replyReply.DeclareCount + 1});
            }


            res.status(200).send(result);
          }).catch( err => {
            console.error(URL + "/Declare CommunityReplyReplyDeclare findOrCreate Faield" + err);
            res.status(400).send(null);
          })
        }
        break;
    }
});

//제목 및 내용 검색
//keywords:string,index:integer,type:integer
router.post('/Search/Contents', async(req, res) => {
    await models.CommunityPost.findAll({
            limit : CONTENTS_MAX,
            offset : req.body.index * 1,
            where : {
                    [Op.or] : {
                            Title : {[Op.like] : '%' + req.body.keywords + '%'},
                            Contents : {[Op.like] : '%' + req.body.keywords + '%'},
                    },
                    DeleteType : 0,
                    Type: {[Op.not] : 2}
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

                    var like = await models.CommunityPostLike.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
                    var isLike = globalRouter.IsEmpty(like) ? false : true;
                    var reply = await models.CommunityPostReply.findOne({ where : { UserID : req.body.userID, PostID : result[i].id}});
                    var isReply = globalRouter.IsEmpty(reply) ? false : true;    

                    var data = {
                        community,
                        isLike,
                        isReply
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

router.post('/Search/Gathering/Contents', async(req, res) => {
    await models.CommunityPost.findAll({
            limit : CONTENTS_MAX,
            offset : req.body.index * 1,
            where : {
                    [Op.or] : {
                            Title : {[Op.like] : '%' + req.body.keywords + '%'},
                            Contents : {[Op.like] : '%' + req.body.keywords + '%'},
                    },
                    DeleteType : 0,
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
            limit : CONTENTS_MAX,
            offset : req.body.index * 1,
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

//모여라 참가하기
//id:integer,userID:integer
router.post('/Gathering/Join', limiter, async(req, res) => {
    var gathering = await models.Gathering.findOne({
        where : { id : req.body.id }
    }).catch(err => {
        console.log(URL + '/Gathering/Join Gathering findOne error ' + err);
        res.status(400).send(null);
    })

    await models.GatheringMembers.create({
        GatheringID : gathering.id,
        UserID : req.body.userID
    }).then(async result => {

        var post = await models.CommunityPost.findOne({where : {id : gathering.PostID}});
        var tarUser = await models.User.findOne({where: {UserID: post.UserID}});
        var sendUser = await models.User.findOne({where: {UserID : req.body.userID}});

        if(tarUser.LoginState == 0){
            var getAllRes = await getallAsync(globalRouter.serverName+String(tarUser.UserID));
            var resJson = JSON.parse(getAllRes);

            if(!globalRouter.IsEmpty(resJson))
            {
                var data = JSON.stringify({
                    userID : req.body.userID,
                    targetID : tarUser.UserID,
                    postTitle : post.Title,
                    notiTitle : "모여라",
                    nickName : sendUser.NickName + '/' + sendUser.WBTIType + '/' + sendUser.Job,
                    type : globalRouter.notiEventEnum.GATHERING_JOIN.value,
                    cType : post.Type,
                    subscribe : 0,
                    tableIndex : post.id,
                    subTableIndex : gathering.id,
                    body : sendUser.NickName + "님이 모임에 참여했어요.",
                    isSend : resJson.isOnline,
                })
    
                //댓글 작성자한테 fcm
                if(fcmFuncRouter.SendFcmEvent( data )){
                }else{
                        console.error(URL + '/Gathering/Join Fcm Failed' + err);
                }
            }
        }

        res.status(200).send(true);
    }).catch (err => {
        console.log(URL + '/Gathering/Join GatheringMembers create error ' + err);
        res.status(400).send(null);
    })
});

//모여라 마짐하기
//id:integer,state:integer
router.post('/Gathering/Close', async(req,res) => {
    await models.Gathering.update(
        {
            State : 1
        },
        {
            where : {id : req.body.id}
        }
    ).catch(err => {
        console.log(URL + '/Gathering/Join Gathering findOne error ' + err);
        res.status(400).send(null);
    })

    res.status(200).send(true);
})

//모여라 나가기
//id:integer,userID:integer
router.post('/Gathering/Leave', async(req, res) => {
   await models.GatheringMembers.destroy({
       where : { GatheringID : req.body.gatheringID, UserID : req.body.userID }
    }).catch (err => {
        console.log(URL + '/Gathering/Leave GatheringMembers destroy error ' + err);
        res.status(400).send(null);
    }) 

    res.status(200).send(true);
});

//모여라 참가인원
//gatheringID:integer
router.post('/Gathering/MemberList', async(req, res) => {
    await models.GatheringMembers.findAll({
        where : { GatheringID : req.body.gatheringID }
    }).then(async result => {
        var resData = [];

        for(var i = 0 ; i < result.length ; ++i){
            var user = await models.User.findOne({ where : { UserID : result[i].userID}});

            resData.push(user);
        }

        if(globalRouter.IsEmpty(resData))
            resData = null;

        res.status(200).send(resData);
    }).catch (err => {
        console.log(URL + '/Gathering/Leave GatheringMembers findAll error ' + err);
        res.status(400).send(null);
    }) 
});

router.post('/Subscriber/CreateOrDestroy', limiter, async(req, res) => {
    if(req.body.isCreate){
        await models.CommunityPostSubscriber.create({
            UserID : req.body.userID,
            PostID : req.body.postID
        }).then(result => {
            res.status(200).send(true);
        }).catch (err => {
            console.log(URL + '/Subscriber/Insert CommunityPostSubscriber create error ' + err);
            res.status(400).send(null);
        }) 
    }else{
        await models.CommunityPostSubscriber.destroy({
            where : {
                UserID: req.body.userID,
                PostID : req.body.postID
            }
        }).then(result => {
            res.status(200).send(false);
        }).catch (err => {
            console.log(URL + '/Subscriber/Insert CommunityPostSubscriber destroy error ' + err);
            res.status(400).send(null);
        }) 
    }
})

router.post('/Select/ReplyDetail', async(req, res) => {
    await models.CommunityPostReply.findOne({
        where : { 
            id : req.body.replyID
        },
        include: [
            {
                model : models.CommunityPostReplyReply,
                required : false,
            }
        ],
    }).then(async result => {

        console.log(result);

        var like = await models.CommunityPostReplyLike.findOne({ where : { UserID : req.body.userID, ReplyID : result.id}});
        var isLike = globalRouter.IsEmpty(like) ? false : true;
        var reply = result;

        var data = {
            reply,
            isLike,
        }

        res.status(200).send(data);
    }).catch (err => {
        console.log(URL + '/Select/ReplyDetail CommunityPostReply findOne error ' + err);
        res.status(400).send(null);
    }) 
});

router.post('/Check/NeedNewPost', async(req, res) => {
    if(0 == req.body.needAll){
		var categoryList = globalRouter.IsEmpty(req.body.categoryList) ? [] : globalRouter.getWords(req.body.categoryList);
		var tagList = globalRouter.IsEmpty(req.body.tagList) ? [] : globalRouter.getWords(req.body.tagList);
		var locationList = globalRouter.IsEmpty(req.body.locationList) ? [] : globalRouter.getWords(req.body.locationList);
	
		var filterData = [];
		for(var i = 0 ; i < categoryList.length ; ++i){
			filterData.push({Category : categoryList[i]});
		}
	
		for(var i = 0 ; i < tagList.length ; ++i){
			filterData.push({Tag : tagList[i]});
		}

		var locationFilterData = [];
		for(var i = 0 ; i < locationList.length; ++i){
			var tokenList = globalRouter.getAllLocationWords(locationList[i]);

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
		var locationList = globalRouter.IsEmpty(req.body.locationList) ? [] : globalRouter.getWords(req.body.locationList);

		var locationFilterData = [];
		for(var i = 0 ; i < locationList.length; ++i){
			var tokenList = globalRouter.getAllLocationWords(locationList[i]);

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

		//새 글 업데이트
		if(result.id != req.body.lastID){
			var data = JSON.stringify({
				targetID : req.body.userID,
				category : result.Category,
				tag : result.Tag,
				location : result.Location,
				notiTitle : "새로운 글",
				type : globalRouter.notiEventEnum.POST_NEW_UPDATE.value,
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
	}).catch(err => {
			console.error(URL + '/Select CommunityPost findAll Failed' + err);
			res.status(400).send(null);
	})
})


module.exports = router;