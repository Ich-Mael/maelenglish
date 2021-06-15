const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
    },

    surname:{
        type: String,
        required: true,
    },

    username:{
        type: String,
        required: true,
        unique:true
    },

    email:{
        type: String,
        required: true,
        unique:true
    },

    role:{
        type: String,
        default: 'user',
        enum:['user', 'admin', 'super-admin']
    },
    ownedCourses:[]
},
    {timestamps: true}
  );

userSchema.plugin(passportLocalMongoose);
const user = mongoose.model('User', userSchema);
module.exports = user ;
