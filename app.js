const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const methodOverride = require("method-override");
const fileUpload = require("express-fileupload");
const expressLayouts = require("express-ejs-layouts");
const flash = require("connect-flash");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();

app.set("trust proxy", 1);

// Database connection
mongoose
    .connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/exam_system_mvc",
        {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Force IPv4
        }
    )
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// Layout setup
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);
app.set("layout extractMetas", true);

app.locals.contentFor = function (name) {
    return `<%- contentFor('${name}') %>`;
};

app.locals.styles = "<%- styles %>";

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: "/tmp/",
        createParentPath: true,
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    })
);
app.use(morgan("dev"));

// Security middleware
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
//       scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
//       imgSrc: ["'self'", 'data:', 'https:'],
//     },
//   },
//   frameguard: { action: 'sameorigin' },  // Fix for X-Frame-Options issue
//   referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
// }));

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET || "your-secret-key",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl:
                process.env.MONGODB_URI ||
                "mongodb://localhost:27017/exam_system_mvc",
            ttl: 24 * 60 * 60, // 1 day
        }),
        // cookie: {
        //     secure: false, // for testing purposes
        //     httpOnly: true,
        //     maxAge: 24 * 60 * 60 * 1000, // 1 day
        //     sameSite: "Lax",
        // },
    })
);

// Flash messages middleware
app.use(flash());

// CSRF protection
app.use(csrf({ cookie: true }));

// Pass data to all views
app.use((req, res, next) => {
    if (!req.path.startsWith("/auth/logout")) {
        res.locals.csrfToken = req.csrfToken();
    }

    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path;

    res.locals.messages = {
        success: req.flash("success") || null,
        error: req.flash("error") || null,
        info: req.flash("info") || null,
    };

    next();
});

// Routes
const authRoutes = require("./src/routes/authRoutes");
const examRoutes = require("./src/routes/examRoutes");
const questionRoutes = require("./src/routes/questionRoutes");
const userRoutes = require("./src/routes/userRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const departmentRoutes = require("./src/routes/departmentRoutes");
const resultsSurveyRoutes = require("./src/routes/resultsSurveyRoutes");
const staticRoutes = require("./src/routes/staticRoutes");
const errorHandler = require("./src/middleware/errorHandler");

app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/exams", examRoutes);
app.use("/questions", questionRoutes);
app.use("/", adminRoutes);
app.use("/departments", departmentRoutes);
app.use("/", resultsSurveyRoutes);
app.use("/", staticRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).render("errors/404", {
        title: "404 Not Found",
        message: "The page you are looking for does not exist.",
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
