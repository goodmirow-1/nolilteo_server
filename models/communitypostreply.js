'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostReply extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.CommunityPost, {
        foreignKey : "PostID",
        onDelete : "cascade",
      });
      this.hasMany(models.CommunityPostReplyLike, {
        foreignKey: 'ReplyID',
        onDelete: "cascade",
      });
      this.hasMany(models.CommunityPostReplyDeclare, {
        foreignKey: 'ReplyID',
        onDelete: "cascade",
      });
      this.hasMany(models.CommunityPostReplyReply, {
        foreignKey: 'ReplyID',
        onDelete: "cascade",
      });
      
    }
  };
  CommunityPostReply.init({
    UserID: DataTypes.INTEGER,
    PostID: DataTypes.INTEGER,
    PostTitle: DataTypes.STRING, 
    NickName: DataTypes.STRING,
    Contents: DataTypes.STRING,
    LikeCount: DataTypes.INTEGER,
    DeclareCount: DataTypes.INTEGER,
    ReplyReplyCount: DataTypes.INTEGER,
    DeleteType: DataTypes.INTEGER,
    IsModify: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CommunityPostReply',
  });
  return CommunityPostReply;
};