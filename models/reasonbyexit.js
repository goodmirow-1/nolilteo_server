'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ReasonByExit extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.ReasonByExit, {
        foreignKey : "UserID",
        onDelete : "cascade",
      });
    }
  };
  ReasonByExit.init({
    UserID: DataTypes.INTEGER,
    Type: DataTypes.INTEGER,
    Contents: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'ReasonByExit',
  });
  return ReasonByExit;
};