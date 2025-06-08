// Aggiungi funzionalità per mostrare/nascondere la password
document.addEventListener('DOMContentLoaded', () => {
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginForm = document.getElementById('loginForm');

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