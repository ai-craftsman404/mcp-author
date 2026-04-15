#!/bin/bash
# Quick validation script for development workflow
# Faster alternative to full robustness suite

echo "⚡ MCP Author - Quick Validation"
echo "================================"

# Track failures
FAILURES=0

# 1. Build Check
echo "📦 Build check..."
if npm run build >/dev/null 2>&1; then
    echo "✅ Build passed"
else
    echo "❌ Build failed"
    FAILURES=$((FAILURES + 1))
fi

# 2. Placeholder Text Check
echo "🔍 Placeholder check..."
PLACEHOLDER_COUNT=$(grep -r "will be implemented\|TODO.*implement\|placeholder functionality" src/ dist/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)

if [ "$PLACEHOLDER_COUNT" -eq 0 ]; then
    echo "✅ No placeholder text"
else
    echo "❌ Found $PLACEHOLDER_COUNT placeholder instances"
    FAILURES=$((FAILURES + 1))
fi

# 3. Critical CLI Commands
echo "🔧 CLI functionality..."

# Validate command
if node dist/cli.js validate example-yaml 2>&1 | grep -q "Grade: [A-F]"; then
    echo "✅ Validation produces grades"
else
    echo "❌ Validation not working"
    FAILURES=$((FAILURES + 1))
fi

# 4. Core Functionality
echo "📋 Core functionality..."

if [ -f "src/templates/server.ts.hbs" ] && [ -f "src/templates/server.py.hbs" ]; then
    echo "✅ Templates exist"
else
    echo "❌ Missing templates"
    FAILURES=$((FAILURES + 1))
fi

# Results
echo "================================"
if [ $FAILURES -eq 0 ]; then
    echo "🎉 QUICK VALIDATION PASSED"
    echo ""
    echo "⚠️  For full validation, run:"
    echo "   ./scripts/pre-commit-validation.sh"
    exit 0
else
    echo "❌ $FAILURES ISSUES FOUND"
    echo ""
    echo "🚨 Fix issues before completing feature"
    exit 1
fi