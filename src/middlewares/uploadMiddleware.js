const multer = require('multer');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * Configurazione Multer per upload di immagini
 * Memory storage per elaborazione immediata senza salvare su disco
 */

// Storage in memoria per elaborazione diretta
const memoryStorage = multer.memoryStorage();

// Filtro per tipi di file immagine
const imageFilter = (req, file, cb) => {
  logger.debug('[UploadMiddleware] File upload tentativo', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Accetta solo immagini
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    logger.warn('[UploadMiddleware] Tipo file non supportato', {
      mimetype: file.mimetype,
      originalname: file.originalname
    });
    cb(new Error(`Tipo file non supportato: ${file.mimetype}. Solo immagini sono consentite.`), false);
  }
};

// Configurazione per upload immagini AI
const aiImageUpload = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1 // Un file alla volta
  }
});

// Configurazione per upload multipli (se necessario in futuro)
const multipleImageUpload = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file
    files: 5 // Max 5 file
  }
});

// Middleware di error handling per multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('[UploadMiddleware] Errore Multer', {
      code: err.code,
      message: err.message,
      field: err.field
    });

    let message;
    let status = 400;

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File troppo grande. Dimensione massima: 10MB';
        status = 413;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Troppi file. Massimo 1 file per upload';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo file non riconosciuto';
        break;
      default:
        message = 'Errore durante upload file';
    }

    return res.status(status).json({
      success: false,
      message,
      error: {
        code: err.code,
        details: err.message
      }
    });
  }

  // Altri errori (tipo file, etc.)
  if (err.message.includes('Tipo file non supportato')) {
    logger.error('[UploadMiddleware] Errore tipo file', {
      message: err.message
    });

    return res.status(400).json({
      success: false,
      message: err.message,
      error: {
        code: 'INVALID_FILE_TYPE'
      }
    });
  }

  // Passa altri errori al middleware di error handling generale
  next(err);
};

// Middleware wrapper per logging e gestione errori
const createUploadMiddleware = (uploadConfig, fieldName = 'image') => {
  return (req, res, next) => {
    logger.info('[UploadMiddleware] Middleware chiamato', {
      method: req.method,
      url: req.url,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });

    const upload = uploadConfig.single(fieldName);
    
    upload(req, res, (err) => {
      if (err) {
        logger.error('[UploadMiddleware] Errore durante upload', {
          error: err.message,
          code: err.code
        });
        return handleUploadError(err, req, res, next);
      }

      // Log successo upload
      if (req.file) {
        logger.info('[UploadMiddleware] Upload completato', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          fieldName
        });
      } else {
        logger.warn('[UploadMiddleware] Nessun file uploadato', {
          bodyKeys: Object.keys(req.body || {}),
          hasFiles: !!req.files,
          contentType: req.headers['content-type']
        });
      }

      next();
    });
  };
};

// Export dei middleware configurati
module.exports = {
  // Middleware per upload singola immagine AI
  aiImageUpload: createUploadMiddleware(aiImageUpload, 'image'),
  
  // Middleware per upload multipli
  multipleImageUpload: createUploadMiddleware(multipleImageUpload, 'images'),
  
  // Configurazioni raw per usi custom
  aiImageUploadRaw: aiImageUpload,
  multipleImageUploadRaw: multipleImageUpload,
  
  // Error handler
  handleUploadError
};
