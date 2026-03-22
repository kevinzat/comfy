#!/bin/bash
# Compiles a .g nearley grammar file to .js and converts to ESM imports.
# Usage: ./compile-grammar.sh src/path/grammar.g

set -e

if [ $# -ne 1 ]; then
  echo "Usage: $0 <grammar.g>" >&2
  exit 1
fi

GFILE="$1"
JSFILE="${GFILE%.g}.js"

if [ ! -f "$GFILE" ]; then
  echo "Error: $GFILE not found" >&2
  exit 1
fi

# Compile with nearley
npx nearleyc "$GFILE" -o "$JSFILE"

# Find the line number of "if (typeof module" — the grammar object close is the line before it
CJS_LINE=$(grep -n "^if (typeof module" "$JSFILE" | head -1 | cut -d: -f1)

if [ -z "$CJS_LINE" ]; then
  echo "Error: could not find CJS wrapper in $JSFILE" >&2
  exit 1
fi

# Lines 1..3 are nearley header + IIFE open; 4 is "function id(x)..."
# Line CJS_LINE-1 is the grammar close "}"
# Lines CJS_LINE..end are CJS wrapper

{
  echo "// Generated automatically by nearley"
  echo "// Converted to ESM"
  echo ""
} > "$JSFILE.tmp"

LAST_BODY_LINE=$((CJS_LINE - 1))
LINENUM=0

while IFS= read -r line; do
  LINENUM=$((LINENUM + 1))

  # Skip past CJS wrapper (including grammar close brace)
  if [ "$LINENUM" -ge "$CJS_LINE" ]; then
    continue
  fi

  # Skip nearley boilerplate header
  case "$line" in
    "// Generated automatically"*) continue ;;
    "// http://github.com/Hardmath123"*) continue ;;
    "(function () {") continue ;;
    "function id(x) { return x[0]; }") continue ;;
  esac

  # Grammar close brace: the line just before the CJS wrapper
  if [ "$LINENUM" -eq "$LAST_BODY_LINE" ]; then
    echo "};" >> "$JSFILE.tmp"
    continue
  fi

  # Convert require() to import
  if echo "$line" | grep -q "^const moo = require('moo');"; then
    echo "import moo from 'moo';" >> "$JSFILE.tmp"
  elif echo "$line" | grep -q "^const .* = require('\."; then
    varname=$(echo "$line" | sed -E "s/^const ([a-zA-Z_]+) = require.*/\1/")
    path=$(echo "$line" | sed -E "s/.*require\('([^']+)'\).*/\1/")
    if echo "$path" | grep -q "grammar_util"; then
      echo "import * as $varname from '${path}.js';" >> "$JSFILE.tmp"
    else
      echo "import * as $varname from '${path}.ts';" >> "$JSFILE.tmp"
    fi
  else
    echo "$line" >> "$JSFILE.tmp"
  fi
done < "$JSFILE"

echo "" >> "$JSFILE.tmp"
echo "export default grammar;" >> "$JSFILE.tmp"

mv "$JSFILE.tmp" "$JSFILE"

echo "Compiled $GFILE -> $JSFILE (ESM)"
