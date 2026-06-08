if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// Warn about missing critical env vars at startup
const REQUIRED_ENV = ['APP_DB', 'SECRET'];
const RECOMMENDED_ENV = ['APP_URL', 'EMAIL_HOST', 'EMAIL_USERNAME', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
const missingRequired = REQUIRED_ENV.filter(k => !process.env[k]);
const missingRecommended = RECOMMENDED_ENV.filter(k => !process.env[k]);
if (missingRequired.length) {
    console.error(`[ENV] CRITICAL: missing required env vars: ${missingRequired.join(', ')}`);
    process.exit(1);
}
if (missingRecommended.length) {
    console.warn(`[ENV] WARNING: missing recommended env vars: ${missingRecommended.join(', ')}`);
    console.warn('[ENV] Emails will not send and base URLs may be wrong without these set.');
}

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash-plus");
const passport = require("passport");
const useragent = require("express-useragent");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Import User model for Passport authentication
const User = require("./shared/models/user");

// Import program routes
const eKalanRoutes = require("./programs/ekalan");
const languageLearningRoutes = require("./programs/language-learning");
const institutionProgram = require("./programs/institution");

// Import shared routes
const accountRoutes = require("./shared/routes/account");
const adminInstitutionRoutes = require("./shared/routes/adminInstitutions");
const institutionDashboardRoutes = require("./shared/routes/institutionDashboard");
const institutionStudentRoutes  = require("./shared/routes/institutionStudent");

// Database connection
const dbUrl = process.env.APP_DB || 'mongodb://localhost:27017/afrohk';
mongoose.connect(dbUrl)
    .then(() => {
        console.log("Database connected");
    })
    .catch(err => {
        console.log("Connection error:");
        console.log(err);
    });

const app = express();

// View engine setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Trust proxy for correct IP detection (important for device tracking)
app.set('trust proxy', true);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "kit.fontawesome.com", "*.fontawesome.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com", "*.fontawesome.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "*.fontawesome.com"],
      frameSrc: ["player.vimeo.com", "www.youtube.com", "www.youtube-nocookie.com"],
    },
  },
}));

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Trop de tentatives, veuillez réessayer dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser(process.env.SECRET || 'thisshouldbeabettersecret!')); // Parse cookies needed for device tracking
app.use(useragent.express()); // Parse User-Agent for device tracking
app.use(methodOverride("_method"));

// Session config
const sessionConfig = {
    secret: process.env.SECRET || 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: dbUrl,
        touchAfter: 24 * 3600 // lazy session update - only update session once per day
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};

app.use(session(sessionConfig));

// Passport configuration
passport.use(User.createStrategy());

// Passport serialization/deserialization
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

// Flash midlewar
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user; // Make user available in all views
    res.locals.isHomePage = req.path === '/' || req.path === '/index.html'; // Detect home page
    next();
});

// App Routes
app.get('/', (req, res) => {
    res.render('home');
});

// Mount Shared Routes
app.use('/', accountRoutes);
app.use('/admin/institutions', adminInstitutionRoutes);
app.use('/institution', institutionDashboardRoutes);
app.use('/institution', institutionStudentRoutes);

// Mount Program Routes
app.use('/programs/ekalan', eKalanRoutes);
app.use('/programs/language-learning', languageLearningRoutes);
app.use('/institution', institutionProgram);

// Export rate limiter for use in routes
app.set('authLimiter', authLimiter);

// 404 handler
app.all('*', (req, res) => {
    res.status(404).render('noAccess', { statusCode: 404, message: 'Page introuvable' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Une erreur est survenue';
    res.status(statusCode).render('noAccess', { statusCode, message });
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`);
});
