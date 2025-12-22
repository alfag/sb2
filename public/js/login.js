/**
 * Login page specific functionality
 * Gestisce form login e validazione
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Login] Pagina login caricata');
    
    // Form validation
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            const username = document.getElementById('username');
            const password = document.getElementById('password');
            
            let isValid = true;
            
            // Validazione username
            if (!username || !username.value.trim()) {
                isValid = false;
                if (window.utils) {
                    window.utils.showError('Inserisci username o email');
                }
            }
            
            // Validazione password
            if (!password || !password.value) {
                isValid = false;
                if (window.utils) {
                    window.utils.showError('Inserisci la password');
                }
            }
            
            if (!isValid) {
                e.preventDefault();
            }
        });
    }
    
    // Password visibility toggle - GESTITO IN scripts.js globalmente
    // Non aggiungere listener qui per evitare doppio toggle
    
    // Enhanced form validation - visual feedback on blur
    const loginFormInputs = document.querySelectorAll('#loginForm .form-input');
    if (loginFormInputs.length > 0) {
        loginFormInputs.forEach(input => {
            input.addEventListener('blur', function() {
                const value = this.value.trim();
                this.classList.remove('error');
                if (!value) {
                    this.classList.add('error');
                }
            });
            
            input.addEventListener('input', function() {
                this.classList.remove('error');
            });
        });
    }
});
