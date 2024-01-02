'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostDeclare extends Model {
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
    }
  };
  CommunityPostDeclare.init({
    UserID: DataTypes.INTEGER,
    PostID: DataTypes.INTEGER,
    Contents: DataTypes.STRING,
    IsProcessed: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'CommunityPostDeclare',
  });
  return CommunityPostDeclare;
};