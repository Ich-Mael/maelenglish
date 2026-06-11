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
const InstitutionCourse = require("./programs/institution/models/Course");
const InstitutionCourseTestimonial = require("./programs/institution/models/Testimonial");
const InstitutionModule = require("./programs/institution/models/Module");
const InstitutionLesson = require("./programs/institution/models/Lesson");
const VisitorMessage = require("./shared/models/visitorMessage");

// Import program routes
const eKalanRoutes = require("./programs/ekalan");
const languageLearningRoutes = require("./programs/language-learning");
const institutionProgram = require("./programs/institution");

// Import shared routes
const accountRoutes = require("./shared/routes/account");
const adminInstitutionRoutes = require("./shared/routes/adminInstitutions");
const adminMessagesRoutes = require("./shared/routes/adminMessages");
const institutionDashboardRoutes = require("./shared/routes/institutionDashboard");
const institutionStudentRoutes = require("./shared/routes/institutionStudent");

function stripHtml(html) {
    if (!html) return '';
    const entities = {
        // lowercase accented
        agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å',
        egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
        igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
        ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
        ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
        ccedil: 'ç', ntilde: 'ñ', aelig: 'æ', oelig: 'œ', szlig: 'ß',
        // uppercase accented
        Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å',
        Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
        Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï',
        Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö',
        Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü',
        Ccedil: 'Ç', Ntilde: 'Ñ', AElig: 'Æ', OElig: 'Œ',
        // punctuation & quotes
        rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
        ndash: '–', mdash: '—', hellip: '…', middot: '·',
        laquo: '«', raquo: '»',
    };
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&([A-Za-z]+);/g, (_, e) => entities[e] || `&${e};`)
        .replace(/\s+/g, ' ').trim();
}

function embedUrl(url) {
    if (!url) return null;
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
    // Vimeo
    const vimMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimMatch) return `https://player.vimeo.com/video/${vimMatch[1]}`;
    // Direct video (mp4, webm, ogg)
    if (/\.(mp4|webm|ogv)(\?|$)/i.test(url)) return url;
    return null;
}

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
            frameSrc: ["player.vimeo.com", "www.youtube.com", "www.youtube-nocookie.com", "maps.google.com", "www.google.com"],
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
app.get('/', async (req, res) => {
    const [courseCount, institutionIds] = await Promise.all([
        InstitutionCourse.countDocuments({ isActive: true }),
        InstitutionCourse.distinct('institutionId', { isActive: true })
    ]);
    res.render('home', { institutionCourseCount: courseCount, institutionCount: institutionIds.length });
});

app.get('/formations', async (req, res) => {
    const courses = await InstitutionCourse
        .find({ isActive: true })
        .populate('institutionId', 'name primaryColor logoUrl contactEmail city country description')
        .select('title description imageUrl institutionId modules category pricing')
        .lean();
    courses.forEach(c => {
        if (c.title) c.title = stripHtml(c.title);
        if (c.description) c.description = stripHtml(c.description);
    });
    res.render('formations', { courses });
});

app.get('/formations/institutions/:institutionId', async (req, res) => {
    const Institution = require('./shared/models/institution');
    const institution = await Institution.findById(req.params.institutionId).lean();
    if (!institution) return res.status(404).render('noAccess', { statusCode: 404, message: 'Institution introuvable' });

    const courses = await InstitutionCourse
        .find({ institutionId: institution._id, isActive: true })
        .select('title description imageUrl modules pricing createdAt')
        .lean();

    courses.forEach(c => {
        if (c.title) c.title = stripHtml(c.title);
        if (c.description) c.description = stripHtml(c.description);
    });

    res.render('formations-institution', { institution, courses });
});

app.get('/formations/:courseId', async (req, res) => {
    const course = await InstitutionCourse
        .findOne({ _id: req.params.courseId, isActive: true })
        .populate('institutionId', 'name primaryColor logoUrl contactEmail phone city country description')
        .populate('instructors', 'name title bio photoUrl email')
        .lean();

    if (!course) return res.status(404).render('noAccess', { statusCode: 404, message: 'Cours introuvable' });

    const [modules, testimonials] = await Promise.all([
        InstitutionModule.find({ courseId: course._id })
            .select('title order lessons')
            .sort({ order: 1 })
            .lean(),
        InstitutionCourseTestimonial.find({ courseId: course._id, isPublished: true })
            .sort({ createdAt: -1 })
            .lean()
    ]);

    course.title = stripHtml(course.title);

    const totalLessons = modules.reduce((sum, m) => sum + (m.lessons ? m.lessons.length : 0), 0);

    res.render('formations-show', { course, modules, testimonials, totalLessons, embedUrl });
});

// Public lesson preview (no auth required — only works when isPreview: true)
app.get('/formations/:courseId/preview/:lessonId', async (req, res) => {
    const lesson = await InstitutionLesson.findOne({
        _id: req.params.lessonId,
        courseId: req.params.courseId,
        isPreview: true,
        isActive: true
    }).lean();

    if (!lesson) return res.status(404).render('noAccess', { statusCode: 404, message: 'Aperçu indisponible' });

    const course = await InstitutionCourse.findOne({ _id: req.params.courseId, isActive: true })
        .populate('institutionId', 'name primaryColor logoUrl')
        .lean();

    if (!course) return res.status(404).render('noAccess', { statusCode: 404, message: 'Cours introuvable' });

    res.render('formations-preview', { lesson, course });
});

// Contact form submission (public, no auth)
app.post('/visitormessage', async (req, res) => {
    try {
        const { name, email, message } = req.body.visitor || {};
        if (!name || !email || !message) {
            req.flash('error', 'Veuillez remplir tous les champs.');
            return res.redirect('/#contact');
        }
        await VisitorMessage.create({ name: name.trim(), email: email.trim(), message: message.trim() });
        req.flash('success', 'Votre message a bien été envoyé. Nous vous répondrons bientôt !');
    } catch (e) {
        req.flash('error', 'Une erreur est survenue. Veuillez réessayer.');
    }
    res.redirect('/#contact');
});

// Mount Shared Routes
app.use('/', accountRoutes);
app.use('/admin/institutions', adminInstitutionRoutes);
app.use('/admin/messages', adminMessagesRoutes);
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
