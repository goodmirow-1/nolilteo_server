'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPost extends Model {
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
      this.hasMany(models.CommunityPhoto, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      });
      this.hasMany(models.CommunityPostLike, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      });
      this.hasMany(models.CommunityPostReply, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      });
      this.hasMany(models.CommunityPostDeclare, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      })
      this.hasMany(models.CommunityPostSubscriber, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      })
      this.hasMany(models.Gathering, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      })
      this.hasMany(models.PopularPostIndex, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      })
      this.hasMany(models.CommunityHotPost, {
        foreignKey: 'PostID',
        onDelete: "cascade",
      })
      //this.belongsToMany(models.Tag, {through: 'CommunityPostTag', as: "PostTager", foreignKey: 'PostID', onDelete: "cascade"});
    }
  };
  CommunityPost.init({
    UserID: DataTypes.INTEGER,
    Category: DataTypes.STRING,
    Location: DataTypes.STRING,
    Tag: DataTypes.STRING,
    Title: DataTypes.STRING,
    NickName: DataTypes.STRING,
    Contents: DataTypes.STRING,
    HitCount: DataTypes.INTEGER,
    LikeCount: DataTypes.INTEGER,
    DeclareCount: DataTypes.INTEGER,
    ReplyCount: DataTypes.INTEGER,
    Type: DataTypes.INTEGER,
    DeleteType: DataTypes.INTEGER,
    IsModify: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CommunityPost',
  });
  return CommunityPost;
};