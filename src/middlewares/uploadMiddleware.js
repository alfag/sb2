const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * Configurazione Multer per upload di immagini
 * Memory storage per elaborazione immediata senza salvare su disco (AI)
 * Disk storage per immagini birrifici permanenti
 */

// Storage in memoria per elaborazione diretta (AI)
const memoryStorage = multer.memoryStorage();

// Storage su disco per immagini birrifici
const breweryDiskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../public/images/breweries');
    
    // Crea la directory se non esiste
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      logger.info(`📁 Creata directory upload: ${uploadPath}`);
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Genera nome file unico: brewery_ID_timestamp_field.ext
    const breweryId = req.params.id || req.user.breweryDetails?._id || req.user.breweryDetails;
    const timestamp = Date.now();
    const fieldName = file.fieldname; // 'breweryLogo' o 'breweryImages'
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `brewery_${breweryId}_${timestamp}_${fieldName}${extension}`;
    
    logger.info(`📎 Generato filename: ${filename} per file: ${file.originalname}`);
    cb(null, filename);
  }
});

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

// 🆕 Configurazione per upload logo birrificio
const breweryLogoUpload = multer({
  storage: breweryDiskStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB max per logo
    files: 1
  }
});

// 🆕 Configurazione per upload immagini birrificio
const breweryImagesUpload = multer({
  storage: breweryDiskStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per immagine
    files: 10 // Max 10 immagini
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
        message = 'Troppi file. Massimo consentito superato';
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

// 🆕 Middleware wrapper per upload multipli
const createMultipleUploadMiddleware = (uploadConfig, fieldName = 'images', maxCount = 5) => {
  return (req, res, next) => {
    logger.info('[UploadMiddleware] Middleware multiplo chiamato', {
      method: req.method,
      url: req.url,
      fieldName,
      maxCount
    });

    const upload = uploadConfig.array(fieldName, maxCount);
    
    upload(req, res, (err) => {
      if (err) {
        logger.error('[UploadMiddleware] Errore durante upload multiplo', {
          error: err.message,
          code: err.code
        });
        return handleUploadError(err, req, res, next);
      }

      // Log successo upload
      if (req.files && req.files.length > 0) {
        logger.info('[UploadMiddleware] Upload multiplo completato', {
          fileCount: req.files.length,
          files: req.files.map(f => ({ name: f.originalname, size: f.size })),
          fieldName
        });
      } else {
        logger.warn('[UploadMiddleware] Nessun file uploadato nel multiplo');
      }

      next();
    });
  };
};

// 🆕 Funzione helper per eliminare immagini vecchie
const deleteBreweryImage = (filename) => {
  return new Promise((resolve, reject) => {
    const imagePath = path.join(__dirname, '../../public/images/breweries', filename);
    
    fs.unlink(imagePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        logger.error(`Errore eliminazione immagine ${filename}:`, err);
        reject(err);
      } else {
        logger.info(`🗑️ Immagine eliminata: ${filename}`);
        resolve();
      }
    });
  });
};

// Export dei middleware configurati
module.exports = {
  // Middleware per upload singola immagine AI
  aiImageUpload: createUploadMiddleware(aiImageUpload, 'image'),
  
  // Middleware per upload multipli
  multipleImageUpload: createUploadMiddleware(multipleImageUpload, 'images'),

  // 🆕 Middleware per upload logo birrificio
  breweryLogoUpload: createUploadMiddleware(breweryLogoUpload, 'breweryLogo'),

  // 🆕 Middleware per upload immagini birrificio (multiple)
  breweryImagesUpload: createMultipleUploadMiddleware(breweryImagesUpload, 'breweryImages', 10),
  
  // Configurazioni raw per usi custom
  aiImageUploadRaw: aiImageUpload,
  multipleImageUploadRaw: multipleImageUpload,
  breweryLogoUploadRaw: breweryLogoUpload,
  breweryImagesUploadRaw: breweryImagesUpload,
  
  // Error handler e utilities
  handleUploadError,
  deleteBreweryImage
};
