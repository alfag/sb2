// Handler per i messaggi flash. Consente traduzione e valori predefiniti

const translate = require('@iamtraction/google-translate');
const logWithFileName = require('./logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Funzione per la traduzione del messaggio
async function transMsg(inputMessage, langCode) {
    logger.debug(`Inizio traduzione del messaggio: "${inputMessage}" nella lingua: "${langCode}"`);

    try {
        const { text } = await translate(inputMessage, { to: langCode });
        logger.debug(`Risultato della traduzione: "${text}"`);
        return text;
    } catch (err) {
        logger.error(`Errore durante la traduzione del messaggio: ${err.message}`);
        throw err;
    }
}

function transMsgPost(app) {
    // Route Express.js per gestire la richiesta POST
    app.post('/translateMsg', async (req, res) => {
        const { inputMessage, langCode } = req.body;

        logger.info(`Richiesta di traduzione ricevuta. Messaggio: "${inputMessage}", Lingua: "${langCode}"`);

        try {
            const translatedMsg = await transMsg(inputMessage, langCode);
            logger.info(`Traduzione completata con successo. Risultato: "${translatedMsg}"`);
            res.json({ result: translatedMsg });
        } catch (error) {
            logger.error(`Errore durante la traduzione del messaggio: ${error.message}`);
            res.status(500).json({ error: 'Errore durante la traduzione' });
        }
    });
}

// Esporta la funzione transMsg, nel caso in cui vuoi utilizzarla altrove
module.exports = { transMsg, transMsgPost };
