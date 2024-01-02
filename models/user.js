
'use strict';
module.exports = (sequelize, DataTypes) => {
  var User = sequelize.define('User', {
    UserID: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    Email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    NickName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ""
    },
    WBTIType: {
      type: DataTypes.STRING
    },
    Job: {
      type: DataTypes.STRING,
    },
    Gender: {
      type: DataTypes.INTEGER(1),
      defaultValue : 0
    },
    PhoneNumber: {
      type: DataTypes.STRING(16)
    },
    Birthday: {
      type: DataTypes.STRING(24)
    },
    LoginType: {
      type: DataTypes.INTEGER
    },
    LoginState: {
      type: DataTypes.INTEGER
    },
    RefreshToken: {
      type: DataTypes.STRING(400),
      allowNull: true,
      defaultValue: ""
    },
    MarketingAgree: {
      type: DataTypes.BOOLEAN,
    },
    MarketingAgreeTime: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,      
      allowNull: true,
      defaultValue: 0
    },
    BanTime: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
  }, {});
  User.associate = function (models) {
    this.hasMany(models.CommunityPost, {
      foreignKey: 'UserID'
    });
    this.hasMany(models.Declare, {
      foreignKey: 'UserID'
    });
    this.hasMany(models.UserBan, {
      foreignKey: 'UserID'
    });
    this.hasMany(models.FcmTokenList, {
      foreignKey: 'UserID',
    });
    this.hasMany(models.NotificationList, {
      foreignKey: 'UserID',
    });
    this.hasMany(models.ReasonByExit, {
      foreignKey: 'UserID',
    });
    this.hasMany(models.BlockTime, {
      foreignKey: 'UserID',
    });
  };
  return User;
};

// 'use strict';
// const {
//   Model
// } = require('sequelize');
// module.exports = (sequelize, DataTypes) => {
//   class user extends Model {
//     /**
//      * Helper method for defining associations.
//      * This method is not a part of Sequelize lifecycle.
//      * The `models/index` file will call this method automatically.
//      */
//     static associate(models) {
//       // define association here
//     }
//   };
//   user.init({
//     UserID: DataTypes.INTEGER,
//     ID: DataTypes.STRING,
//     Name: DataTypes.STRING,
//     Information: DataTypes.STRING,
//     Password: DataTypes.STRING,
//     RefreshToken: DataTypes.STRING
//   }, {
//     sequelize,
//     modelName: 'user',
//   });
//   return user;
// };