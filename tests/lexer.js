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
  Literal,
  Descend,
  Recursive,
  Slice,
  Union,
  Filter,
  Operand,
} from '../src/taxonomy.js';
import { DEFAULT_OPERATORS as OPS } from '../src/operators.js';

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
    new Descend(new Operand('*', OPS['*'][1])),
    new Descend('author'),
  ]),

  '$..author':              new Statement([
    new Root(),
    new Recursive('author'),
  ]),

  '$.store.*':              new Statement([
    new Root(),
    new Descend('store'),
    new Operand('*', OPS['*'][1]),
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
      new Operand('-', OPS['-'][1],
        new Statement('script', [
          new Scope(),
          new Descend('length'),
        ]),
        new Literal(1),
      ),
    ),
  ]),

  '$..book[-1:]':           new Statement([
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
    new Slice([
      null,
      new Literal(2),
    ]),
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
      new Filter(new Operand(
        '<',
        OPS['<'][1],
        new Statement('filter', [
          new Scope(),
          new Descend('price'),
        ]),
        new Literal(10),
      )),
    ),
  ]),

  '$..*': new Statement([
    new Root(),
    new Recursive(
      new Operand('*', OPS['*'][1]),
    ),
  ]),

  '$..[*]': new Statement([
    new Root(),
    new Recursive(
      new Descend(
        new Operand('*', OPS['*'][1]),
      ),
    ),
  ]),

  'store* $ book': new Statement([
    new Descend('store'),
    new Operand('*', OPS['*'][1]),
    new Descend('$'),
    new Descend('book'),
  ]),

  'store.*.$.book': new Statement([
    new Descend('store'),
    new Operand('*', OPS['*'][1]),
    new Descend('$'),
    new Descend('book'),
  ]),

  'avg $..price': new Operand(
    'avg',
    OPS.avg[1],
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
          OPS['<'][1],
          new Statement('filter', [
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
          OPS['<'][1],
          new Statement('filter', [
            new Scope(),
            new Descend('price'),
          ]),
          new Literal(10),
        ),
      ),
    ),
  ]),

};

for (const [ path, expected ] of Object.entries(testcases)) {

  tap.test(path, (t) => {

    const result = parse(path, { debug: true });
    // log(result, expected);
    t.same(result, expected, path);
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
