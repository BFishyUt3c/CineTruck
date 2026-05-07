# ════════════════════════════════════════════════════════════════════════════════
# SEED DATA PARA TODOS LOS MICROSERVICIOS EN PARALELO
# ════════════════════════════════════════════════════════════════════════════════

param(
    [switch]$Up = $false,      # -Up : Ejecutar docker-compose up primero
    [int]$WaitSeconds = 15     # -WaitSeconds : Segundos a esperar antes de seed
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🌱 SEED DATA - Todos los Microservicios" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Opción 1: Iniciar docker-compose si se solicita
if ($Up) {
    Write-Host "`n🐳 Iniciando docker-compose..." -ForegroundColor Yellow
    docker-compose up -d
    Write-Host "✅ Contenedores iniciados" -ForegroundColor Green
    Write-Host "⏳ Esperando $WaitSeconds segundos para que las BDs estén listas..." -ForegroundColor Yellow
    Start-Sleep -Seconds $WaitSeconds
}

# Opción 2: Seeds EN PARALELO
Write-Host "`n🚀 Ejecutando seeds en paralelo..." -ForegroundColor Cyan

# MS1 - Fake Data (Python)
$Job1 = Start-Job -ScriptBlock {
    Set-Location 'c:\Users\Lenovo\OneDrive\Documents\CloudPr\Microservicio1_usuario'
    Write-Host "📊 MS1: Generando 20k usuarios..." -ForegroundColor Magenta
    
    # Si está en un contenedor
    docker-compose exec -T ms1 python fake_data.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MS1: Datos generados correctamente" -ForegroundColor Green
    } else {
        Write-Host "❌ MS1: Error al generar datos" -ForegroundColor Red
    }
} -Name "MS1-Seed"

# MS2 - Seed.js (Node.js)
$Job2 = Start-Job -ScriptBlock {
    Set-Location 'c:\Users\Lenovo\OneDrive\Documents\CloudPr\Microservicio2-Peliculas-REPO'
    Write-Host "🎬 MS2: Seeding películas, actores, directores..." -ForegroundColor Cyan
    
    # Si está en un contenedor
    docker-compose exec -T ms2 npm run seed
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MS2: Datos seeded correctamente" -ForegroundColor Green
    } else {
        Write-Host "❌ MS2: Error al seed" -ForegroundColor Red
    }
} -Name "MS2-Seed"

# MS3 - No tiene seed automático (MongoDB)
Write-Host "📝 MS3: No tiene seed automático (MongoDB)" -ForegroundColor Gray

# Esperar a que terminen ambos jobs
Write-Host "`n⏳ Esperando a que terminen los seeds..." -ForegroundColor Yellow
$Job1, $Job2 | Wait-Job

# Mostrar resultados
Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RESULTADOS:" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

Get-Job | Receive-Job
Get-Job | Remove-Job

Write-Host "`n✅ Seeds completados!" -ForegroundColor Green
Write-Host "🌐 Acceso a servicios:" -ForegroundColor Cyan
Write-Host "  • Frontend:    http://localhost:5173" -ForegroundColor White
Write-Host "  • MS1 Usuarios: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  • MS2 Películas: http://localhost:3000/docs" -ForegroundColor White
Write-Host "  • MS3 Foro:     http://localhost:8080" -ForegroundColor White
Write-Host "  • MS4 Orquestador: http://localhost:8004/docs" -ForegroundColor White
