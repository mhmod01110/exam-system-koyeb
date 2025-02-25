# Exam System MVC

A secure and modern online examination system built with Node.js, Express, and EJS templating engine using MVC architecture.

## Features

### User Management
- Role-based access control (Student, Teacher, Admin)
- Secure authentication with session management
- Profile management
- Department-based organization

### Exam Types
- Multiple Choice Questions (MCQ)
- Project Submissions
- Mixed Format Exams
- Time-based examinations
- Automatic and manual grading

### Results & Analytics
- Detailed performance analytics
- Department-wise analysis
- Student progress tracking
- Score distribution charts
- Results survey dashboard
- Export results in various formats

### Project Submissions
- Google Drive integration for file storage
- Multiple file format support
- Secure file handling
- Teacher feedback system

### Security Features
- CSRF protection
- XSS prevention
- Secure session management
- Input validation and sanitization
- File upload validation
- Rate limiting
- Secure headers

### UI/UX Features
- Responsive Bootstrap 5 design
- Dark blue theme
- Interactive animations
- Real-time feedback
- Mobile-friendly interface
- Accessible design

## Prerequisites

- Node.js (>= 14.0.0)
- MongoDB (>= 4.4)
- Google Drive API credentials
- npm or yarn

## Installation

1. Clone the repository:

    ```bash
    git clone <repository-url>
    cd exam-system-mvc
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create environment file:

    ```bash
    cp .env.example .env
    ```

4. Configure environment variables in `.env`:

    - Set `MONGODB_URI`
    - Set `SESSION_SECRET`
    - Set `JWT_SECRET`
    - Configure SMTP settings for email
    - Adjust other settings as needed

5. Start the development server:

    ```bash
    npm run dev
    ```

6. Visit `http://localhost:3000` in your browser

## Project Structure

```
exam-system-mvc/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   │   ├── adminController.js
│   │   ├── examController.js
│   │   ├── resultsSurveyController.js
│   │   └── userController.js
│   ├── middleware/    # Custom middleware
│   ├── models/        # Database models
│   ├── routes/        # Route definitions
│   ├── utils/         # Utility functions
│   │   └── google-drive-upload.js
│   └── views/         # EJS templates
│       ├── layouts/
│       ├── partials/
│       └── static/
├── public/
│   ├── css/          # Stylesheets
│   ├── js/           # Client-side JavaScript
│   └── images/       # Static images
├── app.js            # Application entry point
└── package.json      # Project dependencies
```

## Key Features Implementation

### Google Drive Integration
- Secure file uploads to Google Drive
- Automatic folder organization
- Public file sharing for submissions
- File type validation

### Results Analytics
- Performance tracking
- Score distribution analysis
- Department-wise comparisons
- Student progress monitoring

### User Interface
- Modern dark blue theme
- Responsive design
- Interactive animations
- User-friendly navigation

## Contact

- Email: mhmod.mhmod01110@gmail.com
- Phone: +20 101 248 2107
- Location: Egypt, Cairo

## Social Links
- [LinkedIn](https://www.linkedin.com/in/mhmod01110/)
- [Facebook](https://www.facebook.com/mahmoud.shawqi.52)
- [WhatsApp](https://wa.me/201012482107)

## License

This project is licensed under the ISC License.


