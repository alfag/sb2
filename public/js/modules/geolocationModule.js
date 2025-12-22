/**
 * 📍 GEOLOCATION MODULE - Sistema di geolocalizzazione con consent management
 * 
 * Gestisce:
 * - Richiesta permessi geolocalizzazione all'utente
 * - Modal di consent con opzione "ricorda la mia scelta"
 * - Cattura coordinate GPS complete (lat, lng, accuracy, altitude, etc.)
 * - Salvataggio preferenze utente nel profilo
 * - Validazione e gestione errori geolocalizzazione
 * 
 * @author SharingBeer2.0 Development Team
 * @date 30 Novembre 2025
 */

class GeolocationModule {
    constructor() {
        this.locationData = null;
        this.userConsent = null;
        this.consentModalActive = false;
        
        // Configuration
        this.config = {
            timeout: 10000,  // 10 secondi timeout
            maximumAge: 300000,  // Cache position per 5 minuti
            enableHighAccuracy: true  // Richiede GPS invece di network location
        };

        this.logger = {
            info: (msg, data) => console.log(`📍 [GeolocationModule] ${msg}`, data || ''),
            warn: (msg, data) => console.warn(`⚠️ [GeolocationModule] ${msg}`, data || ''),
            error: (msg, data) => console.error(`❌ [GeolocationModule] ${msg}`, data || '')
        };

        this.init();
    }

    /**
     * Inizializza il modulo
     */
    init() {
        this.logger.info('Modulo geolocalizzazione inizializzato');
        
        // Verifica supporto Geolocation API
        if (!navigator.geolocation) {
            this.logger.error('Geolocation API non supportata da questo browser');
        }

        // Crea modal consent se non esiste
        this.createConsentModal();
    }

