// Gestione conferma rimozione ruolo (CSP compatibile)
document.addEventListener('DOMContentLoaded', function() {
    const removeButtons = document.querySelectorAll('.remove-role-btn');
    removeButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            const ruolo = btn.getAttribute('data-role');
            if (!confirm(`Sei sicuro di voler rimuovere il ruolo ${ruolo}? Verranno eliminati anche i dettagli associati!`)) {
                e.preventDefault();
            }
        });
    });
});
