#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════════
# SEED DATA PARA TODOS LOS MICROSERVICIOS EN PARALELO
# ════════════════════════════════════════════════════════════════════════════════

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

WAIT_SECONDS=${1:-15}

echo "════════════════════════════════════════════════════════════════"
echo "🌱 SEED DATA - Todos los Microservicios"
echo "════════════════════════════════════════════════════════════════"

# Iniciar docker-compose si no está corriendo
if ! docker-compose ps | grep -q "ms1.*Up"; then
    echo "🐳 Iniciando docker-compose..."
    docker-compose up -d
    echo "✅ Contenedores iniciados"
    echo "⏳ Esperando $WAIT_SECONDS segundos para que las BDs estén listas..."
    sleep $WAIT_SECONDS
fi

echo ""
echo "🚀 Ejecutando seeds en paralelo..."
echo ""

# MS1 - Fake Data (Python) EN BACKGROUND
echo "📊 MS1: Generando 20k usuarios..."
docker-compose exec -T ms1 python fake_data.py > /tmp/ms1-seed.log 2>&1 &
MS1_PID=$!

# MS2 - Seed.js (Node.js) EN BACKGROUND
echo "🎬 MS2: Seeding películas, actores, directores..."
docker-compose exec -T ms2 npm run seed > /tmp/ms2-seed.log 2>&1 &
MS2_PID=$!

# MS3 - No tiene seed automático
echo "📝 MS3: No tiene seed automático (MongoDB)"

# Esperar a que terminen
echo ""
echo "⏳ Esperando a que terminen los seeds..."
wait $MS1_PID $MS2_PID

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 RESULTADOS:"
echo "════════════════════════════════════════════════════════════════"

if [ $? -eq 0 ]; then
    echo "✅ Seeds completados exitosamente!"
else
    echo "⚠️ Algunos seeds tuvieron errores. Revisa los logs:"
    echo "   - MS1: tail /tmp/ms1-seed.log"
    echo "   - MS2: tail /tmp/ms2-seed.log"
fi

echo ""
echo "🌐 Acceso a servicios:"
echo "  • Frontend:        http://localhost:5173"
echo "  • MS1 Usuarios:    http://localhost:8000/docs"
echo "  • MS2 Películas:   http://localhost:3000/docs"
echo "  • MS3 Foro:        http://localhost:8080"
echo "  • MS4 Orquestador: http://localhost:8004/docs"
echo ""
