'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostReplyReplyDeclare extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.CommunityPostReply, {
        foreignKey : "ReplyReplyID",
        onDelete : "cascade",
      });
    }
  };
  CommunityPostReplyReplyDeclare.init({
    UserID: DataTypes.INTEGER,
    ReplyReplyID: DataTypes.INTEGER,
    Contents: DataTypes.STRING,
    IsProcessed: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CommunityPostReplyReplyDeclare',
  });
  return CommunityPostReplyReplyDeclare;
};