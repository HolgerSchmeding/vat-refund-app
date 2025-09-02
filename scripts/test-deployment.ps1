# 🚀 Local Deployment Test Script (PowerShell)
# This script simulates the CI/CD pipeline locally for testing on Windows

param(
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$SkipValidation,
    [switch]$DryDeploy,
    [switch]$Help
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$WarningColor = "Yellow"
$InfoColor = "Cyan"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $InfoColor
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $SuccessColor
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $WarningColor
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $ErrorColor
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    if (-not (Test-Command "node")) {
        Write-Error "Node.js is not installed"
        exit 1
    }
    
    if (-not (Test-Command "npm")) {
        Write-Error "npm is not installed"
        exit 1
    }
    
    if (-not (Test-Command "firebase")) {
        Write-Error "Firebase CLI is not installed. Run: npm install -g firebase-tools"
        exit 1
    }
    
    # Check Node.js version
    $nodeVersion = (node --version) -replace 'v', '' -split '\.' | Select-Object -First 1
    if ([int]$nodeVersion -lt 18) {
        Write-Error "Node.js version 18 or higher is required. Current: $(node --version)"
        exit 1
    }
    
    Write-Success "All prerequisites met"
}

# Step 1: Test Pipeline
function Invoke-Tests {
    Write-Status "🧪 Running Test Pipeline..."
    
    Set-Location functions
    
    # Install dependencies
    Write-Status "Installing dependencies..."
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
    
    # Start Firebase emulators in background
    Write-Status "Starting Firebase emulators..."
    $emulatorJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        firebase emulators:start --project=demo-vat-refund-app
    }
    
    # Wait for emulators to start
    Write-Status "Waiting for emulators to start..."
    Start-Sleep -Seconds 15
    
    # Check if emulators are running
    try {
        $firestoreResponse = Invoke-WebRequest -Uri "http://localhost:8080" -UseBasicParsing -TimeoutSec 5
        $storageResponse = Invoke-WebRequest -Uri "http://localhost:9199" -UseBasicParsing -TimeoutSec 5
        Write-Success "Emulators started successfully"
    }
    catch {
        Write-Error "Emulators failed to start"
        Stop-Job $emulatorJob -PassThru | Remove-Job
        exit 1
    }
    
    try {
        # Run tests
        Write-Status "Running unit tests..."
        npm run test:unit
        if ($LASTEXITCODE -ne 0) {
            throw "Unit tests failed"
        }
        
        Write-Status "Running integration tests..."
        npm run test:integration
        if ($LASTEXITCODE -ne 0) {
            throw "Integration tests failed"
        }
        
        Write-Status "Running smoke tests..."
        npm run test:smoke
        if ($LASTEXITCODE -ne 0) {
            throw "Smoke tests failed"
        }
        
        # Generate coverage report
        Write-Status "Generating coverage report..."
        npm run test:all
        if ($LASTEXITCODE -ne 0) {
            throw "Coverage generation failed"
        }
        
        Write-Success "All tests passed!"
    }
    catch {
        Write-Error $_.Exception.Message
        Stop-Job $emulatorJob -PassThru | Remove-Job
        exit 1
    }
    finally {
        # Stop emulators
        Write-Status "Stopping emulators..."
        Stop-Job $emulatorJob -PassThru | Remove-Job
        Start-Sleep -Seconds 2
    }
    
    Set-Location ..
}

# Step 2: Build Pipeline
function Invoke-Build {
    Write-Status "🏗️ Running Build Pipeline..."
    
    # Build frontend
    if (Test-Path "frontend") {
        Write-Status "Building frontend..."
        Set-Location frontend
        npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install frontend dependencies"
            exit 1
        }
        
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend build failed"
            exit 1
        }
        Set-Location ..
        Write-Success "Frontend build completed"
    }
    else {
        Write-Warning "Frontend directory not found, skipping frontend build"
    }
    
    # Build backend
    Write-Status "Building backend..."
    Set-Location functions
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Backend build failed"
        exit 1
    }
    Set-Location ..
    Write-Success "Backend build completed"
}

