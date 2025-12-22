#!/bin/bash

echo "🧪 Test Rate Limiting con richieste multiple"
echo "============================================="

for i in {1..10}; do
    echo -n "Richiesta $i: "
    response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/)
    echo "HTTP $response"
    
    if [ "$response" = "302" ] || [ "$response" = "301" ]; then
        echo "✅ Rate limit attivato - Redirect rilevato!"
        break
    fi
    
    sleep 0.2
done

echo ""
echo "🔍 Test completato. Controlla i log del server per dettagli."
