// --- Gestione caricamento, anteprima e selezione area foto per AI ---
document.addEventListener('DOMContentLoaded', function () {
    // Controlli di compatibilità browser
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const supportsCanvas = !!document.createElement('canvas').getContext;
    const supportsFileReader = typeof FileReader !== 'undefined';
    
    // Tracking birre già recensite nella sessione
    let reviewedBeersInSession = new Set();
    
    // Recupera birre già recensite dalla sessionStorage se disponibili
    try {
        const storedReviews = sessionStorage.getItem('reviewedBeers');
        if (storedReviews) {
            reviewedBeersInSession = new Set(JSON.parse(storedReviews));
            logDebug('Recuperate birre già recensite dalla sessione', {
                count: reviewedBeersInSession.size,
                beers: Array.from(reviewedBeersInSession)
            });
        }
    } catch (error) {
        logError('Errore recupero dati sessione', error);
        reviewedBeersInSession = new Set();
    }
    
    // Logging per debug e monitoraggio
    function logDebug(message, data = null) {
        if (data) {
            console.log(`[Photo Crop Debug] ${message}:`, data);
        } else {
            console.log(`[Photo Crop Debug] ${message}`);
        }
    }
    
    function logError(message, error = null) {
        console.error(`[Photo Crop Error] ${message}`);
        if (error) console.error(error);
    }
    
    // Monitoraggio performance
    function logPerformance(operation, startTime) {
        const duration = performance.now() - startTime;
        logDebug(`Performance ${operation}`, { duration: `${duration.toFixed(2)}ms` });
        
        if (duration > 1000) {
            logError(`Performance issue: ${operation} took ${duration.toFixed(2)}ms`);
        }
    }
    
    // Debouncing utility per evitare troppe chiamate
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Genera chiave univoca per una birra basata su nome e birrificio
    function generateBeerKey(beerName, breweryName) {
        if (!beerName || !breweryName) return null;
        
        // Normalizza i nomi per confronto: lowercase, rimuovi spazi extra e caratteri speciali
        const normalizedBeer = beerName.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const normalizedBrewery = breweryName.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
        return `${normalizedBrewery}::${normalizedBeer}`;
    }
    
    // Controlla se una birra è già stata recensita nella sessione
    function isBeerAlreadyReviewed(beerName, breweryName) {
        const beerKey = generateBeerKey(beerName, breweryName);
        if (!beerKey) return false;
        
        const isReviewed = reviewedBeersInSession.has(beerKey);
        logDebug('Controllo birra già recensita', {
            beerName,
            breweryName,
            beerKey,
            isAlreadyReviewed: isReviewed
        });
        
        return isReviewed;
    }
    
    // Aggiunge una birra alla lista delle recensite
    function markBeerAsReviewed(beerName, breweryName) {
        const beerKey = generateBeerKey(beerName, breweryName);
        if (!beerKey) {
            logError('Impossibile creare chiave birra', { beerName, breweryName });
            return false;
        }
        
        reviewedBeersInSession.add(beerKey);
        
        // Salva in sessionStorage per persistenza durante la sessione
        try {
            sessionStorage.setItem('reviewedBeers', JSON.stringify(Array.from(reviewedBeersInSession)));
            logDebug('Birra marcata come recensita', {
                beerName,
                breweryName,
                beerKey,
                totalReviewedInSession: reviewedBeersInSession.size
            });
            return true;
        } catch (error) {
            logError('Errore salvataggio in sessionStorage', error);
            return false;
        }
    }
    
    // Mostra alert personalizzato per birra già recensita
    function showDuplicateReviewAlert(beerName, breweryName) {
        const message = `Hai già recensito "${beerName}" di ${breweryName} in questa sessione.\n\nNon è possibile recensire lo stesso prodotto più volte nella stessa sessione.`;
        alert(message);
        logDebug('Mostrato alert duplicato recensione', { beerName, breweryName });
    }
    
    // Controllo disponibilità funzionalità
    if (!supportsCanvas) {
        logError('Canvas non supportato dal browser');
        alert('Il tuo browser non supporta le funzionalità necessarie per il crop delle immagini.');
        return;
    }
    
    if (!supportsFileReader) {
        logError('FileReader non supportato dal browser');
        alert('Il tuo browser non supporta il caricamento di file.');
        return;
    }
    
    logDebug('Inizializzazione sistema photo crop', {
        mobile: isMobile,
        touch: supportsTouch,
        canvas: supportsCanvas,
        fileReader: supportsFileReader
    });
    
    // Mostra suggerimenti appropriati in base al dispositivo
    const cropNoteDesktop = document.getElementById('crop-note');
    const cropNoteMobile = document.getElementById('crop-note-mobile');
    
    if (isMobile || supportsTouch) {
        if (cropNoteDesktop) cropNoteDesktop.style.display = 'none';
        if (cropNoteMobile) cropNoteMobile.style.display = 'block';
        logDebug('Modalità mobile/touch attivata');
    } else {
        if (cropNoteDesktop) cropNoteDesktop.style.display = 'block';
        if (cropNoteMobile) cropNoteMobile.style.display = 'none';
        logDebug('Modalità desktop attivata');
    }

    const uploadPhotoBtn = document.getElementById('upload-photo');
    const reviewPhotoInput = document.getElementById('reviewPhoto');
    const photoModal = document.getElementById('photo-modal');
    const closePhotoModal = document.getElementById('closePhotoModal');
    const photoPreviewContainer = document.getElementById('photo-preview-container');
    const photoPreview = document.getElementById('photoPreview');
    const photoCanvas = document.getElementById('photoCanvas');
    let cropStart = null;
    let cropEnd = null;
    let cropping = false;
    let cropRect = null;
    let croppedBase64 = null;

    // Apertura file picker
    if (uploadPhotoBtn && reviewPhotoInput) {
        uploadPhotoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            reviewPhotoInput.value = "";
            reviewPhotoInput.setAttribute('accept', 'image/*'); // Preimposta filtro per file immagine
            reviewPhotoInput.removeAttribute('capture');
            reviewPhotoInput.click();
        });
    }

    // Mostra il modal quando viene caricata una foto
    let modalReadyForShow = false;
    function openPhotoModal() {
        // Mostra il modal solo se è stato selezionato e caricato un file immagine valido
        if (photoModal && modalReadyForShow) {
            photoModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    function closeModal() {
        if (photoModal) {
            photoModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (photoCanvas) {
            photoCanvas.style.opacity = '0';
            photoCanvas.style.pointerEvents = 'none';
            photoCanvas.classList.remove('active-crop');
        }
        // Reset bottoni
        const sendToAIBtn = document.getElementById('sendToAI');
        if (sendToAIBtn) {
            sendToAIBtn.style.display = 'none';
            sendToAIBtn.disabled = false;
            sendToAIBtn.textContent = 'Invia ad AI';
        }
    }
    if (closePhotoModal) {
        closePhotoModal.addEventListener('click', closeModal);
    }
    // Chiudi modal con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });

    // Mostra anteprima e canvas per selezione
    if (reviewPhotoInput && photoPreview && photoPreviewContainer && photoCanvas) {
        // Variabili per drag e zoom immagine
        let imgOffsetX = 0, imgOffsetY = 0;
        let imgStartX = 0, imgStartY = 0;
        let draggingImg = false;
        let imgScale = 1;
        let lastDist = null;
        let lastMid = null;

        reviewPhotoInput.addEventListener('change', function () {
            // Reset stato crop e preview
            cropRect = null;
            isDragging = false;
            draggingImg = false;
            imgOffsetX = 0;
            imgOffsetY = 0;
            imgScale = 1;
            lastDist = null;
            lastMid = null;
            startX = undefined;
            startY = undefined;
            endX = undefined;
            endY = undefined;
            croppedImageForAI = null; // Reset immagine croppata
            originalImageSrc = null; // Reset immagine originale
            photoPreview.className = 'photo-preview-image';
            photoPreview.style.width = '';
            photoPreview.style.height = '';
            photoCanvas.style.display = '';
            photoCanvas.classList.remove('active-crop');
            
            // Reset freccia di ritorno
            const backArrow = document.getElementById('backArrow');
            if (backArrow) backArrow.style.display = 'none';
            
            const sendToAIBtn = document.getElementById('sendToAI');
            if (sendToAIBtn) {
                sendToAIBtn.style.display = 'none';
                sendToAIBtn.disabled = false;
                sendToAIBtn.textContent = 'Invia ad AI';
            }

            const file = reviewPhotoInput.files[0];
            modalReadyForShow = false;
            
            if (file) {
                logDebug('File selezionato', {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: new Date(file.lastModified)
                });
                
                // Validazione robusta del file
                const maxSize = 10 * 1024 * 1024; // 10MB
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
                const allowedExt = ['.jpg','.jpeg','.png','.gif','.bmp','.webp','.jfif','.pjpeg','.pjp'];
                
                const isImageType = file.type && allowedTypes.includes(file.type.toLowerCase());
                const isImageExt = allowedExt.some(ext => file.name.toLowerCase().endsWith(ext));
                const isSizeValid = file.size <= maxSize;
                
                logDebug('Validazione file', {
                    isImageType,
                    isImageExt,
                    isSizeValid,
                    actualSize: file.size,
                    maxSize
                });
                
                let erroreTipo = false;
                
                if (!isSizeValid) {
                    logError('File troppo grande', { size: file.size, maxSize });
                    alert(`Il file è troppo grande. Dimensione massima consentita: ${Math.round(maxSize / 1024 / 1024)}MB`);
                    reviewPhotoInput.value = '';
                    return;
                }
                
                if (!isImageType && !isImageExt) {
                    erroreTipo = true;
                    logError('Tipo file non valido', { type: file.type, name: file.name });
                }
                
                // Mostra il bottone "Invia ad AI" per tutte le immagini valide
                const sendToAIBtn = document.getElementById('sendToAI');
                if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        // Salva l'immagine originale immediatamente dal FileReader
                        originalImageSrc = e.target.result;
                        logDebug('Immagine originale salvata dal FileReader');
                        
                        photoPreview.onload = function () {
                            logDebug('Caricamento immagine completato', {
                                naturalWidth: photoPreview.naturalWidth,
                                naturalHeight: photoPreview.naturalHeight
                            });
                            
                            if (erroreTipo && (photoPreview.naturalWidth === 0 || photoPreview.naturalHeight === 0)) {
                                logError('File non è un\'immagine valida');
                                alert('La tipologia del file selezionato non è ammessa');
                                reviewPhotoInput.value = '';
                                photoPreviewContainer.style.display = 'none';
                                photoCanvas.style.display = 'none';
                                photoPreview.style.display = 'none';
                                closeModal();
                                return;
                            }
                            
                            // Modal sempre pronto con la nuova struttura
                            modalReadyForShow = true;
                            logDebug('Apertura modal per anteprima immagine');
                            openPhotoModal();
                        
                            // Attiva il canvas interattivo con dimensioni fisse
                            setTimeout(() => {
                                if (photoModal.style.display === 'flex') {
                                    if (syncCanvasToPreview()) {
                                        drawImageOnCanvas();
                                    } else {
                                        logError('Sync canvas fallito al caricamento iniziale');
                                    }
                                }
                            }, 200); // Timeout leggermente aumentato per la nuova struttura
                        };
                    photoPreview.onerror = function() {
                        logError('Errore nel caricamento dell\'immagine');
                        alert('Errore nel caricamento dell\'immagine. Prova con un altro file.');
                        reviewPhotoInput.value = '';
                        closeModal();
                    };
                    
                    photoPreview.src = e.target.result;
                    } catch (error) {
                        logError('Errore nel processamento dell\'immagine', error);
                        alert('Errore nel processamento dell\'immagine. Prova con un altro file.');
                        reviewPhotoInput.value = '';
                        closeModal();
                    }
                };
                
                reader.onerror = function() {
                    logError('Errore nella lettura del file');
                    alert('Errore nella lettura del file. Prova con un altro file.');
                    reviewPhotoInput.value = '';
                };
                
                reader.readAsDataURL(file);
            } else {
                //console.log('Nessun file selezionato');
                photoPreviewContainer.style.display = 'none';
                photoCanvas.style.display = 'none';
                photoPreview.style.display = 'none';
                closeModal();
            }
        });

        // Funzione centralizzata per sincronizzare canvas con immagine - ora con layout fisso
        function syncCanvasToPreview() {
            if (!photoPreview.complete || photoPreview.naturalWidth === 0) {
                logDebug('Immagine non ancora caricata, sync rinviato');
                return false;
            }
            
            // Con la nuova struttura, il canvas si sovrappone sempre perfettamente all'immagine
            const rect = photoPreview.getBoundingClientRect();
            
            // Imposta le dimensioni CSS del canvas per una sovrapposizione perfetta
            photoCanvas.style.width = `${rect.width}px`;
            photoCanvas.style.height = `${rect.height}px`;
            
            // Imposta la risoluzione interna del canvas pari a quella dell'immagine originale
            photoCanvas.width = photoPreview.naturalWidth;
            photoCanvas.height = photoPreview.naturalHeight;
            
            // Il canvas è già posizionato correttamente via CSS, basta renderlo visibile
            photoCanvas.style.opacity = '1';
            photoCanvas.style.pointerEvents = 'auto';
            photoCanvas.style.display = 'block';
            
            logDebug('Canvas sincronizzato con immagine (layout fisso)', {
                canvasRenderWidth: rect.width,
                canvasRenderHeight: rect.height,
                canvasInternalWidth: photoCanvas.width,
                canvasInternalHeight: photoCanvas.height,
                imageNaturalWidth: photoPreview.naturalWidth,
                imageNaturalHeight: photoPreview.naturalHeight
            });
            
            return true;
        }

        // Gestione selezione rettangolo libero sul canvas e drag immagine
        let isDragging = false;
        let startX, startY, endX, endY;
        function drawImageOnCanvas() {
            const ctx = photoCanvas.getContext('2d');
            ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
            
            // Se stiamo mostrando un'immagine croppata, non disegnare mai alcun bordo
            if (croppedImageForAI) {
                // Quando è mostrata l'immagine croppata, il canvas resta completamente trasparente
                return;
            }
            
            // Canvas trasparente per vedere l'immagine sottostante
            ctx.save();
            ctx.translate(imgOffsetX, imgOffsetY);
            ctx.scale(imgScale, imgScale);
            // Non disegniamo l'immagine sul canvas, usiamo il canvas solo per l'overlay
            ctx.restore();
            
            // Se c'è una selezione crop attiva, disegnala (solo se non stiamo mostrando immagine croppata)
            if (isDragging || (cropRect && cropRect.w > 0 && cropRect.h > 0)) {
                ctx.save();
                ctx.strokeStyle = '#FFD600';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                
                const rectX = isDragging ? Math.min(startX, endX) : cropRect.x;
                const rectY = isDragging ? Math.min(startY, endY) : cropRect.y;
                const rectW = isDragging ? Math.abs(endX - startX) : cropRect.w;
                const rectH = isDragging ? Math.abs(endY - startY) : cropRect.h;
                
                ctx.strokeRect(rectX, rectY, rectW, rectH);
                ctx.restore();
            }
        }

        // Crop selection
        // (variabili già dichiarate sopra)

        // Attiva crop solo con Shift+mousedown
        photoCanvas.addEventListener('mousedown', function (e) {
            if (e.button === 0 && e.shiftKey) {
                // Shift+click: crop selection
                isDragging = true;
                photoCanvas.classList.add('active-crop');
                // Coordinate nel canvas (scalate correttamente)
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                startX = (e.clientX - rect.left) * scaleX;
                startY = (e.clientY - rect.top) * scaleY;
                endX = startX;
                endY = startY;
                cropRect = null;
                drawImageOnCanvas();
                photoCanvas.style.cursor = 'crosshair';
                if (confirmCropBtn) confirmCropBtn.style.display = 'block';
            } else {
                // Drag immagine solo se non si sta croppando
                if (!isDragging) {
                    draggingImg = true;
                    imgStartX = e.clientX;
                    imgStartY = e.clientY;
                    photoCanvas.style.cursor = 'grabbing';
                }
            }
        });

        photoCanvas.addEventListener('mousemove', function (e) {
            // Gestione cursore
            if (e.shiftKey && !isDragging && !draggingImg) {
                photoCanvas.style.cursor = 'crosshair';
            } else if (!isDragging && !draggingImg) {
                photoCanvas.style.cursor = 'grab';
            }

            if (isDragging) {
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                endX = (e.clientX - rect.left) * scaleX;
                endY = (e.clientY - rect.top) * scaleY;
                drawImageOnCanvas();
            } else if (draggingImg) {
                let dx = e.clientX - imgStartX;
                let dy = e.clientY - imgStartY;
                imgStartX = e.clientX;
                imgStartY = e.clientY;
                imgOffsetX += dx;
                imgOffsetY += dy;
                drawImageOnCanvas();
            }
        });

        photoCanvas.addEventListener('mouseleave', function () {
            photoCanvas.style.cursor = '';
        });

        window.addEventListener('mouseup', function (e) {
            if (isDragging) {
                isDragging = false;
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                endX = (e.clientX - rect.left) * scaleX;
                endY = (e.clientY - rect.top) * scaleY;
                cropRect = {
                    x: Math.min(startX, endX),
                    y: Math.min(startY, endY),
                    w: Math.abs(endX - startX),
                    h: Math.abs(endY - startY)
                };
                photoCanvas.classList.remove('active-crop');
                
                // Applica automaticamente il crop se la selezione è abbastanza grande
                if (cropRect.w > 10 && cropRect.h > 10) {
                    console.log('Selezione completata - applicazione automatica del crop');
                    applyCrop();
                } else {
                    console.log('Selezione troppo piccola - crop non applicato');
                    drawImageOnCanvas();
                }
                
                photoCanvas.style.cursor = 'grab';
            }
            if (draggingImg) {
                draggingImg = false;
                photoCanvas.style.cursor = 'grab';
            }
        });

        // Touch events per mobile: drag e pinch-to-zoom
        photoCanvas.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                draggingImg = true;
                imgStartX = e.touches[0].clientX;
                imgStartY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                draggingImg = false;
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDist = Math.sqrt(dx*dx + dy*dy);
                lastMid = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
            }
        });
        photoCanvas.addEventListener('touchmove', function (e) {
            if (draggingImg && e.touches.length === 1) {
                let dx = e.touches[0].clientX - imgStartX;
                let dy = e.touches[0].clientY - imgStartY;
                imgStartX = e.touches[0].clientX;
                imgStartY = e.touches[0].clientY;
                imgOffsetX += dx;
                imgOffsetY += dy;
                drawImageOnCanvas();
            } else if (e.touches.length === 2) {
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (lastDist) {
                    let scaleChange = dist / lastDist;
                    // Calcola centro pinch rispetto al canvas
                    const rect = photoCanvas.getBoundingClientRect();
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                    // Aggiorna offset per mantenere il centro
                    imgOffsetX = (imgOffsetX - midX) * scaleChange + midX;
                    imgOffsetY = (imgOffsetY - midY) * scaleChange + midY;
                    imgScale *= scaleChange;
                    // Limiti zoom
                    imgScale = Math.max(0.5, Math.min(imgScale, 5));
                }
                lastDist = dist;
                drawImageOnCanvas();
            }
        });
        photoCanvas.addEventListener('touchend', function (e) {
            draggingImg = false;
            lastDist = null;
        });

        // Variabili per memorizzare l'immagine croppata e originale
        let croppedImageForAI = null;
        let originalImageSrc = null;

        // Funzione per confermare e applicare il crop
        function applyCrop() {
            console.log('Applicazione crop - zoom sull\'area selezionata');
            
            if (!cropRect || cropRect.w < 10 || cropRect.h < 10) {
                console.log('Selezione crop troppo piccola, nessun crop applicato');
                return false;
            }
            
            // Crea un elemento immagine temporaneo dall'immagine originale per ottenere le dimensioni corrette
            const tempImg = new Image();
            tempImg.onload = function() {
                // Usa le dimensioni dell'immagine originale per i calcoli
                const originalWidth = tempImg.naturalWidth;
                const originalHeight = tempImg.naturalHeight;
                
                // Ottieni le dimensioni del canvas renderizzato (quello che vede l'utente)
                const canvasRect = photoCanvas.getBoundingClientRect();
                const canvasDisplayWidth = canvasRect.width;
                const canvasDisplayHeight = canvasRect.height;
                
                // Calcola il rapporto di scala tra canvas interno e canvas visualizzato
                const scaleXCanvas = photoCanvas.width / canvasDisplayWidth;
                const scaleYCanvas = photoCanvas.height / canvasDisplayHeight;
                
                // Calcola il rapporto di scala tra immagine originale e canvas interno
                const scaleXOriginal = originalWidth / photoCanvas.width;
                const scaleYOriginal = originalHeight / photoCanvas.height;
                
                // Converti le coordinate del rettangolo di crop dalle coordinate canvas alle coordinate immagine originale
                const imgX = cropRect.x * scaleXOriginal;
                const imgY = cropRect.y * scaleYOriginal;
                const imgW = cropRect.w * scaleXOriginal;
                const imgH = cropRect.h * scaleYOriginal;
                
                // Assicurati che le coordinate siano entro i limiti dell'immagine originale
                const clampedX = Math.max(0, Math.min(imgX, originalWidth));
                const clampedY = Math.max(0, Math.min(imgY, originalHeight));
                const clampedW = Math.min(imgW, originalWidth - clampedX);
                const clampedH = Math.min(imgH, originalHeight - clampedY);
                
                console.log('Crop coordinates calculation:', { 
                    cropRect,
                    canvasSize: { w: photoCanvas.width, h: photoCanvas.height },
                    canvasDisplay: { w: canvasDisplayWidth, h: canvasDisplayHeight },
                    originalSize: { w: originalWidth, h: originalHeight },
                    scaleCanvas: { x: scaleXCanvas, y: scaleYCanvas },
                    scaleOriginal: { x: scaleXOriginal, y: scaleYOriginal },
                    imageCoords: { x: imgX, y: imgY, w: imgW, h: imgH },
                    clampedCoords: { x: clampedX, y: clampedY, w: clampedW, h: clampedH }
                });
                
                // Crea canvas temporaneo per l'area croppata
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = clampedW;
                tempCanvas.height = clampedH;
                const tctx = tempCanvas.getContext('2d');
                tctx.fillStyle = '#f2f2f2';
                tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Disegna l'area croppata dall'immagine originale pulita (senza bordi)
                tctx.drawImage(tempImg, 
                    clampedX, clampedY, clampedW, clampedH,  // area sorgente nell'immagine originale
                    0, 0, clampedW, clampedH                 // area destinazione (dimensioni reali)
                );
                
                // Salva per invio AI e per display
                croppedImageForAI = tempCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];
                
                // Reset completo dello stato crop per evitare bordi residui
                cropRect = null;
                isDragging = false;
                startX = undefined;
                startY = undefined;
                endX = undefined;
                endY = undefined;
                
                // Nascondi il canvas PRIMA di cambiare l'immagine per evitare sovrapposizioni
                photoCanvas.style.display = 'none';
                photoCanvas.style.opacity = '0';
                photoCanvas.style.pointerEvents = 'none';
                photoCanvas.classList.remove('active-crop');
                
                // Mostra l'immagine zoomata - con la nuova struttura le dimensioni sono gestite dal CSS
                photoPreview.src = tempCanvas.toDataURL('image/jpeg', 0.92);
                
                // Mantieni la classe CSS per il layout responsive fisso
                photoPreview.className = 'photo-preview-image';
                
                // Mostra la freccia di ritorno e il bottone "Invia ad AI"
                const backArrow = document.getElementById('backArrow');
                if (backArrow) backArrow.style.display = 'flex';
                const sendToAIBtn = document.getElementById('sendToAI');
                if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                
                console.log('Crop applicato - dimensioni:', { w: clampedW, h: clampedH });
            };
            
            // Usa l'immagine originale senza il canvas sovrapposto
            tempImg.src = originalImageSrc;
            
            return true;
        }

        // Gestione della freccia di ritorno per annullare crop
        const backArrow = document.getElementById('backArrow');
        if (backArrow) {
            function restoreOriginalImage() {
                console.log('Freccia di ritorno cliccata - ripristino immagine originale come primo caricamento');
                
                if (originalImageSrc) {
                    // Reset completo dello stato
                    imgOffsetX = 0;
                    imgOffsetY = 0;
                    imgScale = 1;
                    cropRect = null;
                    croppedImageForAI = null;
                    isDragging = false;
                    draggingImg = false;
                    
                    // Ripristina l'immagine e ricrea tutto come al primo caricamento
                    photoPreview.onload = function() {
                        console.log('Immagine ripristinata - ricreazione canvas con layout fisso');
                        
                        // Ripristina la classe CSS dell'immagine per il layout fisso
                        photoPreview.className = 'photo-preview-image';
                        photoPreview.style.maxWidth = '';
                        photoPreview.style.maxHeight = '';
                        photoPreview.style.width = '';
                        photoPreview.style.height = '';
                        photoPreview.style.objectFit = '';
                        
                        // Ricrea il canvas con la nuova struttura di layout fisso
                        setTimeout(() => {
                            if (photoModal.style.display === 'flex') {
                                // Canvas con dimensioni fisse gestite dal CSS
                                const rect = photoPreview.getBoundingClientRect();
                                
                                photoCanvas.style.width = `${rect.width}px`;
                                photoCanvas.style.height = `${rect.height}px`;
                                photoCanvas.width = photoPreview.naturalWidth;
                                photoCanvas.height = photoPreview.naturalHeight;
                                photoCanvas.style.opacity = '1';
                                photoCanvas.style.pointerEvents = 'auto';
                                photoCanvas.style.display = 'block';
                                
                                console.log('Canvas ricreato dopo restore (layout fisso)', {
                                    canvasRenderWidth: rect.width,
                                    canvasRenderHeight: rect.height,
                                    canvasInternalWidth: photoCanvas.width,
                                    canvasInternalHeight: photoCanvas.height
                                });

                                drawImageOnCanvas();
                            }
                        }, 200); // Timeout adeguato per la nuova struttura
                    };
                    
                    photoPreview.src = originalImageSrc;
                    
                    // Nascondi la freccia di ritorno
                    backArrow.style.display = 'none';
                    const sendToAIBtn = document.getElementById('sendToAI');
                    if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                } else {
                    console.log('Nessuna immagine originale salvata');
                }
            }
            
            backArrow.addEventListener('click', restoreOriginalImage);
            
            // Migliore gestione touch con debouncing
            let touchTimeout;
            backArrow.addEventListener('touchstart', function(e) {
                e.preventDefault();
                clearTimeout(touchTimeout);
                backArrow.style.transform = 'scale(0.95)';
            });
            
            backArrow.addEventListener('touchend', function(e) {
                e.preventDefault();
                backArrow.style.transform = 'scale(1)';
                clearTimeout(touchTimeout);
                touchTimeout = setTimeout(() => {
                    restoreOriginalImage();
                }, 50); // Debouncing per evitare doppi tap
            });
            
            // Accessibilità: supporto tastiera
            backArrow.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    restoreOriginalImage();
                }
            });
            
            // Rendi la freccia focusable per accessibilità
            backArrow.setAttribute('tabindex', '0');
            backArrow.setAttribute('role', 'button');
            backArrow.setAttribute('aria-label', 'Torna all\'immagine originale');
        }

        // Gestione del nuovo bottone "Invia ad AI" con controlli robusti
        const sendToAIBtn = document.getElementById('sendToAI');
        if (sendToAIBtn) {
            sendToAIBtn.addEventListener('click', function () {
                logDebug('Invia ad AI premuto');
                
                // Previeni doppi click
                if (sendToAIBtn.disabled) {
                    logDebug('Invio già in corso, ignoro click');
                    return;
                }
                
                let imageToSend = croppedImageForAI;
                
                // Se non c'è un'immagine croppata, usa l'immagine originale
                if (!imageToSend && photoPreview.src && photoPreview.complete) {
                    try {
                        logDebug('Preparazione immagine originale per AI');
                        // Crea canvas temporaneo per l'immagine originale
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = photoPreview.naturalWidth;
                        tempCanvas.height = photoPreview.naturalHeight;
                        const ctx = tempCanvas.getContext('2d');
                        
                        if (!ctx) {
                            throw new Error('Impossibile creare contesto canvas');
                        }
                        
                        ctx.drawImage(photoPreview, 0, 0);
                        imageToSend = tempCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];
                        
                        logDebug('Immagine originale preparata per AI', {
                            width: tempCanvas.width,
                            height: tempCanvas.height,
                            dataSize: imageToSend.length
                        });
                    } catch (error) {
                        logError('Errore nella preparazione immagine per AI', error);
                        alert('Errore nella preparazione dell\'immagine. Riprova.');
                        return;
                    }
                }
                
                if (!imageToSend) {
                    logError('Nessuna immagine disponibile per l\'invio');
                    alert('Carica prima un\'immagine');
                    return;
                }

                // Mostra indicatore di caricamento
                sendToAIBtn.disabled = true;
                sendToAIBtn.textContent = 'Invio in corso...';
                sendToAIBtn.style.opacity = '0.7';
                
                logDebug('Invio immagine ad AI', { dataSize: imageToSend.length });

                // Invio dell'immagine all'AI con gestione robusta
                logDebug('Invio fetch a /api/gemini/firstcheck');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout 30 secondi
                
                fetch('/api/gemini/firstcheck', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageToSend }),
                    signal: controller.signal
                })
                .then(response => {
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    return response.json();
                })
                .then(data => {
                    logDebug('Risposta AI ricevuta', data);
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    // Controlla se ci sono duplicati
                    if (data.errorType === 'DUPLICATE_REVIEW_IN_SESSION') {
                        handleDuplicateResponse(data.duplicates);
                        return;
                    }
                    
                    // Se l'analisi è andata a buon fine, marca le birre come recensite
                    if (data.success && data.bottles && data.bottles.length > 0) {
                        data.bottles.forEach(bottle => {
                            if (bottle.bottleLabel && bottle.breweryName) {
                                markBeerAsReviewed(bottle.bottleLabel, bottle.breweryName);
                            }
                        });
                    }
                    
                    const message = data.result || data.message || 'Analisi completata';
                    alert('Risposta AI: ' + message);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    logError('Errore nell\'invio all\'AI', error);
                    
                    let errorMessage = 'Errore nell\'invio all\'AI';
                    
                    if (error.name === 'AbortError') {
                        errorMessage = 'Timeout: l\'analisi sta richiedendo troppo tempo. Riprova.';
                    } else if (error.message.includes('HTTP 413')) {
                        errorMessage = 'Immagine troppo grande. Prova a ridimensionarla.';
                    } else if (error.message.includes('HTTP 429')) {
                        errorMessage = 'Troppe richieste. Attendi un momento e riprova.';
                    } else if (error.message.includes('Failed to fetch')) {
                        errorMessage = 'Problema di connessione. Controlla la tua connessione internet.';
                    }
                    
                    alert(errorMessage);
                })
                .finally(() => {
                    // Ripristina il bottone
                    sendToAIBtn.disabled = false;
                    sendToAIBtn.textContent = 'Invia ad AI';
                    sendToAIBtn.style.opacity = '1';
                    logDebug('Invio AI completato, bottone ripristinato');
                });
            });
        }
    }
});
// Aggiungi funzionalità per mostrare/nascondere la password

