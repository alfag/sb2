#!/bin/bash

# Script di Verifica Pre-Test per Sicurezza Database
# SCOPO: Verificare configurazione sicura prima di permettere esecuzione test
# AUTORE: SharingBeer2.0 Team
# DATA: 5 Ottobre 2025

# set -e rimosse per permettere continuazione script anche con errori grep

# Configurazione
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/pre_test_verification.log"

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Contatori
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Funzione di logging con colori
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case $level in
        "PASS")
            echo -e "${GREEN}✅ [PASS]${NC} $message"
            ((CHECKS_PASSED++)) ;;
        "FAIL") 
            echo -e "${RED}❌ [FAIL]${NC} $message"
            ((CHECKS_FAILED++)) ;;
        "WARN")
            echo -e "${YELLOW}⚠️  [WARN]${NC} $message" 
            ((WARNINGS++)) ;;
        "INFO")
            echo -e "${BLUE}ℹ️  [INFO]${NC} $message" ;;
        "DEBUG")
            echo -e "${CYAN}🔍 [DEBUG]${NC} $message" ;;
    esac
}

# Banner iniziale
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              🛡️ SISTEMA VERIFICA PRE-TEST 🛡️                ║"
    echo "║                  SharingBeer2.0 Safety Check                ║"
    echo "║                                                              ║"
    echo "║  🎯 Scopo: Prevenire perdita dati produzione durante test   ║"
    echo "║  📅 Data: $(date '+%Y-%m-%d %H:%M:%S')                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 1. Verifica esistenza testHelper.js
check_test_helper() {
    log "INFO" "Verifica esistenza testHelper.js..."
    
    local test_helper_path="$PROJECT_ROOT/test/testHelper.js"
    
    if [ -f "$test_helper_path" ]; then
        log "PASS" "testHelper.js trovato"
        
        # Verifica contenuto critico (continua anche se grep fallisce)
        if grep -q "setupTestDatabase" "$test_helper_path" 2>/dev/null && \
           grep -q "cleanupTestDatabase" "$test_helper_path" 2>/dev/null && \
           grep -q "sb2_data_test" "$test_helper_path" 2>/dev/null; then
            log "PASS" "testHelper.js contiene funzioni di sicurezza"
        else
            log "FAIL" "testHelper.js manca funzioni critiche di sicurezza"
        fi
    else
        log "FAIL" "testHelper.js non trovato - CRITICO per sicurezza!"
    fi
}

# 2. Verifica configurazione database test
check_test_config() {
    log "INFO" "Verifica configurazione database test..."
    
    local test_config_path="$PROJECT_ROOT/config/test.js"
    
    if [ -f "$test_config_path" ]; then
        log "PASS" "config/test.js trovato"
        
        if grep -q "sb2_data_test" "$test_config_path" 2>/dev/null; then
            log "PASS" "Configurazione database test corretta"
        else
            log "FAIL" "Configurazione database test mancante o errata"
        fi
    else
        log "FAIL" "config/test.js non trovato"
    fi
}

# 3. Scansione test pericolosi
scan_dangerous_tests() {
    log "INFO" "Scansione test per pattern pericolosi..."
    
    local test_dir="$PROJECT_ROOT/test"
    local dangerous_patterns=(
        "require.*models.*User"
        "require.*models.*Brewery" 
        "mongoose\.connect"
        "new User\("
        "new Brewery\("
    )
    
    local dangerous_files=()
    
    for pattern in "${dangerous_patterns[@]}"; do
        while IFS= read -r -d '' file; do
            if [ -f "$file" ] && ! grep -q "setupTestDatabase" "$file"; then
                dangerous_files+=("$file")
            fi
        done < <(grep -r -l "$pattern" "$test_dir" --include="*.js" -Z 2>/dev/null || true)
    done
    
    # Rimuovi duplicati
    local unique_dangerous=($(printf '%s\n' "${dangerous_files[@]}" | sort -u))
    
    if [ ${#unique_dangerous[@]} -eq 0 ]; then
        log "PASS" "Nessun test pericoloso trovato"
    else
        log "FAIL" "Trovati ${#unique_dangerous[@]} test potenzialmente pericolosi:"
        for file in "${unique_dangerous[@]}"; do
            log "WARN" "  - $(basename "$file")"
        done
    fi
}

# 4. Verifica ambiente Node.js
check_node_env() {
    log "INFO" "Verifica ambiente Node.js..."
    
    if [ -n "$NODE_ENV" ]; then
        case "$NODE_ENV" in
            "test"|"testing"|"development")
                log "PASS" "NODE_ENV sicuro: $NODE_ENV" ;;
            "production")
                log "FAIL" "NODE_ENV=production - PERICOLO per test!" ;;
            *)
                log "WARN" "NODE_ENV non standard: $NODE_ENV" ;;
        esac
    else
        log "WARN" "NODE_ENV non impostato"
    fi
}

