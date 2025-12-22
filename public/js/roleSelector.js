/**
 * Modern Role Selector Module
 * Gestisce la selezione del ruolo attivo e default con UI moderna
 */

class RoleSelector {
    constructor() {
        this.dropdown = null;
        this.isOpen = false;
        this.currentRoles = [];
        this.activeRole = null;
        this.defaultRole = null;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        // Aspetta che il DOM sia caricato
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Verifica se l'utente è administrator puro (solo administrator)
        this.checkUserRoles().then(isAdministratorOnly => {
            if (isAdministratorOnly) {
                console.log('👑 Utente administrator - roleSelector disabilitato');
                return; // Non inizializzare per administrator
            }
            
            this.createDropdown();
            this.attachEventListeners();
            this.loadUserRoles();
        });
    }

    async checkUserRoles() {
        try {
            const response = await fetch('/api/user/roles', {
                method: 'GET',
                credentials: 'include'
            });

            // Controlla se la risposta è JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.log('👤 Risposta non JSON - utente non autenticato');
                return false;
            }

            if (response.ok) {
                const data = await response.json();
                const roles = data.roles || [];
                // Se ha solo il ruolo administrator, non mostrare il selector
                return roles.length === 1 && roles.includes('administrator');
            }
        } catch (error) {
            console.warn('Impossibile verificare ruoli utente - assumo non autenticato');
        }
        return false;
    }

    createDropdown() {
        const profileLink = document.querySelector('a[href="/profile"]');
        if (!profileLink) return;

        // Crea il container del dropdown
        const container = document.createElement('div');
        container.className = 'role-selector-container';
        
        // Sostituisce il link del profilo
        profileLink.parentNode.replaceChild(container, profileLink);
        container.appendChild(profileLink);

        // Crea il dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'role-dropdown';
        this.dropdown.innerHTML = this.getDropdownHTML();
        
        container.appendChild(this.dropdown);

        // Modifica il comportamento del click del profilo
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleDropdown();
        });
    }

    getDropdownHTML() {
        return `
            <div class="role-dropdown-header">
                <i class="fas fa-user-cog"></i> Gestione Ruoli
            </div>
            
            <div class="role-actions-header">
                <span class="action-label select-label">Attiva</span>
                <span class="action-label default-label">Default</span>
            </div>
            
            <div class="role-list" id="role-list">
                <!-- I ruoli verranno inseriti dinamicamente -->
            </div>
        `;
    }

    attachEventListeners() {
        // Click fuori dal dropdown per chiuderlo
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.role-selector-container')) {
                this.closeDropdown();
            }
        });

        // Escape key per chiudere
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDropdown();
            }
        });
    }

    async loadUserRoles() {
        console.log('🔄 Caricamento dati ruoli utente...');
        try {
            const response = await fetch('/api/user/roles', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Controlla se la risposta è JSON valida
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn('⚠️ Risposta non JSON ricevuta - utente probabilmente non autenticato');
                this.handleUnauthenticatedUser();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Dati ruoli ricevuti:', data);
                this.currentRoles = data.roles || [];
                this.activeRole = data.activeRole;
                this.defaultRole = data.defaultRole;
                this.updateDropdownContent();
            } else {
                console.warn('⚠️ Impossibile caricare i ruoli utente');
                this.handleUnauthenticatedUser();
            }
        } catch (error) {
            console.error('❌ Errore nel caricamento ruoli:', error);
            this.handleUnauthenticatedUser();
        }
    }

    updateDropdownContent() {
        // Verifica che il dropdown esista (non esiste per administrator)
        if (!this.dropdown) {
            console.log('👑 Dropdown non disponibile per administrator');
            return;
        }
        
        const roleList = this.dropdown.querySelector('#role-list');
        
        if (roleList) {
            roleList.innerHTML = this.generateRoleItems();
            this.attachRoleEventListeners();
        }
    }

    generateRoleItems() {
        // Filtra ruoli per escludere administrator dalla UI
        const selectableRoles = this.currentRoles.filter(role => role !== 'administrator');
        console.log('🎨 Generazione HTML per ruoli:', selectableRoles, 'default:', this.defaultRole);
        
        return selectableRoles.map(role => {
            const isActive = role === this.activeRole;
            const isDefault = role === this.defaultRole;
            const roleIcon = this.getRoleIcon(role);
            
            return `
                <div class="role-item ${isActive ? 'active' : ''}" data-role="${role}">
                    <div class="role-activate-area" data-activate-role="${role}">
                        <div class="role-info">
                            <div class="role-icon ${role}">
                                ${roleIcon}
                            </div>
                            <div class="role-name">
                                ${this.getRoleDisplayName(role)}
                            </div>
                        </div>
                    </div>
                    <div class="role-default-area">
                        <label class="radio-label" for="default-radio-${role}">
                            <div class="modern-radio">
                                <input type="radio" 
                                       name="defaultRole" 
                                       id="default-radio-${role}" 
                                       value="${role}"
                                       ${isDefault ? 'checked' : ''}
                                       data-role="${role}">
                                <div class="radio-custom"></div>
                            </div>
                        </label>
                    </div>
                </div>
            `;
        }).join('');
    }

    getRoleIcon(role) {
        const icons = {
            customer: 'C',
            brewery: 'B',
            administrator: 'A'
        };
        return icons[role] || '?';
    }

    getRoleDisplayName(role) {
        const names = {
            customer: 'Cliente',
            brewery: 'Birrificio',
            administrator: 'Amministratore'
        };
        return names[role] || role;
    }

    attachRoleEventListeners() {
        // Rimuovi event listeners precedenti per evitare duplicati
        this.removeEventListeners();
        
        // Click sull'area di attivazione del ruolo
        this.dropdown.querySelectorAll('.role-activate-area').forEach(area => {
            area.addEventListener('click', async (e) => {
                const role = area.dataset.activateRole;
                console.log('Attivazione ruolo:', role);
                await this.activateRoleImmediately(role);
            });
        });

        // Gestione radio buttons per default role
        this.dropdown.querySelectorAll('input[name="defaultRole"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    const role = e.target.dataset.role;
                    console.log('🎯 Evento change su radio button per ruolo:', role);
                    await this.setDefaultRoleImmediately(role);
                }
            });
            
            // Aggiungi anche click sul label per assicurarsi che funzioni
            const label = radio.closest('.radio-label');
            if (label) {
                label.addEventListener('click', (e) => {
                    console.log('👆 Click su label per ruolo:', radio.dataset.role);
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                });
            }
        });
        
        console.log('✅ Event listeners collegati per', this.dropdown.querySelectorAll('input[name="defaultRole"]').length, 'radio buttons');
    }

    removeEventListeners() {
        // Rimuovi tutti gli event listeners precedenti
        this.dropdown.querySelectorAll('.role-activate-area').forEach(area => {
            area.replaceWith(area.cloneNode(true));
        });
        
        this.dropdown.querySelectorAll('input[name="defaultRole"]').forEach(radio => {
            radio.replaceWith(radio.cloneNode(true));
        });
        
        this.dropdown.querySelectorAll('.radio-label').forEach(label => {
            label.replaceWith(label.cloneNode(true));
        });
    }

    async activateRoleImmediately(role) {
        if (this.isLoading) return;

        this.setLoading(true);

        try {
            const response = await fetch('/api/user/roles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    activeRole: role
                })
            });

            if (response.ok) {
                // Mostra messaggio di successo brevemente
                this.showSuccessMessage(`Attivato ruolo: ${this.getRoleDisplayName(role)}`);
                
                // Chiudi il dropdown
                setTimeout(() => {
                    this.closeDropdown();
                    // Redirect alla home page appropriata
                    this.redirectToRoleHome(role);
                }, 800);
            } else {
                const error = await response.json();
                this.showErrorMessage(error.message || 'Errore nella selezione del ruolo');
            }
        } catch (error) {
            console.error('Errore nell\'attivazione ruolo:', error);
            this.showErrorMessage('Errore di connessione');
        } finally {
            this.setLoading(false);
        }
    }

    async setDefaultRoleImmediately(role) {
        console.log('🔄 Iniziando cambio ruolo default a:', role);
        if (this.isLoading) {
            console.log('⚠️ Operazione bloccata - già in caricamento');
            return;
        }

        this.setLoading(true);

        try {
            console.log('📡 Invio richiesta API per defaultRole:', role);
            const response = await fetch('/api/user/roles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    defaultRole: role
                })
            });

            console.log('📡 Risposta API ricevuta:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API risposta OK:', data);
                
                // Aggiorna visivamente i radio buttons
                this.updateRadioButtons(role);
                this.showSuccessMessage(`Ruolo default: ${this.getRoleDisplayName(role)}`);
            } else {
                const error = await response.json();
                console.error('❌ Errore API:', error);
                this.showErrorMessage(error.message || 'Errore nell\'impostazione ruolo default');
            }
        } catch (error) {
            console.error('❌ Errore connessione:', error);
            this.showErrorMessage('Errore di connessione');
        } finally {
            this.setLoading(false);
        }
    }

    updateRadioButtons(selectedRole) {
        // Aggiorna i radio buttons
        this.dropdown.querySelectorAll('input[name="defaultRole"]').forEach(radio => {
            radio.checked = (radio.dataset.role === selectedRole);
        });

        this.defaultRole = selectedRole;
    }

    redirectToRoleHome(role) {
        let homeUrl = '/';
        
        switch (role) {
            case 'brewery':
                homeUrl = '/brewery/dashboard';
                break;
            case 'administrator':
                homeUrl = '/administrator';
                break;
            case 'customer':
            default:
                homeUrl = '/';
                break;
        }
        
        window.location.href = homeUrl;
    }

    setLoading(loading) {
        this.isLoading = loading;
        const dropdown = this.dropdown;

        if (loading) {
            dropdown.classList.add('loading');
        } else {
            dropdown.classList.remove('loading');
        }
    }

    showSuccessMessage(customMessage = null) {
        const header = this.dropdown.querySelector('.role-dropdown-header');
        const originalText = header.innerHTML;
        
        const message = customMessage || 'Modifiche salvate!';
        header.innerHTML = `<i class="fas fa-check-circle" style="color: #28a745;"></i> ${message}`;
        header.style.color = '#28a745';
        
        setTimeout(() => {
            header.innerHTML = originalText;
            header.style.color = '';
        }, 2000);
    }

    showErrorMessage(message) {
        const header = this.dropdown.querySelector('.role-dropdown-header');
        const originalText = header.innerHTML;
        
        header.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> ${message}`;
        header.style.color = '#dc3545';
        
        setTimeout(() => {
            header.innerHTML = originalText;
            header.style.color = '';
        }, 3000);
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        if (!this.dropdown) return;
        
        this.dropdown.classList.add('show');
        this.isOpen = true;
        
        // Carica i dati più recenti
        this.loadUserRoles();
    }

    closeDropdown() {
        if (!this.dropdown) return;
        
        this.dropdown.classList.remove('show');
        this.isOpen = false;
    }

    handleUnauthenticatedUser() {
        console.log('👤 Utente non autenticato - nascondo role selector');
        // Nasconde il dropdown se esiste
        if (this.dropdown) {
            this.dropdown.style.display = 'none';
        }
        // Resetta i dati
        this.currentRoles = [];
        this.activeRole = null;
        this.defaultRole = null;
    }
}

// Inizializza il role selector solo per utenti autenticati
document.addEventListener('DOMContentLoaded', function() {
    // Controlla se esiste elemento che indica utente autenticato
    const userIndicator = document.querySelector('.user-menu, .navbar-nav .dropdown');
    if (userIndicator) {
        window.roleSelector = new RoleSelector();
    } else {
        console.log('🔒 Utente guest - Role selector disabilitato');
    }
});
