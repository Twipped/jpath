/* eslint quotes:0, new-cap:0 */

import tap from 'tap';
import tokenize, {
  T_WHITESPACE,
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
} from '../src/tokenizer.js';
import { DEFAULT_OPERATORS } from '../src/operators.js';


const WHITESPACE      = (contents = ' '    ) => ({ contents, type: T_WHITESPACE });
const IDENTIFIER      = (contents = null   ) => ({ contents, type: T_IDENTIFIER });
const LITERAL_NUM     = (contents = null   ) => ({ contents, type: T_LITERAL_NUM });
const LITERAL_STR     = (contents = null   ) => ({ contents, type: T_LITERAL_STR });
const LITERAL_PRI     = (contents          ) => ({ contents, type: T_LITERAL_PRI });
const BRACKET_OPEN    = (contents = '['    ) => ({ contents, type: T_BRACKET_OPEN });
const BRACKET_CLOSE   = (contents = ']'    ) => ({ contents, type: T_BRACKET_CLOSE });
const PAREN_OPEN      = (contents = '('    ) => ({ contents, type: T_PAREN_OPEN });
const PAREN_CLOSE     = (contents = ')'    ) => ({ contents, type: T_PAREN_CLOSE });
const OPERATOR        = (contents          ) => ({ contents, type: T_OPERATOR });
const SYMBOL          = (contents          ) => ({ contents, type: T_OPERATOR, symbol: true });
const ROOT            = (contents = '$'    ) => ({ contents, type: T_TARGET });
const SCOPE           = (contents = '@'    ) => ({ contents, type: T_TARGET });
const FILTER          = (contents = '?'    ) => ({ contents, type: T_FILTER });
const CHILD           = (contents = '.'    ) => ({ contents, type: T_CHILD });
const RECURSE         = (contents = '..'   ) => ({ contents, type: T_RECURSE });
const SLICE           = (contents = ':'    ) => ({ contents, type: T_SLICE });
const UNION           = (contents = ','    ) => ({ contents, type: T_UNION });

function deline (toks) {
  return toks.map(({ line, column, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

tap.test('tokenize 1', (t) => {
  const result = tokenize('$.store[2:-1]..book[?(@.price < 10.5)].author[*][@.phone, mobile, "phone",\'mobile\', true] unique', { operators: DEFAULT_OPERATORS }).readAll();

  t.same(deline(result), [
    ROOT(),
    CHILD(),
    IDENTIFIER('store'),
    BRACKET_OPEN(),
    LITERAL_NUM(2),
    SLICE(),
    LITERAL_NUM(-1),
    BRACKET_CLOSE(),
    RECURSE(),
    IDENTIFIER('book'),
    BRACKET_OPEN(),
    FILTER(),
    PAREN_OPEN(),
    SCOPE(),
    CHILD(),
    IDENTIFIER('price'),
    WHITESPACE(),
    SYMBOL('<'),
    WHITESPACE(),
    LITERAL_NUM(10.5),
    PAREN_CLOSE(),
    BRACKET_CLOSE(),
    CHILD(),
    IDENTIFIER('author'),
    BRACKET_OPEN(),
    SYMBOL('*'),
    BRACKET_CLOSE(),
    BRACKET_OPEN(),
    SCOPE(),
    CHILD(),
    IDENTIFIER('phone'),
    UNION(),
    WHITESPACE(),
    IDENTIFIER('mobile'),
    UNION(),
    WHITESPACE(),
    LITERAL_STR('phone'),
    UNION(),
    LITERAL_STR('mobile'),
    UNION(),
    WHITESPACE(),
    LITERAL_PRI(true),
    BRACKET_CLOSE(),
    WHITESPACE(),
    OPERATOR('unique'),
  ]);
  t.end();
});


tap.test('tokenize $..book[(@.length-1)]', (t) => {
  const result = tokenize('$..book[(@.length-1)]', { operators: DEFAULT_OPERATORS }).readAll();

  t.same(deline(result), [
    ROOT(),
    RECURSE(),
    IDENTIFIER('book'),
    BRACKET_OPEN(),
    PAREN_OPEN(),
    SCOPE(),
    CHILD(),
    IDENTIFIER('length'),
    SYMBOL('-'),
    LITERAL_NUM(1),
    PAREN_CLOSE(),
    BRACKET_CLOSE(),
  ]);
  t.end();
});

tap.test('tokenize avg $..price', (t) => {
  const result = tokenize('avg $..price', { operators: DEFAULT_OPERATORS }).readAll();

  t.same(deline(result), [
    OPERATOR('avg'),
    WHITESPACE(),
    ROOT(),
    RECURSE(),
    IDENTIFIER('price'),
  ]);
  t.end();
});
