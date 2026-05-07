#!/bin/bash
set -e

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 Esperando a MongoDB..."
echo "════════════════════════════════════════════════════════"

# Esperar a que MongoDB esté listo
for i in {1..30}; do
  if nc -z $MONGO_HOST ${MONGO_PORT:-27017} 2>/dev/null; then
    echo "✅ MongoDB está listo"
    break
  fi
  echo "⏳ Intento $i/30..."
  sleep 2
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "🚀 Iniciando servidor MS3"
echo "════════════════════════════════════════════════════════"
echo ""

exec "$@"
