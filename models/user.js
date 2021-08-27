const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },

    surname: {
        type: String,
        trim: true,
        required: true,
    },

    username: {
        type: String,
        trim: true,
        required: true,
        unique: true,
    },

    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },

    role: {
        type: String,
        default: "user",
        enum: ["user", "admin", "super-admin", "instructor", "coach", "student_manager"],
    },

    ownedPrograms: [],

    coursesGiven: [{
        type: Schema.Types.ObjectId,
        ref: "Course",
    }],

    coursesTaken: [{
        type: Schema.Types.ObjectId,
        ref: "Course",
    }],

    grades: [
        [{
            type: Schema.Types.ObjectId,
            ref: "course",

        }]
    ]
}, { timestamps: true });

userSchema.plugin(passportLocalMongoose);

const user = mongoose.model("User", userSchema);

module.exports = user;
