const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);
const nodemailer = require('nodemailer');
const { EMAIL_CONFIG } = require('../../config/config');

/**
 * 🛡️ VALIDATION CONTROLLER - Gestione Validazione Birrifici e Birre
 * 
 * Controller dedicato alla gestione delle entità (birrifici e birre) in stato
 * pending_validation che richiedono approvazione manuale da parte dell'administrator.
 * 
 * Funzionalità:
 * - Lista entità da validare
 * - Approvazione/Rifiuto entità
 * - Modifica dati prima dell'approvazione
 * - Sistema notifiche email agli administrator
 */

/**
 * Recupera lista di birrifici da validare
 */
exports.getPendingBreweries = async (req, res) => {
  try {
    logger.info('[ValidationController] Richiesta lista birrifici da validare', {
      userId: req.user._id,
      userRole: req.user.role
    });

    const pendingBreweries = await Brewery.find({
      validationStatus: { $in: ['pending_validation', 'ai_extracted'] }
    })
    .sort({ createdAt: -1 })
    .limit(50);

    logger.info('[ValidationController] Birrifici trovati', {
      count: pendingBreweries.length
    });

    // Renderizza pagina HTML
    res.render('admin/validationBreweries', {
      title: 'Validazione Birrifici - SharingBeer2.0',
      breweries: pendingBreweries,
      count: pendingBreweries.length
    });

  } catch (error) {
    logger.error('[ValidationController] Errore recupero birrifici', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).render('error', {
      title: 'Errore',
      message: 'Errore durante il recupero dei birrifici da validare',
      error: error
    });
  }
};

/**
 * Recupera lista di birre da validare
 */
exports.getPendingBeers = async (req, res) => {
  try {
    logger.info('[ValidationController] Richiesta lista birre da validare', {
      userId: req.user._id,
      userRole: req.user.role
    });

    const pendingBeers = await Beer.find({
      validationStatus: { $in: ['pending_validation', 'ai_extracted'] }
    })
    .populate('brewery', 'breweryName breweryWebsite')
    .sort({ createdAt: -1 })
    .limit(50);

    logger.info('[ValidationController] Birre trovate', {
      count: pendingBeers.length
    });

    // Renderizza pagina HTML
    res.render('admin/validationBeers', {
      title: 'Validazione Birre - SharingBeer2.0',
      beers: pendingBeers,
      count: pendingBeers.length
    });

  } catch (error) {
    logger.error('[ValidationController] Errore recupero birre', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).render('error', {
      title: 'Errore',
      message: 'Errore durante il recupero delle birre da validare',
      error: error
    });
  }
};

/**
 * Approva un birrificio
 */
exports.approveBrewery = async (req, res) => {
  try {
    const { breweryId } = req.params;
    const updates = req.body; // Eventuali modifiche ai dati

    logger.info('[ValidationController] Approvazione birrificio', {
      breweryId,
      userId: req.user._id,
      hasUpdates: Object.keys(updates).length > 0
    });

    // Trova e aggiorna il birrificio
    const brewery = await Brewery.findById(breweryId);
    
    if (!brewery) {
      return res.status(404).json({
        success: false,
        error: 'Birrificio non trovato'
      });
    }

    // Applica eventuali modifiche
    if (updates && Object.keys(updates).length > 0) {
      Object.assign(brewery, updates);
    }

    // Imposta stato validato
    brewery.validationStatus = 'validated';
    brewery.validatedBy = req.user._id;
    brewery.validatedAt = new Date();
    brewery.needsManualReview = false;

    await brewery.save();

    logger.info('[ValidationController] ✅ Birrificio approvato', {
      breweryId,
      breweryName: brewery.breweryName,
      validatedBy: req.user._id
    });

    res.status(200).json({
      success: true,
      message: 'Birrificio approvato con successo',
      brewery: brewery
    });

  } catch (error) {
    logger.error('[ValidationController] Errore approvazione birrificio', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Errore durante l\'approvazione del birrificio'
    });
  }
};

/**
 * Rifiuta un birrificio
 */
exports.rejectBrewery = async (req, res) => {
  try {
    const { breweryId } = req.params;
    const { reason } = req.body;

    logger.info('[ValidationController] Rifiuto birrificio', {
      breweryId,
      userId: req.user._id,
      reason
    });

    const brewery = await Brewery.findById(breweryId);
    
    if (!brewery) {
      return res.status(404).json({
        success: false,
        error: 'Birrificio non trovato'
      });
    }

    // Elimina il birrificio rifiutato
    await Brewery.findByIdAndDelete(breweryId);

    logger.info('[ValidationController] ❌ Birrificio rifiutato ed eliminato', {
      breweryId,
      breweryName: brewery.breweryName,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Birrificio rifiutato ed eliminato'
    });

  } catch (error) {
    logger.error('[ValidationController] Errore rifiuto birrificio', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Errore durante il rifiuto del birrificio'
    });
  }
};

/**
 * Approva una birra
 */
