'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BlockTime extends Model {
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
  BlockTime.init({
    UserID: DataTypes.INTEGER,
    EndTime: DataTypes.STRING,
    Contents: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'BlockTime',
  });
  return BlockTime;
};