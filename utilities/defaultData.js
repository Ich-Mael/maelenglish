const positions = [
  "President",
  "Vice-President",
  "Treasurer",
  "Secretary",
  "Communication Manager",
  "Cultural Affairs Officer",
];
// Default data

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Articles

defaultArticleData = {
  title: "New English Club",

  // image
  articleImage:
    "https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?ixid=MnwxMjA3fDB8MHxzZWFyY2h8N3x8bmV3c3xlbnwwfHwwfHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60",

  articleSummary: "New English Club",

  articleContent: "New English Club",

  articleAuthor: "New English Club",

  postedAT: Date.now(),
};

//Weekly Activity
const defaultWeeklyActivityData = {
  wordOfDay: {
    word: "New English Club",

    wordMeaning: "New English Club",

    learnMoreWord: "New English Club",

    examples: [],
  },

  IdiomDay: {
    idiom: "New English Club",

    idiomMeaning: "New English Club",

    learnMoreIdiom: "",

    examples: [],
  },

  englishClubMeeting: {
    meetingDate: Date.now(),

    venue: "New English Club",

    meetingTime: "15:00",

    about: "New English Club",
  },

  OnlineDebate: {
    topicOne: "New English Club",

    debateDateOne: Date.now(),

    debateTimeOne: "15:00",

    topicTwo: "New English Club",

    debateDateTwo: Date.now(),

    debateTimeTwo: "20:00",

    aboutTopic: "New English Club",
  },
};

module.exports = {
  positions,
  days,
  months,
  defaultWeeklyActivityData,
  defaultArticleData,
};
