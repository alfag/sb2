#!/usr/bin/env node

/**
 * Test Upload Debug - Verifica funzionamento middleware Multer
 */

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
  console.log('🧪 Test Upload Debug - Avvio test...');
  
  try {
    // Crea un'immagine di test (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0xEA, 0x0E, 0x7B, 0x58, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    // Crea FormData
    const form = new FormData();
    form.append('image', testImageBuffer, {
      filename: 'test.png',
      contentType: 'image/png'
    });

    console.log('📤 Inviando richiesta a http://localhost:8080/review/api/gemini/firstcheck...');
    
    // Invia richiesta
    const response = await fetch('http://localhost:8080/review/api/gemini/firstcheck', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('📥 Risposta ricevuta:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    const responseText = await response.text();
    console.log('📄 Contenuto risposta:', responseText);

  } catch (error) {
    console.error('❌ Errore durante test:', error.message);
  }
}

// Esegui test
testUpload();