document.addEventListener('DOMContentLoaded', function () {
    // Listener per la selezione del ruolo nella creazione utente
    const roleSelect = document.getElementById('role');
    const customerDetails = document.getElementById('customerDetails');
    const administratorDetails = document.getElementById('administratorDetails');
    const breweryDetails = document.getElementById('breweryDetails');
    if (roleSelect && customerDetails && administratorDetails && breweryDetails) {
        roleSelect.addEventListener('change', function () {
            const selectedRole = roleSelect.value;
            customerDetails.style.display = 'none';
            administratorDetails.style.display = 'none';
            breweryDetails.style.display = 'none';
            if (selectedRole === 'customer') {
                customerDetails.style.display = 'block';
            } else if (selectedRole === 'administrator') {
                administratorDetails.style.display = 'block';
            } else if (selectedRole === 'brewery') {
                breweryDetails.style.display = 'block';
            }
        });
    }

    // Gestione popup disclaimer maggiore età
    const disclaimerModal = document.getElementById('disclaimer-modal');
    const acceptDisclaimerBtn = document.getElementById('accept-disclaimer');
    if (disclaimerModal && acceptDisclaimerBtn) {
        disclaimerModal.style.display = 'block';
        acceptDisclaimerBtn.addEventListener('click', function () {
            fetch('/disclaimer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accepted: true })
            })
            .then(response => {
                if (response.ok) {
                    disclaimerModal.style.display = 'none';
                    location.reload();
                }
            });
        });
    }

    // Gestione mostra/nascondi password e login
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginForm = document.getElementById('loginForm');
    function submitForm() {
        if (loginForm) loginForm.submit();
    }
    if (loginButton && loginForm) {
        loginButton.addEventListener('click', function (event) {
            event.preventDefault();
            submitForm();
        });
    }
    if (passwordInput && loginForm) {
        passwordInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitForm();
            }
        });
    }
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const iconSrc = type === 'password' ? '/images/visibility.svg' : '/images/visibility_off.svg';
            togglePassword.setAttribute('src', iconSrc);
        });
    }

    // Gestione sandwich menu
    const toggle = document.getElementById('sandwich-menu-toggle');
    const menu = document.getElementById('sandwich-menu-content');
    if (toggle && menu) {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
        });
        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target) && e.target !== toggle) {
                menu.style.display = 'none';
            }
        });
    }

    // Gestione cancellazione utente
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const deleteUserForm = document.getElementById('deleteUserForm');
    if (deleteUserBtn && deleteUserForm) {
        deleteUserBtn.addEventListener('click', function (e) {
            if (confirm('Sei sicuro di voler cancellare questo utente? L\'operazione è irreversibile.')) {
                deleteUserForm.submit();
            }
        });
    }

    // Gestione cambio ruolo attivo (CSP safe)
    const changeRoleForm = document.getElementById('changeRoleForm');
    const activeRoleSelect = document.getElementById('activeRole');
    if (changeRoleForm && activeRoleSelect) {
        activeRoleSelect.addEventListener('change', function () {
            changeRoleForm.submit();
        });
    }
});

window.onerror = function (message, source, lineno, colno, error) {
    console.error('Errore JavaScript:', message, source, lineno, colno, error);
};

function validatePasswordMatch() {
    var pwd = document.getElementById('password') ? document.getElementById('password').value : '';
    var conf = document.getElementById('confirmPassword') ? document.getElementById('confirmPassword').value : '';
    var error = document.getElementById('passwordError');
    if (pwd !== conf) {
        if (error) error.style.display = 'inline';
        return false;
    }
    if (error) error.style.display = 'none';
    return true;
}

window.onerror = function (message, source, lineno, colno, error) {
    console.error('Errore JavaScript:', message, source, lineno, colno, error);
};

function validatePasswordMatch() {
    var pwd = document.getElementById('password').value;
    var conf = document.getElementById('confirmPassword').value;
    var error = document.getElementById('passwordError');
    if (pwd !== conf) {
        error.style.display = 'inline';
        return false;
    }
    error.style.display = 'none';
    return true;
}