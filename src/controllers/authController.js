const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const AppError = require('../utils/AppError');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

exports.getLogin = (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        error: req.flash('error')
    });
};

exports.postLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user and select all fields needed for session
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new AppError('Invalid email or password', 401);
        }

        // Check if user is active
        if (!user.isActive) {
            throw new AppError('Your account has been deactivated. Please contact admin.', 401);
        }
        
        // Create session data
        const sessionUser = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId
        };

        // Set session
        req.session.user = sessionUser;
        req.session.isAuthenticated = true;
        
        // Save session before redirect
        req.session.save(err => {
            if (err) {
                return next(new AppError('Error creating session', 500));
            }
            
            // Redirect based on role
            if (user.role === 'admin') {
                res.redirect('/');
            } else if (user.role === 'teacher') {
                res.redirect('/exams');
            } else {
                res.redirect('/my-exams');
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getRegister = (req, res) => {
    res.render('auth/register', {
        title: 'Register',
        error: req.flash('error')
    });
};
exports.postRegister = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, role } = req.body;
        
        // Check if passwords match
        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match');
            return res.render('auth/register', {
                title: 'Register',
                error: req.flash('error'),
                oldInput: { firstName, lastName, email, role }
            });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.render('auth/register', {
                title: 'Register', 
                error: req.flash('error'),
                oldInput: { firstName, lastName, email, role }
            });
        }
        
        // Create new user
        const user = new User({
            firstName,
            lastName,
            email,
            password,
            role
        });
        
        await user.save();
        
        req.flash('success', 'Registration successful. Please login.');
        res.redirect('/auth/login');
    } catch (error) {
        req.flash('error', error.message);
        res.render('auth/register', {
            title: 'Register',
            error: req.flash('error'),
            oldInput: { name, email, role },
            csrfToken: req.csrfToken()
        });
    }
};

exports.getForgotPassword = (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

exports.postForgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            throw new AppError('No account with that email address exists', 404);
        }
        
        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();
        
        // Send reset email
        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${token}`;
        await transporter.sendMail({
            to: user.email,
            subject: 'Password Reset',
            html: `
                <p>You requested a password reset</p>
                <p>Click this <a href="${resetUrl}">link</a> to set a new password.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        });
        
        req.flash('success', 'Check your email for password reset instructions');
        res.redirect('/auth/forgot-password');
    } catch (error) {
        next(error);
    }
};

exports.getResetPassword = async (req, res, next) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            throw new AppError('Password reset token is invalid or has expired', 400);
        }
        
        res.render('auth/reset-password', {
            title: 'Reset Password',
            token: req.params.token,
            error: req.flash('error')
        });
    } catch (error) {
        next(error);
    }
};

exports.postResetPassword = async (req, res, next) => {
    try {
        const { password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
            throw new AppError('Passwords do not match', 400);
        }
        
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            throw new AppError('Password reset token is invalid or has expired', 400);
        }
        
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        req.flash('success', 'Your password has been updated');
        res.redirect('/auth/login');
    } catch (error) {
        next(error);
    }
};

exports.logout = (req, res, next) => {
    try {
        req.session.destroy(err => {
            if (err) {
                return next(new AppError('An error occurred during logout', 500));
            }
            res.clearCookie('connect.sid');
            res.clearCookie('_csrf');  // Clear CSRF cookie as well
            res.redirect('/auth/login');
        });
    } catch (error) {
        next(error);
    }
}; 