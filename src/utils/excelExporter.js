const Excel = require('exceljs');

/**
 * Generate an Excel workbook for student results
 * @param {Object} data - The data object containing student and results information
 * @param {Object} data.student - Student information
 * @param {Array} data.results - Array of student results
 * @param {Object} data.summary - Summary statistics
 * @returns {Excel.Workbook} The generated Excel workbook
 */
const generateStudentResultsExcel = async (data) => {
    const { student, results, summary } = data;
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Student Results');

    // Add student information
    worksheet.addRow(['Student Results Report']);
    worksheet.addRow([]);
    worksheet.addRow(['Student Information']);
    worksheet.addRow(['Name:', `${student.firstName} ${student.lastName}`]);
    worksheet.addRow(['Email:', student.email]);
    worksheet.addRow([]);

    // Add summary statistics
    worksheet.addRow(['Summary Statistics']);
    worksheet.addRow(['Total Exams Taken:', summary.totalExams]);
    worksheet.addRow(['Average Score:', `${summary.averagePercentage.toFixed(2)}%`]);
    worksheet.addRow(['Passed Exams:', summary.passedExams]);
    worksheet.addRow(['Failed Exams:', summary.totalExams - summary.passedExams]);
    worksheet.addRow([]);

    // Add detailed results header
    worksheet.addRow([
        'Exam Title',
        'Grade',
        'Score (%)',
        'Status',
        'Date',
        'Time Spent (min)',
        'Correct Answers',
        'Incorrect Answers',
        'Accuracy Rate (%)'
    ]);

    // Add results data
    results.forEach(result => {
        worksheet.addRow([
            result.examId.title,
            result.grade,
            result.percentage.toFixed(2),
            result.status,
            new Date(result.createdAt).toLocaleDateString(),
            result.analytics ? Math.floor(result.analytics.timeSpent / 60) : 'N/A',
            result.analytics ? result.analytics.correctAnswers : 'N/A',
            result.analytics ? result.analytics.incorrectAnswers : 'N/A',
            result.analytics ? result.analytics.accuracyRate.toFixed(2) : 'N/A'
        ]);
    });

    // Style the worksheet
    worksheet.getRow(1).font = { bold: true, size: 16 };
    worksheet.getRow(3).font = { bold: true };
    worksheet.getRow(8).font = { bold: true };
    worksheet.getRow(11).font = { bold: true };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
        column.width = 15;
    });

    return workbook;
};

module.exports = {
    generateStudentResultsExcel
}; 