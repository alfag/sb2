/**
 * ImageProcessor - Utility per ottimizzazione immagini
 * 
 * Riduce drasticamente le dimensioni delle immagini base64 per il salvataggio in MongoDB.
 * 
 * CONFIGURAZIONE:
 * - Larghezza massima: 1080px (ottimale per visualizzazione mobile senza sgranatura)
 * - Qualità JPEG: 82% (bilanciamento qualità/dimensione)
 * - Risultato atteso: da ~1.5-3 MB a ~100-200 KB per immagine
 * 
 * @module imageProcessor
 * @created 18 Gennaio 2026
 */

const sharp = require('sharp');
const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

/**
 * Configurazione ottimizzazione immagini
 */
const IMAGE_CONFIG = {
    maxWidth: 1080,           // Larghezza massima in pixel
    maxHeight: 1920,          // Altezza massima (per portrait)
    quality: 82,              // Qualità JPEG (0-100)
    format: 'jpeg',           // Formato output
    withMetadata: false,      // Non preservare metadata EXIF (riduce size)
};

/**
 * Estrae il buffer da una stringa base64 (data URL o plain base64)
 * 
 * @param {string} base64String - Stringa base64 (con o senza prefisso data:)
 * @returns {Buffer} Buffer dell'immagine
 */
function extractBufferFromBase64(base64String) {
    if (!base64String) {
        throw new Error('Base64 string is empty or undefined');
    }
    
    // Rimuovi il prefisso data:image/...;base64, se presente
    const base64Data = base64String.includes('base64,') 
        ? base64String.split('base64,')[1] 
        : base64String;
    
    return Buffer.from(base64Data, 'base64');
}

/**
 * Converte un buffer in data URL base64
 * 
 * @param {Buffer} buffer - Buffer dell'immagine
 * @param {string} mimeType - Tipo MIME (default: image/jpeg)
 * @returns {string} Data URL completa
 */
function bufferToDataUrl(buffer, mimeType = 'image/jpeg') {
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
}

/**
 * Calcola la dimensione approssimativa in KB di una stringa base64
 * 
 * @param {string} base64String - Stringa base64
 * @returns {number} Dimensione in KB
 */
function getBase64SizeKB(base64String) {
    if (!base64String) return 0;
    
    // Rimuovi prefisso data URL se presente
    const base64Data = base64String.includes('base64,') 
        ? base64String.split('base64,')[1] 
        : base64String;
    
    // Calcolo: lunghezza base64 * 0.75 (conversione a bytes) / 1024 (KB)
    return Math.round((base64Data.length * 0.75) / 1024);
}

/**
 * Ottimizza un'immagine base64 riducendone le dimensioni
 * 
 * @param {string} base64Input - Immagine in formato base64 (data URL o plain)
 * @param {Object} options - Opzioni di configurazione
 * @param {number} options.maxWidth - Larghezza massima (default: 1080)
 * @param {number} options.maxHeight - Altezza massima (default: 1920)
 * @param {number} options.quality - Qualità JPEG 0-100 (default: 82)
 * @returns {Promise<Object>} Oggetto con { dataUrl, originalSizeKB, optimizedSizeKB, reductionPercent }
 */