exports.approveBeer = async (req, res) => {
  try {
    const { beerId } = req.params;
    const updates = req.body;

    logger.info('[ValidationController] Approvazione birra', {
      beerId,
      userId: req.user._id,
      hasUpdates: Object.keys(updates).length > 0
    });

    const beer = await Beer.findById(beerId);
    
    if (!beer) {
      return res.status(404).json({
        success: false,
        error: 'Birra non trovata'
      });
    }

    // Applica eventuali modifiche
    if (updates && Object.keys(updates).length > 0) {
      Object.assign(beer, updates);
    }

    // Imposta stato validato
    beer.validationStatus = 'validated';
    beer.validatedBy = req.user._id;
    beer.validatedAt = new Date();
    beer.needsManualReview = false;

    await beer.save();

    logger.info('[ValidationController] ✅ Birra approvata', {
      beerId,
      beerName: beer.beerName,
      validatedBy: req.user._id
    });

    res.status(200).json({
      success: true,
      message: 'Birra approvata con successo',
      beer: beer
    });

  } catch (error) {
    logger.error('[ValidationController] Errore approvazione birra', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Errore durante l\'approvazione della birra'
    });
  }
};

/**
 * Rifiuta una birra
 */
exports.rejectBeer = async (req, res) => {
  try {
    const { beerId } = req.params;
    const { reason } = req.body;

    logger.info('[ValidationController] Rifiuto birra', {
      beerId,
      userId: req.user._id,
      reason
    });

    const beer = await Beer.findById(beerId);
    
    if (!beer) {
      return res.status(404).json({
        success: false,
        error: 'Birra non trovata'
      });
    }

    // Elimina la birra rifiutata
    await Beer.findByIdAndDelete(beerId);

    logger.info('[ValidationController] ❌ Birra rifiutata ed eliminata', {
      beerId,
      beerName: beer.beerName,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Birra rifiutata ed eliminata'
    });

  } catch (error) {
    logger.error('[ValidationController] Errore rifiuto birra', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Errore durante il rifiuto della birra'
    });
  }
};

/**
 * Conta entità in attesa di validazione
 */
exports.getPendingCount = async (req, res) => {
  try {
    const pendingBreweriesCount = await Brewery.countDocuments({
      validationStatus: { $in: ['pending_validation', 'ai_extracted'] }
    });

    const pendingBeersCount = await Beer.countDocuments({
      validationStatus: { $in: ['pending_validation', 'ai_extracted'] }
    });

    res.status(200).json({
      success: true,
      counts: {
        breweries: pendingBreweriesCount,
        beers: pendingBeersCount,
        total: pendingBreweriesCount + pendingBeersCount
      }
    });

  } catch (error) {
    logger.error('[ValidationController] Errore conteggio entità', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Errore durante il conteggio delle entità'
    });
  }
};

/**
 * 📧 Invia notifica email agli administrator per nuove entità da validare
 */
exports.notifyAdministrators = async (entityType, entityData) => {
  try {
    logger.info('[ValidationController] 📧 Invio notifica email administrator', {
      entityType,
      entityName: entityData.name || 'Unknown'
    });

    // Recupera tutti gli administrator
    const User = require('../models/User');
    const administrators = await User.find({
      roles: 'administrator'
    }).select('email username');

    if (administrators.length === 0) {
      logger.warn('[ValidationController] ⚠️ Nessun administrator trovato per notifica');
      return;
    }

    // Configura transporter email
    const transporter = nodemailer.createTransporter(EMAIL_CONFIG);

    // Template email
    const emailSubject = `🍺 Nuov${entityType === 'brewery' ? 'o Birrificio' : 'a Birra'} da Validare - SharingBeer2.0`;
    
    const emailHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; 
                        margin: 15px 0; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; 
                      color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; color: #666; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍺 Nuov${entityType === 'brewery' ? 'o Birrificio' : 'a Birra'} da Validare</h1>
            </div>
            <div class="content">
              <p>Ciao Administrator,</p>
              <p>È stat${entityType === 'brewery' ? 'o aggiunto un nuovo birrificio' : 'a aggiunta una nuova birra'} 
              che richiede la tua validazione manuale.</p>
              
              <div class="info-box">
                <strong>${entityType === 'brewery' ? 'Birrificio' : 'Birra'}:</strong> ${entityData.name}<br>
                <strong>Origine Dati:</strong> ${entityData.dataSource === 'web_scraped' ? 'Web Scraping' : 'AI Analysis'}<br>
                ${entityData.website ? `<strong>Sito Web:</strong> <a href="${entityData.website}">${entityData.website}</a><br>` : ''}
                <strong>Data Inserimento:</strong> ${new Date().toLocaleString('it-IT')}<br>
                ${entityData.reason ? `<strong>Motivo Revisione:</strong> ${entityData.reason}<br>` : ''}
              </div>
              
              <p>Accedi alla dashboard administrator per revisionare e approvare questa entità.</p>
              
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/administrator/validation/${entityType === 'brewery' ? 'breweries' : 'beers'}" 
                 class="button">Vai alla Dashboard</a>
                 
              <div class="footer">
                <p>SharingBeer2.0 - Sistema di Gestione Recensioni Birre</p>
                <p>Questa è una notifica automatica, non rispondere a questa email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Invia email a tutti gli administrator
    for (const admin of administrators) {
      try {
        await transporter.sendMail({
          from: EMAIL_CONFIG.auth.user,
          to: admin.email,
          subject: emailSubject,
          html: emailHtml
        });

        logger.info('[ValidationController] ✅ Email inviata', {
          recipient: admin.email,
          entityType
        });
      } catch (emailError) {
        logger.error('[ValidationController] ❌ Errore invio email', {
          recipient: admin.email,
          error: emailError.message
        });
      }
    }

  } catch (error) {
    logger.error('[ValidationController] ❌ Errore notifica administrator', {
      error: error.message,
      stack: error.stack
    });
  }
};

module.exports = exports;
