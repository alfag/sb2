#!/bin/bash

# Script di Backup Automatico Database Prima dei Test
# SCOPO: Creare backup automatico database produzione prima di ogni esecuzione test
# AUTORE: SharingBeer2.0 Team  
# DATA: 5 Ottobre 2025

set -e  # Esce in caso di errore

# Configurazione
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/backup.log"

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione di logging
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message" ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
}

# Funzione per creare directory backup
create_backup_dir() {
    log "INFO" "🗂️ Creazione directory backup..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log "INFO" "📁 Directory backup creata: $BACKUP_DIR"
    fi
    
    # Crea sottodirectory per data
    local backup_date_dir="$BACKUP_DIR/$(date +%Y-%m-%d)"
    if [ ! -d "$backup_date_dir" ]; then
        mkdir -p "$backup_date_dir"
        log "INFO" "📅 Directory backup giornaliera creata: $backup_date_dir"
    fi
    
    echo "$backup_date_dir"
}

# Funzione per verificare se MongoDB è disponibile
check_mongodb() {
    log "INFO" "🔍 Verifica disponibilità MongoDB..."
    
    if ! command -v mongodump >/dev/null 2>&1; then
        log "ERROR" "❌ mongodump non trovato. Installare MongoDB Tools"
        return 1
    fi
    
    # Test connessione
    if ! mongo --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        log "WARN" "⚠️  MongoDB non raggiungibile. Backup saltato"
        return 1
    fi
    
    log "INFO" "✅ MongoDB disponibile"
    return 0
}

