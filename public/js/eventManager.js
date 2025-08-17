/**
 * Gestore centralizzato degli eventi per evitare listener duplicati
 * e migliorare la gestione degli eventi nell'applicazione
 */
class EventManager {
    constructor() {
        // Mappa per tracciare i listener registrati
        this.listeners = new Map();
        // Contatore per generare ID unici
        this.eventCounter = 0;
        
        console.log('[EventManager] Inizializzato nuovo gestore eventi');
    }

    /**
     * Aggiunge un listener evitando duplicati
     * @param {Element} element - L'elemento DOM
     * @param {string} event - Il tipo di evento
     * @param {Function} handler - La funzione di gestione
     * @param {string} key - Chiave unica per identificare il listener
     * @returns {string} - ID del listener registrato
     */
    addListener(element, event, handler, key = null) {
        // Genera una chiave unica se non fornita
        if (!key) {
            key = `${event}_${++this.eventCounter}_${Date.now()}`;
        }

        // Rimuovi listener esistente con la stessa chiave
        if (this.listeners.has(key)) {
            this.removeListener(key);
        }

        // Wrapper che preserva il contesto 'this' e gestisce gli errori
        const wrappedHandler = function(e) {
            try {
                // Verifica preventiva del contesto this
                if (!this || typeof this !== 'object') {
                    console.error(`[EventManager] Contesto 'this' non valido per listener ${key}:`, this);
                    console.error('Event:', e);
                    return;
                }

                // Verifica se l'elemento ha dataset (comune per elementi con data-attributes)
                if (this.dataset === undefined && key.includes('star')) {
                    console.warn(`[EventManager] Elemento senza dataset per listener ${key}:`, {
                        element: this,
                        tagName: this.tagName,
                        className: this.className,
                        attributes: Array.from(this.attributes || []).map(attr => `${attr.name}="${attr.value}"`),
                        parentElement: this.parentElement?.tagName
                    });
                }

                // Usa .call per preservare il contesto 'this' dell'elemento
                return handler.call(this, e);
            } catch (error) {
                console.error(`[EventManager] Errore nel listener ${key}:`, error);
                console.error('Element context:', {
                    element: this,
                    tagName: this?.tagName,
                    id: this?.id,
                    className: this?.className,
                    dataset: this?.dataset,
                    isConnected: this?.isConnected
                });
                console.error('Event details:', e);
                
                // Auto-debug per questo tipo di errore
                if (error.message.includes("can't access property") && error.message.includes('dataset')) {
                    console.error('[EventManager] Errore dataset rilevato - avvio debug automatico');
                    eventManager.debugListeners();
                }
            }
        };

        // Registra il listener
        element.addEventListener(event, wrappedHandler);

        // Salva i dettagli per il cleanup futuro
        this.listeners.set(key, {
            element,
            event,
            handler: wrappedHandler,
            originalHandler: handler,
            timestamp: Date.now()
        });

        console.log(`[EventManager] Listener aggiunto: ${key} per evento ${event}`);
        return key;
    }

    /**
     * Rimuove un listener specifico
     * @param {string} key - La chiave del listener da rimuovere
     * @returns {boolean} - True se rimosso con successo
     */
    removeListener(key) {
        const listenerInfo = this.listeners.get(key);
        
        if (listenerInfo) {
            listenerInfo.element.removeEventListener(listenerInfo.event, listenerInfo.handler);
            this.listeners.delete(key);
            console.log(`[EventManager] Listener rimosso: ${key}`);
            return true;
        }

        console.warn(`[EventManager] Listener non trovato: ${key}`);
        return false;
    }

    /**
     * Rimuove tutti i listener di un elemento
     * @param {Element} element - L'elemento di cui rimuovere i listener
     * @returns {number} - Numero di listener rimossi
     */
    removeAllListeners(element) {
        let removed = 0;
        
        for (const [key, listenerInfo] of this.listeners) {
            if (listenerInfo.element === element) {
                this.removeListener(key);
                removed++;
            }
        }

        console.log(`[EventManager] Rimossi ${removed} listener dall'elemento`);
        return removed;
    }

    /**
     * Pulisce tutti i listener registrati
     */
    cleanup() {
        const keys = Array.from(this.listeners.keys());
        keys.forEach(key => this.removeListener(key));
        console.log(`[EventManager] Cleanup completato: ${keys.length} listener rimossi`);
    }

    /**
     * Ottiene informazioni sui listener registrati
     * @returns {Array} - Array con informazioni sui listener
     */
    getListenersInfo() {
        const info = [];
        for (const [key, listenerInfo] of this.listeners) {
            info.push({
                key,
                event: listenerInfo.event,
                element: listenerInfo.element.tagName + (listenerInfo.element.id ? `#${listenerInfo.element.id}` : ''),
                timestamp: listenerInfo.timestamp,
                isConnected: listenerInfo.element.isConnected, // Verifica se l'elemento è ancora nel DOM
                datasets: listenerInfo.element.dataset || {} // Include i dataset per debugging
            });
        }
        return info;
    }

    /**
     * Debug: verifica la validità degli elementi con listener
     * @returns {Object} - Statistiche sui listener
     */
    debugListeners() {
        const stats = {
            total: this.listeners.size,
            connected: 0,
            disconnected: 0,
            withDatasets: 0,
            invalidElements: []
        };

        for (const [key, listenerInfo] of this.listeners) {
            if (listenerInfo.element.isConnected) {
                stats.connected++;
            } else {
                stats.disconnected++;
                stats.invalidElements.push({
                    key,
                    element: listenerInfo.element.tagName,
                    event: listenerInfo.event
                });
            }

            if (listenerInfo.element.dataset && Object.keys(listenerInfo.element.dataset).length > 0) {
                stats.withDatasets++;
            }
        }

        console.log('[EventManager] Debug Listeners:', stats);
        return stats;
    }

