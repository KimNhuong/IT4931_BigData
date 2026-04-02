#!/bin/bash

# Big Data Platform Docker Compose Helper Script
# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Main menu
show_menu() {
    print_header "Big Data Platform - Docker Compose Management"
    echo ""
    echo "1. Start all services"
    echo "2. Stop all services"
    echo "3. View logs (all services)"
    echo "4. View logs (specific service)"
    echo "5. Check service status"
    echo "6. Restart all services"
    echo "7. Clean up (remove containers and volumes)"
    echo "8. Rebuild and restart"
    echo "9. Access CLI tools"
    echo "10. View service ports"
    echo "0. Exit"
    echo ""
    read -p "Select option (0-10): " choice
}

# Service list
services=("zookeeper" "kafka" "kafka-ui" "elasticsearch" "kibana" "redis" "binance-ingest")

start_services() {
    print_header "Starting All Services..."
    if docker-compose up -d; then
        print_success "All services started successfully"
        sleep 3
        check_health
    else
        print_error "Failed to start services"
    fi
}

stop_services() {
    print_header "Stopping All Services..."
    if docker-compose stop; then
        print_success "All services stopped"
    else
        print_error "Failed to stop services"
    fi
}

view_all_logs() {
    print_header "Live Logs (Press Ctrl+C to exit)"
    docker-compose logs -f
}

view_service_logs() {
    echo ""
    echo "Available services:"
    for i in "${!services[@]}"; do
        echo "$((i+1)). ${services[$i]}"
    done
    read -p "Select service number: " service_num
    
    if [ $service_num -gt 0 ] && [ $service_num -le ${#services[@]} ]; then
        service=${services[$((service_num-1))]}
        print_header "Logs for $service (Press Ctrl+C to exit)"
        docker-compose logs -f "$service"
    else
        print_error "Invalid selection"
    fi
}

check_health() {
    print_header "Checking Service Health..."
    docker-compose ps
    
    echo ""
    echo "Service Details:"
    
    if docker-compose exec -T zookeeper zkServer.sh status &>/dev/null; then
        print_success "Zookeeper is healthy"
    else
        print_warning "Zookeeper not yet ready"
    fi
    
    if curl -s http://localhost:9200/_cluster/health &>/dev/null; then
        health=$(curl -s http://localhost:9200/_cluster/health | grep -o '"status":"[^"]*"')
        print_success "Elasticsearch is healthy ($health)"
    else
        print_warning "Elasticsearch not yet ready"
    fi
    
    if docker-compose exec -T redis redis-cli ping &>/dev/null; then
        print_success "Redis is healthy"
    else
        print_warning "Redis not yet ready"
    fi
    
    if curl -s http://localhost:3000/health &>/dev/null; then
        print_success "Nest.js Backend is healthy"
    else
        print_warning "Nest.js Backend not yet ready"
    fi
    
    echo ""
    print_info "Give services 10-15 seconds to fully initialize on first start"
}

restart_services() {
    print_header "Restarting All Services..."
    docker-compose restart
    print_success "Services restarted"
    sleep 3
    check_health
}

cleanup() {
    print_header "Cleanup Options"
    echo "1. Stop containers (keep volumes)"
    echo "2. Remove containers (keep volumes)"
    echo "3. Remove everything (containers + volumes)"
    read -p "Select option (1-3): " cleanup_option
    
    case $cleanup_option in
        1)
            docker-compose stop
            print_success "Services stopped"
            ;;
        2)
            docker-compose down
            print_success "Containers removed"
            ;;
        3)
            read -p "Are you sure? This will delete all data (y/n): " confirm
            if [ "$confirm" = "y" ]; then
                docker-compose down -v
                print_success "All containers and volumes removed"
            else
                print_warning "Cleanup cancelled"
            fi
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
}

rebuild_restart() {
    print_header "Rebuilding and Restarting..."
    docker-compose down
    docker-compose up -d --build
    print_success "Services rebuilt and started"
    sleep 3
    check_health
}

cli_tools() {
    print_header "CLI Tools"
    echo "1. Kafka CLI (kafka-topics)"
    echo "2. Kafka Consumer (crypto-prices topic)"
    echo "3. Redis CLI"
    echo "4. Elasticsearch Query"
    echo "5. Back to main menu"
    read -p "Select option (1-5): " cli_option
    
    case $cli_option in
        1)
            print_header "Kafka Topics"
            docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
            ;;
        2)
            print_header "Kafka Consumer (crypto-prices)"
            print_info "Consuming from the beginning. Press Ctrl+C to exit."
            docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic crypto-prices --from-beginning
            ;;
        3)
            print_header "Redis CLI"
            docker-compose exec redis redis-cli
            ;;
        4)
            print_header "Elasticsearch Query"
            echo "Cluster Health:"
            curl -s http://localhost:9200/_cluster/health | json_pp
            echo ""
            echo "Indices:"
            curl -s http://localhost:9200/_cat/indices | head -20
            ;;
        5)
            return
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
}

show_ports() {
    print_header "Service Access Ports"
    echo ""
    echo "Service                 Port        URL"
    echo "─────────────────────────────────────────────────────────"
    echo "Zookeeper              2181        localhost:2181"
    echo "Kafka                  9092        localhost:9092"
    echo "Kafka UI               8080        http://localhost:8080"
    echo "Elasticsearch          9200        http://localhost:9200"
    echo "Kibana                 5601        http://localhost:5601"
    echo "Redis                  6379        localhost:6379"
    echo "Nest.js Backend        3000        http://localhost:3000"
    echo ""
    echo "Common URLs:"
    echo "  - Kafka UI:        http://localhost:8080"
    echo "  - Kibana:          http://localhost:5601"
    echo "  - Backend Health:  http://localhost:3000/health"
    echo "  - ES Cluster:      http://localhost:9200/_cluster/health"
}

# Main loop
while true; do
    show_menu
    
    case $choice in
        1) start_services ;;
        2) stop_services ;;
        3) view_all_logs ;;
        4) view_service_logs ;;
        5) check_health ;;
        6) restart_services ;;
        7) cleanup ;;
        8) rebuild_restart ;;
        9) cli_tools ;;
        10) show_ports ;;
        0) 
            print_info "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
done
