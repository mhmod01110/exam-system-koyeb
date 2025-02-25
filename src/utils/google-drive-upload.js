const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const credentials = {
    type: process.env.GOOGLE_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};
// Configure Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Upload a file to Google Drive
 * @param {Object} file - The file object from express-fileupload
 * @param {string} folderName - The name of the folder to upload to (optional)
 * @returns {Promise<string>} - The file's web view link
 */
const uploadToGoogleDrive = async (file, folderName = 'ExamSubmissions') => {
    try {
        // First, check if the folder exists or create it
        let folderId = await getFolderId(folderName);
        
        if (!folderId) {
            folderId = await createFolder(folderName);
        }

        // Prepare file metadata
        const fileMetadata = {
            name: file.name,
            parents: [folderId]
        };

        // Create media
        const media = {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.tempFilePath)
        };

        // Upload file
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });

        // Make the file publicly accessible
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        return response.data.webViewLink;
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
};

/**
 * Get folder ID by name
 * @param {string} folderName - The name of the folder
 * @returns {Promise<string|null>} - The folder ID or null if not found
 */
const getFolderId = async (folderName) => {
    try {
        const response = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.data.files.length > 0) {
            return response.data.files[0].id;
        }
        return null;
    } catch (error) {
        console.error('Error getting folder:', error);
        throw error;
    }
};

/**
 * Create a new folder in Google Drive
 * @param {string} folderName - The name of the folder to create
 * @returns {Promise<string>} - The created folder's ID
 */
const createFolder = async (folderName) => {
    try {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });

        return response.data.id;
    } catch (error) {
        console.error('Error creating folder:', error);
        throw error;
    }
};

module.exports = {
    uploadToGoogleDrive
};