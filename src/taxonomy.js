
import {
  isMappable,
  isArray,
  isObject,
  isMap,
  isUndefinedOrNull,
  isNotUndefinedOrNull,
  isString,
  isNumber,
  isFunction,
  isPrimitive,
  sum,
  map,
  keys,
  truthy,
} from '@twipped/utils';

import wtf, {
  E_BAD_SYNTAX,
  E_BAD_UNIT,
} from './wtf.js';

function ensureArray (input) {
  return (isArray(input) ? input : [ input ]).filter(isNotUndefinedOrNull);
}

function named (name, fn) {
  fn.displayName = name;
  return fn;
}

function select (collection, key) {
  if (isArray(collection) || isObject(collection, true)) return collection[key];
  if (isMap(collection)) return map.get(key);
}

const IDENT_MATCH = /^[a-zA-Z$_][a-zA-Z0-9$_]*$/;

export function isSafeIdent (input) {
  if (isNumber(input)) return true;
  if (!isString(input)) return false;
  return !!IDENT_MATCH.exec(input);
}

// function has (collection, key) {
//   if (isArray(collection) || isObject(collection, true)) return typeof collection[key] !== 'undefined';
//   if (isMap(collection)) return map.has(key);
//   return false;
// }

let debugStack = [];
let debugEnabled = false;
export const Debugger = {

  get enabled () {
    return debugEnabled;
  },

  enable (onoff = !debugEnabled) {
    debugEnabled = onoff;
  },

  reset () {
    debugStack = [];
  },

  enter ({ name, step, ...extra } = {}) {
    const frame = { name, children: [], ...extra };
    const prev = debugStack[debugStack.length - 1];
    if (prev && step) {
      frame.steps = [ ...prev.steps, step ];
    } else if (step) {
      frame.steps = [ step ];
    } else frame.steps = [];
    if (prev) prev.children.push(frame);
    debugStack.push(frame);
  },

  exit (result) {
    const frame = debugStack.pop();
    frame.result = result;
    return frame;
  },
};

export class Unit {

  constructor (props) {
    props && Object.assign(this, props);

    if (debugEnabled) {
      this._build = this.build;
      this.build = () => {
        const fn = this._build();
        return (p) => {
          Debugger.enter({
            name: fn.displayName || fn.name || 'Anon',
            step: this.toString(),
            input: p.current,
            scope: p.scope,
          });
          const res = fn(p);
          Debugger.exit(res);
          return res;
        };
      };
    }
  }

  get weight () { return 0; }

  build () { return named('Unit', ({ current }) => current); }

  toString () { return ''; }

  make () {
    const fn = this.build();
    return (data) => fn({
      root: data,
      scope: data,
      current: [ data ],
    });
  }
}


export class Root extends Unit {
  build () {
    return named('Root', ({ root }) => (isUndefinedOrNull(root) ? [] : [ root ]));
  }

  get weight () { return 1; }

  toString () { return '$'; }
}

export class Scope extends Unit {
  build () {
    return named('Scope', ({ scope }) => (isUndefinedOrNull(scope) ? [] : [ scope ]));
  }

  get weight () { return 1; }

  toString () { return '@'; }
}

export class Key extends Unit {
  build () {
    return named('Key', ({ key }) => (isUndefinedOrNull(key) ? [] : [ key ]));
  }

  get weight () { return 1; }

  toString () { return '#'; }
}

export class Index extends Unit {
  build () {
    return named('Index', ({ index }) => (isUndefinedOrNull(index) ? [] : [ index ]));
  }

  get weight () { return 1; }

  toString () { return '%'; }
}

export class Statement extends Unit {

  constructor (type, units = []) {
    if (isArray(type)) {
      units = type;
      type = 'root';
    }
    super({ type, units });
  }

  push (unit) {
    this.units.push(unit);
  }

  remove (unit) {
    if (isNumber(unit)) {
      this.units.splice(unit, 1);
    } else {
      const index = this.units.indexOf(unit);
      if (index > -1) this.units.splice(index, 1);
    }
  }

  get length () {
    return this.units.length;
  }

  reset () {
    this.units = [];
  }

  build () {
    const units = this.units.map((u) => u.build());

    return named('Statement', ({ current, ...props }) => {
      if (!units) return [];
      for (const unit of units) {
        current = unit({ ...props, current });
      }
      return current;
    });
  }

  get weight () {
    return sum(this.units.map((u) => u.weight || 1));
  }

