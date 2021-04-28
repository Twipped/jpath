
import {
  isObject,
  isArray,
  isNumeric,
  isString,
  sum,
  avg,
  median,
  stddev,
  keys,
  values,
  sizeOf,
  uniq,
  any,
  all,
  none,
  intersect,
  difference,
  isMappable,
  truthy,
  falsey,
} from '@twipped/utils';

function randomItem (items) {
  if (isArray(items)) return () => items[ ~~(Math.random() * items.length) ];
  if (isObject(items)) {
    return randomItem(Object.values(items));
  }
}

const push = (arr, ...items) => { arr.push(...items); return arr; };

function bool (input) { return  input ? [ true ] : []; }

var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base', ignorePunctuation: true, caseFirst: false });


export const DEFAULT_OPERATORS = {
  '&&':       [ 'r', (seta, setb) => (seta.filter(truthy).length ? setb : seta), 7 ],
  '||':       [ 'r', (seta, setb) => (seta.filter(truthy).length ? seta : setb), 6 ],
  '??':       [ 'r', (seta, setb) => ( seta.length ? seta : setb ), 5 ],

  '*':        [ 1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...values(item)) : push(items, item)), []) ],
  '~':        [ 1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...keys(item)) : push(items, item)), []) ],

  '===':      [ 0, ([ a ], [ b ]) => bool(a === b), 11 ],
  '==':       [ 0, ([ a ], [ b ]) => bool(a  == b), 11 ], // eslint-disable-line eqeqeq
  '!==':      [ 0, ([ a ], [ b ]) => bool(a !== b), 11 ],
  '!=':       [ 0, ([ a ], [ b ]) => bool(a !=  b), 11 ], // eslint-disable-line eqeqeq
  '<=':       [ 0, ([ a ], [ b ]) => bool(a <=  b), 12 ],
  '<':        [ 0, ([ a ], [ b ]) => bool(a  <  b), 12 ],
  '>=':       [ 0, ([ a ], [ b ]) => bool(a >=  b), 12 ],
  '>':        [ 0, ([ a ], [ b ]) => bool(a  >  b), 12 ],
  '-':        [ 0, ([ a ], [ b ]) => [ Number(a)  -  Number(b) ], 14 ],
  '+':        [ 0, ([ a ], [ b ]) => [ Number(a)  +  Number(b) ], 14 ],

  '!!':       [ -1, (set) => bool( set.filter(falsey).length), 17 ],
  '!':        [ -1, (set) => bool(!set.filter(falsey).length), 17 ],

  is:    [ 0, (seta, setb) => {
    const m = intersect(seta, setb).length;
    return bool(m === seta.length && m === setb.length);
  }, 17 ],
  in:         [ 0, (seta, setb) => intersect(seta, setb), 17 ],
  not:        [ 0, (seta, setb) => difference(seta, setb), 17 ],
  subset:     [ 0, (seta, setb) => (intersect(seta, setb).length === seta.length ? seta : []), 2 ],
  size:       [ 0, (seta, setb)   => bool(seta.length === setb.length), 2 ],
  typeof:     [ 0, ([ a ], [ b ]) => bool(typeof a === typeof b), 17 ],
  ntypeof:    [ 0, ([ a ], [ b ]) => bool(typeof a !== typeof b), 17 ],
  exp:        [ 0, (set, [ b ])   => set.map((a) => a ** b), 16 ],
  add:        [ 0, (set, [ b ])   => set.map((a) => a + b), 14 ],
  sub:        [ 0, (set, [ b ])   => set.map((a) => a - b), 14 ],
  mul:        [ 0, (set, [ b ])   => set.map((a) => a * b), 15 ],
  div:        [ 0, (set, [ b ])   => set.map((a) => a / b), 15 ],
  mod:        [ 0, (set, [ b ])   => set.map((a) => a % b), 15 ],
  join:       [ 0, (set, [ del ]) => [ set.join(del) ], 17 ],
  split:      [ 0, (set, [ del ]) => set.reduce((results, a) => ( isString(a) ? push(results, a.split(del)) : results)), 17 ],

  keys:       [ -1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...keys(item)) : items), []) ],
  values:     [ -1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...values(item)) : items), []) ],
  abs:        [ -1, (set) => set.map(Math.abs) ],
  ceil:       [ -1, (set) => set.map(Math.ceil) ],
  floor:      [ -1, (set) => set.map(Math.floor) ],
  round:      [ -1, (set) => set.map(Math.round) ],
  min:        [ -1, (set) => [ Math.min(...set.filter(isNumeric)) ] ],
  max:        [ -1, (set) => [ Math.max(...set.filter(isNumeric)) ] ],
  sum:        [ -1, (set) => [ sum(set.filter(isNumeric)) ] ],
  avg:        [ -1, (set) => [ avg(set.filter(isNumeric)) ] ],
  med:        [ -1, (set) => [ median(set.filter(isNumeric)) ] ],
  stddev:     [ -1, (set) => [ stddev(set.filter(isNumeric)) ] ],
  random:     [ -1, (set) => [ randomItem(set) ] ],
  first:      [ -1, (set) => [ set[0] ] ],
  last:       [ -1, (set) => [ set[set.length - 1] ] ],
  unique:     [ -1, (set) => uniq(set) ],
  any:        [ -1, (set) => bool(any(set)) ],
  all:        [ -1, (set) => bool(all(set)) ],
  none:       [ -1, (set) => bool(none(set)) ],
  sizeof:     [ -1, (set) => set.map(sizeOf) ],
  count:      [ -1, (set) => [ set.length ] ],
  empty:      [ -1, (set) => bool(set.length) ],
  sort:       [ -1, (set) => [ ...set ].sort(collator.compare) ],
};

export function parseOperators (ops) {
  const o = {
    SYMBOLS: [],
    WORDS: [],
  };

  for (const name of Object.keys(ops)) {
    const char = name.charCodeAt(0);
    if ((char >= 65 && char <= 90) || (char >= 97 && char <= 122)) {
      // word based
      o.WORDS.push(name);
      continue;
    }

    o.SYMBOLS.push([ name, ...name.split('').map((s) => s.charCodeAt(0)) ]);
    continue;
  }

  o.SYMBOLS.sort(symbolsort);

  return o;
}

function symbolsort ([ a ], [ b ]) {
  if (a.length !== b.length) return b.length - a.length;
  return a > b ? -1 : 1;
}

export function operatorIsWord (operator) {
  const char = operator.charCodeAt(0);
  return (char >= 65 && char <= 90) || (char >= 97 && char <= 122);
}
