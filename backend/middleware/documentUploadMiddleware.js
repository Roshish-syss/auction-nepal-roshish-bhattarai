const multer = require('multer');

// Configure multer for memory storage (file will be stored in memory before uploading to Cloudinary)
const storage = multer.memoryStorage();

// File filter - allow PDFs and common document types
const fileFilter = (req, file, cb) => {
  // Accept PDF, DOC, DOCX, and image files for property documents
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, DOCX, and image files are allowed'), false);
  }
};

// Multer configuration for documents
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
  fileFilter: fileFilter
});

// Single document upload middleware
exports.uploadDocument = upload.single('document');

// Multiple documents upload middleware
exports.uploadDocuments = upload.array('documents', 5); // Max 5 documents

// Error handling middleware for multer
exports.handleDocumentUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 documents allowed.'
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
};

