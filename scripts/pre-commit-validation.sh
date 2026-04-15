#!/bin/bash
# Pre-commit validation script to prevent gaps
# This script MUST pass before any feature can be marked complete

echo "🔍 MCP Author - Pre-Commit Validation"
echo "======================================="

# Track failures
FAILURES=0

# 1. Build Check
echo "📦 Checking build..."
if npm run build; then
    echo "✅ Build passed"
else
    echo "❌ Build failed"
    FAILURES=$((FAILURES + 1))
fi

# 2. Placeholder Text Check
echo "🔍 Scanning for placeholder text..."
PLACEHOLDER_FILES=$(grep -r "will be implemented\|TODO.*implement\|placeholder functionality\|coming soon" src/ dist/ --include="*.ts" --include="*.js" --exclude-dir=node_modules 2>/dev/null || true)

if [ -z "$PLACEHOLDER_FILES" ]; then
    echo "✅ No placeholder text found"
else
    echo "❌ Placeholder text detected:"
    echo "$PLACEHOLDER_FILES"
    FAILURES=$((FAILURES + 1))
fi

# 3. CLI Commands Functionality Check
echo "🔧 Testing CLI commands..."

# Test validate command
if node dist/cli.js validate example-yaml 2>&1 | grep -q "Grade: [A-F]"; then
    echo "✅ Validate command working"
else
    echo "❌ Validate command not producing grades"
    FAILURES=$((FAILURES + 1))
fi

# Test generate command help
if node dist/cli.js generate --help 2>&1 | grep -q "Generate"; then
    echo "✅ Generate command help working"
else
    echo "❌ Generate command help broken"
    FAILURES=$((FAILURES + 1))
fi

# 4. Test Suite Execution
echo "🧪 Running test suite..."
if node robustness-test-suite.js 2>&1 | grep -q "GOOD ROBUSTNESS\|EXCELLENT ROBUSTNESS"; then
    echo "✅ Test suite shows good robustness"
else
    echo "❌ Test suite shows poor robustness or failed"
    FAILURES=$((FAILURES + 1))
fi

# 5. Core Functionality Check
echo "📋 Checking core functionality..."

# Check validation system exists and works
if [ -f "src/cli/commands/validate.ts" ] && ! grep -q "will be implemented" "src/cli/commands/validate.ts"; then
    echo "✅ Validation system implemented"
else
    echo "❌ Validation system missing or contains placeholders"
    FAILURES=$((FAILURES + 1))
fi

# Check template generation works for both languages
if [ -f "src/templates/server.ts.hbs" ] && [ -f "src/templates/server.py.hbs" ]; then
    echo "✅ Both TypeScript and Python templates exist"
else
    echo "❌ Missing TypeScript or Python templates"
    FAILURES=$((FAILURES + 1))
fi

# Final Results
echo "======================================="
if [ $FAILURES -eq 0 ]; then
    echo "🎉 ALL CHECKS PASSED - Feature ready for completion"
    echo "✅ Build successful"
    echo "✅ No placeholder text"
    echo "✅ CLI commands functional"
    echo "✅ Test suite robust"
    echo "✅ Core functionality complete"
    exit 0
else
    echo "❌ $FAILURES CHECKS FAILED - Feature NOT ready"
    echo ""
    echo "🚨 CRITICAL: Fix all failures before marking feature complete"
    echo "📋 See docs/DEVELOPMENT-CHECKLIST.md for requirements"
    exit 1
fi