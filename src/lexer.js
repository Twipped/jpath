
import { isString } from './utils/index.js';

import {
  T,
  T_TARGET,
  T_FILTER,
  T_CHILD,
  T_RECURSE,
  T_OPERATOR,
  T_IDENTIFIER,
  T_LITERAL_NUM,
  T_LITERAL_STR,
  T_LITERAL_PRI,
  T_BRACKET_OPEN,
  T_BRACKET_CLOSE,
  T_PAREN_OPEN,
  T_PAREN_CLOSE,
  T_SLICE,
  T_UNION,
} from './tokenizer.js';

import {
  Statement,
  Root,
  Scope,
  Key,
  Index,
  Literal,
  Descend,
  Recursive,
  Slice,
  Union,
  Filter,
  Operand,
} from './taxonomy.js';

const E_UNEXPECTED_EOL = 'E_UNEXPECTED_EOL';
const E_BAD_OPERATOR = 'E_BAD_OPERATOR';
const E_BAD_TOKEN = 'E_BAD_TOKEN';
const E_THATS_A_BUG = 'E_THATS_A_BUG';
const E_BAD_OPERATOR_FUNCTION = 'E_BAD_OPERATOR_FUNCTION';
const E_UNEXPECTED_CLOSE = 'E_UNEXPECTED_CLOSE';

