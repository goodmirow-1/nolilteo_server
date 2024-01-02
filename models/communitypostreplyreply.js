'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostReplyReply extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.CommunityPostReply, {
        foreignKey : "ReplyID",
        onDelete : "cascade",
      });
      this.hasMany(models.CommunityPostReplyReplyDeclare, {
        foreignKey: 'ReplyReplyID',
        onDelete: "cascade",
      })
    }
  };
  CommunityPostReplyReply.init({
    UserID: DataTypes.INTEGER,
    ReplyID: DataTypes.INTEGER,
    ReplyContents: DataTypes.STRING,
    NickName: DataTypes.STRING,
    Contents: DataTypes.STRING,
    DeclareCount: DataTypes.INTEGER,
    DeleteType: DataTypes.INTEGER,
    IsModify: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CommunityPostReplyReply',
  });
  return CommunityPostReplyReply;
};