const mongoose = require('mongoose');
const logWithFileName = require('../utils/logger');
const User = require('../models/User');
const Brewery = require('../models/Brewery');

const logger = logWithFileName(__filename);

/**
 * Controller per la gestione completa del profilo utente
 * Gestisce visualizzazione e aggiornamento di tutti i dati utente
 */
class ProfileController {
    
    /**
     * Visualizza la pagina di gestione profilo completo
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getCompleteProfile(req, res) {
        try {
            logger.info(`Accesso gestione profilo completo per utente: ${req.user.username}`);
            
            // Populate brewery details se l'utente ha il ruolo brewery
            let user = req.user;
            if (user.role.includes('brewery') && user.breweryDetails) {
                user = await User.findById(req.user._id).populate('breweryDetails');
            }
            
            // Recupera tutti i birrifici disponibili per il dropdown di selezione
            const availableBreweries = await Brewery.find({}).select('_id breweryName');
            
            res.render('profile/completeProfile.njk', {
                title: 'I tuoi dati - SharingBeer2.0',
                user: user,
                activeRole: req.session.activeRole,
                availableBreweries: availableBreweries,
                message: req.flash()
            });
            
        } catch (error) {
            logger.error('Errore nella visualizzazione profilo completo:', error);
            req.flash('error', 'Errore durante il caricamento del profilo');
            res.redirect('/');
        }
    }

    /**
     * Aggiorna i dati del profilo completo
     * @param {Object} req - Request object con dati del form
     * @param {Object} res - Response object
     */
    async updateCompleteProfile(req, res) {
        try {
            logger.info(`Aggiornamento profilo completo per utente: ${req.user.username}`);
            
            const updateData = {};
            const { section } = req.body;
            
            // Gestione aggiornamento sezione Account
            if (section === 'account') {
                const accountUpdate = await this._updateAccountSection(req, updateData);
                if (accountUpdate.error) {
                    req.flash('error', accountUpdate.error);
                    return res.redirect('/complete-profile');
                }
            }
            
            // Gestione aggiornamento sezione Customer Details
            if (section === 'customer') {
                this._updateCustomerSection(req, updateData);
            }
            
            // Gestione aggiornamento sezione Brewery Details
            if (section === 'brewery') {
                const breweryUpdate = await this._updateBrewerySection(req, updateData);
                if (breweryUpdate.error) {
                    req.flash('error', breweryUpdate.error);
                    return res.redirect('/complete-profile');
                }
            }
            
            // Aggiorna i dati utente se ci sono modifiche
            if (Object.keys(updateData).length > 0) {
                await User.findByIdAndUpdate(req.user._id, updateData, { new: true });
                logger.info(`Dati utente aggiornati: ${req.user.username}`);
            }
            
            req.flash('info', 'Profilo aggiornato con successo!');
            res.redirect('/complete-profile');
            
        } catch (error) {
            logger.error('Errore nell\'aggiornamento profilo completo:', error);
            req.flash('error', 'Errore durante l\'aggiornamento del profilo');
            res.redirect('/complete-profile');
        }
    }

    /**
     * Gestisce l'aggiornamento della sezione Account
     * @private
     */
    async _updateAccountSection(req, updateData) {
        try {
            if (req.body.username && req.body.username !== req.user.username) {
                // Controlla se il nuovo username è già in uso
                const existingUser = await User.findOne({ 
                    username: req.body.username, 
                    _id: { $ne: req.user._id } 
                });
                if (existingUser) {
                    return { error: 'Username già in uso' };
                }
                updateData.username = req.body.username;
            }
            
            if (req.body.defaultRole && ['customer', 'brewery'].includes(req.body.defaultRole)) {
                if (!req.user.role.includes(req.body.defaultRole)) {
                    return { error: 'Non puoi impostare come default un ruolo che non possiedi' };
                }
                updateData.defaultRole = req.body.defaultRole;
            }
            
            return { success: true };
        } catch (error) {
            logger.error('Errore aggiornamento sezione account:', error);
            return { error: 'Errore durante l\'aggiornamento account' };
        }
    }

