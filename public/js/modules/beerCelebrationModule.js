/**
 * Beer Celebration Module - v2
 * 
 * Overlay animato celebrativo con effetti dinamici continui:
 * - Bicchieri che oscillano e brindano
 * - Confetti generati dinamicamente su canvas
 * - Sparkle dorati lampeggianti
 * - Bollicine che salgono in loop
 * - Schiuma che trabocca
 * - Shimmer dorato sul titolo
 * 
 * Uso:
 *   BeerCelebration.show({ beersCount: 1 });
 *   BeerCelebration.show({ beersCount: 3, duration: 8000 });
 */
const BeerCelebration = (() => {
  // Durata di default (ms) prima della chiusura automatica
  const DEFAULT_DURATION = 6000;

  // Riferimento all'overlay attivo (per evitare duplicati)
  let activeOverlay = null;

  // Riferimento all'animazione confetti (per cleanup)
  let confettiAnimId = null;

  // Riferimento al timer sparkle
  let sparkleIntervalId = null;

  /**
   * Genera l'HTML completo dell'overlay celebrativo
   */
  function buildHTML(beersCount, durationSec) {
    // Testo dinamico in base al numero di birre recensite
    const beersText = beersCount === 1
      ? '<strong>1 birra</strong>'
      : `<strong>${beersCount} birre</strong>`;

    return `
      <div class="beer-celebration-overlay" role="dialog" aria-modal="true" aria-label="Recensione salvata con successo">
        <div class="beer-celebration-card" style="--celebration-duration: ${durationSec}s">
          
          <!-- Bollicine di sfondo -->
          <div class="beer-bubbles-container">
            ${Array.from({ length: 14 }, () => '<div class="beer-bubble"></div>').join('')}
          </div>
          
          <!-- Canvas confetti dinamici -->
          <canvas class="beer-confetti-canvas"></canvas>

          <!-- Bicchieri che brindano -->
          <div class="beer-cheers-container">
            <span class="beer-glass beer-glass-left" aria-hidden="true">🍺</span>
            <span class="beer-glass beer-glass-right" aria-hidden="true">🍺</span>
            <div class="beer-splash"></div>
            <!-- Goccine che schizzano all'impatto -->
            ${Array.from({ length: 8 }, () => '<div class="beer-droplet"></div>').join('')}
          </div>

          <!-- Messaggio -->
          <div class="beer-celebration-title">Alla salute! 🍻</div>
          <div class="beer-celebration-subtitle">
            Hai recensito ${beersText}.<br>
            Le tue opinioni aiutano la community a scoprire nuove birre artigianali!
          </div>

          <!-- Pulsante continua -->
          <button class="beer-celebration-btn" type="button">
            Continua <span aria-hidden="true">→</span>
          </button>

          <!-- Barra progresso auto-chiusura -->
          <div class="beer-celebration-progress"></div>
        </div>
      </div>
    `;
  }

  /**
   * Avvia l'animazione confetti su canvas (particelle continue)
   */
  function startConfettiCanvas(card) {
    const canvas = card.querySelector('.beer-confetti-canvas');
    if (!canvas) return;

    // Imposta dimensioni canvas = dimensioni card
    const rect = card.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    const particles = [];

    // Palette colori leggera: bianchi traslucidi e ambra tenue
    const colors = [
      'rgba(255, 255, 255, 0.7)',
      'rgba(255, 255, 255, 0.5)',
      'rgba(251, 191, 36, 0.6)',
      'rgba(251, 191, 36, 0.4)',
      'rgba(217, 119, 6, 0.4)',
      'rgba(252, 211, 77, 0.5)'
    ];

    // Genera particelle iniziali
    function createParticle() {
      return {
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 20,
        w: 3 + Math.random() * 5,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1 + Math.random() * 2,
        opacity: 0.6 + Math.random() * 0.3,
        shape: Math.random() > 0.6 ? 'circle' : 'rect'
      };
    }

    // Genera una prima ondata
    for (let i = 0; i < 30; i++) {
      const p = createParticle();
      p.y = Math.random() * canvas.height * 0.5; // Sparpagliate nella card
      particles.push(p);
    }

    // Loop di animazione
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Aggiunge nuove particelle progressivamente
      if (particles.length < 50 && Math.random() > 0.6) {
        particles.push(createParticle());
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Aggiorna posizione
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.003;

        // Rimuovi se fuori schermo o troppo trasparente
        if (p.y > canvas.height + 10 || p.opacity <= 0) {
          particles.splice(i, 1);
          // Rigenera una nuova particella al posto di quella rimossa
          if (Math.random() > 0.3) {
            particles.push(createParticle());
          }
          continue;
        }

        // Disegna particella
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      }

      confettiAnimId = requestAnimationFrame(animate);
    }

    // Avvia con un piccolo delay per far apparire prima la card
    setTimeout(() => animate(), 800);
  }

  /**
   * Anima i bicchieri con Web Animations API:
   * Animazione bicchieri: partono lontani, accelerano
   * progressivamente fino allo scontro e rimbalzano.
   */
  function animateGlasses(glassLeft, glassRight) {
    const duration = 2000;
    const delay = 300;

    // Bicchiere sinistro: specchiato (scaleX -1) → translateX e rotate invertiti
    // perché scaleX(-1) ribalta l'asse X, quindi i segni vanno opposti al destro
    glassLeft.animate([
      { transform: 'scaleX(-1) translateX(60px) rotate(15deg)',  opacity: 0,   offset: 0 },
      { transform: 'scaleX(-1) translateX(58px) rotate(14deg)',  opacity: 1,   offset: 0.08 },
      { transform: 'scaleX(-1) translateX(50px) rotate(12deg)',  opacity: 1,   offset: 0.2 },
      { transform: 'scaleX(-1) translateX(36px) rotate(10deg)',  opacity: 1,   offset: 0.35 },
      { transform: 'scaleX(-1) translateX(16px) rotate(6deg)',   opacity: 1,   offset: 0.55 },
      { transform: 'scaleX(-1) translateX(-4px) rotate(2deg)',   opacity: 1,   offset: 0.75 },
      { transform: 'scaleX(-1) translateX(-16px) rotate(-8deg)', opacity: 1,   offset: 0.82 },
      { transform: 'scaleX(-1) translateX(-4px) rotate(4deg)',   opacity: 1,   offset: 0.91 },
      { transform: 'scaleX(-1) translateX(-10px) rotate(1deg)',  opacity: 1,   offset: 1 }
    ], { duration, delay, easing: 'cubic-bezier(0.12, 0, 0.39, 0)', fill: 'forwards' });

    // Bicchiere destro: speculare
    glassRight.animate([
      { transform: 'translateX(60px) rotate(15deg)',  opacity: 0,   offset: 0 },
      { transform: 'translateX(58px) rotate(14deg)',  opacity: 1,   offset: 0.08 },
      { transform: 'translateX(50px) rotate(12deg)',  opacity: 1,   offset: 0.2 },
      { transform: 'translateX(36px) rotate(10deg)',  opacity: 1,   offset: 0.35 },
      { transform: 'translateX(16px) rotate(6deg)',   opacity: 1,   offset: 0.55 },
      { transform: 'translateX(-4px) rotate(2deg)',   opacity: 1,   offset: 0.75 },
      { transform: 'translateX(-16px) rotate(-8deg)', opacity: 1,   offset: 0.82 },
      { transform: 'translateX(-4px) rotate(4deg)',   opacity: 1,   offset: 0.91 },
      { transform: 'translateX(-10px) rotate(1deg)',  opacity: 1,   offset: 1 }
    ], { duration, delay, easing: 'cubic-bezier(0.12, 0, 0.39, 0)', fill: 'forwards' });

    // Fissa opacità dopo completamento
    setTimeout(() => {
      glassLeft.style.opacity = '1';
      glassRight.style.opacity = '1';
    }, duration + delay + 50);
  }

  /**
   * Genera sparkle dorati che appaiono e scompaiono nella card
   */
  function startSparkles(card) {
    const createSparkle = () => {
      const sparkle = document.createElement('div');
      sparkle.className = 'beer-sparkle' + (Math.random() > 0.5 ? ' small' : '');
      sparkle.style.left = (10 + Math.random() * 80) + '%';
      sparkle.style.top = (5 + Math.random() * 70) + '%';
      sparkle.style.opacity = '0';
      card.appendChild(sparkle);

      // Animazione entrata/uscita via JS per massimo controllo
      let opacity = 0;
      let phase = 'in';
      const fadeSpeed = 0.04 + Math.random() * 0.03;

      const tick = () => {
        if (phase === 'in') {
          opacity += fadeSpeed;
          if (opacity >= 0.8) phase = 'out';
        } else {
          opacity -= fadeSpeed;
          if (opacity <= 0) {
            sparkle.remove();
            return;
          }
        }
        sparkle.style.opacity = opacity.toString();
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    // Genera sparkle a intervalli casuali
    sparkleIntervalId = setInterval(() => {
      if (Math.random() > 0.3) createSparkle();
    }, 300);
  }

  /**
   * Ferma tutte le animazioni attive (confetti, sparkle)
   */
  function stopAnimations() {
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    if (sparkleIntervalId) {
      clearInterval(sparkleIntervalId);
      sparkleIntervalId = null;
    }
  }

  /**
   * Mostra l'overlay celebrativo
   * @param {Object} options
   * @param {number} options.beersCount - Numero di birre recensite (default: 1)
   * @param {number} options.duration - Durata in ms prima della chiusura automatica (default: 6000)
   * @param {Function} options.onClose - Callback opzionale alla chiusura
   */
  function show(options = {}) {
    const beersCount = options.beersCount || 1;
    const duration = options.duration || DEFAULT_DURATION;
    const onClose = options.onClose || null;
    const durationSec = duration / 1000;

    // Se c'è già un overlay attivo, rimuovilo prima
    if (activeOverlay) {
      stopAnimations();
      activeOverlay.remove();
      activeOverlay = null;
    }

    // Inserisci HTML nel DOM
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML(beersCount, durationSec).trim();
    const overlay = wrapper.firstElementChild;
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Blocca lo scroll del body
    document.body.style.overflow = 'hidden';

    // Attiva l'animazione di ingresso (richiede un frame per il browser)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('active');

        // Avvia animazioni dinamiche dopo l'apertura
        const card = overlay.querySelector('.beer-celebration-card');
        if (card) {
          startConfettiCanvas(card);
          startSparkles(card);
        }

        // Animazione bicchieri gestita interamente via Web Animations API
        const glassLeft = overlay.querySelector('.beer-glass-left');
        const glassRight = overlay.querySelector('.beer-glass-right');
        if (glassLeft && glassRight) {
          animateGlasses(glassLeft, glassRight);
        }
      });
    });

    // Riferimento al timer per poterlo cancellare
    let autoCloseTimer = null;

    // Funzione di chiusura
    const closeOverlay = () => {
      if (!overlay || !overlay.parentNode) return;

      // Cancella il timer se non è già scaduto
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }

      // Ferma animazioni dinamiche
      stopAnimations();

      // Animazione di uscita
      overlay.classList.add('closing');
      overlay.classList.remove('active');

      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
        activeOverlay = null;
        document.body.style.overflow = '';

        // Callback di chiusura
        if (typeof onClose === 'function') {
          onClose();
        }
      }, 400);
    };

    // Auto-chiusura dopo la durata specificata
    autoCloseTimer = setTimeout(closeOverlay, duration + 500);

    // Chiusura con pulsante "Continua"
    const btn = overlay.querySelector('.beer-celebration-btn');
    if (btn) {
      btn.addEventListener('click', closeOverlay);
    }

    // Chiusura con click sull'overlay (fuori dalla card)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    // Chiusura con tasto Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeOverlay();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    console.log('[BeerCelebration] Overlay celebrativo mostrato', { beersCount, duration });
  }

  // API pubblica
  return { show };
})();

// Esponi globalmente per l'accesso dai vari moduli
window.BeerCelebration = BeerCelebration;
