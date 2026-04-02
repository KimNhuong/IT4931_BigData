# Big Data Platform Docker Compose Helper Script (PowerShell)
# This script provides a menu-driven interface for managing Docker Compose services

param(
    [string]$action = "menu"
)

# Color definitions
$colors = @{
    Header  = "Cyan"
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Blue"
}

function Print-Header($text) {
    Write-Host "════════════════════════════════════════" -ForegroundColor $colors.Header
    Write-Host $text -ForegroundColor $colors.Header
    Write-Host "════════════════════════════════════════" -ForegroundColor $colors.Header
}

function Print-Success($text) {
    Write-Host "✓ $text" -ForegroundColor $colors.Success
}

function Print-Error($text) {
    Write-Host "✗ $text" -ForegroundColor $colors.Error
}

function Print-Warning($text) {
    Write-Host "⚠ $text" -ForegroundColor $colors.Warning
}

function Print-Info($text) {
    Write-Host "ℹ $text" -ForegroundColor $colors.Info
}

function Show-Menu {
    Print-Header "Big Data Platform - Docker Compose Management"
    Write-Host ""
    Write-Host "1. Start all services"
    Write-Host "2. Stop all services"
    Write-Host "3. View logs (all services)"
    Write-Host "4. View logs (specific service)"
    Write-Host "5. Check service status"
    Write-Host "6. Restart all services"
    Write-Host "7. Clean up (remove containers and volumes)"
    Write-Host "8. Rebuild and restart"
    Write-Host "9. Access CLI tools"
    Write-Host "10. View service ports"
    Write-Host "0. Exit"
    Write-Host ""
}

function Start-Services {
    Print-Header "Starting All Services..."
    docker-compose up -d
    if ($LASTEXITCODE -eq 0) {
        Print-Success "All services started successfully"
        Start-Sleep -Seconds 3
        Check-Health
    }
    else {
        Print-Error "Failed to start services"
    }
}

function Stop-Services {
    Print-Header "Stopping All Services..."
    docker-compose stop
    if ($LASTEXITCODE -eq 0) {
        Print-Success "All services stopped"
    }
    else {
        Print-Error "Failed to stop services"
    }
}

function View-AllLogs {
    Print-Header "Live Logs (Press Ctrl+C to exit)"
    docker-compose logs -f
}

function View-ServiceLogs {
    $services = @("zookeeper", "kafka", "kafka-ui", "elasticsearch", "kibana", "redis", "binance-ingest")
    
    Write-Host ""
    Write-Host "Available services:"
    for ($i = 0; $i -lt $services.Count; $i++) {
        Write-Host "$($i+1). $($services[$i])"
    }
    
    $serviceNum = Read-Host "Select service number"
    
    if ($serviceNum -gt 0 -and $serviceNum -le $services.Count) {
        $service = $services[$serviceNum - 1]
        Print-Header "Logs for $service (Press Ctrl+C to exit)"
        docker-compose logs -f $service
    }
    else {
        Print-Error "Invalid selection"
    }
}

function Check-Health {
    Print-Header "Checking Service Health..."
    docker-compose ps
    
    Write-Host ""
    Write-Host "Service Details:"
    
    # Check Elasticsearch
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9200/_cluster/health" -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Print-Success "Elasticsearch is healthy"
        }
    }
    catch {
        Print-Warning "Elasticsearch not yet ready"
    }
    
    # Check Redis
    try {
        $result = docker-compose exec -T redis redis-cli ping 2>$null
        if ($result -match "PONG") {
            Print-Success "Redis is healthy"
        }
    }
    catch {
        Print-Warning "Redis not yet ready"
    }
    
    # Check Nest.js
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Print-Success "Nest.js Backend is healthy"
        }
    }
    catch {
        Print-Warning "Nest.js Backend not yet ready"
    }
    
    Write-Host ""
    Print-Info "Give services 10-15 seconds to fully initialize on first start"
}

function Restart-Services {
    Print-Header "Restarting All Services..."
    docker-compose restart
    Print-Success "Services restarted"
    Start-Sleep -Seconds 3
    Check-Health
}

