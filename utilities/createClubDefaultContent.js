const User = require("../models/user");

const {
  englishClubs,
  englishClubArticles,
  englishWeeklyActivities,
  englishClubWorkersOfMonth,
  englishWeeklyLessons,
  englishClubMedia,
  englishClubComment,
} = require("../models/englishClub");

const {
  positions,
  days,
  months,
  defaultWeeklyActivityData,
  defaultArticleData,
  mediaData,
  weeklyLessonsData,
  workersOfMonthData,
} = require("../utilities/defaultData");

module.exports = async function createDefaultContent(club_id) {
  const englishClub = await englishClubs.findById(club_id);

  // Adding default article
  for (let i = 0; i < 3; i++) {
    const firstArticle = new englishClubArticles(defaultArticleData);
    await firstArticle.save();

    englishClub.articles.push(firstArticle._id);
  }

  // Default workers of the Month
  const firstWorkersOfMonth = new englishClubWorkersOfMonth(
    workersOfMonthData[0]
  );

  await firstWorkersOfMonth.save();

  englishClub.workersOfMonth.push(firstWorkersOfMonth._id);

  // Adding default weekly activities
  const firstWeeklyActivity = new englishWeeklyActivities(
    defaultWeeklyActivityData
  );
  await firstWeeklyActivity.save();

  englishClub.weeklyActivity.push(firstWeeklyActivity._id);

  // Adding weekly lesson
  for (let weekLessonData of weeklyLessonsData) {
    const weeklyLesson = new englishWeeklyLessons(weekLessonData);

    await weeklyLesson.save();

    englishClub.weeklyVideoLesson.push(weeklyLesson._id);
  }

 // Adding media
 for (let i = 0; i < 2; i++) {
	const newMedia = new englishClubMedia(mediaData);
	await newMedia.save();
    
	englishClub.media.unshift(newMedia._id);
      }
     
 await englishClub.save();


};