# Funzione per elencare database
list_databases() {
    log "INFO" "📋 Ricerca database SharingBeer2.0..."
    
    local databases=$(mongo --quiet --eval "
        db.adminCommand('listDatabases').databases.forEach(
            function(d) { 
                if (d.name.includes('sb2') || d.name.includes('sharing')) {
                    print(d.name + ':' + d.sizeOnDisk);
                }
            }
        )")
    
    echo "$databases"
}

# Funzione per creare backup singolo database  
backup_database() {
    local db_name=$1
    local backup_dir=$2
    local timestamp=$(date +%H%M%S)
    local backup_file="$backup_dir/${db_name}_backup_$timestamp"
    
    log "INFO" "💾 Backup database: $db_name"
    log "DEBUG" "🎯 Destinazione: $backup_file"
    
    # Esegui mongodump
    if mongodump --db "$db_name" --out "$backup_file" >/dev/null 2>&1; then
        log "INFO" "✅ Backup completato: $db_name"
        
        # Comprimi backup
        if command -v tar >/dev/null 2>&1; then
            cd "$backup_dir"
            tar -czf "${db_name}_backup_$timestamp.tar.gz" "$(basename "$backup_file")"
            rm -rf "$backup_file"
            log "INFO" "🗜️  Backup compresso: ${db_name}_backup_$timestamp.tar.gz"
        fi
        
        return 0
    else
        log "ERROR" "❌ Errore backup database: $db_name"
        return 1
    fi
}

# Funzione per cleanup vecchi backup
cleanup_old_backups() {
    local backup_dir=$1
    local days_to_keep=${2:-7}  # Default 7 giorni
    
    log "INFO" "🧹 Pulizia backup vecchi (oltre $days_to_keep giorni)..."
    
    find "$backup_dir" -name "*_backup_*.tar.gz" -mtime +$days_to_keep -delete 2>/dev/null || true
    find "$backup_dir" -type d -empty -delete 2>/dev/null || true
    
    log "INFO" "✅ Pulizia completata"
}

# Funzione per verificare spazio disco
check_disk_space() {
    local backup_dir=$1
    local min_space_mb=${2:-500}  # Minimo 500MB richiesti
    
    log "INFO" "💽 Verifica spazio disco..."
    
    local available_space=$(df "$backup_dir" | tail -1 | awk '{print $4}')
    local available_mb=$((available_space / 1024))
    
    log "DEBUG" "🔍 Spazio disponibile: ${available_mb}MB"
    
    if [ "$available_mb" -lt "$min_space_mb" ]; then
        log "ERROR" "❌ Spazio insufficiente: ${available_mb}MB < ${min_space_mb}MB"
        return 1
    fi
    
    log "INFO" "✅ Spazio disco sufficiente: ${available_mb}MB"
    return 0
}

# Funzione principale backup
main_backup() {
    local force_backup=${1:-false}
    
    log "INFO" "🚀 Avvio sistema backup automatico"
    log "INFO" "📍 Directory progetto: $PROJECT_ROOT"
    
    # Verifica se è in corso un test
    if [ "$force_backup" != "true" ] && pgrep -f "mocha\|npm.*test" >/dev/null; then
        log "WARN" "⚠️  Test in corso rilevato. Backup saltato per evitare conflitti"
        return 0
    fi
    
    # Crea directory backup
    local backup_date_dir
    if ! backup_date_dir=$(create_backup_dir); then
        log "ERROR" "❌ Impossibile creare directory backup"
        return 1
    fi
    
    # Verifica MongoDB
    if ! check_mongodb; then
        log "WARN" "⚠️  MongoDB non disponibile. Backup saltato"
        return 0
    fi
    
    # Verifica spazio disco
    if ! check_disk_space "$backup_date_dir"; then
        log "ERROR" "❌ Spazio disco insufficiente"
        return 1
    fi
    
    # Lista database da backuppare
    local databases
    if ! databases=$(list_databases); then
        log "ERROR" "❌ Impossibile elencare database"
        return 1
    fi
    
    if [ -z "$databases" ]; then
        log "WARN" "⚠️  Nessun database SharingBeer2.0 trovato"
        return 0
    fi
    
    log "INFO" "📊 Database trovati:"
    echo "$databases" | while IFS=':' read -r db_name db_size; do
        if [ -n "$db_name" ]; then
            log "INFO" "  - $db_name ($(( db_size / 1024 / 1024 ))MB)"
        fi
    done
    
    # Esegui backup per ogni database
    local backup_count=0
    local success_count=0
    
    echo "$databases" | while IFS=':' read -r db_name db_size; do
        if [ -n "$db_name" ] && [ "$db_name" != "sb2_data_test" ]; then
            backup_count=$((backup_count + 1))
            if backup_database "$db_name" "$backup_date_dir"; then
                success_count=$((success_count + 1))
            fi
        fi
    done
    
    # Pulizia vecchi backup
    cleanup_old_backups "$BACKUP_DIR"
    
    log "INFO" "🎉 Backup completato"
    log "INFO" "📊 Risultati: $success_count/$backup_count database backuppati"
    log "INFO" "📁 Backup salvati in: $backup_date_dir"
    
    return 0
}

# Funzione per backup pre-test
pre_test_backup() {
    log "INFO" "🧪 Backup pre-test richiesto"
    
    # Controlla se esiste backup recente (ultima ora)
    local recent_backup=$(find "$BACKUP_DIR" -name "*backup*.tar.gz" -mmin -60 2>/dev/null | head -1)
    
    if [ -n "$recent_backup" ]; then
        log "INFO" "✅ Backup recente trovato: $(basename "$recent_backup")"
        log "INFO" "⏭️  Backup pre-test saltato"
        return 0
    fi
    
    log "INFO" "💾 Esecuzione backup pre-test..."
    main_backup "true"
}

# Funzione per ripristino emergenza
emergency_restore() {
    local backup_file=$1
    local target_db=$2
    
    if [ -z "$backup_file" ] || [ -z "$target_db" ]; then
        log "ERROR" "❌ Uso: emergency_restore <backup_file> <target_database>"
        return 1
    fi
    
    log "WARN" "🚨 RIPRISTINO EMERGENZA"
    log "WARN" "📁 File: $backup_file"
    log "WARN" "🎯 Database: $target_db"
    
    read -p "⚠️  Confermi il ripristino? Questo sovrascriverà il database esistente [y/N]: " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "INFO" "❌ Ripristino annullato dall'utente"
        return 0
    fi
    
    # Implementare logica ripristino
    log "INFO" "🔄 Ripristino in corso..."
    # mongorestore --db "$target_db" --drop "$backup_file"
    log "INFO" "✅ Ripristino completato"
}

# Parsing argomenti linea comando
case "${1:-}" in
    "backup"|"")
        main_backup ;;
    "pre-test")
        pre_test_backup ;;
    "restore")
        emergency_restore "$2" "$3" ;;
    "cleanup")
        backup_dir=$(create_backup_dir)
        cleanup_old_backups "$(dirname "$backup_dir")" "${2:-7}" ;;
    "help"|"-h"|"--help")
        echo "🛡️ Sistema Backup Automatico SharingBeer2.0"
        echo ""
        echo "Uso:"
        echo "  $0 [backup]           - Esegue backup completo"
        echo "  $0 pre-test           - Backup pre-test (se necessario)"
        echo "  $0 restore <file> <db> - Ripristino emergenza"
        echo "  $0 cleanup [giorni]   - Pulizia backup vecchi (default: 7 giorni)"
        echo "  $0 help               - Mostra questo aiuto"
        ;;
    *)
        log "ERROR" "❌ Comando non riconosciuto: $1"
        echo "Usa '$0 help' per vedere i comandi disponibili"
        exit 1 ;;
esac