// Gestione menù contestuale, acquisizione/cattura/caricamento foto, chiamata API, feedback AI, selettore rating, pubblicazione
// Validazione di primo livello lato client per la pubblicazione recensione

document.addEventListener('DOMContentLoaded', function () {
    const reviewForm = document.getElementById('reviewForm');
    const photoInput = document.getElementById('reviewPhoto');

    if (!reviewForm) return;

    reviewForm.addEventListener('submit', function (e) {
        let valid = true;
        // Controllo testo recensione
        //const reviewText = document.getElementById('reviewText');
        //if (!reviewText || reviewText.value.trim().length < 10) {
        //    valid = false;
        //    alert('Inserisci almeno 10 caratteri nella recensione.');
        //}
        // Controllo rating
        const rating = document.querySelector('input[name="rating"]:checked');
        if (!rating) {
            valid = false;
            alert('Seleziona un rating.');
        }
        // Controllo presenza foto
        if (!photoInput || photoInput.files.length === 0) {
            valid = false;
            alert('Carica almeno una foto.');
        }
        // Se serve inviare la foto a GeminiAI, la logica è ora in scripts.js
        if (!valid) {
            e.preventDefault();
        }
    });
});