# Step 3: Deployment Validation
function Test-DeploymentValidation {
    Write-Status "✅ Validating Deployment Configuration..."
    
    # Check Firebase project
    Write-Status "Checking Firebase project configuration..."
    try {
        firebase projects:list | Out-Null
    }
    catch {
        Write-Error "Not authenticated with Firebase. Run: firebase login"
        exit 1
    }
    
    # Check if production project exists
    $projects = firebase projects:list
    if ($projects -match "eu-vat-refund-app-prod") {
        Write-Success "Production project found"
    }
    else {
        Write-Warning "Production project 'eu-vat-refund-app-prod' not found"
        Write-Warning "Create it with: firebase projects:create eu-vat-refund-app-prod"
    }
    
    # Validate configuration files
    Write-Status "Validating configuration files..."
    
    $requiredFiles = @("firebase.json", "firestore.rules", "storage.rules", ".github/workflows/deploy.yml")
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            Write-Error "$file not found"
            exit 1
        }
    }
    
    Write-Success "All configuration files validated"
}

# Step 4: Dry Run Deployment
function Invoke-DryRunDeploy {
    Write-Status "🚀 Running Dry Deployment..."
    
    # Use development project for dry run
    try {
        firebase use demo-vat-refund-app
    }
    catch {
        Write-Warning "Development project not configured"
        return
    }
    
    # Deploy to development project (dry run)
    Write-Status "Deploying to development project (dry run)..."
    
    try {
        # Deploy hosting
        if (Test-Path "frontend/dist") {
            firebase deploy --only hosting --project=demo-vat-refund-app
            if ($LASTEXITCODE -ne 0) {
                throw "Hosting deployment failed"
            }
            Write-Success "Hosting deployed successfully"
        }
        
        # Deploy functions
        firebase deploy --only functions --project=demo-vat-refund-app
        if ($LASTEXITCODE -ne 0) {
            throw "Functions deployment failed"
        }
        Write-Success "Functions deployed successfully"
        
        # Deploy rules
        firebase deploy --only firestore:rules,storage --project=demo-vat-refund-app
        if ($LASTEXITCODE -ne 0) {
            throw "Rules deployment failed"
        }
        Write-Success "Security rules deployed successfully"
    }
    catch {
        Write-Error $_.Exception.Message
        exit 1
    }
}

# Show help
function Show-Help {
    Write-Host @"
🚀 Local Deployment Test Script (PowerShell)
EU VAT Refund Application CI/CD

Usage: .\test-deployment.ps1 [options]

Options:
  -SkipTests        Skip test execution
  -SkipBuild        Skip build process
  -SkipValidation   Skip deployment validation
  -DryDeploy        Run deployment to development project
  -Help             Show this help message

Examples:
  .\test-deployment.ps1                    # Run full pipeline
  .\test-deployment.ps1 -SkipTests         # Skip tests
  .\test-deployment.ps1 -DryDeploy         # Include dry deployment
"@
}

# Main execution
function Main {
    if ($Help) {
        Show-Help
        exit 0
    }
    
    Write-Host @"
╔══════════════════════════════════════════════╗
║        🚀 Local Deployment Test Script       ║
║     EU VAT Refund Application CI/CD          ║
╚══════════════════════════════════════════════╝
"@ -ForegroundColor $InfoColor
    
    # Record start time
    $startTime = Get-Date
    
    try {
        # Run pipeline steps
        Test-Prerequisites
        
        if (-not $SkipTests) {
            Invoke-Tests
        }
        else {
            Write-Warning "Skipping tests"
        }
        
        if (-not $SkipBuild) {
            Invoke-Build
        }
        else {
            Write-Warning "Skipping build"
        }
        
        if (-not $SkipValidation) {
            Test-DeploymentValidation
        }
        else {
            Write-Warning "Skipping validation"
        }
        
        if ($DryDeploy) {
            Invoke-DryRunDeploy
        }
        
        # Calculate execution time
        $endTime = Get-Date
        $duration = [math]::Round(($endTime - $startTime).TotalSeconds)
        
        Write-Host @"
╔══════════════════════════════════════════════╗
║            🎉 Pipeline Completed!            ║
║                                              ║
║  All steps executed successfully in $duration s      ║
║                                              ║
║  Ready for production deployment! 🚀         ║
╚══════════════════════════════════════════════╝
"@ -ForegroundColor $SuccessColor
        
        Write-Success "Local deployment test completed successfully!"
        Write-Status "Next steps:"
        Write-Host "  1. Commit and push changes to trigger GitHub Actions"
        Write-Host "  2. Monitor deployment at: https://github.com/your-org/vat-refund-app/actions"
        Write-Host "  3. Check production at: https://eu-vat-refund-app-prod.web.app"
    }
    catch {
        Write-Error "Pipeline failed: $($_.Exception.Message)"
        exit 1
    }
}

# Handle script interruption
trap {
    Write-Error "Script interrupted"
    # Stop any running jobs
    Get-Job | Stop-Job -PassThru | Remove-Job
    exit 1
}

# Run main function
Main
