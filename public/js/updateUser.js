// Funzione globale per toggle brewery selection (fallback per onchange inline)
function toggleBrewerySelection(roleValue) {
    console.log('toggleBrewerySelection globale chiamata con:', roleValue);
    const brewerySelection = document.getElementById('brewerySelection');
    
    if (brewerySelection) {
        if (roleValue === 'brewery') {
            console.log('Mostra selezione birrificio (globale)');
            brewerySelection.style.display = 'block';
            // Aggiunge animazione di entrata
            brewerySelection.style.animation = 'slideDown 0.3s ease';
        } else {
            console.log('Nascondi selezione birrificio (globale)');
            brewerySelection.style.display = 'none';
            const brewerySelect = document.getElementById('breweryId');
            if (brewerySelect) {
                brewerySelect.value = '';
            }
        }
    } else {
        console.log('Elemento brewerySelection non trovato (globale)');
    }
}

// Enhanced User Management JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('UpdateUser.js caricato - Versione moderna');
    
    // ===== GESTIONE SELEZIONE UTENTE =====
    const userSelect = document.getElementById('userUpdateId');
    const selectUserBtn = document.getElementById('selectUserBtn');
    const userSelectionForm = userSelect ? userSelect.closest('form') : null;
    
    console.log('User select (userUpdateId):', userSelect);
    console.log('Select user button:', selectUserBtn);
    console.log('User selection form:', userSelectionForm);
    
    if (userSelect && selectUserBtn) {
        // Imposta lo stato iniziale del pulsante
        selectUserBtn.disabled = !userSelect.value;
        
        userSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            console.log('User selection changed:', {
                value: this.value,
                text: selectedOption.text
            });
            
            if (this.value) {
                // Abilita il pulsante e aggiungi feedback visivo alla dropdown
                selectUserBtn.disabled = false;
                selectUserBtn.innerHTML = '<i class="fas fa-edit"></i> Modifica "' + selectedOption.text.split(' (')[0] + '"';
                
                // Feedback visivo sulla dropdown
                this.style.background = '#e8f5e8';
                this.style.borderColor = '#28a745';
                this.style.fontWeight = 'bold';
                
                // Animazione di conferma
                this.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 200);
                
                console.log('User selected:', selectedOption.text.split(' (')[0]);
            } else {
                // Disabilita il pulsante e resetta lo stile
                selectUserBtn.disabled = true;
                selectUserBtn.innerHTML = '<i class="fas fa-edit"></i> Modifica Utente';
                
                // Reset stile dropdown
                this.style.background = '';
                this.style.borderColor = '';
                this.style.fontWeight = '';
                
                console.log('User selection cleared');
            }
        });
        
        // Trigger dell'evento change per impostare lo stato iniziale
        if (userSelect.value) {
            userSelect.dispatchEvent(new Event('change'));
        }
    }
    
    // ===== GESTIONE FORM SELEZIONE UTENTE =====
    if (userSelectionForm) {
        userSelectionForm.addEventListener('submit', function(e) {
            const selectedUserId = userSelect ? userSelect.value : '';
            
            console.log('User selection form submit - User ID:', selectedUserId);
            
            if (!selectedUserId) {
                e.preventDefault();
                
                // Feedback visivo migliorato sulla dropdown stessa
                userSelect.style.borderColor = '#ef4444';
                userSelect.style.background = '#fef2f2';
                userSelect.style.animation = 'shake 0.5s ease-in-out';
                
                // Alert personalizzato posizionato meglio
                const alertDiv = document.createElement('div');
                alertDiv.className = 'selection-alert';
                alertDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    Seleziona un utente dalla dropdown per continuare
                `;
                alertDiv.style.cssText = `
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #ef4444;
                    color: white;
                    padding: 0.6rem;
                    border-radius: 0 0 6px 6px;
                    font-size: 0.85rem;
                    z-index: 1000;
                    animation: slideDown 0.3s ease;
                    box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
                `;
                
                // Posiziona l'alert sotto la dropdown
                const selectContainer = userSelect.closest('.form-group');
                selectContainer.style.position = 'relative';
                selectContainer.appendChild(alertDiv);
                
                // Rimuovi l'alert dopo 4 secondi
                setTimeout(() => {
                    if (selectContainer.contains(alertDiv)) {
                        alertDiv.style.animation = 'slideUp 0.3s ease';
                        setTimeout(() => {
                            if (selectContainer.contains(alertDiv)) {
                                selectContainer.removeChild(alertDiv);
                            }
                        }, 300);
                    }
                }, 4000);
                
                // Reset stile dopo 3 secondi
                setTimeout(() => {
                    userSelect.style.borderColor = '';
                    userSelect.style.background = '';
                    userSelect.style.animation = '';
                }, 3000);
                
                // Focus sulla select
                userSelect.focus();
                
                console.log('Form submission blocked - no user selected');
                return false;
            }
            
            // Aggiungi feedback di loading sul pulsante
            if (selectUserBtn) {
                selectUserBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Caricando...';
                selectUserBtn.disabled = true;
            }
            
            console.log('User selection form submission allowed');
        });
    }
    
    // ===== GESTIONE FORM AGGIORNAMENTO UTENTE PRINCIPALE =====
    const updateUserForm = document.getElementById('updateUserForm');
    if (updateUserForm) {
        updateUserForm.addEventListener('submit', function(e) {
            console.log('Form aggiornamento utente submitted');
            
            // Aggiungi feedback di loading al pulsante salva
            const saveButton = updateUserForm.querySelector('button[type="submit"]');
            if (saveButton) {
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                saveButton.disabled = true;
            }
            
            console.log('Form aggiornamento utente submission allowed');
        });
    }
    
    // ===== GESTIONE RIMOZIONE RUOLI =====
    const removeButtons = document.querySelectorAll('.remove-role-btn');
    removeButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            // Previeni il submit automatico del form - controlleremo noi il flusso
            e.preventDefault();
            
            const ruolo = btn.getAttribute('data-role');
            const form = btn.closest('form');
            
            console.log(`Click su rimozione ruolo: ${ruolo}`, { form: form, button: btn });
            
            // Conta i ruoli totali sulla pagina
            const totalRoles = document.querySelectorAll('.role-badge').length;
            
            // Controlla se è l'ultimo ruolo
            if (totalRoles <= 1) {
                alert(`❌ Impossibile rimuovere il ruolo "${ruolo}".\n\nOgni utente deve avere almeno un ruolo attivo.`);
                return false;
            }
            
            // Controllo specifico per ruolo customer
            if (ruolo === 'customer') {
                alert(`❌ Impossibile rimuovere il ruolo "customer".\n\nIl ruolo customer è obbligatorio per tutti gli utenti della piattaforma.`);
                return false;
            }
            
            // Conferma rimozione per altri ruoli
            const confirmed = confirm(
                `⚠️ Rimozione Ruolo "${ruolo.toUpperCase()}"\n\n` +
                `Sei sicuro di voler rimuovere questo ruolo?\n\n` +
                `Conseguenze:\n` +
                `• Perdita delle autorizzazioni associate\n` +
                `• Rimozione dei dettagli specifici del ruolo\n` +
                `${ruolo === 'brewery' ? '• Disassociazione dal birrificio (il birrificio non sarà eliminato)\n' : ''}` +
                `• Questa azione è irreversibile\n\n` +
                `Procedere con la rimozione?`
            );
            
            if (!confirmed) {
                return false;
            }
            
            // Aggiungi feedback visivo durante l'invio
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
            
            // Aggiungi un indicatore di caricamento al form
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-indicator';
            loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rimozione in corso...';
            loadingDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #3b82f6;
                color: white;
                padding: 0.8rem 1.2rem;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                font-size: 0.85rem;
                animation: slideInDown 0.3s ease;
            `;
            document.body.appendChild(loadingDiv);
            
            // Rimuovi l'indicatore dopo 10 secondi (fallback)
            setTimeout(() => {
                if (document.body.contains(loadingDiv)) {
                    document.body.removeChild(loadingDiv);
                }
            }, 10000);
            
            console.log(`Rimozione ruolo ${ruolo} confermata, invio form...`);
            
            // CORREZIONE: Forza il submit del form dopo la conferma
            if (form) {
                console.log('Submitting form:', form);
                form.submit();
            } else {
                console.error('Form non trovato per la rimozione del ruolo');
            }
        });
    });

    // ===== TOGGLE VISIBILITÀ PASSWORD =====
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    console.log('Toggle password button:', togglePasswordBtn);
    console.log('Password input:', passwordInput);
    
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function() {
            console.log('Toggle password clicked');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                togglePasswordBtn.innerHTML = '🙈';
                togglePasswordBtn.title = 'Nascondi password';
                
                // Aggiungi effetto di focus
                passwordInput.focus();
                passwordInput.style.background = '#f0f9ff';
                
                setTimeout(() => {
                    passwordInput.style.background = '';
                }, 300);
            } else {
                passwordInput.type = 'password';
                togglePasswordBtn.innerHTML = '👁️';
                togglePasswordBtn.title = 'Mostra password';
            }
            
            // Aggiungi effetto click
            togglePasswordBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                togglePasswordBtn.style.transform = '';
            }, 150);
        });
    }

    // ===== GESTIONE SELEZIONE RUOLO BREWERY =====
    const addRoleSelect = document.getElementById('addRole');
    const brewerySelection = document.getElementById('brewerySelection');
    const addRoleForm = addRoleSelect ? addRoleSelect.closest('form') : null;
    
    console.log('Add role select:', addRoleSelect);
    console.log('Brewery selection div:', brewerySelection);
    console.log('Add role form:', addRoleForm);
    
    if (addRoleSelect && brewerySelection) {
        addRoleSelect.addEventListener('change', function() {
            console.log('Role selection changed to:', this.value);
            
            // Reset previous animations
            brewerySelection.style.animation = '';
            
            if (this.value === 'brewery') {
                console.log('Showing brewery selection');
                brewerySelection.style.display = 'block';
                brewerySelection.style.animation = 'slideDown 0.3s ease';
                
                // Aggiungi focus al select del birrificio dopo l'animazione
                setTimeout(() => {
                    const brewerySelect = document.getElementById('breweryId');
                    if (brewerySelect) {
                        brewerySelect.focus();
                    }
                }, 350);
                
            } else {
                console.log('Hiding brewery selection');
                
                // Animazione di uscita
                brewerySelection.style.animation = 'slideUp 0.2s ease';
                setTimeout(() => {
                    brewerySelection.style.display = 'none';
                    // Reset brewery selection
                    const brewerySelect = document.getElementById('breweryId');
                    if (brewerySelect) {
                        brewerySelect.value = '';
                    }
                }, 200);
            }
        });
    }

    // ===== VALIDAZIONE FORM AGGIUNTA RUOLO =====
    if (addRoleForm) {
        addRoleForm.addEventListener('submit', function(e) {
            const roleToAdd = addRoleSelect.value;
            const breweryId = document.getElementById('breweryId');
            
            console.log('Form submit - Role:', roleToAdd, 'BreweryId:', breweryId ? breweryId.value : 'not found');
            
            if (roleToAdd === 'brewery' && breweryId && !breweryId.value) {
                e.preventDefault();
                
                // Feedback visivo migliorato
                breweryId.style.borderColor = '#ef4444';
                breweryId.style.background = '#fef2f2';
                
                // Alert personalizzato
                const alertDiv = document.createElement('div');
                alertDiv.className = 'flash-message flash-error';
                alertDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    Devi selezionare un birrificio per assegnare il ruolo brewery
                `;
                alertDiv.style.position = 'fixed';
                alertDiv.style.top = '20px';
                alertDiv.style.right = '20px';
                alertDiv.style.zIndex = '9999';
                alertDiv.style.animation = 'slideInDown 0.3s ease';
                
                document.body.appendChild(alertDiv);
                
                // Rimuovi l'alert dopo 4 secondi
                setTimeout(() => {
                    alertDiv.style.animation = 'slideInDown 0.3s ease reverse';
                    setTimeout(() => {
                        document.body.removeChild(alertDiv);
                    }, 300);
                }, 4000);
                
                // Reset stile dopo 3 secondi
                setTimeout(() => {
                    breweryId.style.borderColor = '';
                    breweryId.style.background = '';
                }, 3000);
                
                // Focus sul select brewery
                breweryId.focus();
                
                console.log('Form submission blocked - no brewery selected');
                return false;
            }
            
            // Aggiungi feedback di loading
            const submitButton = addRoleForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aggiungendo...';
                submitButton.disabled = true;
            }
            
            console.log('Form submission allowed');
        });
    }

    // ===== GESTIONE ELIMINA UTENTE CON MODAL BOOTSTRAP =====
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const deleteUserModal = document.getElementById('deleteUserModal');
    
    if (deleteUserBtn && deleteUserModal) {
        // Rimuovi eventuali listener precedenti clonando il pulsante
        const newDeleteBtn = deleteUserBtn.cloneNode(true);
        deleteUserBtn.parentNode.replaceChild(newDeleteBtn, deleteUserBtn);
        
        newDeleteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Verifica Bootstrap
            if (typeof bootstrap === 'undefined') {
                console.error('Bootstrap not loaded!');
                alert('Errore: Bootstrap non caricato. Ricarica la pagina.');
                return;
            }
            
            // Rimuovi eventuali backdrop orfani
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            
            // Apri il modal Bootstrap per conferma eliminazione
            try {
                const modal = new bootstrap.Modal(deleteUserModal, {
                    backdrop: true,
                    keyboard: true
                });
                modal.show();
            } catch (err) {
                console.error('Error showing modal:', err);
                // Fallback a conferma semplice
                if (confirm('Sei sicuro di voler eliminare questo utente?')) {
                    document.getElementById('deleteUserForm').submit();
                }
            }
        });
        
        // Gestione submit form eliminazione nel modal
        const deleteFormInModal = deleteUserModal.querySelector('#deleteUserForm');
        if (deleteFormInModal) {
            deleteFormInModal.addEventListener('submit', function() {
                const submitBtn = this.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
                    submitBtn.disabled = true;
                }
            });
        }
    }

    // ===== FEEDBACK VISIVO PER FORM SUBMISSIONS =====
    // Escludi form di eliminazione utente (gestito separatamente dal modal)
    const allForms = document.querySelectorAll('form:not(#deleteUserForm)');
    allForms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitButtons = form.querySelectorAll('button[type="submit"]');
            submitButtons.forEach(btn => {
                if (!btn.disabled) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                    btn.disabled = true;
                    
                    // Backup: riabilita dopo 10 secondi per evitare blocchi
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 10000);
                }
            });
        });
    });

    // ===== MIGLIORAMENTI ACCESSIBILITÀ =====
    // Aggiungi supporto tastiera per elementi interattivi
    const interactiveElements = document.querySelectorAll('.role-badge, .btn, .form-control');
    interactiveElements.forEach(element => {
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (element.tagName === 'BUTTON' || element.classList.contains('btn'))) {
                element.click();
            }
        });
    });

    // ===== AUTO-SAVE PER BOZZE (opzionale) =====
    const formInputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', function() {
            // Salva in localStorage per bozze (implementazione base)
            const key = `draft_${input.name}_${window.location.pathname}`;
            localStorage.setItem(key, input.value);
        });
        
        // Carica bozze al caricamento pagina
        const key = `draft_${input.name}_${window.location.pathname}`;
        const draft = localStorage.getItem(key);
        if (draft && !input.value) {
            input.value = draft;
            input.style.background = '#fef3c7';
            input.title = 'Valore ripristinato da bozza salvata';
        }
    });

    console.log('UpdateUser.js - Inizializzazione completata');
});

// ===== CSS ANIMATIONS DINAMICHE =====
// Aggiungi animazioni CSS non presenti nel file CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            opacity: 1;
            max-height: 200px;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
        }
    }
    
    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            max-height: 200px;
            transform: translateY(0);
        }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    .form-control:focus {
        transform: scale(1.02);
        transition: all 0.3s ease;
    }
    
    .btn:active {
        transform: scale(0.98) !important;
    }
    
    .role-badge:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed !important;
        transform: none !important;
    }
`;
document.head.appendChild(style);