    /**
     * Gestisce l'aggiornamento della sezione Customer Details
     * @private
     */
    _updateCustomerSection(req, updateData) {
        const customerDetails = {
            customerID: req.user.customerDetails?.customerID || new mongoose.Types.ObjectId(),
            customerName: req.body.customerName || req.user.customerDetails?.customerName,
            customerSurname: req.body.customerSurname || req.user.customerDetails?.customerSurname,
            customerFiscalCode: req.body.customerFiscalCode || req.user.customerDetails?.customerFiscalCode,
            customerAddresses: {
                billingAddress: req.body.billingAddress || req.user.customerDetails?.customerAddresses?.billingAddress,
                shippingAddress: req.body.shippingAddress || req.user.customerDetails?.customerAddresses?.shippingAddress
            },
            customerPhoneNumber: req.body.customerPhoneNumber || req.user.customerDetails?.customerPhoneNumber,
            customerPurchases: req.user.customerDetails?.customerPurchases || [],
            customerWishlist: req.user.customerDetails?.customerWishlist || [],
            customerReviews: req.user.customerDetails?.customerReviews || []
        };
        updateData.customerDetails = customerDetails;
    }

    /**
     * Gestisce l'aggiornamento della sezione Brewery Details
     * @private
     */
    async _updateBrewerySection(req, updateData) {
        try {
            if (!req.user.role.includes('brewery')) {
                return { error: 'Non hai i permessi per aggiornare i dati birrificio' };
            }
            
            let breweryId = req.user.breweryDetails;
            
            // Se l'utente non ha ancora un birrificio associato e ne seleziona uno
            if (!breweryId && req.body.selectedBreweryId) {
                // Controlla che il birrificio non sia già associato ad altro utente
                const existingUserWithBrewery = await User.findOne({ 
                    breweryDetails: req.body.selectedBreweryId 
                });
                if (existingUserWithBrewery) {
                    return { error: 'Il birrificio selezionato è già associato ad un altro utente' };
                }
                breweryId = req.body.selectedBreweryId;
                updateData.breweryDetails = breweryId;
            }
            
            // Se l'utente ha già un birrificio, aggiorna i suoi dati
            if (breweryId) {
                const breweryUpdateData = this._buildBreweryUpdateData(req);
                await Brewery.findByIdAndUpdate(breweryId, breweryUpdateData, { new: true });
                logger.info(`Dati birrificio aggiornati per utente: ${req.user.username}`);
            }
            
            return { success: true };
        } catch (error) {
            logger.error('Errore aggiornamento sezione brewery:', error);
            return { error: 'Errore durante l\'aggiornamento dati birrificio' };
        }
    }

