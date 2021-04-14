
import { inspect } from 'util';

// eslint-disable-next-line no-unused-vars
function log (...args) {
  for (const a of args) {
    process.stdout.write(inspect(a, { colors: true, depth: Infinity }) + '\n');
  }
}

import tap from 'tap';
import { parse } from '../src/index.js';

const testcases = {
  '$.store["book"]': '$.store.book',
  '$.store.book[*].author': '$.store.book.*.author',
  '$..author': '$..author',
  '$.store.*': '$.store.*',
  '$.store..price': '$.store..price',
  '$.store.book[?(% mod 2)]': '$.store.book[?(% mod 2)]',
  '$..book': '$..book',
  '$..book.*': '$..book.*',
  '$..book[2]': '$..book[2]',
  '$..book[@.length-1]': '$..book[@.length - 1]',
  '$..book[-1:]': '$..book[-1:]',
  '$..book[0,1]': '$..book[0,1]',
  '$..book[:2]': '$..book[:2]',
  '$..book[?(@.isbn)]': '$..book[?(@.isbn)]',
  '$..book.?(@.isbn)': '$..book.?(@.isbn)',
  '$..book[?(@.price<10)]': '$..book[?(@.price < 10)]',
  '$..[?(@.price<10)]': '$..?(@.price < 10)',
  '$..*': '$..*',
  '$..[*]': '$..*',
  'store* $ book': 'store.*.$.book',
  'store.*.$.book': 'store.*.$.book',
  'avg $..price': 'avg $..price',
};


for (const [ path, expected ] of Object.entries(testcases)) {

  tap.test(path, (t) => {
    const ast = parse(path);
    const result = String(ast);
    t.same(result, expected, path);
    t.end();
  });

}
