#!/bin/bash

echo ""
echo "=========================================="
echo "K1.node1 File Naming Validation"
echo "=========================================="
echo ""

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo "✓ No files to validate"
    echo ""
    exit 0
fi

ERRORS=0

# Validate each file
for FILE in $STAGED_FILES; do
    FILENAME=$(basename "$FILE")
    DIR=$(dirname "$FILE")
    
    # Skip validation for files outside Conductor directory
    if [[ ! "$DIR" =~ ^Conductor ]]; then
        echo "✓ $FILE (outside Conductor, skipped)"
        continue
    fi
    
    # Skip validation for files in scripts/ directory (executables)
    if [[ "$DIR" =~ ^Conductor/scripts ]]; then
        echo "✓ $FILE (scripts directory, skipped)"
        continue
    fi
    
    # Exceptions: allow these files as-is
    case "$FILENAME" in
        .gitignore | conductor.json | README.md | CLAUDE.md | pre-commit)
            echo "✓ $FILE (exception)"
            continue
            ;;
    esac
    
    # Pattern: [ProjectCode]_[Type][_modifiers]_v[number].[number]_[YYYYMMDD].[ext]
    # Allow: K1N*, K1NCI*, K1NCond*, K1NTask* as project codes
    # Allow types with modifiers: GUIDE_HOOKS, ANNEX_A, etc
    # Require: v[number].[number] version
    # Require: _[YYYYMMDD] date
    
    if [[ "$FILENAME" =~ ^K1N[A-Za-z]*_[A-Z][A-Z0-9_]*_v[0-9]+\.[0-9]+_[0-9]{8}\.[a-z]+$ ]]; then
        echo "✓ $FILE"
    else
        echo "✗ INVALID: $FILENAME"
        echo "  Format: [ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]"
        echo "  Example: K1NCond_GUIDE_HOOKS_v1.0_20251108.md"
        ((ERRORS++))
    fi
done

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All Conductor files comply with naming standard"
    echo "=========================================="
    echo ""
    exit 0
else
    echo "❌ COMMIT BLOCKED - $ERRORS file(s) have naming violations"
    echo "=========================================="
    echo ""
    echo "Fix filenames in Conductor/ to match: [ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]"
    echo ""
    exit 1
fi
