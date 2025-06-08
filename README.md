# SharingBeer2_0

SharingBeer2_0 (SB2) è una piattaforma online innovativa progettata per connettere clienti e birrifici, facilitando la vendita e distribuzione di birre artigianali. La piattaforma mira a creare una community nazionale attraverso un sistema di inviti, pagamenti online sicuri e una gestione logistica efficiente.

## Caratteristiche Principali

- **Architettura a Microservizi**: SB2 è costruita su un'architettura a microservizi per garantire scalabilità e manutenibilità.
- **Tecnologie Open Source**: Utilizza tecnologie come Node.js, MongoDB per un'infrastruttura robusta e sicura.
- **Interfaccia Utente Responsive**: Sviluppata con Nunjucks per un'esperienza utente fluida su dispositivi diversi.
- **Sicurezza Avanzata**: Implementa Passport e OAuth2 per la gestione sicura degli accessi, oltre a misure di protezione contro attacchi DDoS.
- **Geolocalizzazione**: Utilizza Leaflet.js e OpenStreetMap per visualizzare birrifici su una mappa interattiva.
- **Gestione QRCode**: Integra QRCode per il tracciamento delle BeerBox e facilitare gli inviti.

## Struttura del Progetto

- **src**: Contiene il codice sorgente dell'applicazione, inclusi controller, modelli, rotte e middleware.
- **config**: Configurazioni per il database e l'autenticazione.
- **public**: Risorse statiche come CSS, JavaScript e immagini.
- **views**: Template per le pagine dell'applicazione.
- **package.json**: Gestione delle dipendenze e degli script npm.

## Installazione

1. Clona il repository:
   ```
   git clone <repository-url>
   ```
2. Naviga nella cartella del progetto:
   ```
   cd SharingBeer2_0
   ```
3. Installa le dipendenze:
   ```
   npm install
   ```
4. Configura le variabili d'ambiente nel file `.env`.
5. Avvia l'applicazione:
   ```
   npm start
   ```

## Contribuire

Le contribuzioni sono benvenute! Per favore, apri un issue o invia una pull request per suggerire miglioramenti o segnalare bug.

## Licenza

Questo progetto è concesso in licenza sotto la Licenza MIT. Vedi il file LICENSE per ulteriori dettagli.# sb2
