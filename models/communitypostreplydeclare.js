'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostReplyDeclare extends Model {
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
    }
  };
  CommunityPostReplyDeclare.init({
    UserID: DataTypes.INTEGER,
    ReplyID: DataTypes.INTEGER,
    Contents: DataTypes.STRING,
    IsProcessed: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CommunityPostReplyDeclare',
  });
  return CommunityPostReplyDeclare;
};