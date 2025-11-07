#!/bin/bash
# K1.node1 Add YAML Front Matter to Documentation Files
# Utility for batch-adding governance metadata to existing markdown files
# Usage: ./tools/governance/add_frontmatter.sh [options]

set -e

PROJECT_ROOT=$(git rev-parse --show-toplevel)
DOCS_DIR="$PROJECT_ROOT/docs"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   K1.node1 Governance Front Matter Assistant              ║"
echo "║   Add YAML metadata to documentation files                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Show usage options
show_usage() {
  echo -e "${BLUE}Usage:${NC}"
  echo "  ./tools/governance/add_frontmatter.sh [OPTION]"
  echo ""
  echo -e "${BLUE}Options:${NC}"
  echo "  --check-missing     Check which docs are missing metadata"
  echo "  --add-all           Add metadata to all files missing it (interactive)"
  echo "  --add-file FILE     Add metadata to a specific file"
  echo "  --help              Show this help message"
  echo ""
  echo -e "${BLUE}Examples:${NC}"
  echo "  ./tools/governance/add_frontmatter.sh --check-missing"
  echo "  ./tools/governance/add_frontmatter.sh --add-file docs/04-planning/my_doc.md"
  echo ""
}

# Check if file has front matter
has_frontmatter() {
  local file="$1"
  head -n 1 "$file" | grep -q "^---" && return 0 || return 1
}

# List files missing front matter
check_missing() {
  echo -e "${YELLOW}Checking for documentation files missing YAML front matter...${NC}"
  echo ""

  MISSING_COUNT=0
  SAFE_FILES=("README.md" "CHANGELOG.md" "TASKS.md")

  # Check docs/ folder (excluding root README/CHANGELOG/TASKS)
  while IFS= read -r file; do
    FILENAME=$(basename "$file")

    # Skip allowed root files
    if [[ " ${SAFE_FILES[@]} " =~ " ${FILENAME} " ]]; then
      continue
    fi

    # Skip hidden files and certain patterns
    if [[ "$FILENAME" =~ ^\. ]] || [[ "$FILENAME" =~ ^archive ]]; then
      continue
    fi

    # Check if file has front matter
    if ! has_frontmatter "$file"; then
      echo -e "  ${YELLOW}⚠${NC} Missing metadata: $file"
      MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
  done < <(find "$DOCS_DIR" -name "*.md" -type f)

  echo ""
  if [ $MISSING_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All documented files have metadata!${NC}"
  else
    echo -e "${YELLOW}⚠ Found $MISSING_COUNT files missing metadata${NC}"
    echo -e "  Run ${BLUE}./tools/governance/add_frontmatter.sh --add-all${NC} to add metadata"
  fi
}

# Generate front matter template
generate_frontmatter() {
  local file="$1"
  local author="${2:-[Author Name]}"
  local status="${3:-draft}"
  local intent="${4:-[Document purpose]}"

  local date=$(date +%Y-%m-%d)

  cat << EOF
---
author: $author
date: $date
status: $status
intent: $intent
---

EOF
}

# Add metadata to a specific file
add_to_file() {
  local file="$1"

  # Check if file exists
  if [ ! -f "$file" ]; then
    echo -e "${YELLOW}✗ File not found: $file${NC}"
    return 1
  fi

  # Check if already has front matter
  if has_frontmatter "$file"; then
    echo -e "${BLUE}ℹ File already has metadata: $file${NC}"
    return 0
  fi

  echo -e "${BLUE}Adding metadata to: $file${NC}"

  # Get information from user
  read -p "Author name (or press Enter for '[Author Name]'): " author
  author=${author:-[Author Name]}

  echo "Status options: draft, in_review, published, superseded"
  read -p "Status (default: draft): " status
  status=${status:-draft}

  read -p "One-line intent/purpose: " intent
  intent=${intent:-[Document purpose]}

  # Generate front matter
  local frontmatter=$(generate_frontmatter "$file" "$author" "$status" "$intent")

  # Create temporary file with new front matter prepended
  local tmpfile=$(mktemp)
  echo -n "$frontmatter" > "$tmpfile"
  cat "$file" >> "$tmpfile"

  # Replace original file
  mv "$tmpfile" "$file"

  echo -e "${GREEN}✓ Metadata added to: $file${NC}"
}

# Add to all missing files (interactive)
add_all() {
  echo -e "${YELLOW}Interactive mode: Adding metadata to files missing it${NC}"
  echo ""

  SAFE_FILES=("README.md" "CHANGELOG.md" "TASKS.md")
  FILES_PROCESSED=0

  while IFS= read -r file; do
    FILENAME=$(basename "$file")

    # Skip safe files
    if [[ " ${SAFE_FILES[@]} " =~ " ${FILENAME} " ]]; then
      continue
    fi

    # Skip hidden and archive files
    if [[ "$FILENAME" =~ ^\. ]] || [[ "$FILENAME" =~ ^archive ]]; then
      continue
    fi

    # Only process files missing metadata
    if ! has_frontmatter "$file"; then
      add_to_file "$file"
      FILES_PROCESSED=$((FILES_PROCESSED + 1))
      echo ""
    fi
  done < <(find "$DOCS_DIR" -name "*.md" -type f)

  echo ""
  echo -e "${GREEN}✓ Processed $FILES_PROCESSED files${NC}"
}

# Main command routing
case "${1:-}" in
  --check-missing)
    check_missing
    ;;
  --add-all)
    add_all
    ;;
  --add-file)
    if [ -z "$2" ]; then
      echo -e "${YELLOW}Error: --add-file requires a file path${NC}"
      show_usage
      exit 1
    fi
    add_to_file "$2"
    ;;
  --help|"")
    show_usage
    ;;
  *)
    echo -e "${YELLOW}Unknown option: $1${NC}"
    show_usage
    exit 1
    ;;
esac
