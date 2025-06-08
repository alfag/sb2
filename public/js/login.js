// Funzione per gestire il submit del modulo di login
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const loginForm = document.getElementById('loginForm');

    if (loginButton && loginForm) {
        loginButton.addEventListener('click', () => {
            // Invia il modulo utilizzando il metodo submit nativo
            loginForm.submit();
        });
    }
});
