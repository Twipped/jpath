
import { anyOf } from './utils/index.js';
import { parseOperators } from './operators.js';

let tokenIndex = 0;
export const T_WHITESPACE    = tokenIndex++;
export const T_TARGET        = tokenIndex++;
export const T_FILTER        = tokenIndex++;
export const T_CHILD         = tokenIndex++;
export const T_RECURSE       = tokenIndex++;
export const T_OPERATOR      = tokenIndex++;
export const T_IDENTIFIER    = tokenIndex++;
export const T_LITERAL_NUM   = tokenIndex++;
export const T_LITERAL_STR   = tokenIndex++;
export const T_LITERAL_PRI   = tokenIndex++;
export const T_BRACKET_OPEN  = tokenIndex++;
export const T_BRACKET_CLOSE = tokenIndex++;
export const T_PAREN_OPEN    = tokenIndex++;
export const T_PAREN_CLOSE   = tokenIndex++;
export const T_SLICE         = tokenIndex++;
export const T_UNION         = tokenIndex++;
export const T_MAP_OPEN      = tokenIndex++;
export const T_MAP_CLOSE     = tokenIndex++;
export const T_REGEXP        = tokenIndex++;


export const T = [
  'T_WHITESPACE',
  'T_TARGET',
  'T_FILTER',
  'T_CHILD',
  'T_RECURSE',
  'T_OPERATOR',
  'T_IDENTIFIER',
  'T_LITERAL_NUM',
  'T_LITERAL_STR',
  'T_LITERAL_PRI',
  'T_BRACKET_OPEN',
  'T_BRACKET_CLOSE',
  'T_PAREN_OPEN',
  'T_PAREN_CLOSE',
  'T_SLICE',
  'T_UNION',
  'T_MAP_OPEN',
  'T_MAP_CLOSE',
];

const NUMBERS_CAN_FOLLOW = new Set([
  T_WHITESPACE,
  T_CHILD,
  T_RECURSE,
  T_OPERATOR,
  T_BRACKET_OPEN,
  T_PAREN_OPEN,
  T_SLICE,
  T_UNION,
]);

import {
  LF,
  CR,
  SPACE,
  DOUBLEQUOT,
  HASH,
  DOLLAR,
  PERCENT,
  QUOT,
  PAREN_OPEN,
  PAREN_CLOSE,
  COMMA,
  MINUS,
  PERIOD,
  COLON,
  QUESTION,
  AT,
  BRACKET_OPEN,
  BRACKET_CLOSE,
  SLASH,
  BACKSLASH,
  UNDERSCORE,
  CURL_OPEN,
  CURL_CLOSE,
  NBSP,
} from './characters.js';

const isAlpha = (char) => (char >= 65 && char <= 90) || (char >= 97 && char <= 122);
const isNumeric = (char) => (char >= 48 && char <= 57);
const isIdent = anyOf(isAlpha, isNumeric, UNDERSCORE, DOLLAR);
const isMinusPeriod = (char) => (char === MINUS || char === PERIOD);
const isQuot = (char) => (char === QUOT || char === DOUBLEQUOT);

