@twipped/jpath
===

`jpath` is an object navigation and data aggregation library based upon the jsonpath specification, but not explicitly adhering to it. The most notable difference is that script blocks (statements inside parenthesis) are NOT executed within the scripting engine, but rather are evaluated as substatements. Aside from this change, jpath should be fully backwards compatible with jsonpath.

Additionally, `jpath` provides a lot of functionality NOT present in the original jpath specification and implementation.

### Usage

```
npm install @twipped/jpath
```

### Usage

In CommonJS:

```js
const { compile } = require('@twipped/jpath');
const fn = compile('$.store.book.*');
const books = fn(data);
```

In ES6:

```js
import { compile } from '@twipped/jpath';
const fn = compile('$.store.book.*');
const books = fn(data);
```
