const mongoose = require('mongoose');
const { Course } = require('./shared/models/courses');
require('dotenv').config();

// Default local connection string if env var not set (fallback)
const dbUrl = process.env.APP_DB || 'mongodb://127.0.0.1:27017/afrohk';

mongoose.connect(dbUrl)
  .then(async () => {
    console.log('Connected to DB');
    const courses = await Course.find({});
    console.log('--- COURSES FOUND ---');
    courses.forEach(c => {
      console.log(`[${c._id}] Title: "${c.title}" | Private: ${c.isPrivate} | Active: ${c.isActive}`);
    });
    console.log('---------------------');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