  toString () {
    let result = '';
    for (let piece of this.units) {
      if (piece instanceof Slice || (piece instanceof Operand && piece.arity !== 1)) {
        piece = '(' + piece + ')';
        result += (result && ' ') + piece;
      } else {
        piece = String(piece);
        if (piece[0] === '{' || piece[0] === '(' || piece[0] === '/') result += ' ' + piece;
        else if (piece[0] === '.' || piece[0] === '['  || !result) result += piece;
        else result += '.' + piece;
      }
    }
    return result;
  }
}

export class Nested extends Unit {

  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    if (unit instanceof Unit) unit = unit.build();
    else return () => [];

    return named('Nested', ({ root, current }) => current.reduce((results, item, index) => {
      const output = unit({ root, scope: item, current: [ item ], key: index, index });
      if (output.length) results.push(output);
      return results;
    }, []));
  }

  get weight () {
    return sum(this.units.map((u) => u.weight || 1));
  }

  toString () {
    return '(' + this.unit + ')';
  }
}


export class Literal extends Unit {

  constructor (value = null) {
    super({ value });
  }

  build () {
    const { value } = this;
    if (isUndefinedOrNull(value)) return named('Null Literal', () => []);
    return named(`Literal[${value}]`, () => [ value ]);
  }

  get weight () {
    if (!isString(this.unit)) return 1;
    return Math.round(this.unit.length / 10);
  }

  toString () { return JSON.stringify(this.value); }
}

export class Descend extends Unit {

  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    let mode = null;

    if (isString(unit) || isNumber(unit)) {
      return named(`Descend[${unit}]`,
        ({ current }) => current.reduce((results, item) => {
          const value = select(item, unit);
          if (isNotUndefinedOrNull(value)) results.push(value);
          return results;
        }, []),
      );
    }

    if (unit instanceof Filter ) {
      unit = unit.build();
      return named('Descend>Filter', (props) => props.current.reduce((results, item) => {
        const items = unit({ ...props, scope: item, current: ensureArray(item) });
        results.push(...items);
        return results;
      }, []));
    }

    if (unit instanceof Slice) {
      unit = unit.build();
      return named('Descend>Slice', (props) => props.current.reduce((results, item) => {
        if (isString(item)) {
          const str = unit({ ...props, scope: item, current: item.split('') }).join('');
          if (str) results.push(str);
        } else if (isArray(item)) {
          const items = unit({ ...props, scope: item, current: item });
          results.push(...items);
        }
        return results;
      }, []));
    }

    if (unit instanceof Union) mode = 'union';
    if (unit instanceof Unit) unit = unit.build();
    if (!isFunction(unit)) throw new Error('Descend did not receive a valid target unit');

    return named('Descend', (props) => props.current.reduce((results, item) => {
      let targetKeys = unit({ ...props, scope: item, current: Array.from(keys(item)) });
      if (mode === 'union') targetKeys = targetKeys[0];
      for (const targetKey of targetKeys) {
        const targetValue = select(item, targetKey);
        if (isNotUndefinedOrNull(targetValue)) results.push(targetValue);
      }
      return results;
    }, []));
  }

  get weight () {
    if (isString(this.unit)) return Math.ceil(this.unit.length / 15);
    if (isPrimitive(this.unit)) return 1;
    return this.unit.weight || 0;
  }

  toString () {
    const { unit } = this;
    if (isString(unit)) {
      if (unit.match(IDENT_MATCH)) {
        return unit;
      }
      return `["${unit}"]`;
    }

    if (isNumber(unit)) {
      return `[${unit}]`;
    }

    if (unit instanceof Operand) {
      if (unit.arity === 1) return unit.operator;
      return '[' + unit.toString() + ']';
    }

    if (unit instanceof Unit) return '[' + unit.toString() + ']';
    return '';
  }

}

export class Recursive extends Unit {
  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;

    if (isString(unit) || isNumber(unit)) {
      return named(`Recursive[${unit}]`, ({ current }) => {
        const results = [];
        const seen = new Set();
        function walk (item) {
          if (!isMappable(item) || seen.has(item)) return;
          seen.add(item); // this is to prevent circular reference loops

          map(item, (v, k) => {
            if ((k === unit || Number(k) === unit) && isNotUndefinedOrNull(v)) {
              results.push(v);
            }
            walk(v);
          });
        }
        current.map(walk);

        return results;
      });
    }

    if (unit instanceof Filter) {
      unit = unit.unit.build();
      return named('RecursiveFilter', (props) => {
        const results = [];
        const seen = new Set();
        function walk (item, key) {
          if (!isMappable(item) || seen.has(item)) return;
          seen.add(item); // this is to prevent circular reference loops

          const matches = unit({ ...props, scope: item, current: [ item ], key }).filter(isNotUndefinedOrNull).filter(truthy).length;
          if (matches) results.push(item);

          map(item, walk);
        }

        props.current.map(walk);
        return results;
      });
    }

