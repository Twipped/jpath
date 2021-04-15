
import {
  isObject,
  isArray,
  isNumeric,
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

export const DEFAULT_OPERATORS = {
  '*':        [ 1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...values(item)) : push(items, item)), []) ],
  '~':        [ 1, (set) => set.reduce((items, item) => (isMappable(item) ? push(items, ...keys(item)) : push(items, item)), []) ],

  '===':      [ 0, ([ a ], [ b ]) => [ a === b ] ],
  '==':       [ 0, ([ a ], [ b ]) => [ a ==  b ] ], // eslint-disable-line eqeqeq
  '!==':      [ 0, ([ a ], [ b ]) => [ a !== b ] ],
  '!=':       [ 0, ([ a ], [ b ]) => [ a !=  b ] ], // eslint-disable-line eqeqeq
  '<=':       [ 0, ([ a ], [ b ]) => [ a <=  b ] ],
  '<':        [ 0, ([ a ], [ b ]) => [ a <   b ] ],
  '>=':       [ 0, ([ a ], [ b ]) => [ a >=  b ] ],
  '>':        [ 0, ([ a ], [ b ]) => [ a >   b ] ],
  '-':        [ 0, ([ a ], [ b ]) => [ a - b ] ],
  '+':        [ 0, ([ a ], [ b ]) => [ a + b ] ],

  '&&':       [ 0, (seta, setb) => (seta.filter(truthy).length ? setb : seta) ],
  '||':       [ 0, (seta, setb) => (seta.filter(truthy).length ? seta : setb) ],
  '??':       [ 0, (seta, setb) => ( seta.length ? seta : setb ) ],

  '!':        [ -1, (set) => (set.filter(falsey).length ? [] : [ true ]) ],

  is:    [ 0, (seta, setb) => {
    const m = intersect(seta, setb).length;
    return m === seta.length && m === setb.length;
  } ],
  in:         [ 0, (seta, setb) => intersect(seta, setb) ],
  not:        [ 0, (seta, setb) => difference(seta, setb) ],
  subset:     [ 0, (seta, setb) => (intersect(seta, setb).length === seta.length ? seta : []) ],
  size:       [ 0, (seta, setb)   => [ seta.length === setb.length ] ],
  typeof:     [ 0, ([ a ], [ b ]) => [ typeof a === typeof b ] ],
  ntypeof:    [ 0, ([ a ], [ b ]) => [ typeof a !== typeof b ] ],
  mod:        [ 0, (set, [ b ])   => set.map((a) => a % b) ],
  nmod:       [ 0, (set, [ b ])   => set.map((a) => a % b === 0) ],
  pow:        [ 0, (set, [ b ])   => set.map((a) => Math.pow(a, b)) ],
  join:       [ 0, (set, [ del ]) => [ set.join(del) ] ],
  add:        [ 0, (set, [ b ])   => set.map((a) => a + b) ],
  sub:        [ 0, (set, [ b ])   => set.map((a) => a - b) ],
  mul:        [ 0, (set, [ b ])   => set.map((a) => a * b) ],
  div:        [ 0, (set, [ b ])   => set.map((a) => a / b) ],

  keys:       [ -1, (set) => set.reduce((items, item) => push(items, ...keys(item)), []) ],
  values:     [ -1, (set) => set.reduce((items, item) => push(items, ...values(item)), []) ],
  abs:        [ -1, (set) => set.map(Math.abs) ],
  ceil:       [ -1, (set) => set.map(Math.ceil) ],
  floor:      [ -1, (set) => set.map(Math.floor) ],
  round:      [ -1, (set) => set.map(Math.round) ],
  min:        [ -1, (set) => [ Math.min(...set) ] ],
  max:        [ -1, (set) => [ Math.max(...set) ] ],
  sum:        [ -1, (set) => [ sum(set.filter(isNumeric)) ] ],
  avg:        [ -1, (set) => [ avg(set.filter(isNumeric)) ] ],
  med:        [ -1, (set) => [ median(set.filter(isNumeric)) ] ],
  stddev:     [ -1, (set) => [ stddev(set.filter(isNumeric)) ] ],
  random:     [ -1, (set) => [ randomItem(set) ] ],
  first:      [ -1, (set) => [ set[0] ] ],
  last:       [ -1, (set) => [ set[set.length - 1] ] ],
  unique:     [ -1, (set) => uniq(set) ],
  any:        [ -1, (set) => (any(set) ? [ true ] : []) ],
  all:        [ -1, (set) => (all(set) ? [ true ] : []) ],
  none:       [ -1, (set) => (none(set) ? [ true ] : []) ],
  sizeof:     [ -1, ([ a ]) => [ sizeOf(a) ] ],
  count:      [ -1, (set) => [ set.length ] ],
  empty:      [ -1, (set) => (set.length ? [] : [ true ]) ],
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
