
import {
  isMappable,
  isArray,
  isObject,
  isMap,
  isUndefined,
  isUndefinedOrNull,
  isNotUndefinedOrNull,
  isString,
  isNumber,
  isFunction,
  map,
  keys,
} from '@twipped/utils';

function ensureArray (input) {
  return (isArray(input) ? input : [ input ]).filter(isNotUndefinedOrNull);
}

function named (name, fn) {
  fn.name = name;
  return fn;
}

function select (collection, key) {
  if (isArray(collection) || isObject(collection, true)) return collection[key];
  if (isMap(collection)) return map.get(key);
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

  enter (name) {
    const frame = { name, children: [] };
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
        return (...args) => {
          Debugger.enter(fn.name);
          const res = fn(...args);
          Debugger.exit(res);
          return res;
        };
      };
    }
  }

  build () { return named('Unit', (v) => v); }
}

export class Statement extends Unit {

  constructor (units = []) {
    super({ units });
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
        ({ current }) => current.map((item) => select(item, unit)).filter(isUndefined),
      );
    }

    if (unit instanceof Slice) return unit.build();

    if (unit instanceof Unit) unit = unit.build();
    if (!isFunction(unit)) throw new Error('Descend did not receive a valid target unit');

    return named('Descend', (props) => props.current.reduce((items, item) => {
      if (!isMappable(item)) return items;

      items.push(...unit({ ...props, scope: item, current: keys(item) }));

      return items;
    }, []));
  }

}

export class Recursive extends Unit {
  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    if (unit instanceof Unit) unit = unit.build();

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

    return named('Recursive', (props) => {

      const results = [];
      const seen = new Set();
      function walk (item) {
        if (!isMappable(item) || seen.has(item)) return;
        seen.add(item); // this is to prevent circular reference loops

        map(item, (v) => {
          const level = unit({ ...props, scope: v }).filter(isNotUndefinedOrNull);
          if (level.length) results.push(...level);
          walk(v);
        });
      }

      props.current.map(walk);
      return results;
    });
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

    return (props) => {
      const current = props.current.filter((item) => isArray(item));
      let [ [ start ], [ stop ], [ step ] ] = units.map((unit) => (isFunction(unit) ? unit(props) : []));
      start = isUndefinedOrNull(start) ? null : parseFloat(start);
      stop =  isUndefinedOrNull(stop) ? null : parseFloat(stop);
      step =  isUndefinedOrNull(step) ? null : parseFloat(step);

      if (!step) {
        return current.reduce((items, item) => (
          isArray(item) || isString(item) ? items.push(...item.slice(start, stop)) : items
        ), []);
      }

      return current.reduce((items, item) => {
        if (!isArray(item) && !isString(item)) return items;
        const len = item.length;
        const first = start === null ? 0 : Math.max(0, start < 0 ? start + len : start);
        const last = stop === null ? len - 1 : Math.min(stop < 0 ? stop + len : stop, len - 1);
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

        if (isString(item)) return items.push(result.join(''));
        return items.push(...result);
      }, []).filter(isNotUndefinedOrNull);
    };
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
    if (!isFunction(unit)) throw new Error('Filter did not receive a valid target unit');

    return named('Filter',
      (props) => props.current.reduce(
        (items, item) => map(item,
          (scope, key, index) => (unit({ ...props, scope, key, index })[0] ? items.push(scope) : items),
        ),
        [],
      ),
    );
  }
}

export class Script extends Unit {

  constructor (unit = null) {
    super({ unit });
  }

  build () {
    let { unit } = this;
    if (unit instanceof Unit) unit = unit.build();
    if (!isFunction(unit)) throw new Error('Script did not receive a valid target unit');

    return named('Script',
      (props) => props.current.reduce(
        (current, item) => map(item,
          (scope, key, index) => current.push(...unit({ ...props, scope, key, index })),
        ),
        [],
      ).filter(isNotUndefinedOrNull),
    );
  }
}

export class Operand extends Unit {

  constructor (operator = null, fn = null, left = null, right = null) {
    super({ operator, fn, left, right });
  }

  build () {
    let { operator, fn, left, right } = this;
    if (!fn) throw new Error(`"${operator}" is not a recognized operator.`);

    if (left === null && right === null) {
      return named(`Operand[${operator}]`,
        ({ current }) => ensureArray(fn(current)),
      );
    }

    if (left) {
      if (left instanceof Unit) left = left.build();
      if (!isFunction(left)) throw new Error('Did not find a valid statement left of the "' + operator + '" operator.');
    }

    if (right) {
      if (right instanceof Unit) right = right.build();
      if (!isFunction(right)) throw new Error('Did not find a valid statement right of the "' + operator + '" operator.');
    }

    if (left && right) {
      return named(`Operand[${operator}]`,
        (props) => ensureArray(fn(left(props), right(props))),
      );
    }

    if (right && !left) {
      return named(`Operand[${operator}]`,
        (props) => ensureArray(fn(right(props))),
      );
    }

    if (left && !right) {
      // the lexer shouldn't produce this, but lets just cover our bases
      return named(`Operand[${operator}]`,
        (props) => ensureArray(fn(left(props))),
      );
    }
  }
}

