
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
} from './utils/index.js';

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
  '*':        [ 1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...values(item)) : push(items, item)), []) ],
  '~':        [ 1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...keys(item)) : push(items, item)), []) ],

  '===':      [ 0, ([ a ], [ b ]) => bool(a === b) ],
  '==':       [ 0, ([ a ], [ b ]) => bool(a  == b) ], // eslint-disable-line eqeqeq
  '!==':      [ 0, ([ a ], [ b ]) => bool(a !== b) ],
  '!=':       [ 0, ([ a ], [ b ]) => bool(a !=  b) ], // eslint-disable-line eqeqeq
  '<=':       [ 0, ([ a ], [ b ]) => bool(a <=  b) ],
  '<':        [ 0, ([ a ], [ b ]) => bool(a  <  b) ],
  '>=':       [ 0, ([ a ], [ b ]) => bool(a >=  b) ],
  '>':        [ 0, ([ a ], [ b ]) => bool(a  >  b) ],
  '-':        [ 0, ([ a ], [ b ]) => [ Number(a)  -  Number(b) ] ],
  '+':        [ 0, ([ a ], [ b ]) => [ Number(a)  +  Number(b) ] ],

  '&&':       [ 0, (seta, setb) => (seta.filter(truthy).length ? setb : seta) ],
  '||':       [ 0, (seta, setb) => (seta.filter(truthy).length ? seta : setb) ],
  '??':       [ 0, (seta, setb) => ( seta.length ? seta : setb ) ],

  '!!':       [ -1, (set) => bool( set.filter(falsey).length) ],
  '!':        [ -1, (set) => bool(!set.filter(falsey).length) ],

  is:    [ 0, (seta, setb) => {
    const m = intersect(seta, setb).length;
    return bool(m === seta.length && m === setb.length);
  } ],
  in:         [ 0, (seta, setb) => intersect(seta, setb) ],
  not:        [ 0, (seta, setb) => difference(seta, setb) ],
  subset:     [ 0, (seta, setb) => (intersect(seta, setb).length === seta.length ? seta : []) ],
  size:       [ 0, (seta, setb)   => bool(seta.length === setb.length) ],
  typeof:     [ 0, ([ a ], [ b ]) => bool(typeof a === typeof b) ],
  ntypeof:    [ 0, ([ a ], [ b ]) => bool(typeof a !== typeof b) ],
  mod:        [ 0, (set, [ b ])   => set.map((a) => a % b) ],
  pow:        [ 0, (set, [ b ])   => set.map((a) => Math.pow(a, b)) ],
  join:       [ 0, (set, [ del ]) => [ set.join(del) ] ],
  split:      [ 0, (set, [ del ]) => set.reduce((results, a) => ( isString(a) ? push(results, a.split(del)) : results)) ],
  add:        [ 0, (set, [ b ])   => set.map((a) => a + b) ],
  sub:        [ 0, (set, [ b ])   => set.map((a) => a - b) ],
  mul:        [ 0, (set, [ b ])   => set.map((a) => a * b) ],
  div:        [ 0, (set, [ b ])   => set.map((a) => a / b) ],

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
