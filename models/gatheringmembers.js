'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GatheringMembers extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Gathering, {
        foreignKey : "GatheringID",
        onDelete : "cascade",
      });
    }
  };
  GatheringMembers.init({
    GatheringID: DataTypes.INTEGER,
    UserID: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'GatheringMembers',
  });
  return GatheringMembers;
};