/**
 * Image Color Analyzer - Analizza il colore predominante di un'immagine
 * Usato per rilevare loghi bianchi e applicare drop-shadow automaticamente
 */

const axios = require('axios');
const sharp = require('sharp');
const { logWithFileName } = require('./logger');

/**
 * Analizza se un'immagine è prevalentemente bianca
 * @param {string} imageUrl - URL dell'immagine da analizzare
 * @returns {Promise<{isWhite: boolean, whitePercentage: number}>}
 */
async function analyzeImageWhiteness(imageUrl) {
    try {
        logWithFileName(__filename, `🎨 Analisi colore per: ${imageUrl}`);

        // Scarica l'immagine
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Ridimensiona a 50x50px per performance
        const resizedBuffer = await sharp(response.data)
            .resize(50, 50, { fit: 'inside' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { data: pixels, info } = resizedBuffer;
        const { width, height, channels } = info;

        let whitePixels = 0;
        let nonTransparentPixels = 0;

        // Analizza ogni pixel
        for (let i = 0; i < pixels.length; i += channels) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = channels === 4 ? pixels[i + 3] : 255;

            // Ignora pixel trasparenti (alpha < 50)
            if (a < 50) continue;

            nonTransparentPixels++;

            // Considera "bianco" se tutti i canali RGB sono > 240
            if (r > 240 && g > 240 && b > 240) {
                whitePixels++;
            }
        }

        const whitePercentage = nonTransparentPixels > 0 
            ? (whitePixels / nonTransparentPixels) * 100 
            : 0;

        const isWhite = whitePercentage > 60;

        logWithFileName(__filename, 
            `✅ Analisi completata: ${whitePercentage.toFixed(1)}% bianco (${whitePixels}/${nonTransparentPixels} pixel) → ${isWhite ? 'BIANCO' : 'COLORATO'}`
        );

        return {
            isWhite,
            whitePercentage: parseFloat(whitePercentage.toFixed(1)),
            totalPixels: nonTransparentPixels,
            whitePixels
        };

    } catch (error) {
        logWithFileName(__filename, `❌ Errore analisi colore: ${error.message}`);
        
        // In caso di errore, assumiamo che NON sia bianco
        // (meglio non avere drop-shadow che avere errori)
        return {
            isWhite: false,
            whitePercentage: 0,
            error: error.message
        };
    }
}

module.exports = {
    analyzeImageWhiteness
};
