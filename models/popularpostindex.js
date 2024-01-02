'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PopularPostIndex extends Model {
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
  PopularPostIndex.init({
    PostID: DataTypes.INTEGER,
    Type: DataTypes.INTEGER,
    Category: DataTypes.STRING,
    Tag: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'PopularPostIndex',
  });
  return PopularPostIndex;
};