'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostReplyLike extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.CommunityPost, {
        foreignKey : "ReplyID",
        onDelete : "cascade",
      });
    }
  };
  CommunityPostReplyLike.init({
    UserID: DataTypes.INTEGER,
    ReplyID: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'CommunityPostReplyLike',
  });
  return CommunityPostReplyLike;
};