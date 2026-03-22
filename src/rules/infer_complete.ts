/**
 * Pattern-based autocomplete for forward rules and backward tactics.
 */

import { RULE_ALGEBRA, RULE_SUBSTITUTE } from './rules_ast';
import { TACTIC_ALGEBRA, TACTIC_SUBSTITUTE } from './tactics_ast';


interface PatternElement {
  type: number,
  text?: string,
  names?: string[],
}

const TYPE_LITERAL = 1;
const TYPE_PREDICATE = 4;
const TYPE_EXPR = 7;
const TYPE_NUMBER = 8;

const RE_PREDICATE = /[A-Z][_a-zA-Z0-9]*/;
const RE_EXPR = /\(.*/;
const RE_NUMBER = /[0-9]+/;


/** Names available for forward rule completion. */
const RULE_NAMES: string[] = [];

/** Patterns for forward rules. */
const FWD_PATTERNS: Array<[number, Array<PatternElement>]> = [
  [RULE_ALGEBRA,
   [{type: TYPE_LITERAL, text: "="}, {type: TYPE_EXPR}]],
  [RULE_ALGEBRA,
   [{type: TYPE_LITERAL, text: "<"}, {type: TYPE_EXPR}]],
  [RULE_ALGEBRA,
   [{type: TYPE_LITERAL, text: "<="}, {type: TYPE_EXPR}]],
  [RULE_SUBSTITUTE,
   [{type: TYPE_LITERAL, text: "subst"}, {type: TYPE_NUMBER}]],
  [RULE_SUBSTITUTE,
   [{type: TYPE_LITERAL, text: "unsub"}, {type: TYPE_NUMBER}]],
];

/** Patterns for backward rules. */
const BWD_PATTERNS: Array<[number, Array<PatternElement>]> = [
  [TACTIC_ALGEBRA,
   [{type: TYPE_EXPR}, {type: TYPE_LITERAL, text: "="}]],
  [TACTIC_ALGEBRA,
   [{type: TYPE_EXPR}, {type: TYPE_LITERAL, text: "<"}]],
  [TACTIC_ALGEBRA,
   [{type: TYPE_EXPR}, {type: TYPE_LITERAL, text: "<="}]],
  [TACTIC_SUBSTITUTE,
   [{type: TYPE_LITERAL, text: "subst"}, {type: TYPE_NUMBER}]],
  [TACTIC_SUBSTITUTE,
   [{type: TYPE_LITERAL, text: "unsub"}, {type: TYPE_NUMBER}]],
];


/** A piece of text that is optionally bold. */
export interface MatchWord {
  bold: boolean,
  text: string,
}

/** Describes a potential match and how to complete it. */
export interface Match {
  description: Array<MatchWord>,
  completion: string,
}


/** Returns forward pattern matches for the given text. */
export function FindForwardMatches(text: string): Array<Match> {
  return FindMatches(text, FWD_PATTERNS);
}

/** Returns backward pattern matches for the given text. */
export function FindBackwardMatches(text: string): Array<Match> {
  return FindMatches(text, BWD_PATTERNS);
}


function FindMatches(
    text: string,
    patterns: Array<[number, Array<PatternElement>]>): Array<Match> {
  const parts = SplitLine(text);

  const matches: Array<Match> = [];
  const seen = new Set<string>();
  for (const [_variety, pattern] of patterns) {
    for (const match of PatternMatch(parts, pattern)) {
      if (!seen.has(match.completion)) {
        seen.add(match.completion);
        matches.push(match);
      }
    }
  }
  return matches;
}


/**
 * Determines whether the given text parts match the given pattern.
 * Returns an array of matches (may be empty if no match, or multiple
 * when a predicate slot expands to multiple names).
 */
export function PatternMatch(
    parts: string[], pattern: Array<PatternElement>): Match[] {

  const n = pattern.length;
  if (parts.length > n)
    return [];

  const desc: Array<MatchWord> = [];
  const comp: Array<string> = [];

  for (let i = 0; i < parts.length; i++) {
    if (desc.length > 0) {
      desc.push({bold: false, text: " "});
      comp.push(" ");
    }

    switch (pattern[i].type) {
      case TYPE_LITERAL:
        if (pattern[i].text === parts[i]) {
          desc.push({bold: true, text: parts[i]});
          comp.push(parts[i]);
        } else if (pattern[i].text!.startsWith(parts[i])) {
          comp.push(pattern[i].text!);
          desc.push({bold: true, text: parts[i]});
          desc.push({bold: false, text: pattern[i].text!.substring(parts[i].length)});
        } else {
          return [];
        }
        break;

      case TYPE_PREDICATE: {
        if (!RE_PREDICATE.test(parts[i]))
          return [];
        const names = pattern[i].names ?? RULE_NAMES;
        const partialMatches = names.filter(name => name.startsWith(parts[i]));
        if (partialMatches.length === 0) {
          return [];
        } else if (partialMatches.length === 1) {
          const name = partialMatches[0];
          desc.push({bold: true, text: parts[i]});
          if (name.length > parts[i].length)
            desc.push({bold: false, text: name.substring(parts[i].length)});
          comp.push(name);
        } else {
          const results: Match[] = [];
          for (const name of partialMatches) {
            const entryDesc = [...desc];
            const entryComp = [...comp];
            if (entryDesc.length > 0)
              entryDesc.push({bold: false, text: " "});
            if (entryComp.length > 0 && entryComp[entryComp.length-1] !== " ")
              entryComp.push(" ");
            entryDesc.push({bold: true, text: parts[i]});
            if (name.length > parts[i].length)
              entryDesc.push({bold: false, text: name.substring(parts[i].length)});
            entryComp.push(name);
            for (let j = i + 1; j < parts.length; j++) {
              entryDesc.push({bold: false, text: " "});
              entryComp.push(" ");
              entryDesc.push({bold: true, text: parts[j]});
              entryComp.push(parts[j]);
            }
            results.push({description: entryDesc, completion: entryComp.join("")});
          }
          return results;
        }
        break;
      }

      case TYPE_EXPR:
        if (RE_EXPR.test(parts[i])) {
          desc.push({bold: true, text: "(Expr)"});
          comp.push(parts[i]);
        } else {
          return [];
        }
        break;

      case TYPE_NUMBER:
        if (RE_NUMBER.test(parts[i])) {
          desc.push({bold: true, text: parts[i]});
          comp.push(parts[i]);
        } else {
          return [];
        }
        break;

      default:
        throw new Error(`unknown type ${pattern[i].type}`);
    }
  }

  // Describe the parts not yet matched.
  for (let i = parts.length; i < pattern.length; i++) {
    if (pattern[i].type === TYPE_PREDICATE) {
      const results: Match[] = [];
      const names = pattern[i].names ?? RULE_NAMES;
      for (const name of names) {
        const entryDesc = [...desc];
        const entryComp = [...comp];
        if (entryDesc.length > 0)
          entryDesc.push({bold: false, text: " "});
        if (entryComp.length > 0 && entryComp[entryComp.length-1] !== " ")
          entryComp.push(" ");
        entryDesc.push({bold: false, text: name});
        entryComp.push(name);
        for (let j = i + 1; j < pattern.length; j++) {
          entryDesc.push({bold: false, text: " "});
          switch (pattern[j].type) {
            case TYPE_LITERAL:
              entryDesc.push({bold: false, text: pattern[j].text!});
              break;
            case TYPE_EXPR:
              entryDesc.push({bold: false, text: "(Expr)"});
              break;
            case TYPE_NUMBER:
              entryDesc.push({bold: false, text: "N"});
              break;
          }
        }
        results.push({description: entryDesc, completion: entryComp.join("")});
      }
      return results;
    }

    if (desc.length > 0)
      desc.push({bold: false, text: " "});
    if (comp.length > 0 && comp[comp.length-1] !== " ")
      comp.push(" ");

    switch (pattern[i].type) {
      case TYPE_LITERAL:
        desc.push({bold: false, text: pattern[i].text!});
        comp.push(pattern[i].text!);
        break;
      case TYPE_EXPR:
        desc.push({bold: false, text: "(Expr)"});
        break;
      case TYPE_NUMBER:
        desc.push({bold: false, text: "N"});
        break;
      default:
        throw new Error(`unknown type ${pattern[i].type}`);
    }
  }

  return [{description: desc, completion: comp.join("")}];
}


/** Returns the longest common prefix of the given strings. */
export function LongestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    let j = 0;
    while (j < prefix.length && j < strings[i].length) {
      if (prefix[j] !== strings[i][j])
        break;
      j++;
    }
    if (j < prefix.length)
      prefix = prefix.substring(0, j);
  }
  return prefix;
}


/**
 * Splits rule text into basic pieces (literals and expressions).
 * Expressions are recognized by balanced parentheses.
 */
export function SplitLine(text: string): string[] {
  const parts: string[] = [];
  text = text.trim();

  let i = 0;
  while (i < text.length) {
    if (text[i] === ' ') {
      i += 1;
      continue;
    }

    let j: number;
    let s: string;
    if (text[i] === '(') {
      [j, s] = ParseExprToken(text, i);
    } else {
      [j, s] = ParseLiteral(text, i);
    }
    parts.push(s);
    i = j;
  }
  return parts;
}

function ParseLiteral(text: string, start: number): [number, string] {
  let i = start;
  while (i < text.length && text[i] !== ' ') {
    i += 1;
  }
  return [i, text.substring(start, i)];
}

function ParseExprToken(text: string, start: number): [number, string] {
  let depth = 1;
  let i = start + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    i += 1;
  }
  return [i, text.substring(start, i)];
}
