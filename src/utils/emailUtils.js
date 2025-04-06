const nodemailer = require('nodemailer');
const logWithFileName = require('./logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const transporter = nodemailer.createTransport({
    service: 'gmail', // o qualsiasi altro servizio email
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email inviata con successo a ${to}: ${info.response}`); // Log tradotto
        return info;
    } catch (error) {
        logger.error(`Errore durante l'invio dell'email a ${to}: ${error.message}`); // Log tradotto
        throw error;
    }
};

module.exports = {
    sendEmail,
};