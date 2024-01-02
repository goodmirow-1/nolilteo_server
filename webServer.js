const express = require('express');
const methodOverride = require('method-override');		//Post,Delete,Update 관련 Module
const bodyParser = require('body-parser');			//Json으로 데이터 통신 Module
const helmet = require('helmet');				//http 보안관련 Module
const cors = require('cors');
const cookieParser = require('cookie-parser');			//Cookie Module
const path = require('path');

const models = require("./models/index.js");

const WebRouter = require('./routers/web/webRouter');
const fcmFuncRouter = require('./routers/fcm/fcmFuncRouter');
const fcmRouter = require('./routers/fcm/fcmRouter');

const app = express();

app.use(methodOverride('_method'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/communityphtos/'));

app.use(helmet());
app.use(cors());
app.use('/Web', WebRouter);

// configuration =========================
app.set('port', process.argv[2] || 50009);

const server = app.listen(app.get('port'), () => {
	console.log('Express server listening on port ' + app.get('port'));
});

// sequelize 연동
models.sequelize.sync().then( () => {
	console.log("DB Connect Success");
}).catch( err => {
    console.log("DB Connect Faield");
    console.log(err);
})