export default function lex (tokens, { operators, debug } = {}) {
  let tok, contents;
  let tindex = 0;

  var is = (type, cont) => (t = tok) => t && t.type === type && (!cont || t.contents === cont);
  var isIdentifier   = is(T_IDENTIFIER);
  var isOperator     = is(T_OPERATOR);
  var isBracketOpen  = is(T_BRACKET_OPEN);
  var isBracketClose = is(T_BRACKET_CLOSE);
  var isParenOpen    = is(T_PAREN_OPEN);
  var isParenClose   = is(T_PAREN_CLOSE);
  var isLiteralNum   = is(T_LITERAL_NUM);
  var isLiteralStr   = is(T_LITERAL_STR);
  var isLiteralPri   = is(T_LITERAL_PRI);
  var isFilter       = is(T_FILTER);
  var isChild        = is(T_CHILD);
  var isRecurse      = is(T_RECURSE);
  var isSlice        = is(T_SLICE);
  var isUnion        = is(T_UNION);
  var isTarget       = is(T_TARGET);
  var isLiteral = (t = tok) => isLiteralNum(t) || isLiteralStr(t) || isLiteralPri(t);

  function next (type = null, required = false) {
    if (tokens.eof) return false;
    const t = tokens.peek();
    if (!t) return false;
    if (type !== null && t.type !== type) {
      if (required) wtf(isString(required) ? required : `Expected ${type} but found ${T[t.type]}`);
      return false;
    }
    contents = t.contents;
    tindex++;
    return (tok = tokens.next());
  }

  function rewind (delta = 1) {
    while (delta--) tokens.prev();
  }

  function peek (type = null, delta = 1) {
    const t = tokens.peek(delta);
    if (t && type !== null && t.type !== type) return false;
    return t;
  }


  function wtf (msg = 'Unexpected token: ' + T[tok.type], { code = E_BAD_TOKEN, line, column, ...extra } = tok || {}) {
    msg += (line ? ` (${line}:${column})` : '');
    if (debug) msg += `[Token ${tindex}]`;
    const e = new SyntaxError(msg);
    e.code = code;
    e.token = tok;
    e.next = tokens.peek(1);
    throw Object.assign(e, extra);
  }

  function scanStatement (statementType, depth = 0) {
    const statement = new Statement(statementType);

    while (next()) {

      if (isChild()) {
        continue;
      }

      if (isParenOpen()) {
        statement.push(scanStatement('substatement', 0));
        continue;
      }

      if (isIdentifier()) {
        statement.push(new Descend(contents));
        continue;
      }

      if (isLiteral()) {
        if (isLiteralNum()) statement.push(new Literal(Number(contents)));
        else statement.push(new Literal(contents));
        continue;
      }

      if (isRecurse()) {
        if (next(T_IDENTIFIER) || next(T_LITERAL_NUM) || next(T_LITERAL_STR)) {
          statement.push(new Recursive(contents));
          continue;
        }

        if (next(T_BRACKET_OPEN)) {
          if (next(T_FILTER)) {
            next(T_PAREN_OPEN, true);
            statement.push(new Recursive(new Filter(scanStatement('filter', 0))));
            next(T_BRACKET_CLOSE, true);
            continue;
          }

          statement.push(new Recursive(new Descend(scanStatement('descend', 0))));
          continue;
        }

        if (next(T_PAREN_OPEN)) {
          statement.push(new Recursive(scanStatement('recursive', 0)));
          continue;
        }

        if (next(T_OPERATOR)) {
          if (tok.symbol) {
            const [ opType, fn ] = operators[contents];
            if (opType === 1) {
              statement.push(new Recursive(new Operand(contents, opType, fn)));
              continue;
            }

            wtf(`Unexpected operator, "${contents}". Only postfix operators may be used in a statement chain`, { code: E_BAD_OPERATOR });
          }

          statement.push(new Recursive(contents));
          continue;
        }

        if (next(T_FILTER)) {
          if (next(T_PAREN_OPEN)) {
            statement.push(new Recursive(new Filter(scanStatement('filter', 0))));
            continue;
          }
          wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a filter operator.`);
        }

        if (next(T_TARGET)) {
          // if the target isn't at the start of the statement, it isn't a target.
          statement.push(new Recursive(contents));
          continue;
        }

        wtf(`Unexpected ${T[peek().type]} following a ${T[tok.type]}`);
      }

      if (isTarget()) {
        if (statement.length) {
          // if the target isn't at the start of the statement, it isn't a target.
          statement.push(new Descend(contents));
          continue;
        }

        const Target = {
          '$': Root,
          '@': Scope,
          '#': Key,
          '%': Index,
        }[contents];

        if (!Target) wtf(`"${contents}" is not a recognized target operator.`);
        statement.push(new Target);
        continue;
      }

      if (isOperator()) {
        if (!operators[contents]) wtf(`Unknown operator found: "${contents}"`);
        const [ opType, fn ] = operators[contents];

        // if the operator is a word and immediately follows a descent token then
        // this is trying to access a named property, not perform an operation.
        if (!tok.symbol && (peek(T_CHILD, -1) || peek(T_RECURSE, -1))) {
          if (isChild()) statement.push(new Descend(contents));
          else if (isRecurse()) statement.push(new Recursive(contents));
          continue;
        }

        // postfix unary
        if (opType === 1) {
          statement.push(new Operand(contents, opType, fn));
          continue;
        }

        if (!peek()) {
          wtf(`Unexpected end of path following a "${contents}" operator.`, { code: E_UNEXPECTED_EOL });
        }

        if (peek(T_BRACKET_CLOSE) || peek(T_PAREN_CLOSE)) {
          wtf(`Unexpected end of substatement (${T[peek().type]}) following a "${contents}" operator.`, { code: E_UNEXPECTED_EOL });
        }

        if (peek(T_UNION) || peek(T_SLICE) || peek(T_CHILD)) {
          wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a "${contents}" operator.`, { code: E_BAD_OPERATOR });
        }

        if (peek(T_OPERATOR)) {
          const [ nopType ] = operators[peek().contents] || [];
          if (nopType === 0) {
            wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a "${contents}" operator.`, { code: E_BAD_OPERATOR });
          }
        }

        // infix binary
        if (opType === 0) {
          if (!statement.length) {
            wtf(`Unexpected operator, "${contents}". Only prefix operators may be used at the start of a statement`, { code: E_BAD_OPERATOR });
          }

          const o = new Operand(contents, opType, fn);
          o.left = statement;
          o.right = scanStatement('operand', depth + 1);
          return o;
        }

        // prefix unary
        if (opType === -1) {
          if (statement.length) {
            wtf('Unexpected prefix operator mid-statement.', { code: E_BAD_OPERATOR });
          }

          const o = new Operand(contents, opType, fn);
          o.right = scanStatement('operand', depth + 1);
          statement.push(o);
          continue;
        }

        wtf(`Operator function for "${contents}" provided an unsupported arity: "${opType}"`, { code: E_BAD_OPERATOR_FUNCTION });
      }

      if (isSlice()) {
        if (depth) {
          rewind();
          break;
        }

        const slice = new Slice([ statement ]);
        do {
          slice.push(scanStatement('slice', depth + 1));
        } while (next(T_SLICE));
        slice.units = slice.units.map((s) => {
          if (s instanceof Statement) {
            if (!s.length) return null;
            if (s.length === 1) return s.units[0];
            return s;
          }
          return s;
        });
        return slice;
      }

      if (isUnion()) {
        if (depth) {
          rewind();
          break;
        }

        const union = new Union([ statement ]);
        do {
          union.push(scanStatement('union', depth + 1));
        } while (next(T_UNION));
        union.units = union.units.map((s) => {
          if (s instanceof Statement && s.length === 1) {
            return s.units[0];
          }
          return s;
        });
        return union;
      }

      if (isFilter()) {
        if (next(T_PAREN_OPEN)) {
          statement.push(new Filter(scanStatement('filter', 0)));
          continue;
        }
        wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a filter operator.`);
      }

      if (isBracketClose() || isParenClose()) {
        if (statement.length === 1) {
          return statement.units[0];
        }
        if (statement.length === 0 && !depth) wtf('Unexpected end of statement (statement is empty).', { code: E_UNEXPECTED_CLOSE });
        return statement;
      }

      if (isBracketOpen()) {
        const substatement = scanStatement('descend', 0);
        if (substatement instanceof Slice) {
          statement.push(substatement);
        } else if (substatement instanceof Literal) {
          statement.push(new Descend(substatement.value));
        } else {
          statement.push(new Descend(substatement));
        }
        continue;
      }

      wtf(`Unexpected token while processing statement: "${tok.contents}" (${T[tok.type]})`);
    }

    if (statement.length === 1) return statement.units[0];
    if (statement.length === 0) wtf('Unexpected end of statement (statement is empty).', { code: E_UNEXPECTED_EOL });
    return statement;
  }

  const result = scanStatement('root', 0);
  if (!tokens.eof) {
    console.error({ remaining: tokens.remaining() }); // eslint-disable-line no-console
    wtf('There are still tokens left, how did we get here?', { code: E_THATS_A_BUG });
  }
  return result;
}
