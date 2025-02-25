const cloudinary = require("cloudinary").v2;

cloudinary.config({
    secure: true,
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (file) => {
    try {
        const result = await cloudinary.uploader.upload(file.path, {
            folder: "exam_system",
            use_filename: true,
        });
        // Delete local file after upload
        fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file:", err);
        });
        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw error;
    }
};

module.exports = {
    uploadToCloudinary,
};
