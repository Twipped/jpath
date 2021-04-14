
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

  function peek (type = null, delta = 1) {
    const t = tokens.peek(delta);
    if (t && type !== null && t.type !== type) return false;
    return t;
  }


  const err = new SyntaxError();
  function wtf (msg = 'Unexpected token: ' + T[tok.type], { code = E_BAD_TOKEN, line, column, ...extra } = tok || {}) {
    msg += (line ? ` (${line}:${column})` : '');
    if (debug) msg += `[Token ${tindex}]`;
    let e = err;
    if (debug) {
      e = new SyntaxError(msg);
      e.framesToPop = 1; // ignore the wtf call itself.
    } else {
      err.message = msg;
    }
    e.code = code;
    e.token = tok;
    e.next = tokens.peek(1);
    throw Object.assign(e, extra);
  }

  function scanStatement (statementType) {
    let union, slice, operand;
    let statement = new Statement(statementType);

    while (next()) {

      if (isChild()) {
        continue;
      }

      if (isIdentifier()) {
        statement.push(new Descend(contents));
        continue;
      }

      if (isLiteral()) {
        statement.push(new Literal(contents));
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
            statement.push(new Recursive(new Filter(scanStatement('filter'))));
            next(T_BRACKET_CLOSE, true);
            continue;
          }

          statement.push(new Recursive(new Descend(scanStatement('substatement'))));
          continue;
        }

        if (next(T_PAREN_OPEN)) {
          statement.push(new Recursive(scanStatement('script')));
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
            statement.push(new Recursive(new Filter(scanStatement('filter'))));
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

        // if the operator is a word and is immediately followed by `.` or `..`, then
        // this is trying to access a named property, not perform an operation.
        if (!tok.symbol && (peek(T_CHILD) || peek(T_RECURSE))) {
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

        if (peek(T_UNION) || peek(T_SLICE) || peek(T_CHILD) || peek(T_RECURSE)) {
          wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a "${contents}" operator.`, { code: E_BAD_OPERATOR });
        }

        if (peek(T_OPERATOR)) {
          const [ nopType ] = operators[peek().contents] || [];
          if (nopType !== -1) {
            wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a "${contents}" operator.`, { code: E_BAD_OPERATOR });
          }
        }

        // infix binary
        if (opType === 0) {
          const o = new Operand(contents, opType, fn);
          if (!statement.length) {
            wtf(`Unexpected operator, "${contents}". Only prefix operators may be used at the start of a statement`, { code: E_BAD_OPERATOR });
          }
          const s = statement;
          statement = new Statement('operand');
          if (operand) {
            // we're already inside an operator, use that for left
            o.left = operand;
            o.right = statement;
          } else {
            o.left = s;
            o.right = statement;
          }
          operand = o;
          continue;
        }

        // prefix unary
        if (opType === -1) {
          const o = new Operand(contents, opType, fn);
          // with a prefix operator we're ignoring everything before the operator,
          // so lets just ditch the current statement.

          if (operand) {
            // we're already inside an operator, so this needs to replace that operator's right
            // IF we are currently in that operator's right.
            if (operand.right === statement) {
              operand.right = o;
            } else {
              operand = o;
              wtf('How did we get a prefix operator on the left hand side of a parent operator?', { code: E_THATS_A_BUG });
            }
          } else {
            operand = o;
          }
          o.right = statement = new Statement('operand');
          continue;
        }

        wtf(`Operator function for "${contents}" provided an unsupported arity: "${opType}"`, { code: E_BAD_OPERATOR_FUNCTION });
      }

      if (isSlice()) {
        if (operand) wtf('Unexpected T_SLICE inside an operation.');
        if (union) wtf('Unexpected T_SLICE inside a union.');

        if (!slice) slice = new Slice([ statement ]);
        slice.push(statement = new Statement('slice'));
        continue;
      }

      if (isUnion()) {
        if (operand) wtf('Unexpected T_UNION inside an operation.');
        if (slice) wtf('Unexpected T_UNION inside a slice.');

        if (!union) union = new Union([ statement ]);
        union.push(statement = new Statement('slice'));
        continue;
      }

      if (isFilter()) {
        if (next(T_PAREN_OPEN)) {
          statement.push(new Filter(scanStatement('filter')));
          continue;
        }
        wtf(`Unexpected "${peek().contents}" (${T[peek().type]}) following a filter operator.`);
      }

      if (isBracketClose() && statementType !== 'substatement') {
        wtf('Unmatched closing bracket.', { code: E_UNEXPECTED_CLOSE });
      }

      if (isParenClose() && statementType !== 'filter' && statementType !== 'script') {
        wtf('Unmatched closing parenthesis.', { code: E_UNEXPECTED_CLOSE });
      }

      if (isBracketClose() || isParenClose()) {
        if (operand) {
          if (operand.left instanceof Statement && operand.left.length === 1) {
            operand.left = operand.left.units[0];
          }
          if (operand.right instanceof Statement && operand.right.length === 1) {
            operand.right = operand.right.units[0];
          }
          return operand;
        }
        if (union) {
          union.units = union.units.map((s) => {
            if (s instanceof Statement && s.length === 1) {
              return s.units[0];
            }
            return s;
          });
          return union;
        }
        if (slice) {
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
        if (statement.length === 1) {
          if (statementType === 'substatement' && statement.units[0] instanceof Literal) return statement.units[0].value;
          return statement.units[0];
        }
        if (statement.length === 0) wtf('Unexpected end of statement (statement is empty).', { code: E_UNEXPECTED_CLOSE });
        return statement;
      }

      if (isBracketOpen()) {
        const substatement = scanStatement('substatement');
        if (substatement instanceof Slice) {
          statement.push(substatement);
        } else {
          statement.push(new Descend(substatement));
        }
        continue;
      }

      if (isParenOpen()) {
        statement.push(scanStatement('script'));
        continue;
      }

      wtf(`Unexpected token while processing statement: "${tok.contents}" (${T[tok.type]})`);
    }

    if (statementType !== 'root') wtf('Unexpected end of path, unclosed substatement.', { code: E_UNEXPECTED_EOL });

    if (operand) {
      if (operand.left instanceof Statement && operand.left.length === 1) {
        operand.left = operand.left.units[0];
      }
      if (operand.right instanceof Statement && operand.right.length === 1) {
        operand.right = operand.right.units[0];
      }
      return operand;
    }
    if (union) {
      union.units = union.units.map((s) => {
        if (s instanceof Statement && s.length === 1) {
          return s.units[0];
        }
        return s;
      });
      return union;
    }
    if (slice) {
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
    if (statement.length === 1) return statement.units[0];
    if (statement.length === 0) wtf('Unexpected end of statement (statement is empty).', { code: E_UNEXPECTED_EOL });
    return statement;
  }

  const result = scanStatement('root');
  if (!tokens.eof) {
    console.error({ remaining: tokens.remaining() }); // eslint-disable-line no-console
    wtf('There are still tokens left, how did we get here?', { code: E_THATS_A_BUG });
  }
  return result;
}
