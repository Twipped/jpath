@twipped/jpath
===

`jpath` is an object navigation and data aggregation library based upon [the jsonpath specification](https://goessner.net/articles/JsonPath/), but not explicitly adhering to it. The most notable difference is that script blocks (statements inside parenthesis) are NOT executed within the scripting engine, but rather are evaluated as jpath substatements. Aside from this change, jpath should be fully backwards compatible with jsonpath.

Additionally, `jpath` provides a lot of functionality NOT present in the original jsonpath specification and implementation, such as a broad range of computational operators and collection manipulation, and a syntax for mapping over values.

### Usage

```
npm install @twipped/jpath
```

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

## JPath Syntax

JPath uses a dot-notation and brackets syntax, same as JavaScript and JSONPath.

```
$.store.book[0].title
$['store']['book'][0]['title']
```

However, in JPath this is optional, and the same results can be accomplished with simple spaces. It is also possible to omit the leading `$` from the path. However, it is not recommend that you use this in an entire path, as your property keys may be misinterpreted for operators.

```
store book 0 // `store book 2` fetches the third `book`
store mod 0  // `store mod 2` performs modulus 2 on the value of `store`
```

Whitespace is otherwise insignificant, so this is a perfectly valid path:

```
..book.* {
  %,
  title,
  price,
}
```

### Property Identifiers

Following the same rules as JavaScript, property identifiers can only start with `A-Z` (caseinsensitive), `$` and `_` (underscore). They may also contain numbers.

### Recursive Descent

The `..` (double period) notation identifies that you are seeking any value identified immediately following the `..`.

| Examples |   |
| -------  | - |
| `@..book` | Recursively scans every object in the current scope to find a value named `book` |
| `@..[$.marker]` | Recursively scans every object from the current scope to find any values named with the value at `$.marker` |
| `$..(1,2)` | Returns the second and third items from every array found in the data |
| `$..?(isbn)` | Returns any objects which contain an `isbn` value. |

### Literals

JPath recognizes the `true`, `false` and `null` keywords as literal values, as well as any numbers, and text enclosed inside single or double quotes (ex: `"hello"`). Literal values can only exist at the beginning of an expression (which includes either side of an operator).

### Unions

The comma (`,`) token allows you to return multiple discrete values from an expression.

| Examples |   |
| -------  | - |
| `$.a, $.b` | Produces a two item array containing the values of `a` and `b` |
| `products.*.price (max *, min *)` | Produces a two item array of the smallest and largest prices |
| `($.a, $.b) join ', '` | Selects the values of `a` and `b` and joins them together into a single string result. |

### Slicing

Arrays and strings may be sliced using the bracket-colon notation: `[start:end:step]`

| Examples |   |
| -------  | - |
| `$.items[2:]`   | Returns all items, skipping the first two. |
| `$.items[-2:]`  | Returns the last two items. |
| `$.items[:2]`   | Returns the first two items. |
| `$.items[::2]`  | Returns every other item. |
| `$.items[::-1]` | Returns the array in items order. |

### Hashmaps

You can produce a keyed object by combining the Slice (`:`) and Union (`,`) operators.

```
index: %, title, price: price mul 0.5
```

Note that this does support the shortened notation where it is not needed to type `title: title`, however at least one property in the set must use a colon to mark the key, or else the set will be parsed as a union.

### Mapping

An expression wrapped in curly braces (`{` and `}`) is a Mapping expression. This will take the values received from the left of the Mapping, run the internal expression against each one, and output the non-null results.

`$.products.* { productid, price mul 0.5 }` Produces an array of arrays where each contains the productid and half the price.

### Filtering

The filter statement takes all values from the left of the filter and iterates over them with the enclosed expression. If the expression returns any truthy result, then the value is outputted, otherwise it is excluded.

The scope of a filter expression is always the value being filtered, as is the initial value of the expression, *except* during a bracketed descent (eg, `foo[?(something)]`). In that case the initial value is the key of the value being filtered.

### Scope Keywords

JPath statements are composed of multiple expressions. Any time the path is segmented by brackets, braces or parenthesis, that forms a new expression, and thus a new scope. Operators also cause multiple expressions, but they receive the parent scope.



Expressions may begin with one of four significant characters:

| Keyword | Name  | Description |
| ------- | ----- | ----------- |
| **$**   | Root  | Targets the top level of the data passed in to the expression. |
| **@**   | Scope | Targets the top level of the current expression. |
| **#**   | Key   | When iterating over an object or array, contains the key of the current item. |
| **%**   | Index | When iterating over an object or array, contains the zero-based index of the current item. |

If these are used in the middle of an expression (ex: `$.foo.@.bar`) then they will be treated as property keys (eg: `foo["@"].bar`).

### Operators

JPath supports a full compliment of operators for manipulating data.

| Oper    | Name                     | Description |
| :-----: | ------------------------ | ----------- |
| *       | All Values               | Returns all of the values in the collections to the left |
| ~       | All Keys/Indexes         | Returns all keys of the collections to the left |
| ===     | Strict Equal             | Results in a single `true` if the first value of both left and right expressions are strictly identical. |
| ==      | Loose Equal              | Results in a single `true` if the first value of both left and right expressions are loosely identical. |
| !==     | Strict Unequal           | Results in a single `true` if the first value of both left and right expressions are not strictly identical. |
| !=      | Loose Unequal            | Results in a single `true` if the first value of both left and right expressions are not loosely identical. |
| <       | Less Than                | Results in a single `true` if the first value of the left expression is smaller than the first value of the right expression. |
| <=      | Less Than or Equal To    | Results in a single `true` if the first value of the left expression is smaller than or equal to the first value of the right expression. |
| >=      | Greater Than or Equal To | Results in a single `true` if the first value of the left expression is larger than or equal the first value of the right expression. |
| >       | Greater Than             | Results in a single `true` if the first value of the left expression is larger than the first value of the right expression. |
| -       | Minus                    | Produces the result of subtracting the first value of the right expression from the first value of the left expression |
| +       | Plus                     | Produces the result of subtracting the first value of the right expression from the first value of the left expression |
| &&      | Logical And              | Returns the right side results if the left side results contain truthy values, the left side results if not. |
| &#124;&#124; | Logical Or               | Returns the left side results if the left side results contain truthy values, the right side results if not. |
| ??      | Null Coalesce            | Returns the left side results unless the results are empty, then returns the right side. |
| !       | Falsey                   | Results in a single `true` if the statement to the right has a truthy value. |
| !!      | Truthy                   | Results in a single `true` if the statement to the right is empty or contains no truthy values. |
| is      | Matching Results         | Produces a single `true` if expressions on both sides are strictly identical. |
| in      | Intersection             | Returns all the values from the left side which exist in the results of the right side expression. |
| not     | Difference               | Returns all the values from the left side which are NOT in the results of the right side expression. |
| subset  | Exclusive Intersection   | Returns all the values from the left side, but only if they all exist in the right side expression. |
| typeof  | Type Compare             | Produces a single `true` if the first value of both expressions is the same data type (string, number, boolean, object, array). |
| ntypeof | Type Mismatch            | Produces a single `true` if the first value of both expressions are **not** the same data type (string, number, boolean, object, array). |
| join    | Join Array               | Joins the values on the left side of the expression into a single string, using the first value on the right. |
| split   | Split Array              | Splits every string value on the left using the first value of the right expression as the delimiter |
| keys    | Collection Keys          | Outputs the keys of any Object, Array, Set or Map received from the left expression. |
| values  | Collection Values        | Outputs the values of any Object, Array, Set or Map received from the left expression. |
| add     | Addition                 | Adds the first value on of the right expression to every value on the left. |
| sub     | Subtraction              | Subtracts the first value on of the right expression from every value on the left. |
| mul     | Multiplication           | Multiples every value of the left expression by the first value on the right. |
| div     | Division                 | Divides every value of the left expression by the first value on the right. |
| mod     | Modulus                  | Reduces every value of the left expression to the modulo of the first value on the right. |
| pow     | To The Power Of          | Returns every value of the left expression, to the exponent of the first value on the right. |
| abs     | Absolute Value           | Outputs the absolute value for every value in the left expression. |
| ceil    | Value Ceiling            | Rounds up every value from the left side expression to the nearest whole number |
| floor   | Value Floor              | Rounds down every value from the left side expression to the nearest whole number |
| round   | Round Value              | Rounds every value from the left side expression to the nearest whole number |
| min     | Minumum Value            | Outputs the smallest numeric value from the result of the expression left of the operator |
| max     | Maximum Value            | Outputs the largest numeric value from the result of the expression left of the operator |
| sum     | Sum of Values            | Outputs the sum of all numeric values in the result of the expression left of the operator |
| avg     | Mean Average of Values   | Outputs the mean average of all numeric value in the result of the expression left of the operator |
| med     | Median Average of Values | Outputs the median average of all numeric value in the result of the expression left of the operator |
| stddev  | Standard Deviation       | Outputs the standard deviation of all numeric value in the result of the expression left of the operator |
| random  | Random of Values         | Outputs a single random value from the results of the expression left of the operator |
| first   | First of Valeus          | Outputs the first value from the results of the expression left of the operator |
| last    | Last of Values           | Outputs the left value from the results of the expression left of the operator |
| unique  | De-duplicate Values      | Removes duplicate values from the results of the expression left of the operator |
| sort    | Sort Values              | Sorts the results of the expression left of the operator, using a case-insensitive natural sort that ignores punctuation. |
| any     | Any Value is Truthy      | Produces a single `true` if any of the results of the expression left of the operator are truthy. |
| all     | All Values Are Truthy    | Produces a single `true` if all of the results of the expression left of the operator are truthy. |
| none    | No Value is Truthy       | Produces a single `true` if none of the results of the expression left of the operator are truthy. |
| sizeof  | Length of Each Value     | Outputs the size of every result of the expression left of the operator. For collections this is the number of child elements. For strings, this is the length of the string. |
| count   | Number of Values         | Outputs how many results were produced by the expression left of the operator. |
| empty   | Empty Results            | Produces a single `true` if the expression left of the operator produced no results. |

### Regular Expressions

Any regular expression can also be used as an operator. It executes against every string result to the left side of the RegExp, and outputs an array for each item containing the matching string and any capture groups, if the item matches.

