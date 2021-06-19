const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const Schema = mongoose.Schema;

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
        enum:['user', 'admin', 'super-admin', 'instructor', 'coach']
    },

    coursesGiven: 
    [{
        course: { 
            type: Schema.Types.ObjectId,
             ref: 'Course'
            }
    }],

    courseTaken: 
    [{
        course: {
            type: Schema.Types.ObjectId,
            ref: 'Course'
        }
    }]
},
    {timestamps: true}
  );

userSchema.plugin(passportLocalMongoose);
const user = mongoose.model('User', userSchema);
module.exports = user ;
