const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.isAuth = async (req, res, next) => {
    try {
        // Check if user is logged in via session
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
    
        // Attach user to request
        const user = await User.findById(req.session.user._id);
    if (!user) {
        return res.redirect('/auth/login');
    }
        
        // Set user name if not already set
        if (!user.name) {
            user.name = `${user.firstName} ${user.lastName}`;
        }
        
    req.user = user;
        res.locals.user = user;
    next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.redirect('/auth/login');
    }
};

exports.isTeacher = (req, res, next) => {
    if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    next();
    } else {
        res.status(403).render('error', {
            message: 'Access denied. Teachers only.',
            error: {}
        });
    }
};

exports.isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'teacher')) {
    next();
    } else {
        res.status(403).render('error', {
            message: 'Access denied. Administrators only.',
            error: {}
        });
    }
};

exports.isStudent = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
    next();
    } else {
        res.status(403).render('error', {
            message: 'Access denied. Students only.',
            error: {}
        });
    }
};

// API authentication middleware using JWT
exports.authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'Authentication token required' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('JWT authentication error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
}; 