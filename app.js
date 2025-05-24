if (process.env.NODE_ENV !== "production") {
     require("dotenv").config();
}


const moment = require("moment");
const express = require("express");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const methodOverride = require("method-override");
const flash = require("connect-flash-plus");
const User = require("./models/user");
const DateUtil = require("./utilities/date");
const catchAsync = require("./utilities/catchAsync");
const ExpressError = require("./utilities/ExpressError");

// models requirements

// News
const {
    news,
    allNews
} = require("./models/news");

// Visitors
const visitor = require("./models/visitors");


// Routes requirements
const userRoutes = require("./routes/user");
const newsRoutes = require("./routes/news");
const commentRoutes = require("./routes/comment");
const courseRoutes = require("./routes/course");
const bacRoutes = require("./routes/100bac");

const path = require("path");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoDBStore = require("connect-mongo");

// bring in the app constants
const {
    DB,
    PORT,
    SECRET
} = require("./config");

// connecting to the database
const connectDB = catchAsync(async () => {
     mongoose.connect(process.env.APP_DB, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
    });
});

connectDB();


const app = express();
// setting up ejs-mate
app.engine("ejs", ejsMate);

// Setting up ejs
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// parsing the body
app.use(express.urlencoded({
    extended: true
}));

// setting for method override
app.use(methodOverride("_method"));

// serving the public directory
app.use(express.static(path.join(__dirname, "public")));

// setting up session
const sessionConfig = {
    store: MongoDBStore.create({
        mongoUrl: process.env.APP_DB,
        touchAfter: 24 * 60 * 60,
    }),
    secret: process.env.SECRET || "hereistheworstsecretever",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httponly: true,
        expires: Date.now() + 1000 * 60 * 60 * 12 * 1,
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
};

//for cookies
app.use(session(sessionConfig));

// setting up flash
app.use(flash());

// Passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(
    User.serializeUser(function (user, done) {
        done(null, user);
    })
);
passport.deserializeUser(
    User.deserializeUser(function (user, done) {
        done(null, user);
    })
);

// setting up local variables
app.use((req, res, next) => {
    res.locals.currentTime = DateUtil.localTime(Date.now(), "Date du Jour :");
    res.locals.currentTimeEng = moment().format("dddd, Do MMMM  YYYY");
    res.locals.currentUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

// Landing page route
app.get("/", catchAsync(async (req, res) => {
    res.render("comingsoon", {
    });
}));

// app.get("/", catchAsync(async (req, res) => {
//     let all_articles = await news.find({});
//     all_articles = all_articles.reverse();
//     res.render("all_home", {
//         all_articles
//     });
// }));


// visitor message routes
app.post("/visitormessage", catchAsync(async(req, res)=>{
    const newVisitorMessage = new visitor(req.body.visitor);
    await newVisitorMessage.save();
    req.flash('success', 'Votre message a été envoyé avec succès')
    res.redirect("/");
}));

// Language Lab  home page
app.get("/elearning", catchAsync(async (req, res) => {
    res.render("comingsoon");
}));


// Language Lab  home page
app.get("/tech-innovation", catchAsync(async (req, res) => {
    res.render("comingsoon");
}));


//user routes
app.use("/", userRoutes);

//courses routes
app.use("/", courseRoutes);

//100% BAC routes
app.use("/", bacRoutes);

//comments routes
app.use("/", commentRoutes);

//comments routes
app.use("/", newsRoutes);




app.all("*", (req, res, next) => {
    next(new ExpressError("Page not found", 404));
});

//error handling
app.use((err, req, res, next) => {
    const {
        statusCode = 500
    } = err;
    if (!err.message)
        err.message = `Quelque chose d'inattendue s'est produit 🤷🏽‍♂️!!!`;
    res.status(statusCode).render("error", {
        err
    });
});

const port = process.env.PORT || 3000;
// server
app.listen(port, () => {
    console.log("server is working");
});