    /**
     * Costruisce l'oggetto di aggiornamento per i dati birrificio
     * @private
     */
    _buildBreweryUpdateData(req) {
        const breweryUpdateData = {};
        
        // Dati base birrificio
        if (req.body.breweryName) breweryUpdateData.breweryName = req.body.breweryName;
        if (req.body.breweryDescription) breweryUpdateData.breweryDescription = req.body.breweryDescription;
        if (req.body.breweryFiscalCode) breweryUpdateData.breweryFiscalCode = req.body.breweryFiscalCode;
        if (req.body.breweryREAcode) breweryUpdateData.breweryREAcode = req.body.breweryREAcode;
        if (req.body.breweryacciseCode) breweryUpdateData.breweryacciseCode = req.body.breweryacciseCode;
        if (req.body.breweryLegalAddress) breweryUpdateData.breweryLegalAddress = req.body.breweryLegalAddress;
        if (req.body.breweryPhoneNumber) breweryUpdateData.breweryPhoneNumber = req.body.breweryPhoneNumber;
        if (req.body.breweryWebsite) breweryUpdateData.breweryWebsite = req.body.breweryWebsite;
        if (req.body.breweryEmail) breweryUpdateData.breweryEmail = req.body.breweryEmail;
        if (req.body.foundingYear) breweryUpdateData.foundingYear = req.body.foundingYear;
        if (req.body.brewerySize) breweryUpdateData.brewerySize = req.body.brewerySize;
        if (req.body.employeeCount) breweryUpdateData.employeeCount = req.body.employeeCount;
        if (req.body.productionVolume) breweryUpdateData.productionVolume = req.body.productionVolume;
        if (req.body.distributionArea) breweryUpdateData.distributionArea = req.body.distributionArea;
        if (req.body.breweryHistory) breweryUpdateData.breweryHistory = req.body.breweryHistory;
        if (req.body.masterBrewer) breweryUpdateData.masterBrewer = req.body.masterBrewer;
        
        // Social media
        if (req.body.facebook || req.body.instagram || req.body.twitter || req.body.linkedin || req.body.youtube) {
            breweryUpdateData.brewerySocialMedia = {
                facebook: req.body.facebook || '',
                instagram: req.body.instagram || '',
                twitter: req.body.twitter || '',
                linkedin: req.body.linkedin || '',
                youtube: req.body.youtube || ''
            };
        }
        
        return breweryUpdateData;
    }

    /**
     * Gestisce l'upload del logo birrificio
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async uploadBreweryLogo(req, res) {
        try {
            if (!req.user.breweryDetails) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Utente non associato a nessun birrificio' 
                });
            }

            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nessun file caricato' 
                });
            }

            const logoPath = `/uploads/${req.file.filename}`;
            await Brewery.findByIdAndUpdate(req.user.breweryDetails, { 
                breweryLogo: logoPath 
            });

            logger.info(`Logo birrificio aggiornato per utente: ${req.user.username}`);
            
            res.json({ 
                success: true, 
                message: 'Logo aggiornato con successo!',
                logoPath: logoPath
            });

        } catch (error) {
            logger.error('Errore upload logo birrificio:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Errore durante l\'upload del logo' 
            });
        }
    }

    /**
     * Gestisce l'upload di immagini aggiuntive del birrificio
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async uploadBreweryImages(req, res) {
        try {
            if (!req.user.breweryDetails) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Utente non associato a nessun birrificio' 
                });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nessun file caricato' 
                });
            }

            const existingBrewery = await Brewery.findById(req.user.breweryDetails);
            const newImages = req.files.map(file => `/uploads/${file.filename}`);
            const updatedImages = [
                ...(existingBrewery?.breweryImages || []),
                ...newImages
            ];

            await Brewery.findByIdAndUpdate(req.user.breweryDetails, { 
                breweryImages: updatedImages 
            });

            logger.info(`Immagini birrificio aggiunte per utente: ${req.user.username}`);
            
            res.json({ 
                success: true, 
                message: 'Immagini caricate con successo!',
                newImages: newImages
            });

        } catch (error) {
            logger.error('Errore upload immagini birrificio:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Errore durante l\'upload delle immagini' 
            });
        }
    }

    /**
     * Rimuove un'immagine dalla galleria del birrificio
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async deleteBreweryImage(req, res) {
        try {
            if (!req.user.breweryDetails) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Utente non associato a nessun birrificio' 
                });
            }

            const { imagePath } = req.body;
            const brewery = await Brewery.findById(req.user.breweryDetails);
            
            if (!brewery) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Birrificio non trovato' 
                });
            }

            const updatedImages = brewery.breweryImages.filter(img => img !== imagePath);
            await Brewery.findByIdAndUpdate(req.user.breweryDetails, { 
                breweryImages: updatedImages 
            });

            logger.info(`Immagine birrificio rimossa per utente: ${req.user.username}`);
            
            res.json({ 
                success: true, 
                message: 'Immagine rimossa con successo!' 
            });

        } catch (error) {
            logger.error('Errore rimozione immagine birrificio:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Errore durante la rimozione dell\'immagine' 
            });
        }
    }
}

module.exports = new ProfileController();
