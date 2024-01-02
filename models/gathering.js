'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Gathering extends Model {
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
      this.hasMany(models.GatheringMembers, {
        foreignKey: 'GatheringID',
        onDelete : "cascade",
      })
    }
  };
  Gathering.init({
    PostID: DataTypes.INTEGER,
    DetailLocation: DataTypes.STRING,
    Date: DataTypes.DATE,
    MaxMemberNum: DataTypes.INTEGER,
    MinAge: DataTypes.INTEGER,
    MaxAge: DataTypes.INTEGER,
    NeedGender: DataTypes.INTEGER,
    Link: DataTypes.STRING,
    State: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Gathering',
  });
  return Gathering;
};