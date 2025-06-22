// Aggiungi funzionalità per mostrare/nascondere la password
document.addEventListener('DOMContentLoaded', () => {
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginForm = document.getElementById('loginForm');

    // Funzione per gestire l'invio del form
    function submitForm() {
        loginForm.submit();
    }

    // Aggiungi un event listener per il click sul pulsante di login
    if (loginButton) {
        loginButton.addEventListener('click', function(event) {
            event.preventDefault(); // Impedisce l'invio predefinito del form
            submitForm();
        });
    }

    // Aggiungi un event listener per il tasto "Invio" nel campo password
    if (passwordInput) {
        passwordInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Impedisce l'azione predefinita del tasto "Invio"
                submitForm();
            }
        });
    }

    // Mostra/nascondi password
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            const iconSrc = type === 'password' ? '/images/visibility.svg' : '/images/visibility_off.svg';
            togglePassword.setAttribute('src', iconSrc);
        });
    }    
});

document.getElementById('deleteUserBtn').addEventListener('click', function (e) {
    if (confirm('Sei sicuro di voler cancellare questo utente? L\'operazione è irreversibile.')) {
        document.getElementById('deleteUserForm').submit();
    }
});

window.onerror = function (message, source, lineno, colno, error) {
    console.error('Errore JavaScript:', message, source, lineno, colno, error);
};