function Cleanup {
    Print-Header "Cleanup Options"
    Write-Host "1. Stop containers (keep volumes)"
    Write-Host "2. Remove containers (keep volumes)"
    Write-Host "3. Remove everything (containers + volumes)"
    
    $cleanupOption = Read-Host "Select option (1-3)"
    
    switch ($cleanupOption) {
        "1" {
            docker-compose stop
            Print-Success "Services stopped"
        }
        "2" {
            docker-compose down
            Print-Success "Containers removed"
        }
        "3" {
            $confirm = Read-Host "Are you sure? This will delete all data (y/n)"
            if ($confirm -eq "y") {
                docker-compose down -v
                Print-Success "All containers and volumes removed"
            }
            else {
                Print-Warning "Cleanup cancelled"
            }
        }
        default {
            Print-Error "Invalid option"
        }
    }
}

function Rebuild-Restart {
    Print-Header "Rebuilding and Restarting..."
    docker-compose down
    docker-compose up -d --build
    Print-Success "Services rebuilt and started"
    Start-Sleep -Seconds 3
    Check-Health
}

function Show-CLITools {
    Print-Header "CLI Tools"
    Write-Host "1. List Kafka Topics"
    Write-Host "2. Kafka Consumer (crypto-prices topic)"
    Write-Host "3. Redis CLI"
    Write-Host "4. Elasticsearch Query"
    Write-Host "5. Back to main menu"
    
    $cliOption = Read-Host "Select option (1-5)"
    
    switch ($cliOption) {
        "1" {
            Print-Header "Kafka Topics"
            docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
        }
        "2" {
            Print-Header "Kafka Consumer (crypto-prices)"
            Print-Info "Consuming from the beginning. Press Ctrl+C to exit."
            docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic crypto-prices --from-beginning
        }
        "3" {
            Print-Header "Redis CLI"
            docker-compose exec redis redis-cli
        }
        "4" {
            Print-Header "Elasticsearch Query"
            Write-Host "Cluster Health:"
            $health = Invoke-WebRequest -Uri "http://localhost:9200/_cluster/health" -ErrorAction SilentlyContinue
            $health.Content | ConvertFrom-Json | ConvertTo-Json
            
            Write-Host ""
            Write-Host "Indices:"
            Invoke-WebRequest -Uri "http://localhost:9200/_cat/indices" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Content
        }
        "5" {
            return
        }
        default {
            Print-Error "Invalid option"
        }
    }
}

function Show-Ports {
    Print-Header "Service Access Ports"
    Write-Host ""
    Write-Host "Service                 Port        URL"
    Write-Host ("-" * 60)
    Write-Host "Zookeeper              2181        localhost:2181"
    Write-Host "Kafka                  9092        localhost:9092"
    Write-Host "Kafka UI               8080        http://localhost:8080"
    Write-Host "Elasticsearch          9200        http://localhost:9200"
    Write-Host "Kibana                 5601        http://localhost:5601"
    Write-Host "Redis                  6379        localhost:6379"
    Write-Host "Nest.js Backend        3000        http://localhost:3000"
    Write-Host ""
    Write-Host "Common URLs:"
    Write-Host "  - Kafka UI:        http://localhost:8080"
    Write-Host "  - Kibana:          http://localhost:5601"
    Write-Host "  - Backend Health:  http://localhost:3000/health"
    Write-Host "  - ES Cluster:      http://localhost:9200/_cluster/health"
}

# Main loop
while ($true) {
    Show-Menu
    
    $choice = Read-Host "Select option (0-10)"
    
    switch ($choice) {
        "1" { Start-Services }
        "2" { Stop-Services }
        "3" { View-AllLogs }
        "4" { View-ServiceLogs }
        "5" { Check-Health }
        "6" { Restart-Services }
        "7" { Cleanup }
        "8" { Rebuild-Restart }
        "9" { Show-CLITools }
        "10" { Show-Ports }
        "0" {
            Print-Info "Goodbye!"
            exit 0
        }
        default {
            Print-Error "Invalid option"
        }
    }
    
    Read-Host "Press Enter to continue"
}