    /**
     * Crea il modal HTML per il consent geolocalizzazione
     */
    createConsentModal() {
        // Controlla se esiste già
        if (document.getElementById('geolocation-consent-modal')) {
            this.logger.info('Modal consent già esistente');
            return;
        }

        const modalHTML = `
            <div id="geolocation-consent-modal" class="geolocation-modal" style="display: none;">
                <div class="geolocation-modal-overlay"></div>
                <div class="geolocation-modal-content">
                    <div class="geolocation-modal-header">
                        <i class="fas fa-map-marker-alt"></i>
                        <h3>Posizione Geografica</h3>
                    </div>
                    
                    <div class="geolocation-modal-body">
                        <p class="geolocation-description">
                            Per migliorare la tua esperienza e associare le tue recensioni 
                            ai luoghi in cui le birre sono state provate, vorremmo accedere 
                            alla tua posizione geografica.
                        </p>
                        
                        <div class="geolocation-privacy-notice">
                            <i class="fas fa-shield-alt"></i>
                            <p>
                                <strong>Privacy garantita:</strong> Le tue coordinate GPS saranno 
                                salvate solo nelle tue recensioni e non condivise con terze parti. 
                                Puoi modificare questa preferenza in qualsiasi momento dal tuo profilo.
                            </p>
                        </div>

                        <div class="geolocation-remember-choice">
                            <label>
                                <input type="checkbox" id="remember-location-choice">
                                <span>Ricorda la mia scelta per le prossime recensioni</span>
                            </label>
                        </div>
                    </div>

                    <div class="geolocation-modal-footer">
                        <button id="geolocation-deny-btn" class="btn-secondary">
                            <i class="fas fa-times"></i>
                            Non Condividere
                        </button>
                        <button id="geolocation-allow-btn" class="btn-primary">
                            <i class="fas fa-check"></i>
                            Consenti Accesso
                        </button>
                    </div>

                    <button class="geolocation-close-btn" id="geolocation-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        // Inserisci il modal nel DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Aggiungi event listeners
        this.attachModalEvents();

        this.logger.info('Modal consent creato e inserito nel DOM');
    }

    /**
     * Attach event listeners al modal
     */
    attachModalEvents() {
        const modal = document.getElementById('geolocation-consent-modal');
        const allowBtn = document.getElementById('geolocation-allow-btn');
        const denyBtn = document.getElementById('geolocation-deny-btn');
        const closeBtn = document.getElementById('geolocation-close-btn');
        const overlay = modal?.querySelector('.geolocation-modal-overlay');

        if (allowBtn) {
            allowBtn.addEventListener('click', () => this.handleUserConsent(true));
        }

        if (denyBtn) {
            denyBtn.addEventListener('click', () => this.handleUserConsent(false));
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeConsentModal(false));
        }

        if (overlay) {
            overlay.addEventListener('click', () => this.closeConsentModal(false));
        }

        this.logger.info('Event listeners modal consent attivati');
    }

    /**
     * Verifica se l'utente ha già una preferenza salvata
     */
    async checkUserPreference() {
        try {
            const response = await fetch('/api/user/location-consent', {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                // Se 401/403, utente non autenticato - chiederemo al login
                if (response.status === 401 || response.status === 403) {
                    this.logger.info('Utente non autenticato - preferenza non disponibile');
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.consent) {
                this.logger.info('Preferenza utente recuperata dal server', data.consent);
                return data.consent.enabled;  // true/false/null
            }

            return null;

        } catch (error) {
            this.logger.error('Errore nel recupero preferenze utente:', error);
            return null;  // In caso di errore, chiedi ogni volta
        }
    }

    /**
     * Salva la preferenza utente sul server
     */
    async saveUserPreference(enabled, rememberChoice) {
        try {
            console.log('📡 POST /api/user/location-consent', { enabled, rememberChoice });
            
            const response = await fetch('/api/user/location-consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    enabled: enabled,
                    rememberChoice: rememberChoice
                })
            });

            console.log('📡 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Errore HTTP:', response.status, errorText);
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('📡 Response data:', data);
            
            if (data.success) {
                console.log('✅ Preferenza utente salvata con successo sul database!');
                console.log('📊 Consent salvato:', data.consent);
                this.logger.info('Preferenza utente salvata con successo', data);
                return true;
            }

            console.warn('⚠️ Risposta non successful:', data);
            return false;

        } catch (error) {
            console.error('❌ ERRORE nel salvataggio preferenza:', error);
            this.logger.error('Errore nel salvataggio preferenza:', error);
            return false;
        }
    }

    /**
     * Mostra il modal di consent
     */
    showConsentModal() {
        return new Promise((resolve) => {
            const modal = document.getElementById('geolocation-consent-modal');
            
            if (!modal) {
                this.logger.error('Modal consent non trovato nel DOM');
                resolve(false);
                return;
            }

            this.consentModalActive = true;
            this.consentResolve = resolve;

            // Mostra modal con fade-in
            modal.style.display = 'block';
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);

            this.logger.info('Modal consent visualizzato');
        });
    }

    /**
     * Chiude il modal di consent
     */
    closeConsentModal(consented = false) {
        const modal = document.getElementById('geolocation-consent-modal');
        
        if (!modal) return;

        // Fade-out
        modal.classList.remove('active');
        
        setTimeout(() => {
            modal.style.display = 'none';
            this.consentModalActive = false;

            // Risolvi la promise se esiste
            if (this.consentResolve) {
                this.consentResolve(consented);
                this.consentResolve = null;
            }
        }, 300);

        this.logger.info(`Modal consent chiuso - Consented: ${consented}`);
    }

    /**
     * Gestisce la scelta dell'utente dal modal
     */
    async handleUserConsent(allowed) {
        const rememberCheckbox = document.getElementById('remember-location-choice');
        const rememberChoice = rememberCheckbox ? rememberCheckbox.checked : false;

        console.log('🔵 GEOLOCATION CONSENT - Scelta utente:', { 
            allowed, 
            rememberChoice,
            checkboxFound: !!rememberCheckbox,
            checkboxChecked: rememberCheckbox?.checked 
        });

        // Salva preferenza sul server se utente vuole ricordare
        if (rememberChoice) {
            console.log('💾 Tentativo di salvataggio preferenza sul server...');
            const saved = await this.saveUserPreference(allowed, true);
            console.log('💾 Risultato salvataggio:', saved ? '✅ SUCCESS' : '❌ FAILED');
        } else {
            console.log('⚠️ Checkbox NON selezionato - preferenza NON salvata sul server');
        }

        this.userConsent = allowed;
        this.closeConsentModal(allowed);

        // Se l'utente ha negato, risolvi con errore
        if (!allowed) {
            this.logger.warn('Utente ha negato l\'accesso alla posizione');
        }
    }

    /**
     * Ottiene la posizione geografica dell'utente
     * @param {boolean} showModal - Se mostrare il modal di consent
     * @returns {Promise<Object>} Dati di geolocalizzazione completi
     */
    async getLocation(showModal = true) {
        try {
            // Verifica supporto API
            if (!navigator.geolocation) {
                throw new Error('Geolocation API non supportata');
            }

            // Controlla preferenza salvata
            const savedPreference = await this.checkUserPreference();
            
            this.logger.info('Preferenza salvata:', savedPreference);

            // Se ha già negato in precedenza, non catturare
            if (savedPreference === false) {
                this.logger.info('Utente ha disabilitato la geolocalizzazione nelle preferenze');
                return {
                    consentGiven: false,
                    source: 'none',
                    coordinates: null,
                    timestamp: new Date().toISOString()
                };
            }

            // Se non ha preferenza salvata (null) o showModal è true, chiedi consent
            if (savedPreference === null && showModal) {
                const consented = await this.showConsentModal();
                
                if (!consented) {
                    this.logger.info('Utente ha negato il consent dal modal');
                    // ⚠️ NON chiamare getCurrentPosition() se consent negato
                    // Questo previene la doppia richiesta del browser
                    return {
                        consentGiven: false,
                        source: 'none',
                        coordinates: null,
                        timestamp: new Date().toISOString()
                    };
                }
                // ✅ Utente ha cliccato "Consenti" nel modal
                // ORA possiamo chiamare il browser senza doppia richiesta
                this.logger.info('Consent manuale ottenuto - procedo con richiesta browser GPS');
            }

            // Cattura posizione GPS (chiamato SOLO se consent=true)
            this.logger.info('Richiesta posizione GPS in corso...');
            
            const position = await this.getCurrentPosition();

            // Costruisci oggetto dati completo
            const locationData = {
                consentGiven: true,
                source: position.coords.accuracy < 100 ? 'gps' : 'network',
                coordinates: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed
                },
                timestamp: new Date(position.timestamp).toISOString()
            };

            this.locationData = locationData;

            this.logger.info('Posizione acquisita con successo', {
                lat: locationData.coordinates.latitude,
                lng: locationData.coordinates.longitude,
                accuracy: locationData.coordinates.accuracy,
                source: locationData.source
            });

            return locationData;

        } catch (error) {
            this.logger.error('Errore nella cattura posizione:', error);
            
            return {
                consentGiven: false,
                source: 'none',
                coordinates: null,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Wrapper promisified per getCurrentPosition
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                this.config
            );
        });
    }

    /**
     * Ottiene i dati di geolocalizzazione catturati
     */
    getLocationData() {
        return this.locationData;
    }

    /**
     * Reset dei dati di geolocalizzazione
     */
    resetLocationData() {
        this.locationData = null;
        this.userConsent = null;
        this.logger.info('Dati di geolocalizzazione resettati');
    }
}

// Esporta istanza singleton
if (typeof window !== 'undefined') {
    window.GeolocationModule = new GeolocationModule();
    console.log('📍 GeolocationModule caricato e disponibile globalmente');
}
