'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class FcmTokenList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.User, {
        foreignKey : "UserID",
        onDelete : "cascade",
      });
    }
  };
  FcmTokenList.init({
    UserID: DataTypes.INTEGER,
    Token: DataTypes.STRING,
    PlayAlarm: DataTypes.BOOLEAN,
    WorkAlarm: DataTypes.BOOLEAN,
    GatherAlarm: DataTypes.BOOLEAN,
    SubscribeAlarm: DataTypes.BOOLEAN,
    RecommendAlarm : DataTypes.BOOLEAN,
    BadgeCount: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'FcmTokenList',
  });
  return FcmTokenList;
};