async function optimizeBase64Image(base64Input, options = {}) {
    const config = {
        maxWidth: options.maxWidth || IMAGE_CONFIG.maxWidth,
        maxHeight: options.maxHeight || IMAGE_CONFIG.maxHeight,
        quality: options.quality || IMAGE_CONFIG.quality,
    };
    
    try {
        // Calcola dimensione originale
        const originalSizeKB = getBase64SizeKB(base64Input);
        
        // Converti base64 in buffer
        const inputBuffer = extractBufferFromBase64(base64Input);
        
        // Ottieni info immagine originale
        const metadata = await sharp(inputBuffer).metadata();
        
        logger.info('📷 Ottimizzazione immagine', {
            originalWidth: metadata.width,
            originalHeight: metadata.height,
            originalFormat: metadata.format,
            originalSizeKB: originalSizeKB,
            targetMaxWidth: config.maxWidth,
            targetQuality: config.quality
        });
        
        // Processa immagine con sharp
        const optimizedBuffer = await sharp(inputBuffer)
            .resize({
                width: config.maxWidth,
                height: config.maxHeight,
                fit: 'inside',              // Mantiene aspect ratio
                withoutEnlargement: true    // Non ingrandisce immagini piccole
            })
            .jpeg({
                quality: config.quality,
                progressive: true,          // JPEG progressivo per caricamento veloce
                mozjpeg: true               // Usa encoder mozjpeg per migliore compressione
            })
            .toBuffer();
        
        // Converti buffer ottimizzato in data URL
        const optimizedDataUrl = bufferToDataUrl(optimizedBuffer, 'image/jpeg');
        const optimizedSizeKB = getBase64SizeKB(optimizedDataUrl);
        
        // Calcola percentuale riduzione
        const reductionPercent = originalSizeKB > 0 
            ? Math.round(((originalSizeKB - optimizedSizeKB) / originalSizeKB) * 100)
            : 0;
        
        logger.info('✅ Immagine ottimizzata', {
            originalSizeKB,
            optimizedSizeKB,
            reductionPercent: `${reductionPercent}%`,
            savedKB: originalSizeKB - optimizedSizeKB
        });
        
        return {
            dataUrl: optimizedDataUrl,
            originalSizeKB,
            optimizedSizeKB,
            reductionPercent,
            metadata: {
                originalWidth: metadata.width,
                originalHeight: metadata.height,
                originalFormat: metadata.format
            }
        };
        
    } catch (error) {
        logger.error('❌ Errore ottimizzazione immagine', {
            error: error.message,
            stack: error.stack
        });
        
        // In caso di errore, ritorna l'immagine originale
        // Meglio salvare grande che non salvare affatto
        logger.warn('⚠️ Fallback: uso immagine originale non ottimizzata');
        return {
            dataUrl: base64Input,
            originalSizeKB: getBase64SizeKB(base64Input),
            optimizedSizeKB: getBase64SizeKB(base64Input),
            reductionPercent: 0,
            error: error.message
        };
    }
}

/**
 * Verifica se una stringa è un'immagine base64 valida
 * 
 * @param {string} base64String - Stringa da verificare
 * @returns {boolean} true se è un'immagine base64 valida
 */
function isValidBase64Image(base64String) {
    if (!base64String || typeof base64String !== 'string') {
        return false;
    }
    
    // Verifica pattern data URL immagine
    const dataUrlPattern = /^data:image\/(jpeg|jpg|png|gif|webp|bmp);base64,/i;
    if (dataUrlPattern.test(base64String)) {
        return true;
    }
    
    // Verifica se è base64 puro (senza prefisso)
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (base64Pattern.test(base64String) && base64String.length > 100) {
        return true;
    }
    
    return false;
}

/**
 * Estrae l'immagine da un documento Review
 * Gestisce sia vecchi documenti (imageUrl) che nuovi (rawAiData.imageDataUrl)
 * @param {Object} review - Documento Review MongoDB
 * @returns {string|null} Data URL dell'immagine o null se non trovata
 */
function extractImageFromReview(review) {
    if (!review) return null;
    
    // Prima prova rawAiData.imageDataUrl (nuova posizione ottimizzata)
    if (review.rawAiData?.imageDataUrl && isValidBase64Image(review.rawAiData.imageDataUrl)) {
        return review.rawAiData.imageDataUrl;
    }
    
    // Fallback a imageUrl (vecchi documenti o documenti con placeholder)
    if (review.imageUrl && review.imageUrl !== 'stored_in_rawAiData' && isValidBase64Image(review.imageUrl)) {
        return review.imageUrl;
    }
    
    return null;
}

module.exports = {
    optimizeBase64Image,
    getBase64SizeKB,
    isValidBase64Image,
    extractBufferFromBase64,
    bufferToDataUrl,
    extractImageFromReview,
    IMAGE_CONFIG
};
