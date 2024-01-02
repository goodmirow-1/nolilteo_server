'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityPostSubscriber extends Model {
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
  CommunityPostSubscriber.init({
    UserID: DataTypes.INTEGER,
    PostID: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'CommunityPostSubscriber',
  });
  return CommunityPostSubscriber;
};