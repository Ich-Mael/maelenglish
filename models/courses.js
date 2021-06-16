const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const courseSchema = new Schema({
    title:{
        type: String,
        required: true,
    },

    description:{
        type: String,
        required: true
    },

    price: Number,

    instructor: {
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required: [true,'The course title cannot be blank.']
    },

    student : {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },

},
  {
 timestamps: true
  }
);

module.exports  = mongoose.model('Course', courseSchema);


