
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
  '$..book(-1:)': '$..book (-1:)',
  '$..book[0,1]': '$..book[0,1]',
  '$..book[:2]': '$..book[:2]',
  '$..book[?(@.isbn)]': '$..book[?(@.isbn)]',
  '$..book.?(@.isbn)': '$..book.?(@.isbn)',
  '$..book[?(@.price<10)]': '$..book[?(@.price < 10)]',
  '$..[?(@.price<10)]': '$..[?(@.price < 10)]',
  '$..*': '$..*',
  '$..[*]': '$..*',
  '$..[-1:]': '$..[-1:]',
  '$..(-1:)': '$..(-1:)',
  'store* $ book': 'store.*.$.book',
  'store.*.$.book': 'store.*.$.book',
  'avg $..price': 'avg $..price',
  '$..book (avg *.price)': '$..book (avg *.price)',
  "$['store']['book'][0]['title']": '$.store.book[0].title',
  'value /.*Foo/i[0]': 'value /.*Foo/i[0]',
  [`
  ..book.*{
    %,
    title,
    price,
  }
  `]: '..book.* {%,title,price}',
  'foo.@.bar': 'foo["@"].bar',
  'foo.0': 'foo[0]',
  '..book.* ({ index: %, title: title, price: price })': '..book.* {"index": %, "title": title, "price": price}',
  '( foo, bar, baz: "1" )': '"foo": foo, "bar": bar, "baz": "1"',
  '(foo, bar) 0 *': '(foo,bar)[0].*',
};


for (const [ path, expected ] of Object.entries(testcases)) {

  tap.test(path, (t) => {
    const ast = parse(path);
    const result = String(ast);
    t.same(result, expected, expected);
    const reparsed = parse(result);
    const secondResult = reparsed.toString();
    t.same(secondResult, expected, 'Parsing output produces same composition');
    t.end();
  });

}
