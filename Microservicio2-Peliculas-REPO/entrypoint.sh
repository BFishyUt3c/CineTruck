#!/bin/bash
set -e

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 Esperando a MySQL..."
echo "════════════════════════════════════════════════════════"

# Esperar a que MySQL esté listo
for i in {1..30}; do
  if nc -z $DB_HOST $DB_PORT 2>/dev/null; then
    echo "✅ MySQL está listo"
    break
  fi
  echo "⏳ Intento $i/30..."
  sleep 2
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "🌱 Ejecutando seed database..."
echo "════════════════════════════════════════════════════════"

if [ "${SEED_ENABLED:-true}" = "true" ]; then
  node src/db/seed.js
else
  echo "⏭️  Seed desactivado (SEED_ENABLED=false)"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "🚀 Iniciando servidor MS2"
echo "════════════════════════════════════════════════════════"
echo ""

node src/app.js
