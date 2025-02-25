const AppError = require('../utils/AppError');

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const value = err.keyValue ? Object.values(err.keyValue)[0] : '';
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again.', 401);

const handleError = (err, req, res) => {
  // Set default error status
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Handle AJAX/API requests
  if (req.xhr || req.headers.accept.includes('application/json')) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err })
    });
  }

  // For regular requests, use flash messages and redirect
  const referer = req.get('Referer') || '/';
  
  // Set appropriate flash message
  req.flash('error', err.message);
  
  // Handle different types of errors with appropriate redirects
  switch (err.statusCode) {
    case 401:
      return res.redirect('/auth/login');
    case 403:
      return res.redirect(referer);
    case 404:
      return res.redirect('/');
    default:
      // Log server errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error details:', err);
      }
      return res.redirect(referer);
  }
};

module.exports = (err, req, res, next) => {
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR 💥', err);
  }

  // Clone the error to avoid modifying the original
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode;
  error.status = err.status;

  // Handle specific error types
  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (err.code === 'EBADCSRFTOKEN') {
    error = new AppError('Invalid form submission. Please try again.', 403);
  }

  // Send error response
  handleError(error, req, res);
}; 