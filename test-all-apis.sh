#!/bin/bash

echo "Ì∑™ Comprehensive PrintPress Suite API Testing..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}‚úÖ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}‚ùå FAIL${NC}"
        ((FAILED++))
    fi
}

# Function to test endpoint
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local expected_code=$4
    local description=$5
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $AUTH_TOKEN" "$url")
    elif [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH_TOKEN" -d "$data" "$url")
    else
        response=$(curl -s -w "%{http_code}" -X "$method" -H "Authorization: Bearer $AUTH_TOKEN" "$url")
    fi
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" = "$expected_code" ]; then
        print_status 0
    else
        echo -e "${RED}Expected $expected_code but got $http_code${NC}"
        echo "Response: $response_body"
        print_status 1
    fi
}

# Test database connection
echo -e "${BLUE}1. Testing Database Connection...${NC}"
cd apps/backend
node -e "
import { testConnection } from './src/config/database.js';
testConnection().then(connected => {
    if (connected) {
        console.log('‚úÖ Database connection successful');
        process.exit(0);
    } else {
        console.log('‚ùå Database connection failed');
        process.exit(1);
    }
});
" > /dev/null 2>&1
print_status $?

# Start server in background
echo -e "${BLUE}2. Starting Server...${NC}"
npm run dev > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 10

# Test health endpoint
echo -e "${BLUE}3. Testing Health Endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    print_status 0
else
    echo -e "${RED}Health check failed${NC}"
    print_status 1
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Get authentication token
echo -e "${BLUE}4. Getting Authentication Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@printpress.com","password":"admin!123"}' \
  http://localhost:5000/api/auth/login)

HTTP_CODE="${LOGIN_RESPONSE: -3}"
RESPONSE_BODY="${LOGIN_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    AUTH_TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ ! -z "$AUTH_TOKEN" ]; then
        echo -e "${GREEN}‚úÖ Token obtained successfully${NC}"
    else
        echo -e "${RED}‚ùå Failed to extract token${NC}"
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
else
    echo -e "${RED}‚ùå Login failed${NC}"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo -e "${BLUE}5. Testing All API Endpoints...${NC}"
echo "=================================================="

# Ì¥ê AUTH ENDPOINTS
echo -e "${YELLOW}Ì¥ê AUTHENTICATION ENDPOINTS${NC}"
test_endpoint "GET" "http://localhost:5000/api/auth/me" "" "200" "Get Current User"
test_endpoint "PUT" "http://localhost:5000/api/auth/profile" '{"name":"System Admin","email":"admin@printpress.com"}' "200" "Update Profile"

# Ì±• USER MANAGEMENT ENDPOINTS
echo -e "${YELLOW}Ì±• USER MANAGEMENT ENDPOINTS${NC}"
test_endpoint "GET" "http://localhost:5000/api/users" "" "200" "Get All Users"

# Create a test worker user
WORKER_DATA='{
  "name": "Test Worker",
  "email": "testworker@printpress.com",
  "role": "worker",
  "phone": "+2348012345678",
  "hourlyRate": 1500,
  "paymentMethod": "bank_transfer",
  "bankName": "GT Bank",
  "accountNumber": "0123456789",
  "accountName": "Test Worker"
}'
test_endpoint "POST" "http://localhost:5000/api/users" "$WORKER_DATA" "201" "Create Worker User"

# Get the user ID for subsequent tests
USERS_RESPONSE=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:5000/api/users")
USER_ID=$(echo "$USERS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$USER_ID" ]; then
    test_endpoint "GET" "http://localhost:5000/api/users/$USER_ID" "" "200" "Get User by ID"
    test_endpoint "PUT" "http://localhost:5000/api/users/$USER_ID" '{"name":"Updated Worker","role":"worker"}' "200" "Update User"
else
    echo -e "${RED}‚ùå Could not get user ID for testing${NC}"
fi

# Ì≥ã JOB MANAGEMENT ENDPOINTS
echo -e "${YELLOW}Ì≥ã JOB MANAGEMENT ENDPOINTS${NC}"
test_endpoint "GET" "http://localhost:5000/api/jobs" "" "200" "Get All Jobs"

