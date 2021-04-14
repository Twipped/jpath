
import { inspect } from 'util';

// eslint-disable-next-line no-unused-vars
function log (...args) {
  for (const a of args) {
    process.stdout.write(inspect(a, { colors: true, depth: Infinity }) + '\n');
  }
}

import tap from 'tap';
import { verbose } from '../src/index.js';
const testdata = {
  'store': {
    'book': [
      {
        'category': 'reference',
        'author': 'Nigel Rees',
        'title': 'Sayings of the Century',
        'price': 8.95,
      },
      {
        'category': 'fiction',
        'author': 'Evelyn Waugh',
        'title': 'Sword of Honour',
        'price': 12.99,
      },
      {
        'category': 'fiction',
        'author': 'Herman Melville',
        'title': 'Moby Dick',
        'isbn': '0-553-21311-3',
        'price': 8.99,
      },
      {
        'category': 'fiction',
        'author': 'J. R. R. Tolkien',
        'title': 'The Lord of the Rings',
        'isbn': '0-395-19395-8',
        'price': 22.99,
      },
    ],
    'bicycle': [
      {
        'color': 'red',
        'price': 19.95,
      },
    ],
    'ball': {
      'color': 'blue',
      'price': 5.45,
    },
  },
};

const testcases = {
  '$.store["book"]': [ testdata.store.book ],
  '$.store.book[*].author': [
    testdata.store.book[0].author,
    testdata.store.book[1].author,
    testdata.store.book[2].author,
    testdata.store.book[3].author,
  ],
  '$..author': [
    testdata.store.book[0].author,
    testdata.store.book[1].author,
    testdata.store.book[2].author,
    testdata.store.book[3].author,
  ],
  '$.store.*': [
    testdata.store.book,
    testdata.store.bicycle,
    testdata.store.ball,
  ],
  '$.store..price': [
    testdata.store.book[0].price,
    testdata.store.book[1].price,
    testdata.store.book[2].price,
    testdata.store.book[3].price,
    testdata.store.bicycle[0].price,
    testdata.store.ball.price,
  ],
  '$.store.book[?(% mod 2)]': [
    testdata.store.book[1],
    testdata.store.book[3],
  ],
  '$..book': [
    testdata.store.book,
  ],
  '$..book.*': [
    ...testdata.store.book,
  ],
  '$..book[2]': [
    testdata.store.book[2],
  ],
  '$..book[@.length-1]': [
    testdata.store.book[3],
  ],
  '$..book[-1:]': [
    testdata.store.book[3],
  ],
  '$..book[0,1]': [
    testdata.store.book[0],
    testdata.store.book[1],
  ],
  '$..book[:2]': [
    testdata.store.book[0],
    testdata.store.book[1],
  ],
  '$..book[?(@.isbn)]': [
    testdata.store.book[2],
    testdata.store.book[3],
  ],
  '$..book[?(@.price<10)]': [
    testdata.store.book[0],
    testdata.store.book[2],
  ],
  '$..[?(@.price<10)]': [
    testdata.store.book[0],
    testdata.store.book[2],
    testdata.store.ball,
  ],
  '$..*': [
    testdata.store,
    testdata.store.book,
    testdata.store.bicycle,
    testdata.store.ball,
    testdata.store.book[0],
    testdata.store.book[1],
    testdata.store.book[2],
    testdata.store.book[3],
    ...Object.values(testdata.store.book[0]),
    ...Object.values(testdata.store.book[1]),
    ...Object.values(testdata.store.book[2]),
    ...Object.values(testdata.store.book[3]),
    testdata.store.bicycle[0],
    ...Object.values(testdata.store.bicycle[0]),
    ...Object.values(testdata.store.ball),
  ],
  '$..[*]': [
    testdata.store,
    testdata.store.book,
    testdata.store.bicycle,
    testdata.store.ball,
    testdata.store.book[0],
    testdata.store.book[1],
    testdata.store.book[2],
    testdata.store.book[3],
    ...Object.values(testdata.store.book[0]),
    ...Object.values(testdata.store.book[1]),
    ...Object.values(testdata.store.book[2]),
    ...Object.values(testdata.store.book[3]),
    testdata.store.bicycle[0],
    ...Object.values(testdata.store.bicycle[0]),
    ...Object.values(testdata.store.ball),
  ],
  'store* $ book': [],
  'store.*.$.book': [],
  'avg $..price': [ 13.22 ],
};


for (const [ path, expected ] of Object.entries(testcases)) {

  tap.test(path, (t) => {
    const { result, ...tree } = verbose(path, testdata, { debug: true }); // eslint-disable-line no-unused-vars
    // log(tree);
    // log({ result, expected });
    t.same(result, expected, path);
    t.end();
  });

}