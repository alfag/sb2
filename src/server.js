const express = require('express');
const config = require('../config/config');
const db = require('../config/db');
const app = require('./app');
const logWithFileName = require('./utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const PORT = process.env.PORT || 3000;

const os = require('os');
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Il server è in esecuzione sulla porta ${PORT}`);
    const ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach((ifname) => {
        ifaces[ifname].forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                logger.info(`Accessibile da rete locale: http://${iface.address}:${PORT}`);
            }
        });
    });
});