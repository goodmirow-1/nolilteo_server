'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Tag extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      //this.belongsToMany(models.CommunityPost, {through: 'CommunityPostTag', as: "PostTaged", foreignKey: 'TagID', onDelete: "cascade"});
    }
  };
  Tag.init({
    Name: DataTypes.STRING,
    PlayCount: DataTypes.INTEGER,
    WorkCount: DataTypes.INTEGER,
    GatherCount: DataTypes.INTEGER,
    WbtiCount: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Tag',
  });
  return Tag;
};