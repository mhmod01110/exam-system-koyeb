const PDFDocument = require('pdfkit');
const arabicReshaper = require('arabic-reshaper');
const path = require('path');

/**
 * Generate a PDF report for student results
 * @param {Object} data - The data object containing student and results information
 * @param {Object} data.student - Student information
 * @param {Array} data.results - Array of student results
 * @param {Object} data.summary - Summary statistics
 * @returns {PDFDocument} The generated PDF document
 */
const generateStudentResultsPDF = (data) => {
    const { student, results, summary } = data;
    const doc = new PDFDocument();

    // Load an Arabic-compatible font
    const arabicFontPath = path.join(__dirname, 'fonts', 'NotoNaskhArabic-Regular.ttf'); // Ensure this path is correct
    doc.font(arabicFontPath);

    // Add content to PDF
    doc.fontSize(20).text('Student Results Report', { align: 'center' });
    doc.moveDown();
    
    // Student Information
    doc.fontSize(14).text('Student Information');
    doc.fontSize(12)
       .text(`Name: ${student.firstName} ${student.lastName}`)
       .text(`Email: ${student.email}`)
       .moveDown();

    // Summary Statistics
    doc.fontSize(14).text('Summary');
    doc.fontSize(12)
       .text(`Total Exams Taken: ${summary.totalExams}`)
       .text(`Average Score: ${summary.averagePercentage.toFixed(2)}%`)
       .text(`Passed Exams: ${summary.passedExams}`)
       .text(`Failed Exams: ${summary.totalExams - summary.passedExams}`)
       .moveDown();

    // Detailed Results
    doc.fontSize(14).text('Detailed Results');
    doc.moveDown();

    results.forEach((result, index) => {
        let examTitle = result.examId.title;

        // Check if title contains Arabic characters
        const isArabic = /[\u0600-\u06FF]/.test(examTitle);
        if (isArabic) {
            // Reshape Arabic text for proper rendering
            examTitle = arabicReshaper.convertArabic(examTitle);
            // Reverse the reshaped text to display correctly in PDFKit
            examTitle = examTitle.split(' ').reverse().join('');
        }

        doc.fontSize(12)
           .text(`${index + 1}. ${examTitle}`, { align: isArabic ? 'right' : 'left' })
           .text(`   Grade: ${result.grade}`)
           .text(`   Score: ${result.percentage.toFixed(2)}%`)
           .text(`   Status: ${result.status}`)
           .text(`   Date: ${new Date(result.createdAt).toLocaleDateString()}`)
           .moveDown();

        // Add analytics if available
        if (result.analytics) {
            doc.text('   Analytics:')
               .text(`   - Time Spent: ${Math.floor(result.analytics.timeSpent / 60)} minutes`)
               .text(`   - Correct Answers: ${result.analytics.correctAnswers}`)
               .text(`   - Incorrect Answers: ${result.analytics.incorrectAnswers}`)
               .text(`   - Accuracy Rate: ${result.analytics.accuracyRate.toFixed(2)}%`)
               .moveDown();
        }
    });

    return doc;
};

module.exports = {
    generateStudentResultsPDF
};
