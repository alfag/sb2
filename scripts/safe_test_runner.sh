#!/bin/bash

# Test Runner Sicuro - Wrapper per proteggere npm test
# SCOPO: Verificare sicurezza sistema prima di eseguire qualsiasi test
# PREVIENE: Esecuzione test su database produzione

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛡️ TEST RUNNER SICURO SharingBeer2.0${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verifica rapida sicurezza
echo -e "${YELLOW}🔍 Verifica sicurezza sistema...${NC}"

# Esegui verifica pre-test
if ! "$SCRIPT_DIR/pre_test_verification.sh" quick >/dev/null 2>&1; then
    echo
    echo -e "${RED}🚨 BLOCCO AUTOMATICO ATTIVATO${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Sistema NON sicuro per esecuzione test${NC}"
    echo -e "${RED}❌ Test bloccati per prevenire perdita dati${NC}"
    echo
    echo -e "${YELLOW}🔧 SOLUZIONI CONSIGLIATE:${NC}"
    echo -e "${GREEN}1.${NC} Usa test sicuri:     ${BLUE}npm run test:safe${NC}"
    echo -e "${GREEN}2.${NC} Verifica completa:   ${BLUE}npm run pre-test:verify${NC}"  
    echo -e "${GREEN}3.${NC} Test con backup:     ${BLUE}npm run test:with-backup${NC}"
    echo -e "${GREEN}4.${NC} Test ultra-sicuri:   ${BLUE}npm run test:ultra-safe${NC}"
    echo
    echo -e "${YELLOW}📋 Per dettagli problemi: ${BLUE}npm run pre-test:verify${NC}"
    echo
    exit 1
fi

# Sistema sicuro - procedi con backup automatico
echo -e "${GREEN}✅ Sistema verificato sicuro${NC}"
echo -e "${YELLOW}💾 Creazione backup automatico...${NC}"

# Backup pre-test automatico
if ! "$SCRIPT_DIR/backup_system.sh" pre-test; then
    echo -e "${YELLOW}⚠️ Backup fallito, procedo comunque con test sicuri${NC}"
fi

echo -e "${GREEN}🧪 Esecuzione test in ambiente sicuro...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Esegui test originale
cd "$PROJECT_ROOT"
exec mocha --recursive --exit "$@"