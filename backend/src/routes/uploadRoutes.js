const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Cloudinary returns URL in req.file.path
    // Local Multer returns filename in req.file.filename
    let fileUrl = req.file.path; 

    // If it's local storage, prefix with backend URL
    if (!fileUrl.startsWith('http')) {
      fileUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${req.file.filename}`;
    }
    
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename || req.file.originalname
    });
  } catch (error) {
    console.error('[UPLOAD_ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