    /**
     * Pulisce i listener di elementi disconnessi dal DOM
     * @returns {number} - Numero di listener rimossi
     */
    cleanupDisconnectedListeners() {
        const toRemove = [];
        
        for (const [key, listenerInfo] of this.listeners) {
            if (!listenerInfo.element.isConnected) {
                toRemove.push(key);
            }
        }

        toRemove.forEach(key => this.removeListener(key));
        
        console.log(`[EventManager] Cleanup: rimossi ${toRemove.length} listener disconnessi`);
        return toRemove.length;
    }

    /**
     * Sostituisce un elemento mantenendo i listener
     * @param {Element} oldElement - L'elemento da sostituire
     * @param {Element} newElement - Il nuovo elemento
     * @returns {number} - Numero di listener trasferiti
     */
    replaceElement(oldElement, newElement) {
        let transferred = 0;
        
        // Trova tutti i listener dell'elemento vecchio
        const listenersToTransfer = [];
        for (const [key, listenerInfo] of this.listeners) {
            if (listenerInfo.element === oldElement) {
                listenersToTransfer.push({
                    key,
                    event: listenerInfo.event,
                    handler: listenerInfo.originalHandler // Usa l'handler originale
                });
            }
        }

        // Sostituisci l'elemento nel DOM
        if (oldElement.parentNode) {
            oldElement.parentNode.replaceChild(newElement, oldElement);
        }

        // Trasferisci i listener al nuovo elemento usando addListener per preservare il wrapping
        listenersToTransfer.forEach(listener => {
            this.removeListener(listener.key);
            this.addListener(newElement, listener.event, listener.handler, listener.key);
            transferred++;
        });

        console.log(`[EventManager] Elemento sostituito con ${transferred} listener trasferiti`);
        return transferred;
    }

    /**
     * Clona un elemento mantenendo i listener
     * @param {Element} element - L'elemento da clonare
     * @param {boolean} deep - Se fare una clonazione profonda
     * @returns {Element} - L'elemento clonato con i listener
     */
    cloneElementWithListeners(element, deep = true) {
        const clone = element.cloneNode(deep);
        
        // Trova tutti i listener dell'elemento originale
        let transferred = 0;
        for (const [key, listenerInfo] of this.listeners) {
            if (listenerInfo.element === element) {
                // Crea una nuova chiave per il clone
                const newKey = `${key}_clone_${Date.now()}`;
                this.addListener(clone, listenerInfo.event, listenerInfo.originalHandler, newKey);
                transferred++;
            }
        }

        console.log(`[EventManager] Elemento clonato con ${transferred} listener trasferiti`);
        return clone;
    }

    /**
     * Aggiunge un listener che si rimuove automaticamente dopo il primo utilizzo
     * @param {Element} element - L'elemento DOM
     * @param {string} event - Il tipo di evento
     * @param {Function} handler - La funzione di gestione
     * @param {string} key - Chiave unica per identificare il listener
     * @returns {string} - ID del listener registrato
     */
    addOneTimeListener(element, event, handler, key = null) {
        if (!key) {
            key = `onetime_${event}_${++this.eventCounter}_${Date.now()}`;
        }

        const wrappedHandler = function(e) {
            try {
                handler.call(this, e);
            } catch (error) {
                console.error(`[EventManager] Errore nel one-time listener ${key}:`, error);
            } finally {
                // Rimuovi automaticamente dopo l'esecuzione
                eventManager.removeListener(key);
            }
        };

        return this.addListener(element, event, wrappedHandler, key);
    }

    /**
     * Aggiunge un listener con debouncing
     * @param {Element} element - L'elemento DOM
     * @param {string} event - Il tipo di evento
     * @param {Function} handler - La funzione di gestione
     * @param {number} delay - Ritardo in millisecondi per il debouncing
     * @param {string} key - Chiave unica per identificare il listener
     * @returns {string} - ID del listener registrato
     */
    addDebouncedListener(element, event, handler, delay = 300, key = null) {
        if (!key) {
            key = `debounced_${event}_${++this.eventCounter}_${Date.now()}`;
        }

        let timeoutId;
        const debouncedHandler = function(e) {
            clearTimeout(timeoutId);
            const context = this; // Preserva il contesto
            timeoutId = setTimeout(() => {
                try {
                    handler.call(context, e);
                } catch (error) {
                    console.error(`[EventManager] Errore nel debounced listener ${key}:`, error);
                }
            }, delay);
        };

        return this.addListener(element, event, debouncedHandler, key);
    }

    /**
     * Aggiunge un listener con throttling
     * @param {Element} element - L'elemento DOM
     * @param {string} event - Il tipo di evento
     * @param {Function} handler - La funzione di gestione
     * @param {number} limit - Limite in millisecondi per il throttling
     * @param {string} key - Chiave unica per identificare il listener
     * @returns {string} - ID del listener registrato
     */
    addThrottledListener(element, event, handler, limit = 300, key = null) {
        if (!key) {
            key = `throttled_${event}_${++this.eventCounter}_${Date.now()}`;
        }

        let inThrottle;
        const throttledHandler = function(e) {
            if (!inThrottle) {
                try {
                    handler.call(this, e);
                } catch (error) {
                    console.error(`[EventManager] Errore nel throttled listener ${key}:`, error);
                }
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };

        return this.addListener(element, event, throttledHandler, key);
    }
}

// Esporta una singola istanza globale
const eventManager = new EventManager();

// Cleanup automatico quando la pagina viene scaricata
window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
});

// Esporta il manager per uso globale
window.EventManager = EventManager;
window.eventManager = eventManager;

console.log('[EventManager] Gestore eventi globale inizializzato e disponibile come window.eventManager');