    if (unit instanceof Slice) {
      unit = unit.build();
      return named('RecursiveSlice', (props) => {
        const results = [];
        const seen = new Set();
        function walk (item, key) {
          if (isString(item)) {
            const str = unit({ ...props, scope: item, current: item.split(''), key }).join('');
            if (str) results.push(str);
            return;
          }

          if (!isMappable(item) || seen.has(item)) return;
          seen.add(item); // this is to prevent circular reference loops

          if (isArray(item)) {
            const items = unit({ ...props, scope: item, current: item, key });
            results.push(...items);
          }

          map(item, walk);
        }

        props.current.map(walk);
        return results;
      });
    }

    if (unit instanceof Unit) {
      unit = unit.build();
      return named('Recursive', (props) => {

        const results = [];
        const seen = new Set();
        function walk (item, key) {
          if (!isMappable(item) || seen.has(item)) return;
          seen.add(item); // this is to prevent circular reference loops

          const level = unit({ ...props, scope: item, current: [ item ], key }).filter(isNotUndefinedOrNull);
          if (level.length) results.push(...level);

          map(item, walk);
        }

        props.current.map(walk);
        return results;
      });
    }
  }

  get weight () {
    if (isString(this.unit)) return Math.round(this.unit.length / 10);
    if (isPrimitive(this.unit)) return 1;
    return this.unit.weight || 0;
  }

  toString () {
    let { unit } = this;

    if (unit instanceof Descend) {
      if (unit.unit instanceof Operand) {
        unit = unit.unit;
      } else {
        return '..' + unit.toString();
      }
    }

    if (isString(unit)) {
      if (unit.match(IDENT_MATCH)) {
        return '..' + unit;
      }
      return `..["${unit}"]`;
    }

    if (isNumber(unit)) {
      return `..[${unit}]`;
    }


    if (unit instanceof Operand) {
      if (unit.arity === 1) return '..' + unit.operator;
      return '..(' + unit.toString() + ')';
    }

    if (unit instanceof Slice) return '..(' + unit.toString() + ')';

    if (unit instanceof Unit) return '..[' + unit.toString() + ']';
    return '';
  }
}

export class Slice extends Unit {

  constructor (units = []) {
    super({ units });
  }

  push (unit) {
    if (unit instanceof Statement) {
      if (!unit.length) unit = null;
      else if (unit.length === 1) unit = unit.units[0];
    }
    this.units.push(unit);
  }

  remove (unit) {
    if (isNumber(unit)) {
      this.units.splice(unit, 1);
    } else {
      const index = this.units.indexOf(unit);
      if (index > -1) this.units.splice(index, 1);
    }
  }

  get length () {
    return this.units.length;
  }

  reset () {
    this.units = [];
  }

  build () {
    const units = this.units.map((unit) => (unit instanceof Unit ? unit.build() : unit));

    return named('Slice', (props) => {
      const { current } = props;
      const [ start, stop, step ] = units.map((unit) => (isFunction(unit) ? unit(props) : [])).map((a) => a[0]);

      return slice(current, start, stop, step);
    });
  }

  get weight () {
    return sum(this.units.map((u) => u && u.weight || 0));
  }

  toString () {
    return this.units.map((u) => (u ? String(u) : '')).join(':');
  }
}


export class Union extends Unit {

  constructor (units = []) {
    super({ units });
  }

  push (unit) {
    if (unit instanceof Statement) {
      if (!unit.length) return;
      else if (unit.length === 1) unit = unit.units[0];
    }
    this.units.push(unit);
  }

  remove (unit) {
    if (isNumber(unit)) {
      this.units.splice(unit, 1);
    } else {
      const index = this.units.indexOf(unit);
      if (index > -1) this.units.splice(index, 1);
    }
  }

  get length () {
    return this.units.length;
  }

  reset () {
    this.units = [];
  }

  build () {
    const units = this.units
      .map((u) => ((u instanceof Unit) ? u.build() : u))
      .filter(isFunction);

    return named('Union', (props) => {
      const result = [];
      for (const unit of units) {
        result.push(...unit(props));
      }
      return [ result ];
    });
  }

  get weight () {
    return sum(this.units.map((u) => u && u.weight || 1)) + 1;
  }

  toString () {
    return this.units.join(',');
  }
}

export class Hashmap extends Unit {

  constructor (properties = []) {
    super({ properties: new Map(properties) });
  }

