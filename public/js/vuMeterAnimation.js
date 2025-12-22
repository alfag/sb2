/**
 * VU Meter Animation Script
 * Gestisce le animazioni del VU meter per la crescita mensile
 */

document.addEventListener('DOMContentLoaded', function() {
    // Anima i segmenti del VU meter in base al valore
    const vuMeter = document.querySelector('.vu-meter-svg');
    if (vuMeter) {
        const segments = vuMeter.querySelectorAll('.vu-segment');
        const needle = vuMeter.querySelector('.vu-needle');
        
        // Recupera il valore della crescita dal badge
        const vuContainer = document.querySelector('.vu-meter-container');
        const growthBadge = vuContainer.closest('.mb-4').querySelector('.badge');
        let growthValue = 0;
        
        if (growthBadge && growthBadge.textContent.includes('%')) {
            const valueText = growthBadge.textContent.replace(/[+\-%]/g, '').replace('N/A', '0');
            growthValue = parseFloat(valueText) || 0;
            
            // Se il badge contiene un segno negativo, rendi il valore negativo
            if (growthBadge.textContent.includes('-')) {
                growthValue = -Math.abs(growthValue);
            }
        }
        
        // Attiva i segmenti in base al valore
        segments.forEach((segment, index) => {
            setTimeout(() => {
                if (growthValue <= -60 && segment.classList.contains('danger')) {
                    segment.classList.add('active');
                } else if (growthValue > -60 && growthValue <= -20 && segment.classList.contains('warning')) {
                    segment.classList.add('active');
                } else if (growthValue > -20 && growthValue <= 20 && segment.classList.contains('neutral')) {
                    segment.classList.add('active');
                } else if (growthValue > 20 && growthValue <= 60 && segment.classList.contains('success')) {
                    segment.classList.add('active');
                } else if (growthValue > 60 && segment.classList.contains('excellent')) {
                    segment.classList.add('active');
                }
            }, index * 200);
        });
        
        // Anima l'ago
        if (needle) {
            needle.style.opacity = '0';
            needle.style.transform = 'scale(0.8)';
            setTimeout(() => {
                needle.style.opacity = '1';
                needle.style.transform = 'scale(1)';
            }, 800);
        }
    }
});
