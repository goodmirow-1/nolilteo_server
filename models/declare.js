'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Declare extends Model {
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
    }
  };
  Declare.init({
    UserID: DataTypes.INTEGER,
    DeclareID: DataTypes.INTEGER,
    Contents: DataTypes.STRING,
    IsProcessed: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Declare',
  });
  return Declare;
};