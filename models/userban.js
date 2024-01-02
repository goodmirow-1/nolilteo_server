'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserBan extends Model {
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
  UserBan.init({
    UserID: DataTypes.INTEGER,
    TargetID: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'UserBan',
  });
  return UserBan;
};