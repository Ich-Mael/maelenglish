const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;


const userSchema = new Schema({
    name: {
      type: String,
      required: true,
      trim: true,
    },

    area: {
      type: String,
      trim: true,
      required: true,
    },

    class: {
        type: String,
        trim: true,
        required: true,
      },

      school: {
        type: String,
        trim: true,
        required: true, 
      },

    contact: {
      type: String,
      trim: true,
      required: true,
    },

}, {
    timestamps: true
  });

  userSchema.plugin(passportLocalMongoose);

  const account = mongoose.model("Account", userSchema);
 
  module.exports = account;