  add (keyEx, valueEx = null) {
    if (!valueEx) valueEx = keyEx;
    if (keyEx instanceof Descend) {
      if (keyEx.unit instanceof Descend || keyEx.unit instanceof Literal) {
        keyEx = keyEx.unit;
      } else if (isPrimitive(keyEx.unit)) {
        keyEx = new Literal(keyEx.unit);
      }
    }
    this.properties.set(keyEx, valueEx);
    return this;
  }

  remove (keyEx) {
    if (isNumber(keyEx)) {
      keyEx = Array.from(this.properties.values())[keyEx];
    }
    this.properties.delete(keyEx);
  }

  get length () {
    return this.properties.size;
  }

  reset () {
    this.properties = new Map;
  }

  get entries () {
    return Array.from(this.properties.entries());
  }

  map (fn) {
    return Array.from(this.properties.entries(), fn);
  }

  get weight () {
    const entries = this.map(([ keyEx, valueEx ]) => (keyEx.weight || 1) + (valueEx.weight || 1));
    return sum(entries);
  }

  build () {
    const entries = this.map(([ keyEx, valueEx ]) => [ keyEx.build(), valueEx.build() ]);

    return named('Hashmap', (props) => {
      const obj = {};
      for (const [ keyEx, valueEx ] of entries) {
        const [ key ] = keyEx(props);
        const [ value ] = valueEx(props);
        obj[ key ] = value;
      }
      return [ obj ];
    });
  }

  toString () {
    return this.map((kv) => kv.join(': ')).join(', ');
  }
}
Hashmap.from = (input) => {
  if (input instanceof Slice) {
    if (input.units.length !== 2) {
      wtf('Encountered an unexpected number of expressions while converting a Slice to a Hashmap: ' + input.units.length, { code: E_BAD_SYNTAX });
    }
    const units = input.units.map((s) => {
      if (s instanceof Statement) {
        if (!s.length) {
          wtf('Encountered an empty expression converting a Slice to a Hashmap.', { code: E_BAD_SYNTAX });
        }
        if (s.length === 1) return s.units[0];
      }
      return s;
    });
    return new Hashmap().add(...units);
  }
  if (input instanceof Union) {
    const h = new Hashmap();
    input.units.map((u) => h.add(u));
    return h;
  }
  badUnit('Hashmap', input, 'Hashmap.from() received unsupported unit.', E_BAD_SYNTAX);
};


export class Filter extends Unit {

  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    if (unit instanceof Unit) unit = unit.build();
    else return () => [];

    return named('Filter', ({ root, current }) => current.reduce((results, item, index) => {
      const matches = unit({ root, scope: item, current: [ item ], key: undefined, index }).filter(truthy).length;
      if (matches) results.push(item);
      return results;
    }, []));
  }

  get weight () {
    return (this.unit.weight || 1) + 1;
  }

  toString () {
    return '?(' + this.unit + ')';
  }
}

export class Mapper extends Unit {

  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    if (unit instanceof Unit) unit = unit.build();
    else return () => [];

    return named('Map', ({ root, current }) => current.reduce((results, item, index) => {
      const output = unit({ root, scope: item, current: [ item ], key: index, index });
      if (output.length) results.push(...output);
      return results;
    }, []));
  }

  get weight () {
    return (this.unit.weight || 1) + 1;
  }

  toString () {
    return '{' + this.unit + '}';
  }
}

export class Operand extends Unit {

  constructor (operator = null, arity, fn = null, ...ops) {
    let precedence = 0;
    if (isNumber(ops[0])) precedence = ops.shift();
    const [ left = null, right = null ] = ops;
    super({ operator, arity, fn, precedence, left, right });
  }

  build () {
    let { operator, arity, fn, left, right } = this;
    if (!fn) throw new Error(`"${operator}" is not a recognized operator.`);

    switch (arity) {
    case -1:
      if (!(right instanceof Unit)) badUnit('Operand', right, 'right of the "' + operator + '" operator.');
      right = right.build();
      return named(`Operand[${operator}|>]`,
        (props) => ensureArray(fn(right(props))),
      );


    case  0:
      if (!(left instanceof Unit)) badUnit('Operand', left, 'left of the "' + operator + '" operator.');
      if (!(right instanceof Unit)) badUnit('Operand', right, 'right of the "' + operator + '" operator.');

      left = left.build();
      right = right.build();

      return named(`Operand[${operator}|=]`,
        (props) => ensureArray(fn(left(props), right(props))),
      );


    case  1:
      return named(`Operand[${operator}]`,
        ({ current }) => ensureArray(fn(current)),
      );

    default:
      wtf(`Unrecognized operand arity: "${arity}"`);

    }
  }

