const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;


const userSchema = new Schema({
    name: {
      type: String,
      required: true,
      trim: true,
    },
  
    message: {
      type: String,
      trim: true,
      required: true,
    },
  
    subject: {
      type: String,
      trim: true,
      required: true,
    },
  
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Saisissez une adresse mail valide",
      },
      required: [true, "Email required"],
    },
}, {
    timestamps: true
  });
  
  userSchema.plugin(passportLocalMongoose);
  
  const visitor = mongoose.model("Visitor", userSchema);
  
  module.exports = visitor;