export default function tokenizer (input, { operators = {} } = {}) {

  const {
    SYMBOLS: OP_SYMBOLS,
    WORDS:   OP_WORDS,
  } = parseOperators(operators);

  input = input.trim();
  const max = input.length - 1;
  let pos = 0;
  let line = 1;
  let col = 1;

  let tokens = [];
  let tindex = -1;
  let previous = null;

  function token (type, contents = null, l = line, c = col, extra) {
    const tok = { type, contents, line: l, column: c, ...extra };
    tokens.push(tok);
    previous = tok;
    return tok;
  }

  function debug (...args) { // eslint-disable-line
    console.log(`${input.slice(Math.max(0, pos - 20), pos)} | ${input.slice(pos, pos + 20)}`, ...args); // eslint-disable-line no-console
  }

  const err = new SyntaxError();
  function wtf (msg, { l = line, c = col, ...extra } = {}) {
    err.message = msg + ` (${l}:${c})`;
    console.dir(tokens); // eslint-disable-line no-console
    throw Object.assign(err, extra, { line: l, column: c });
  }

  function plc () { return { p: pos, l: line, c: col }; }

  function matchChars (...chars) {
    let i = 0;
    for (const char of chars) {
      if (peek(i++) !== char) return false;
    }
    return true;
  }

  function peek (delta = 0) {
    const i = pos + delta;
    if (i > max || i < 0) return;
    return input.charCodeAt(i);
  }

  function parseChar (char) {
    if (char === CR || char === LF) {
      line++;
      col = 1;
      // account for CRLF
      if (char === CR && input.charCodeAt(pos) === LF) {
        pos++;
      }
    } else {
      col++;
    }
  }

  function move (delta = 1) {
    const index = Math.min(max + 1, Math.max(0, pos + delta));
    if (delta > 0) for (let i = pos; i < index; i++) parseChar(input.charCodeAt(i));
    pos = index;
    return pos <= max;
  }

  function eof () {
    return pos > max;
  }

  function readWhitespace () {
    const { p, l, c } = plc();
    let char;
    while (pos <= max && (char = peek(0))) {
      if (char > 14 && char !== SPACE && char !== NBSP) break;
      move();
    }
    if (p === pos) return;
    token(T_WHITESPACE, input.slice(p, pos), l, c);
    return true;
  }

  function readParenStart () {
    if (peek() !== PAREN_OPEN) return;
    token(T_PAREN_OPEN, '(');
    move();
    return true;
  }

  function readParenEnd () {
    if (peek() !== PAREN_CLOSE) return;
    token(T_PAREN_CLOSE, ')');
    move();
    return true;
  }


  function readBrackStart () {
    if (peek() !== BRACKET_OPEN) return;
    token(T_BRACKET_OPEN, '[');
    move();
    return true;
  }

  function readBrackEnd () {
    if (peek() !== BRACKET_CLOSE) return;
    token(T_BRACKET_CLOSE, ']');
    move();
    return true;
  }

  function readCurlStart () {
    if (peek() !== CURL_OPEN) return;
    token(T_MAP_OPEN, '{');
    move();
    return true;
  }

  function readCurlEnd () {
    if (peek() !== CURL_CLOSE) return;
    token(T_MAP_CLOSE, '}');
    move();
    return true;
  }


  function readOperator () {
    const char = peek();

    if (char === PERIOD) {
      if (peek(1) === PERIOD) {
        token(T_RECURSE, '..');
        move(2);
      } else {
        token(T_CHILD, '.');
        move();
      }
      return true;
    }

    if (char === AT) {
      token(T_TARGET, '@'); // scope
      move();
      return true;
    }

    if (char === QUESTION) {
      token(T_FILTER, '?');
      move();
      return true;
    }

    if (char === COLON) {
      token(T_SLICE, ':');
      move();
      return true;
    }

    if (char === COMMA) {
      token(T_UNION, ',');
      move();
      return true;
    }

    if (char === HASH) {
      token(T_TARGET, '#'); // key
      move();
      return true;
    }

    if (char === PERCENT) {
      token(T_TARGET, '%'); // index
      move();
      return true;
    }

    for (const [ oper, ...chars ] of OP_SYMBOLS) {
      if (matchChars(...chars)) {
        const { l, c } = plc();
        move(oper.length);
        token(T_OPERATOR, oper, l, c, { symbol: true });
        return true;
      }
    }

  }


  function readIdentifier () {
    let char = peek();
    if (isNumeric(char) || !isIdent(char) || char === PERIOD) return;
    const { p, l, c } = plc();
    move();
    while ((char = peek())) {
      if (!isIdent(char)) break;
      move();
    }
    if (p === pos) return;
    const contents = input.slice(p, pos);
    if (contents === 'true')       token(T_LITERAL_PRI, true, l, c);
    else if (contents === 'false') token(T_LITERAL_PRI, false, l, c);
    else if (contents === 'null')  token(T_LITERAL_PRI, null, l, c);
    else if (contents === '$')     token(T_TARGET, '$', l, c); // root
    else if (OP_WORDS.includes(contents)) token(T_OPERATOR, contents, l, c);
    else token(T_IDENTIFIER, contents, l, c);
    return true;
  }

  function readNumber () {
    let char = peek();
    if (!isNumeric(char) && !isMinusPeriod(char)) return;
    if (isMinusPeriod(char) && !isNumeric(peek(1))) return;
    const { p, l, c } = plc();
    let hasPeriod = false;

    do {
      if (char === MINUS) {
        if (previous && !NUMBERS_CAN_FOLLOW.has(previous.type)) {
          // this minus has to be an operator
          return;
        }
        if (pos !== p) break;
        move();
        continue;
      }
      // found a minus after the start of the number, this is not part of the token.

      if (char === PERIOD) {
        if (hasPeriod) break; // we found an extra period, not part of the token.
        hasPeriod = true;
      } else if (!isNumeric(char)) break;
      // found something that was neither number nor period, not part of the token.

      move();
    } while ((char = peek()));

    if (p === pos) return;
    token(T_LITERAL_NUM, input.slice(p, pos), l, c);
    return true;
  }

  function readString () {
    let char = peek();
    if (!isQuot(char)) return;
    const { p, l, c } = plc();
    const fence = char;
    move();
    while ((char = peek())) {
      if (char === BACKSLASH) {
        move(2);
        continue;
      }
      if (char === fence) {
        token(T_LITERAL_STR, pos - p === 1 ? '' : input.slice(p + 1, pos).replace(/\\(.)/, '$1'),  l, c);
        move();
        return true;
      }
      move();
    }
    wtf(`Unterminated string literal: ${input.substr(p, 20)}…`, { l, c });
  }

  function readRegularExpression () {
    let char = peek();
    if (char !== SLASH || peek(2) === SLASH) return; // skip "//"
    const { p, l, c } = plc();
    const fence = char;
    move();
    let closed = false;
    while ((char = peek())) {
      if (closed) {
        if (isAlpha(char)) {
          // read flags
          move();
          continue;
        }
        break;
      }
      if (char === BACKSLASH) {
        move(2);
        continue;
      }
      if (char === fence) {
        closed = true;
        move();
        continue;
      }
      move();
    }
    if (closed) {
      const [ , re, flags ] = input.slice(p, pos).split('/');
      try {
        token(T_REGEXP, new RegExp(re, flags || undefined),  l, c);
        return true;
      } catch (e) {
        wtf(e.message + ': ' + re, { l, c });
      }
    }
    wtf(`Unterminated regular expression: ${input.substr(p, 20)}…`, { l, c });
  }

  function read () {
    if (eof()) return false;
    for (const r of read.order) {
      if (r()) return true;
    }
    wtf(`Unknown token: ${input.substr(pos, 20)}…`);
  }
  read.order = [
    readWhitespace,
    readBrackStart,
    readParenStart,
    readCurlStart,
    readIdentifier,
    readNumber,
    readString,
    readRegularExpression,
    readOperator,
    readBrackEnd,
    readParenEnd,
    readBrackEnd,
    readCurlEnd,
  ];

  tokens = tokens.filter((t) => t.type !== T_WHITESPACE);

  return {
    debug () {
      return { pos, max, tindex, tokens };
    },
    get eof () {
      return eof() && tindex >= tokens.length - 1;
    },
    get current () {
      while (tindex >= tokens.length && !eof()) read();
      return tokens[tindex];
    },
    readAll () {
      while (read());
      return tokens;
    },
    remaining () {
      while (read());
      return tokens.slice(tindex);
    },
    reset () {
      tindex = -1;
      return this;
    },
    next () {
      tindex++;
      while (tindex >= tokens.length && !eof()) read();
      if (tokens[tindex] && tokens[tindex].type === T_WHITESPACE) return this.next();
      return tokens[tindex];
    },
    prev () {
      do {
        if (!tindex) break;
        tindex--;
      } while (tokens[tindex] && tokens[tindex].type === T_WHITESPACE);
      return tokens[tindex];
    },
    peek (delta = 1) {
      const idx = tindex + delta;
      while (idx >= tokens.length && !eof()) read();
      if (tokens[idx] && tokens[idx].type === T_WHITESPACE) return this.peek(delta + 1);
      return tokens[idx];
    },

  };
}