# 5. Verifica connessioni MongoDB attive
check_mongodb_connections() {
    log "INFO" "Verifica connessioni MongoDB attive..."
    
    if command -v mongo >/dev/null 2>&1; then
        # Testa connessione a database produzione
        if mongo sb2_data --eval "quit()" >/dev/null 2>&1; then
            log "WARN" "Database produzione 'sb2_data' accessibile - Attenzione!"
        fi
        
        # Testa connessione a database test
        if mongo sb2_data_test --eval "quit()" >/dev/null 2>&1; then
            log "PASS" "Database test 'sb2_data_test' accessibile"
        else
            log "WARN" "Database test 'sb2_data_test' non accessibile"
        fi
    else
        log "WARN" "MongoDB client non trovato - impossibile verificare connessioni"
    fi
}

# 6. Verifica processi Node.js attivi
check_active_processes() {
    log "INFO" "Verifica processi Node.js attivi..."
    
    local node_processes=$(pgrep -f "node\|nodemon" | wc -l)
    
    if [ "$node_processes" -gt 0 ]; then
        log "WARN" "$node_processes processi Node.js attivi trovati"
        log "INFO" "Processi attivi:"
        pgrep -af "node\|nodemon" | while read pid cmd; do
            log "DEBUG" "  PID $pid: $(echo "$cmd" | cut -c1-60)..."
        done
    else
        log "PASS" "Nessun processo Node.js attivo"
    fi
}

# 7. Verifica spazio disco per backup
check_disk_space() {
    log "INFO" "Verifica spazio disco per backup..."
    
    local backup_dir="$PROJECT_ROOT/backups"
    local available_space_mb
    
    if [ -d "$backup_dir" ]; then
        available_space_mb=$(df "$backup_dir" | tail -1 | awk '{print int($4/1024)}')
    else
        available_space_mb=$(df "$PROJECT_ROOT" | tail -1 | awk '{print int($4/1024)}')
    fi
    
    log "DEBUG" "Spazio disponibile: ${available_space_mb}MB"
    
    if [ "$available_space_mb" -gt 500 ]; then
        log "PASS" "Spazio disco sufficiente per backup: ${available_space_mb}MB"
    elif [ "$available_space_mb" -gt 100 ]; then
        log "WARN" "Spazio disco limitato per backup: ${available_space_mb}MB"
    else
        log "FAIL" "Spazio disco insufficiente per backup: ${available_space_mb}MB"
    fi
}

# 8. Verifica script di backup
check_backup_script() {
    log "INFO" "Verifica script di backup..."
    
    local backup_script="$PROJECT_ROOT/scripts/backup_system.sh"
    
    if [ -f "$backup_script" ]; then
        if [ -x "$backup_script" ]; then
            log "PASS" "Script backup trovato ed eseguibile"
        else
            log "WARN" "Script backup trovato ma non eseguibile"
        fi
    else
        log "FAIL" "Script backup non trovato"
    fi
}

# 9. Verifica package.json per comandi sicuri
check_package_json() {
    log "INFO" "Verifica comandi npm per test sicuri..."
    
    local package_json="$PROJECT_ROOT/package.json"
    
    if [ -f "$package_json" ]; then
        if grep -q "test:safe\|backup:pre-test" "$package_json" 2>/dev/null; then
            log "PASS" "Comandi test sicuri configurati in package.json"
        else
            log "WARN" "Comandi test sicuri non trovati in package.json"
        fi
    else
        log "FAIL" "package.json non trovato"
    fi
}

