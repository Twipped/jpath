/* eslint quotes:0, new-cap:0 */

import { inspect } from 'util';

// eslint-disable-next-line no-unused-vars
function log (...args) {
  for (const a of args) {
    process.stdout.write(inspect(a, { colors: true, depth: Infinity }) + '\n');
  }
}

import tap from 'tap';
import { parse } from '../src/index.js';
import {
  Statement,
  Root,
  Scope,
  Index,
  Literal,
  Descend,
  Recursive,
  Slice,
  Union,
  Filter,
  Operand,
  Reduce,
  Mapper,
  RegularExpression,
  Hashmap,
} from '../src/taxonomy.js';
import { DEFAULT_OPERATORS as OPS } from '../src/operators.js';

function Wildcard () {
  return new Operand('*', ...OPS['*']);
}

const testcases = {
  '$.store["book"]': new Statement([
    new Root(),
    new Descend('store'),
    new Descend('book'),
  ]),

  '$.store.book[*].author': new Statement([
    new Root(),
    new Descend('store'),
    new Descend('book'),
    new Descend(new Wildcard()),
    new Descend('author'),
  ]),

  '$..author':              new Statement([
    new Root(),
    new Recursive('author'),
  ]),

  '$.store.*':              new Statement([
    new Root(),
    new Descend('store'),
    new Wildcard(),
  ]),

  '$.store..price':         new Statement([
    new Root(),
    new Descend('store'),
    new Recursive('price'),
  ]),

  '$..book[2]':             new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(2),
  ]),

  '$..book[(@.length-1)]':  new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(
      new Operand(
        '-',
        ...OPS['-'],
        new Statement('operand', [
          new Scope(),
          new Descend('length'),
        ]),
        new Literal(1),
      ),
    ),
  ]),

  '$..book[-1:]': new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(
      new Slice([
        new Literal(-1),
        null,
      ]),
    ),
  ]),

  '$..book (-1:)': new Statement([
    new Root(),
    new Recursive('book'),
    new Slice([
      new Literal(-1),
      null,
    ]),
  ]),

  '$..book[0,1]':           new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(
      new Union([
        new Literal(0),
        new Literal(1),
      ]),
    ),
  ]),

  '$..book[:2]':            new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(
      new Slice([
        null,
        new Literal(2),
      ]),
    ),
  ]),

  '$..book[?(@.isbn)]':     new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(
      new Filter(
        new Statement('filter', [
          new Scope(),
          new Descend('isbn'),
        ]),
      ),
    ),
  ]),

  '$..book[?(@.price<10)]': new Statement([
    new Root(),
    new Recursive('book'),
    new Descend(
      new Filter(
        new Operand(
          '<',
          ...OPS['<'],
          new Statement('operand', [
            new Scope(),
            new Descend('price'),
          ]),
          new Literal(10),
        ),
      ),
    ),
  ]),

  '$..*': new Statement([
    new Root(),
    new Recursive(
      new Wildcard(),
    ),
  ]),

  '$..[*]': new Statement([
    new Root(),
    new Recursive(
      new Descend(
        new Wildcard(),
      ),
    ),
  ]),

  '$..[-1:]': new Statement([
    new Root(),
    new Recursive(
      new Descend(
        new Slice([
          new Literal(-1),
          null,
        ]),
      ),
    ),
  ]),

  '$..(-1:)': new Statement([
    new Root(),
    new Recursive(
      new Slice([
        new Literal(-1),
        null,
      ]),
    ),
  ]),

  'store* $ book': new Statement([
    new Descend('store'),
    new Wildcard(),
    new Descend('$'),
    new Descend('book'),
  ]),

  'store.*.$.book': new Statement([
    new Descend('store'),
    new Wildcard(),
    new Descend('$'),
    new Descend('book'),
  ]),

  'avg $..price': new Operand(
    'avg',
    ...OPS.avg,
    null,
    new Statement('operand', [
      new Root(),
      new Recursive('price'),
    ]),
  ),

  '$..[?(@.price<10)]': new Statement([
    new Root(),
    new Recursive(
      new Filter(
        new Operand(
          '<',
          ...OPS['<'],
          new Statement('operand', [
            new Scope(),
            new Descend('price'),
          ]),
          new Literal(10),
        ),
      ),
    ),
  ]),

  '$..?(@.price<10)': new Statement([
    new Root(),
    new Recursive(
      new Filter(
        new Operand(
          '<',
          ...OPS['<'],
          new Statement('operand', [
            new Scope(),
            new Descend('price'),
          ]),
          new Literal(10),
        ),
      ),
    ),
  ]),

  '(min *, max *, avg *)': new Union([
    new Operand(
      'min',
      ...OPS.min,
      null,
      new Wildcard(),
    ),
    new Operand(
      'max',
      ...OPS.max,
      null,
      new Wildcard(),
    ),
    new Operand(
      'avg',
      ...OPS.avg,
      null,
      new Wildcard(),
    ),
  ]),

  '$.store.book* (avg price)': new Statement([
    new Root(),
    new Descend('store'),
    new Descend('book'),
    new Wildcard(),
    new Operand('avg', ...OPS.avg, null,
      new Descend('price'),
    ),
  ]),

  '$.store.book (*.price)': new Statement([
    new Root(),
    new Descend('store'),
    new Descend('book'),
    new Statement('substatement', [
      new Wildcard(),
      new Descend('price'),
    ]),
  ]),


  '..price (min *, max *, avg *)': new Statement([
    new Recursive('price'),
    new Union([
      new Operand(
        'min',
        ...OPS.min,
        null,
        new Wildcard(),
      ),
      new Operand(
        'max',
        ...OPS.max,
        null,
        new Wildcard(),
      ),
      new Operand(
        'avg',
        ...OPS.avg,
        null,
        new Wildcard(),
      ),
    ]),
  ]),

  'min ..price, max ..price, avg ..price': new Union([
    new Operand(
      'min',
      ...OPS.min,
      null,
      new Recursive('price'),
    ),
    new Operand(
      'max',
      ...OPS.max,
      null,
      new Recursive('price'),
    ),
    new Operand(
      'avg',
      ...OPS.avg,
      null,
      new Recursive('price'),
    ),
  ]),

  "$['store']['book'][0]['title']": new Statement([
    new Root(),
    new Descend('store'),
    new Descend('book'),
    new Descend(0),
    new Descend('title'),
  ]),

  'store book 0 title': new Statement([
    new Descend('store'),
    new Descend('book'),
    new Descend(0),
    new Descend('title'),
  ]),

  'store mod 0 title': new Operand(
    'mod',
    ...OPS.mod,
    new Descend('store'),
    new Statement('operand', [
      new Descend(0),
      new Descend('title'),
    ]),
  ),

  [`
  ..book.*{
    %,
    title,
    price,
  }
  `]: new Statement([
    new Recursive('book'),
    new Wildcard(),
    new Mapper(
      new Union([
        new Index(),
        new Descend('title'),
        new Descend('price'),
      ]),
    ),
  ]),

  'value /.*Foo/i[0]': new Statement([
    new Descend('value'),
    new RegularExpression(/.*Foo/i),
    new Descend(0),
  ]),

  '"FooBar" /.*Bar/i[0]': new Statement([
    new Literal('FooBar'),
    new RegularExpression(/.*Bar/i),
    new Descend(0),
  ]),

  'foo.0': new Statement([
    new Descend('foo'),
    new Descend(0),
  ]),

  '$..?(isbn)': new Statement([
    new Root(),
    new Recursive(
      new Filter(
        new Descend('isbn'),
      ),
    ),
  ]),

  '$..(1,2)': new Statement([
    new Root(),
    new Recursive(
      new Union([
        new Literal(1),
        new Literal(2),
      ]),
    ),
  ]),

  '( foo: 0, bar: "1" )': new Hashmap([
    [
      new Literal('foo'),
      new Literal(0),
    ],
    [
      new Literal('bar'),
      new Literal('1'),
    ],
  ]),

  '( [foo]: 0, bar, baz: "1" )': new Hashmap([
    [
      new Descend('foo'),
      new Literal(0),
    ],
    [
      new Literal('bar'),
      new Descend('bar'),
    ],
    [
      new Literal('baz'),
      new Literal('1'),
    ],
  ]),

  '( foo, bar, baz: "1" )': new Hashmap([
    [
      new Literal('foo'),
      new Descend('foo'),
    ],
    [
      new Literal('bar'),
      new Descend('bar'),
    ],
    [
      new Literal('baz'),
      new Literal('1'),
    ],
  ]),

  'foo ?? bar ?? baz': new Reduce(
    '??',
    OPS['??'][1],
    new Descend('foo'),
    new Descend('bar'),
    new Descend('baz'),
  ),

  'foo > 0 || bar': new Reduce(
    '||',
    OPS['||'][1],
    new Operand(
      '>',
      ...OPS['>'],
      new Descend('foo'),
      new Literal(0),
    ),
    new Descend('bar'),
  ),

  'foo || 0 > bar': new Reduce(
    '||',
    OPS['||'][1],
    new Descend('foo'),
    new Operand(
      '>',
      ...OPS['>'],
      new Literal(0),
      new Descend('bar'),
    ),
  ),

  '3 add 4 mul 5': new Operand(
    'add',
    ...OPS.add,
    new Literal(3),
    new Operand(
      'mul',
      ...OPS.mul,
      new Literal(4),
      new Literal(5),
    ),
  ),

};

for (const [ path, expected ] of Object.entries(testcases)) {

  tap.test(path, (t) => {

    const result = parse(path, { debug: true });
    t.same(result, expected, path);
    if (!t.passing()) log(result, expected);
    t.end();

  });

}

const failures = {
  'in 5': { code: 'E_BAD_OPERATOR' },
  '5 in ': { code: 'E_UNEXPECTED_EOL' },
};

for (const [ path, expected ] of Object.entries(failures)) {

  tap.test(path, (t) => {

    t.throws(() => parse(path), expected);
    t.end();

  });

}
