const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },

    surname: {
        type: String,
        required: true,
    },

    username: {
        type: String,
        required: true,
        unique: true,
    },

    email: {
        type: String,
        required: true,
        unique: true,
    },

    role: {
        type: String,
        default: "user",
        enum: ["user", "admin", "super-admin", "instructor", "coach"],
    },

    coursesGiven: [{
        type: Schema.Types.ObjectId,
        ref: "Course",
    }],

    coursesTaken: [{
        type: Schema.Types.ObjectId,
        ref: "Course",
    }],
}, { timestamps: true });

userSchema.plugin(passportLocalMongoose);

const user = mongoose.model("User", userSchema);

module.exports = user;