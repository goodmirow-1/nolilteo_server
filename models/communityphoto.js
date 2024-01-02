'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPhoto extends Model {
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
  CommunityPhoto.init({
    PostID: DataTypes.INTEGER,
    Index: DataTypes.INTEGER,
    ImageURL: DataTypes.STRING,
    Description: DataTypes.STRING,
    Width: DataTypes.INTEGER,
    Height: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'CommunityPhoto',
  });
  return CommunityPhoto;
};