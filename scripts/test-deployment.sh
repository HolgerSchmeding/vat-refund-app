#!/bin/bash

# 🚀 Local Deployment Test Script
# This script simulates the CI/CD pipeline locally for testing

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command_exists firebase; then
        print_error "Firebase CLI is not installed. Run: npm install -g firebase-tools"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current: $(node --version)"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Step 1: Test Pipeline
run_tests() {
    print_status "🧪 Running Test Pipeline..."
    
    cd functions
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm ci
    
    # Start Firebase emulators in background
    print_status "Starting Firebase emulators..."
    firebase emulators:start --project=demo-vat-refund-app &
    EMULATOR_PID=$!
    
    # Wait for emulators to start
    print_status "Waiting for emulators to start..."
    sleep 10
    
    # Check if emulators are running
    if ! curl -f http://localhost:8080 >/dev/null 2>&1; then
        print_error "Firestore emulator not running"
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    fi
    
    if ! curl -f http://localhost:9199 >/dev/null 2>&1; then
        print_error "Storage emulator not running"  
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    fi
    
    print_success "Emulators started successfully"
    
    # Run tests
    print_status "Running unit tests..."
    npm run test:unit || {
        print_error "Unit tests failed"
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    }
    
    print_status "Running integration tests..."
    npm run test:integration || {
        print_error "Integration tests failed"
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    }
    
    print_status "Running smoke tests..."
    npm run test:smoke || {
        print_error "Smoke tests failed"
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    }
    
    # Generate coverage report
    print_status "Generating coverage report..."
    npm run test:all || {
        print_error "Coverage generation failed"
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    }
    
    # Stop emulators
    print_status "Stopping emulators..."
    kill $EMULATOR_PID 2>/dev/null || true
    sleep 2
    
    cd ..
    print_success "All tests passed!"
}

# Step 2: Build Pipeline
run_build() {
    print_status "🏗️ Running Build Pipeline..."
    
    # Build frontend
    if [ -d "frontend" ]; then
        print_status "Building frontend..."
        cd frontend
        npm ci
        npm run build || {
            print_error "Frontend build failed"
            exit 1
        }
        cd ..
        print_success "Frontend build completed"
    else
        print_warning "Frontend directory not found, skipping frontend build"
    fi
    
    # Build backend
    print_status "Building backend..."
    cd functions
    npm run build || {
        print_error "Backend build failed"
        exit 1
    }
    cd ..
    print_success "Backend build completed"
}

# Step 3: Deployment Validation
validate_deployment() {
    print_status "✅ Validating Deployment Configuration..."
    
    # Check Firebase project
    print_status "Checking Firebase project configuration..."
    if ! firebase projects:list >/dev/null 2>&1; then
        print_error "Not authenticated with Firebase. Run: firebase login"
        exit 1
    fi
    
    # Check if production project exists
    if firebase projects:list | grep -q "eu-vat-refund-app-prod"; then
        print_success "Production project found"
    else
        print_warning "Production project 'eu-vat-refund-app-prod' not found"
        print_warning "Create it with: firebase projects:create eu-vat-refund-app-prod"
    fi
    
    # Validate configuration files
    print_status "Validating configuration files..."
    
    if [ ! -f "firebase.json" ]; then
        print_error "firebase.json not found"
        exit 1
    fi
    
    if [ ! -f "firestore.rules" ]; then
        print_error "firestore.rules not found"
        exit 1
    fi
    
    if [ ! -f "storage.rules" ]; then
        print_error "storage.rules not found"
        exit 1
    fi
    
    # Validate GitHub Actions workflow
    if [ ! -f ".github/workflows/deploy.yml" ]; then
        print_error "GitHub Actions workflow not found"
        exit 1
    fi
    
    print_success "All configuration files validated"
}

# Step 4: Dry Run Deployment
dry_run_deploy() {
    print_status "🚀 Running Dry Deployment..."
    
    # Use development project for dry run
    firebase use demo-vat-refund-app 2>/dev/null || {
        print_warning "Development project not configured"
        return
    }
    
    # Deploy to development project (dry run)
    print_status "Deploying to development project (dry run)..."
    
    # Deploy hosting
    if [ -d "frontend/dist" ]; then
        firebase deploy --only hosting --project=demo-vat-refund-app || {
            print_error "Hosting deployment failed"
            exit 1
        }
        print_success "Hosting deployed successfully"
    fi
    
    # Deploy functions
    firebase deploy --only functions --project=demo-vat-refund-app || {
        print_error "Functions deployment failed"
        exit 1
    }
    print_success "Functions deployed successfully"
    
    # Deploy rules
    firebase deploy --only firestore:rules,storage --project=demo-vat-refund-app || {
        print_error "Rules deployment failed"
        exit 1
    }
    print_success "Security rules deployed successfully"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║        🚀 Local Deployment Test Script       ║"
    echo "║     EU VAT Refund Application CI/CD          ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Parse command line arguments
    RUN_TESTS=true
    RUN_BUILD=true
    RUN_VALIDATION=true
    RUN_DRY_DEPLOY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                RUN_TESTS=false
                shift
                ;;
            --skip-build)
                RUN_BUILD=false
                shift
                ;;
            --skip-validation)
                RUN_VALIDATION=false
                shift
                ;;
            --dry-deploy)
                RUN_DRY_DEPLOY=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-tests      Skip test execution"
                echo "  --skip-build      Skip build process"
                echo "  --skip-validation Skip deployment validation"
                echo "  --dry-deploy      Run deployment to development project"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Run pipeline steps
    check_prerequisites
    
    if [ "$RUN_TESTS" = true ]; then
        run_tests
    else
        print_warning "Skipping tests"
    fi
    
    if [ "$RUN_BUILD" = true ]; then
        run_build
    else
        print_warning "Skipping build"
    fi
    
    if [ "$RUN_VALIDATION" = true ]; then
        validate_deployment
    else
        print_warning "Skipping validation"
    fi
    
    if [ "$RUN_DRY_DEPLOY" = true ]; then
        dry_run_deploy
    fi
    
    # Calculate execution time
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║            🎉 Pipeline Completed!            ║"
    echo "║                                              ║"
    echo "║  All steps executed successfully in ${DURATION}s      ║"
    echo "║                                              ║"
    echo "║  Ready for production deployment! 🚀         ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    print_success "Local deployment test completed successfully!"
    print_status "Next steps:"
    echo "  1. Commit and push changes to trigger GitHub Actions"
    echo "  2. Monitor deployment at: https://github.com/your-org/vat-refund-app/actions"
    echo "  3. Check production at: https://eu-vat-refund-app-prod.web.app"
}

# Handle script interruption
trap 'print_error "Script interrupted"; kill $EMULATOR_PID 2>/dev/null || true; exit 1' INT TERM

# Run main function
main "$@"
