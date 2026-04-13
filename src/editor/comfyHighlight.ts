import { RangeSetBuilder } from '@codemirror/state';
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';


type Pattern = [RegExp, string | null];

// Declaration keywords + theorem (unified patterns for the proof file format).
const PATTERNS: Pattern[] = [
  [/^(?:prove)\b/,                         '#8060b0'],
  [/^(?:theorem)\b/,                       '#b06040'],
  [/^(?:type|def|if|then|else)\b/,         '#ce9178'],
  [/^[A-Z][_a-zA-Z0-9]*/,                 '#d4a96a'],
  [/^[0-9]+/,                              '#d4a96a'],
  [/^(?:->|=>|<=)/,                        '#a07850'],
  [/^[|:=<(),^*+\-]/,                      '#a07850'],
  [/^[a-z][_a-zA-Z0-9]*/,                 null],
];

// Pre-build Decoration.mark objects keyed by color for reuse.
const markCache = new Map<string, Decoration>();
function markForColor(color: string): Decoration {
  let d = markCache.get(color);
  if (!d) {
    d = Decoration.mark({ attributes: { style: `color: ${color}` } });
    markCache.set(color, d);
  }
  return d;
}

function buildHighlightDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    let pos = 0;

    outer: while (pos < text.length) {
      // Skip whitespace and newlines.
      const ch = text.charCodeAt(pos);
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
        pos++;
        continue;
      }

      const rest = text.substring(pos);
      for (const [re, color] of PATTERNS) {
        const m = re.exec(rest);
        if (m) {
          const tok = m[0];
          if (color) {
            builder.add(from + pos, from + pos + tok.length, markForColor(color));
          }
          pos += tok.length;
          continue outer;
        }
      }
      // Unmatched character — skip.
      pos++;
    }
  }

  return builder.finish();
}

export const comfyHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHighlightDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildHighlightDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