  get weight () {
    if (this.arity === 1) return 1;
    if (this.arity === -1) return this.right.weight + 1;
    return (this.left.weight || 1) + 1 + (this.right.weight || 1);
  }

  toString () {
    const { operator, arity, left, right } = this;

    switch (arity) {
    case -1: return `${operator} ${right}`;
    case  0: return `${left} ${operator} ${right}`;
    case  1:
      return operator;
    // no default
    }
  }
}

export class Reduce extends Unit {

  constructor (operator = null, fn = null, ...units) {
    super({ operator, fn, units });
  }

  push (unit) {
    if (unit instanceof Statement) {
      if (!unit.length) return;
      else if (unit.length === 1) unit = unit.units[0];
    }
    if (unit instanceof Reduce) {
      this.units.push(...unit.units);
    } else {
      this.units.push(unit);
    }
  }

  remove (unit) {
    if (isNumber(unit)) {
      this.units.splice(unit, 1);
    } else {
      const index = this.units.indexOf(unit);
      if (index > -1) this.units.splice(index, 1);
    }
  }

  get length () {
    return this.units.length;
  }

  reset () {
    this.units = [];
  }

  build () {
    const { fn } = this;
    const [ first, ...units ] = this.units
      .map((u) => ((u instanceof Unit) ? u.build() : u))
      .filter(isFunction);

    return named('Reduce', (props) => {
      let seta = first(props);
      for (const unit of units) {
        const setb = unit(props);
        seta = ensureArray(fn(seta, setb));
      }
      return seta;
    });
  }

  get weight () {
    return sum(this.units.map((u) => u.weight || 1)) + 1;
  }

  toString () {
    return this.units.join(' ' + this.operator + ' ');
  }
}

export class RegularExpression extends Unit {
  constructor (regex) {
    super({ regex });
  }

  build () {
    return named(`RegExp[${this.regex}]`, ({ current }) => current.reduce((results, item) => {
      if (isNumber(item)) item = String(item);
      if (isString(item)) {
        const match = this.regex.exec(item);
        if (match) results.push(match);
      }
      return results;
    }, []));
  }

  get weight () {
    return Math.ceil(this.regex.toString().length / 10);
  }

  toString () {
    return this.regex.toString();
  }
}

function badUnit (source, unit, target = '', code = E_BAD_UNIT) {
  const e = new TypeError(`${source} received an invalid unit type (${typeof unit})${target && ' for ' + target}: ${unit}`);
  e.unit = unit;
  e.code = code;
  throw e;
}

function slice (collection, start, stop, step) {
  if (isString(collection)) {
    collection = collection.split('');
  } else if (isObject(collection)) {
    collection = Object.values(collection);
  }

  if (!collection.length) return [];

  start = isUndefinedOrNull(start) ? undefined : parseFloat(start);
  stop =  isUndefinedOrNull(stop)  ? undefined : parseFloat(stop);
  step =  isUndefinedOrNull(step)  ? undefined : parseFloat(step);

  if (!step) {
    return collection.slice(start, stop);
  }

  const len = collection.length;
  const first = start === undefined ? 0 : Math.max(0, start < 0 ? start + len : start);
  const last = stop === undefined ? len - 1 : Math.min(stop < 0 ? stop + len : stop, len - 1);
  const result = [];
  if (step > 0) {
    for (let i = first; i <= last; i += step) {
      result.push(collection[i]);
    }
  } else {
    for (let i = last; i >= first; i += step) {
      result.push(collection[i]);
    }
  }

  if (isString(collection)) return result.join('');
}

export function identify (unit) {
  if (!(unit instanceof Unit)) return false;
  if (unit.constructor === Descend) return 'Descend';
  if (unit.constructor === Statement) return 'Statement';
  if (unit.constructor === Literal) return 'Literal';
  if (unit.constructor === Root) return 'Root';
  if (unit.constructor === Scope) return 'Scope';
  if (unit.constructor === Operand) return 'Operand';
  if (unit.constructor === Nested) return 'Nested';
  if (unit.constructor === Recursive) return 'Recursive';
  if (unit.constructor === Filter) return 'Filter';
  if (unit.constructor === Slice) return 'Slice';
  if (unit.constructor === Union) return 'Union';
  if (unit.constructor === Hashmap) return 'Hashmap';
  if (unit.constructor === Mapper) return 'Mapper';
  if (unit.constructor === Reduce) return 'Reduce';
  if (unit.constructor === Key) return 'Key';
  if (unit.constructor === Index) return 'Index';
  if (unit.constructor === RegularExpression) return 'RegularExpression';
  return 'Unit';
}