# Create a test job
JOB_DATA='{
  "customer_name": "Test Customer",
  "customer_phone": "+2348012345679",
  "customer_email": "customer@example.com",
  "description": "Test job for API testing",
  "total_cost": 15000,
  "date_requested": "2024-01-15",
  "delivery_deadline": "2024-01-20",
  "mode_of_payment": "cash"
}'
test_endpoint "POST" "http://localhost:5000/api/jobs" "$JOB_DATA" "201" "Create New Job"

# Get the job ID for subsequent tests
JOBS_RESPONSE=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:5000/api/jobs")
JOB_ID=$(echo "$JOBS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
TICKET_ID=$(echo "$JOBS_RESPONSE" | grep -o '"ticket_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$JOB_ID" ]; then
    test_endpoint "GET" "http://localhost:5000/api/jobs/$JOB_ID" "" "200" "Get Job by ID"
    
    # Update job status
    STATUS_DATA='{
      "status": "in_progress",
      "materials": [
        {
          "material_name": "A4 Paper",
          "paper_size": "A4",
          "paper_type": "Glossy",
          "grammage": 120,
          "quantity": 10,
          "unit_cost": 50,
          "update_inventory": false
        }
      ],
      "waste": [
        {
          "type": "paper_waste",
          "description": "Test waste entry",
          "quantity": 2,
          "unit_cost": 50,
          "total_cost": 100,
          "waste_reason": "setup_waste"
        }
      ]
    }'
    test_endpoint "PATCH" "http://localhost:5000/api/jobs/$JOB_ID/status" "$STATUS_DATA" "200" "Update Job Status"
fi

if [ ! -z "$TICKET_ID" ]; then
    test_endpoint "GET" "http://localhost:5000/api/jobs/ticket/$TICKET_ID" "" "200" "Get Job by Ticket ID"
fi

# Ì¥î NOTIFICATION ENDPOINTS
echo -e "${YELLOW}Ì¥î NOTIFICATION ENDPOINTS${NC}"
test_endpoint "GET" "http://localhost:5000/api/notifications" "" "200" "Get Notifications"
test_endpoint "GET" "http://localhost:5000/api/notifications/unread-count" "" "200" "Get Unread Count"

# Get notification ID for mark as read test
NOTIFICATIONS_RESPONSE=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:5000/api/notifications")
NOTIFICATION_ID=$(echo "$NOTIFICATIONS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$NOTIFICATION_ID" ]; then
    test_endpoint "PATCH" "http://localhost:5000/api/notifications/$NOTIFICATION_ID/read" "" "200" "Mark Notification as Read"
fi

test_endpoint "PATCH" "http://localhost:5000/api/notifications/mark-all-read" "" "200" "Mark All Notifications as Read"

# Ì¥å WEBSOCKET & HEALTH
echo -e "${YELLOW}Ì¥å WEBSOCKET & HEALTH ENDPOINTS${NC}"
test_endpoint "GET" "http://localhost:5000/api/websocket/status" "" "200" "Get WebSocket Status"

# Cleanup - Delete test user if created
if [ ! -z "$USER_ID" ]; then
    echo -e "${YELLOW}Ì∑π Cleaning up test data...${NC}"
    curl -s -X DELETE -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:5000/api/users/$USER_ID" > /dev/null
    echo -e "${GREEN}‚úÖ Test user cleaned up${NC}"
fi

# Stop server
echo -e "${BLUE}6. Stopping Server...${NC}"
kill $SERVER_PID 2>/dev/null
sleep 2

# Final Results
echo "=================================================="
echo -e "${BLUE}Ì≥ä TEST RESULTS:${NC}"
echo -e "${GREEN}‚úÖ PASSED: $PASSED${NC}"
echo -e "${RED}‚ùå FAILED: $FAILED${NC}"
echo "=================================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Ìæâ All tests passed! Your API is working correctly.${NC}"
else
    echo -e "${YELLOW}‚ö†Ô∏è  Some tests failed. Check the server logs for details.${NC}"
    echo -e "${YELLOW}Server logs saved to: server.log${NC}"
fi

# Show server logs if any failures
if [ $FAILED -gt 0 ]; then
    echo -e "${YELLOW}Last 10 lines of server logs:${NC}"
    tail -10 server.log
fi
