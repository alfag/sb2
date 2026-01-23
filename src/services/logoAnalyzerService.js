/**
 * LogoAnalyzerService - Analizza i loghi per determinare se sono chiari/bianchi
 * Usato per applicare drop-shadow automaticamente ai loghi bianchi su sfondo chiaro
 * 
 * L'analisi viene fatta UNA VOLTA quando il logo viene salvato nel DB,
 * il risultato viene memorizzato nel campo `logoIsLight` del Brewery.
 */

const axios = require('axios');
const sharp = require('sharp');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

class LogoAnalyzerService {
    
    /**
     * Analizza un'immagine da URL e determina se è prevalentemente chiara
     * @param {string} imageUrl - URL dell'immagine da analizzare
     * @returns {Promise<boolean|null>} - true se chiara (>60% pixel chiari), false se scura, null se errore
     */
    static async isImageLight(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') {
            return null;
        }
        
        try {
            logger.info(`🎨 Analisi luminosità logo: ${imageUrl.substring(0, 80)}...`);
            
            // Scarica l'immagine
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const imageBuffer = Buffer.from(response.data);
            
            // Usa sharp per analizzare i pixel
            // Ridimensiona a 50x50 per velocità
            const { data, info } = await sharp(imageBuffer)
                .resize(50, 50, { fit: 'inside' })
                .raw()
                .toBuffer({ resolveWithObject: true });
            
            const channels = info.channels; // 3 (RGB) o 4 (RGBA)
            let lightPixels = 0;
            let totalPixels = 0;
            
            // Analizza ogni pixel
            for (let i = 0; i < data.length; i += channels) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = channels === 4 ? data[i + 3] : 255;
                
                // Ignora pixel trasparenti
                if (a < 50) continue;
                
                totalPixels++;
                
                // Calcola luminosità (formula standard)
                // L = 0.299*R + 0.587*G + 0.114*B
                const luminosity = 0.299 * r + 0.587 * g + 0.114 * b;
                
                // Considera "chiaro" se luminosità > 200 (su scala 0-255)
                if (luminosity > 200) {
                    lightPixels++;
                }
            }
            
            if (totalPixels === 0) {
                logger.warn(`⚠️ Logo senza pixel visibili: ${imageUrl.substring(0, 50)}`);
                return null;
            }
            
            const lightPercentage = (lightPixels / totalPixels) * 100;
            const isLight = lightPercentage > 60;
            
            logger.info(`🎨 Logo analizzato: ${lightPercentage.toFixed(1)}% chiaro → ${isLight ? '☀️ CHIARO' : '🌙 SCURO'}`);
            
            return isLight;
            
        } catch (error) {
            logger.warn(`⚠️ Impossibile analizzare logo: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Analizza e aggiorna il campo logoIsLight per un birrificio
     * @param {Object} brewery - Documento Mongoose Brewery
     * @returns {Promise<boolean|null>} - Risultato dell'analisi
     */
    static async analyzeAndUpdateBrewery(brewery) {
        if (!brewery || !brewery.breweryLogo) {
            return null;
        }
        
        // Se già analizzato, non rifare
        if (brewery.logoIsLight !== null && brewery.logoIsLight !== undefined) {
            logger.info(`🎨 Logo già analizzato per ${brewery.breweryName}: ${brewery.logoIsLight ? 'chiaro' : 'scuro'}`);
            return brewery.logoIsLight;
        }
        
        const isLight = await this.isImageLight(brewery.breweryLogo);
        
        if (isLight !== null) {
            brewery.logoIsLight = isLight;
            await brewery.save();
            logger.info(`🎨 Salvato logoIsLight=${isLight} per ${brewery.breweryName}`);
        }
        
        return isLight;
    }
    
    /**
     * Analizza tutti i birrifici che hanno logo ma logoIsLight non impostato
     * Utile per migrazione batch
     * @returns {Promise<{analyzed: number, light: number, dark: number, errors: number}>}
     */
    static async analyzeAllBreweries() {
        const Brewery = require('../models/Brewery');
        
        const breweries = await Brewery.find({
            breweryLogo: { $exists: true, $ne: null, $ne: '' },
            $or: [
                { logoIsLight: { $exists: false } },
                { logoIsLight: null }
            ]
        });
        
        logger.info(`🎨 Avvio analisi batch di ${breweries.length} loghi...`);
        
        let analyzed = 0;
        let light = 0;
        let dark = 0;
        let errors = 0;
        
        for (const brewery of breweries) {
            const result = await this.isImageLight(brewery.breweryLogo);
            
            if (result !== null) {
                brewery.logoIsLight = result;
                await brewery.save();
                analyzed++;
                if (result) light++;
                else dark++;
            } else {
                errors++;
            }
            
            // Piccola pausa per non sovraccaricare
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        logger.info(`🎨 Analisi batch completata: ${analyzed} analizzati (${light} chiari, ${dark} scuri), ${errors} errori`);
        
        return { analyzed, light, dark, errors };
    }
}

module.exports = LogoAnalyzerService;