# 10. Test simulazione sicurezza
simulate_test_safety() {
    log "INFO" "Simulazione test di sicurezza..."
    
    # Simula import testHelper
    local test_helper="$PROJECT_ROOT/test/testHelper.js"
    
    if [ -f "$test_helper" ]; then
        # Verifica che contenga le funzioni necessarie
        local required_functions=("setupTestDatabase" "cleanupTestDatabase" "closeTestDatabase")
        local missing_functions=()
        
        for func in "${required_functions[@]}"; do
            if ! grep -q "$func" "$test_helper"; then
                missing_functions+=("$func")
            fi
        done
        
        if [ ${#missing_functions[@]} -eq 0 ]; then
            log "PASS" "Tutte le funzioni di sicurezza presenti in testHelper"
        else
            log "FAIL" "Funzioni mancanti in testHelper: ${missing_functions[*]}"
        fi
    else
        log "FAIL" "Impossibile simulare - testHelper non trovato"
    fi
}

# Funzione per generare report finale
generate_report() {
    local total_checks=$((CHECKS_PASSED + CHECKS_FAILED))
    local safety_score=$((CHECKS_PASSED * 100 / total_checks))
    
    echo
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    📊 REPORT FINALE                         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    echo -e "📈 ${GREEN}Controlli Superati:${NC} $CHECKS_PASSED"
    echo -e "❌ ${RED}Controlli Falliti:${NC} $CHECKS_FAILED"  
    echo -e "⚠️  ${YELLOW}Avvisi:${NC} $WARNINGS"
    echo -e "🎯 ${BLUE}Punteggio Sicurezza:${NC} $safety_score%"
    echo
    
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}🎉 SISTEMA SICURO - Test possono essere eseguiti${NC}"
        echo -e "${GREEN}✅ Nessun rischio identificato per database produzione${NC}"
        return 0
    elif [ "$safety_score" -ge 70 ]; then
        echo -e "${YELLOW}⚠️  ATTENZIONE - Sistema parzialmente sicuro${NC}"
        echo -e "${YELLOW}🔍 Rivedere i controlli falliti prima di procedere${NC}"
        return 1
    else
        echo -e "${RED}🚨 PERICOLO - Sistema NON sicuro per test${NC}"
        echo -e "${RED}❌ NON eseguire test fino alla risoluzione problemi${NC}"
        return 2
    fi
}

# Funzione per suggerimenti correzione
suggest_fixes() {
    if [ "$CHECKS_FAILED" -gt 0 ]; then
        echo
        echo -e "${CYAN}🛠️ SUGGERIMENTI PER CORREGGERE I PROBLEMI:${NC}"
        echo
        echo "1. 📁 Creare testHelper.js se mancante:"
        echo "   cp test/testHelper.js.example test/testHelper.js"
        echo
        echo "2. 🔧 Convertire test non sicuri:"
        echo "   Aggiungere setupTestDatabase() nei test pericolosi"
        echo
        echo "3. 💾 Creare backup prima dei test:"
        echo "   npm run backup:pre-test"
        echo
        echo "4. 🧪 Usare comandi test sicuri:"
        echo "   npm run test:safe"
        echo "   npm run test:with-backup"
        echo
    fi
}

# Funzione principale
main() {
    show_banner
    
    log "INFO" "🚀 Avvio verifica pre-test..."
    log "INFO" "📂 Directory progetto: $PROJECT_ROOT"
    
    # Esegui tutti i controlli
    check_test_helper
    check_test_config  
    scan_dangerous_tests
    check_node_env
    check_mongodb_connections
    check_active_processes
    check_disk_space
    check_backup_script
    check_package_json
    simulate_test_safety
    
    echo
    log "INFO" "🏁 Verifica completata"
    
    # Genera report e suggerimenti
    generate_report
    local exit_code=$?
    
    if [ "$exit_code" -ne 0 ]; then
        suggest_fixes
    fi
    
    # Salva report nel log
    echo >> "$LOG_FILE"
    echo "SUMMARY: PASSED=$CHECKS_PASSED FAILED=$CHECKS_FAILED WARNINGS=$WARNINGS SAFETY_SCORE=$((CHECKS_PASSED * 100 / (CHECKS_PASSED + CHECKS_FAILED)))%" >> "$LOG_FILE"
    
    return $exit_code
}

# Parsing argomenti
case "${1:-}" in
    "check"|"")
        main ;;
    "quick")
        check_test_helper
        check_test_config
        scan_dangerous_tests
        generate_report ;;
    "help"|"-h"|"--help")
        echo "🛡️ Sistema Verifica Pre-Test SharingBeer2.0"
        echo ""
        echo "Uso:"
        echo "  $0 [check]    - Verifica completa sicurezza (default)"
        echo "  $0 quick      - Verifica rapida solo elementi critici"
        echo "  $0 help       - Mostra questo aiuto"
        echo ""
        echo "Codici di uscita:"
        echo "  0 - Sistema sicuro"
        echo "  1 - Attenzione richiesta"  
        echo "  2 - Sistema pericoloso"
        ;;
    *)
        echo "❌ Comando non riconosciuto: $1"
        echo "Usa '$0 help' per vedere i comandi disponibili"
        exit 1 ;;
esac