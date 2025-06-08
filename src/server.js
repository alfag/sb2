const express = require('express');
const config = require('../config/config');
const db = require('../config/db');
const app = require('./app');
const logWithFileName = require('./utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`Il server è in esecuzione sulla porta ${PORT}`); // Log tradotto
});