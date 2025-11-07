#!/bin/bash
# K1.node1 Governance Health Check
# Daily compliance monitoring

PROJECT_ROOT=$(git rev-parse --show-toplevel)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        K1.node1 Governance Compliance Health Check         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Root Level File Count
ROOT_COUNT=$(find "$PROJECT_ROOT" -maxdepth 1 -type f -name "*.md" -o -name "*.json" -o -name "*.ini" | grep -v "^\." | wc -l)
ALLOWED=5
echo "[1/5] Root-level files: $ROOT_COUNT / $ALLOWED"
if [ $ROOT_COUNT -le $ALLOWED ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL ($((ROOT_COUNT - ALLOWED)) excess files)${NC}"
fi
echo ""

# 2. Orphaned Docs Check
echo "[2/5] Checking for orphaned documentation..."
ORPHANED=0
for doc in $(find "$PROJECT_ROOT/docs" -type f -name "*.md" 2>/dev/null); do
  FILENAME=$(basename "$doc")
  if ! grep -r "$FILENAME" "$PROJECT_ROOT/TASKS.md" "$PROJECT_ROOT/README.md" 2>/dev/null >/dev/null; then
    ORPHANED=$((ORPHANED + 1))
  fi
done

if [ $ORPHANED -eq 0 ]; then
  echo -e "${GREEN}✓ PASS - No orphaned docs${NC}"
else
  echo -e "${YELLOW}⚠ WARNING - $ORPHANED orphaned docs found${NC}"
fi
echo ""

# 3. Task List Status
echo "[3/5] Task tracking status..."
if [ -f "$PROJECT_ROOT/TASKS.md" ]; then
  TOTAL_TASKS=$(grep -c "^###" "$PROJECT_ROOT/TASKS.md" 2>/dev/null || echo 0)
  PENDING=$(grep -c "PENDING" "$PROJECT_ROOT/TASKS.md" 2>/dev/null || echo 0)
  IN_PROGRESS=$(grep -c "IN-PROGRESS" "$PROJECT_ROOT/TASKS.md" 2>/dev/null || echo 0)
  DONE=$(grep -c "DONE" "$PROJECT_ROOT/TASKS.md" 2>/dev/null || echo 0)

  echo "Tasks: $TOTAL_TASKS total | $PENDING pending | $IN_PROGRESS in-progress | $DONE done"
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL - TASKS.md not found${NC}"
fi
echo ""

# 4. Documentation Metadata
echo "[4/5] Metadata compliance..."
NO_METADATA=$(find "$PROJECT_ROOT/docs" -type f -name "*.md" ! -exec grep -l "^---" {} \; 2>/dev/null | wc -l)
TOTAL_DOCS=$(find "$PROJECT_ROOT/docs" -type f -name "*.md" 2>/dev/null | wc -l)

if [ $TOTAL_DOCS -gt 0 ]; then
  COMPLIANCE=$(( (TOTAL_DOCS - NO_METADATA) * 100 / TOTAL_DOCS ))
  echo "Metadata compliance: $COMPLIANCE% ($TOTAL_DOCS docs)"
  if [ $COMPLIANCE -ge 80 ]; then
    echo -e "${GREEN}✓ PASS${NC}"
  else
    echo -e "${YELLOW}⚠ WARNING - Below 80% threshold${NC}"
  fi
else
  echo -e "${GREEN}✓ PASS - No docs to check${NC}"
fi
echo ""

# 5. Git Hook Status
echo "[5/5] Pre-commit hook status..."
if [ -x "$PROJECT_ROOT/.git/hooks/pre-commit" ]; then
  echo -e "${GREEN}✓ PASS - Hook installed and executable${NC}"
else
  echo -e "${RED}✗ FAIL - Hook not executable${NC}"
fi
echo ""

# Summary & Recommendations
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Summary & Next Steps                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ $ROOT_COUNT -le $ALLOWED ] && [ $COMPLIANCE -ge 80 ] && [ -x "$PROJECT_ROOT/.git/hooks/pre-commit" ]; then
  echo -e "${GREEN}✓ Governance is healthy. Ready to execute.${NC}"
else
  echo -e "${YELLOW}⚠ Issues detected. Recommendations:${NC}"
  if [ $ROOT_COUNT -gt $ALLOWED ]; then
    echo "  - Move excess root files to docs/ or Implementation.plans/"
  fi
  if [ $COMPLIANCE -lt 80 ]; then
    echo "  - Add YAML front matter to docs (use tools/governance/add_frontmatter.sh)"
  fi
  if [ ! -x "$PROJECT_ROOT/.git/hooks/pre-commit" ]; then
    echo "  - Make pre-commit hook executable: chmod +x .git/hooks/pre-commit"
  fi
fi
echo ""
echo "Run daily: ./tools/governance/governance_health.sh"
echo ""
