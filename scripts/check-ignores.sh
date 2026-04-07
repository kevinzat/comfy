#!/bin/bash

# Ensure we stop on errors
set -e

SEARCH_DIR=${1:-.}

# Check for pcregrep dependency
if ! command -v pcregrep &> /dev/null; then
    echo "Error: 'pcregrep' is not installed. Please install it to run ignore checks."
    echo "macOS: brew install pcre"
    echo "Ubuntu/Debian: sudo apt-get install pcregrep"
    exit 1
fi

# Find files and validate
find "$SEARCH_DIR" -type f -not -path '*/node_modules/*' -not -path '*/.*' | xargs grep -l "v8 ignore" | while read -r file; do
    grep -n "v8 ignore" "$file" | while read -r line; do
        line_num=$(echo "$line" | cut -d: -f1)
        text=$(echo "$line" | cut -d: -f2-)

        is_valid_next=$(pcregrep -M "/\* v8 ignore next \*/\s+throw new Error" "$file" | grep -F "$text" || true)
        
        is_valid_block=$(pcregrep -M "/\* v8 ignore start \*/\s+if\s*\(.*\)\s*\{?\s*throw new Error\(.*\);?\s*\}?\s*/\* v8 ignore stop \*/" "$file" | grep -F "$text" || true)

        if [[ -z "$is_valid_next" && -z "$is_valid_block" ]]; then
            echo "$file:$line_num: invalid ignore: $(echo "$text" | xargs)"
            # Exit with error code if invalid pattern found
            exit 1
        fi
    done
done
