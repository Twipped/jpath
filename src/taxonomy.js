
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
  map,
  keys,
  truthy,
} from './utils/index.js';

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

const push = (arr, ...items) => { arr.push(...items); return arr; };


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

  enter (name, extra) {
    const frame = { name, children: [], ...extra };
    const prev = debugStack[debugStack.length - 1];
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
          Debugger.enter(fn.displayName || fn.name || 'Anon', { input: p.current, scope: p.scope });
          // console.log(p.current);
          const res = fn(p);
          Debugger.exit(res);
          return res;
        };
      };
    }
  }

  build () { return named('Unit', (v) => v); }
}


export class Root extends Unit {
  build () {
    return named('Root', ({ root }) => (isUndefinedOrNull(root) ? [] : [ root ]));
  }
}

export class Scope extends Unit {
  build () {
    return named('Scope', ({ scope }) => (isUndefinedOrNull(scope) ? [] : [ scope ]));
  }
}

export class Key extends Unit {
  build () {
    return named('Key', ({ key }) => (isUndefinedOrNull(key) ? [] : [ key ]));
  }
}

export class Index extends Unit {
  build () {
    return named('Index', ({ index }) => (isUndefinedOrNull(index) ? [] : [ index ]));
  }
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

}

export class Descend extends Unit {

  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    if (isString(unit) || isNumber(unit)) {
      return named(`Descend[${unit}]`,
        ({ current }) => current.reduce((results, item) => {
          const value = select(item, unit);
          if (isNotUndefinedOrNull(value)) results.push(value);
          return results;
        }, []),
      );
    }

    if (unit instanceof Slice) return named('Descend[Slice]', unit.build());

    if (unit instanceof Filter) {
      unit = unit.build();
      return named('Descend>Filter', (props) => props.current.reduce((results, item) => {
        const items = unit({ ...props, scope: item, current: ensureArray(item) });
        results.push(...items);
        return results;
      }, []));
    }

    if (unit instanceof Unit) unit = unit.build();
    if (!isFunction(unit)) throw new Error('Descend did not receive a valid target unit');

    return named('Descend', (props) => props.current.reduce((results, item) => {
      const targetKeys = unit({ ...props, scope: item, current: keys(item) });
      for (const targetKey of targetKeys) {
        const targetValue = select(item, targetKey);
        if (isNotUndefinedOrNull(targetValue)) results.push(targetValue);
      }
      return results;
    }, []));
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
}

export class Slice extends Unit {

  constructor (units = []) {
    super({ units });
  }

  push (unit) {
    this.units.push(unit);
  }

  build () {
    const units = this.units.map((unit) => (unit instanceof Unit ? unit.build() : unit));

    return named('Slice', (props) => {
      const current = props.current.filter((item) => isArray(item));
      let [ start, stop, step ] = units.map((unit) => (isFunction(unit) ? unit(props) : [])).map((a) => a[0]);
      start = isUndefinedOrNull(start) ? undefined : parseFloat(start);
      stop =  isUndefinedOrNull(stop) ? undefined : parseFloat(stop);
      step =  isUndefinedOrNull(step) ? undefined : parseFloat(step);

      if (!step) {
        return current.reduce((items, item) => (
          isArray(item) || isString(item) ? push(items, ...item.slice(start, stop)) : items
        ), []);
      }

      return current.reduce((items, item) => {
        if (!isArray(item) && !isString(item)) return items;
        const len = item.length;
        const first = start === undefined ? 0 : Math.max(0, start < 0 ? start + len : start);
        const last = stop === undefined ? len - 1 : Math.min(stop < 0 ? stop + len : stop, len - 1);
        const result = [];
        if (step > 0) {
          for (let i = first; i <= last; i += step) {
            result.push(item[i]);
          }
        } else {
          for (let i = last; i >= first; i += step) {
            result.push(item[i]);
          }
        }

        if (isString(item)) return push(items, result.join(''));
        return push(items, ...result);
      }, []).filter(isNotUndefinedOrNull);
    });
  }
}


export class Union extends Unit {

  constructor (units = []) {
    super({ units });
  }

  push (unit) {
    this.units.push(unit);
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
      return result;
    });
  }
}


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
}

export class Operand extends Unit {

  constructor (operator = null, arity, fn = null, left = null, right = null) {
    super({ operator, arity, fn, left, right });
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
      throw new TypeError(`Unrecognized operand arity: "${arity}"`);

    }
  }

}

function badUnit (source, unit, target = '') {
  const e = new TypeError(`${source} received an invalid unit type (${typeof unit})${target && ' for ' + target}.`);
  e.code = 'E_BAD_UNIT';
  throw e;
}
