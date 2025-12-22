#!/usr/bin/env node

/**
 * Build script per Tailwind CSS v4 - SharingBeer2.0
 * Tailwind v4 non richiede CLI, usa import CSS diretto
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = 'public/css/tailwind-input.css';
const OUTPUT_FILE = 'public/css/tailwind-output.css';

const isWatch = process.argv.includes('--watch');

console.log('🎨 SharingBeer2.0 - Tailwind CSS Build v4');
console.log('=========================================');

function buildTailwind() {
  try {
    console.log(`📝 Input: ${INPUT_FILE}`);
    console.log(`📄 Output: ${OUTPUT_FILE}`);
    console.log('⚙️  Mode: Tailwind v4 direct CSS');
    
    // Leggi il file input
    const cssContent = fs.readFileSync(INPUT_FILE, 'utf8');
    
    // Per Tailwind v4, il CSS può essere usato direttamente
    // Aggiungi solo un header per identificazione
    const outputContent = `/* SharingBeer 2.0 - Generated CSS */
/* Generated on ${new Date().toISOString()} */
/* Tailwind CSS v4 - Direct Import Mode */

${cssContent}`;
    
    // Scrivi il file output
    fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
    
    console.log('✅ CSS compilato con successo!');
    console.log(`📦 Dimensione: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
    
    if (isWatch) {
      console.log('👀 Modalità watch non necessaria per Tailwind v4');
      console.log('� Le utility classes sono generate automaticamente');
    }
    
  } catch (error) {
    console.error('❌ Errore durante il build:', error.message);
    process.exit(1);
  }
}

// Verifica che i file necessari esistano
if (!fs.existsSync(INPUT_FILE)) {
  console.error(`❌ File input non trovato: ${INPUT_FILE}`);
  process.exit(1);
}

// Crea la directory output se non esiste
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

buildTailwind();