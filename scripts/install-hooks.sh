#!/bin/bash
#
# Install Git hooks for Chrome Tab Manager
#
# Usage: ./scripts/install-hooks.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_SOURCE="$PROJECT_ROOT/.git-hooks"
HOOKS_TARGET="$PROJECT_ROOT/.git/hooks"

echo "🔧 Installing Git hooks..."
echo ""

# Check if .git directory exists
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "❌ Error: .git directory not found."
  echo "   Make sure you're in a Git repository."
  exit 1
fi

# Check if hooks source directory exists
if [ ! -d "$HOOKS_SOURCE" ]; then
  echo "❌ Error: Hooks source directory not found: $HOOKS_SOURCE"
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_TARGET"

# Install pre-commit hook
if [ -f "$HOOKS_SOURCE/pre-commit" ]; then
  echo "📋 Installing pre-commit hook..."
  cp "$HOOKS_SOURCE/pre-commit" "$HOOKS_TARGET/pre-commit"
  chmod +x "$HOOKS_TARGET/pre-commit"
  echo "   ✅ pre-commit hook installed"
else
  echo "⚠️  Warning: pre-commit hook not found in $HOOKS_SOURCE"
fi

echo ""
echo "✨ Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will:"
echo "  • Run Jest tests for changed JavaScript files"
echo "  • Run Pylint for changed Python files"
echo "  • Validate manifest.json if changed"
echo ""
echo "To skip hooks temporarily, use: git commit --no-verify"
echo ""
