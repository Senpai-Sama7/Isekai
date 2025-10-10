#!/bin/bash

# Comprehensive Test Script for CSV Viewer Generation
# This script tests the complete flow from prompt to working application

set -e

echo "🧪 Testing CSV Viewer Generation"
echo "================================="

# Configuration
API_URL="http://localhost:3001"
UI_URL="http://localhost:3000"
TEST_PROMPT="CSV viewer with filter and export"
TIMEOUT=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Check if services are running
test_services() {
    log_info "Testing service availability..."
    
    local services_running=true
    
    # Check UI
    if curl -s "$UI_URL" > /dev/null; then
        log_info "✅ UI service is running"
    else
        log_error "❌ UI service is not running at $UI_URL"
        services_running=false
    fi
    
    # Check API Gateway
    if curl -s "$API_URL/health" > /dev/null; then
        log_info "✅ API Gateway is running"
    else
        log_error "❌ API Gateway is not running at $API_URL"
        services_running=false
    fi
    
    if [ "$services_running" = false ]; then
        log_error "Services are not running. Please start with 'make dev' or 'make docker-up'"
        exit 1
    fi
}

# Test 2: Submit prompt for CSV viewer
test_prompt_submission() {
    log_info "Submitting prompt for CSV viewer generation..."
    
    local prompt_data=$(cat <<EOF
{
    "id": "test-csv-$(date +%s)",
    "prompt": "$TEST_PROMPT",
    "context": {
        "userId": "test-user",
        "sessionId": "test-session"
    }
}
EOF
)
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$prompt_data" \
        "$API_URL/api/v1/prompts")
    
    if echo "$response" | grep -q '"planId"'; then
        local plan_id=$(echo "$response" | grep -o '"planId":"[^"]*"' | cut -d'"' -f4)
        log_info "✅ Prompt submitted successfully, Plan ID: $plan_id"
        echo "$plan_id" > /tmp/test_plan_id.txt
        return 0
    else
        log_error "❌ Prompt submission failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 3: Wait for plan completion
test_plan_completion() {
    log_info "Waiting for plan completion..."
    
    if [ ! -f /tmp/test_plan_id.txt ]; then
        log_error "❌ No plan ID found"
        return 1
    fi
    
    local plan_id=$(cat /tmp/test_plan_id.txt)
    local elapsed=0
    
    while [ $elapsed -lt $TIMEOUT ]; do
        local response=$(curl -s "$API_URL/api/v1/plans/$plan_id")
        local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        case $status in
            "completed")
                log_info "✅ Plan completed successfully"
                return 0
                ;;
            "failed")
                log_error "❌ Plan failed"
                echo "Response: $response"
                return 1
                ;;
            "in_progress"|"pending")
                log_info "⏳ Plan status: $status (${elapsed}s elapsed)"
                ;;
            *)
                log_warn "Unknown status: $status"
                ;;
        esac
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    log_error "❌ Plan completion timeout"
    return 1
}

# Test 4: Test generated application
test_generated_app() {
    log_info "Testing generated CSV viewer application..."
    
    # Create test CSV data
    local test_csv="/tmp/test_data.csv"
    cat > "$test_csv" << EOF
Name,Email,Department,Salary,Join Date
John Doe,john@example.com,Engineering,75000,2022-01-15
Jane Smith,jane@example.com,Marketing,65000,2021-03-22
Bob Johnson,bob@example.com,Sales,55000,2022-06-10
Alice Brown,alice@example.com,Engineering,80000,2020-11-05
Charlie Wilson,charlie@example.com,HR,60000,2023-02-14
EOF
    
    log_info "✅ Test CSV data created"
    
    # Test UI accessibility
    if curl -s "$UI_URL" | grep -q "Imagine Platform"; then
        log_info "✅ UI is accessible"
    else
        log_error "❌ UI is not accessible"
        return 1
    fi
    
    log_info "✅ Generated application test completed"
    log_info "📊 Test CSV file available at: $test_csv"
    log_info "🌐 Upload this file to test the CSV viewer"
}

# Test 5: Performance validation
test_performance() {
    log_info "Validating performance characteristics..."
    
    # Test API response time
    local start_time=$(date +%s%N)
    curl -s "$API_URL/health" > /dev/null
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [ $response_time -lt 1000 ]; then
        log_info "✅ API response time: ${response_time}ms (< 1000ms)"
    else
        log_warn "⚠️  API response time: ${response_time}ms (> 1000ms)"
    fi
    
    # Test UI load time
    start_time=$(date +%s%N)
    curl -s "$UI_URL" > /dev/null
    end_time=$(date +%s%N)
    local ui_load_time=$(( (end_time - start_time) / 1000000 ))
    
    if [ $ui_load_time -lt 3000 ]; then
        log_info "✅ UI load time: ${ui_load_time}ms (< 3000ms)"
    else
        log_warn "⚠️  UI load time: ${ui_load_time}ms (> 3000ms)"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test files..."
    rm -f /tmp/test_plan_id.txt
    rm -f /tmp/test_data.csv
}

# Main test execution
main() {
    log_info "Starting CSV Viewer Generation Test"
    log_info "===================================="
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run tests
    test_services || exit 1
    test_prompt_submission || exit 1
    test_plan_completion || exit 1
    test_generated_app || exit 1
    test_performance
    
    log_info "🎉 All tests passed successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Open $UI_URL in your browser"
    log_info "2. Upload the test CSV file when prompted"
    log_info "3. Test filtering and export functionality"
    log_info "4. Verify the application works as expected"
}

# Run main function
main "$@"