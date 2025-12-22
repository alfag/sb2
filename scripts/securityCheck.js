#!/usr/bin/env node

/**
 * Script per controllare le vulnerabilità di sicurezza
 * Esegue npm audit e controlla pacchetti specifici
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Controllo vulnerabilità di sicurezza...\n');

try {
  // Controllo npm audit
  console.log('1. Eseguendo npm audit...');
  const auditResult = execSync('npm audit --audit-level=low --json', { 
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  
  const audit = JSON.parse(auditResult);
  
  if (audit.metadata.vulnerabilities.total === 0) {
    console.log('✅ Nessuna vulnerabilità trovata con npm audit\n');
  } else {
    console.log(`⚠️  Trovate ${audit.metadata.vulnerabilities.total} vulnerabilità:`);
    console.log(`   - Critical: ${audit.metadata.vulnerabilities.critical}`);
    console.log(`   - High: ${audit.metadata.vulnerabilities.high}`);
    console.log(`   - Moderate: ${audit.metadata.vulnerabilities.moderate}`);
    console.log(`   - Low: ${audit.metadata.vulnerabilities.low}\n`);
  }

  // Controllo pacchetti specifici problematici
  console.log('2. Controllando pacchetti specifici...');
  
  const packageLock = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8')
  );
  
  const problematicPackages = [
    'on-headers',
    'express-session',
    'helmet',
    'express'
  ];
  
  problematicPackages.forEach(packageName => {
    if (packageLock.dependencies && packageLock.dependencies[packageName]) {
      const version = packageLock.dependencies[packageName].version;
      console.log(`   📦 ${packageName}: v${version}`);
    } else if (packageLock.packages && packageLock.packages[`node_modules/${packageName}`]) {
      const version = packageLock.packages[`node_modules/${packageName}`].version;
      console.log(`   📦 ${packageName}: v${version}`);
    }
  });
  
  console.log('\n✅ Controllo completato!');
  
  // Raccomandazioni di sicurezza
  console.log('\n📋 Raccomandazioni di sicurezza:');
  console.log('   • Esegui "npm audit" regolarmente');
  console.log('   • Mantieni aggiornate le dipendenze con "npm update"');
  console.log('   • Usa "npm audit fix" per risolvere vulnerabilità automaticamente');
  console.log('   • Considera l\'uso di tools come Snyk per monitoraggio continuo');
  
} catch (error) {
  if (error.status === 1 && error.stdout) {
    // npm audit restituisce exit code 1 se trova vulnerabilità
    const audit = JSON.parse(error.stdout);
    console.log(`⚠️  Trovate ${audit.metadata.vulnerabilities.total} vulnerabilità:`);
    console.log(`   - Critical: ${audit.metadata.vulnerabilities.critical}`);
    console.log(`   - High: ${audit.metadata.vulnerabilities.high}`);
    console.log(`   - Moderate: ${audit.metadata.vulnerabilities.moderate}`);
    console.log(`   - Low: ${audit.metadata.vulnerabilities.low}`);
    console.log('\n🔧 Esegui "npm audit fix" per tentare di risolvere automaticamente');
  } else {
    console.error('❌ Errore durante il controllo:', error.message);
  }
}
