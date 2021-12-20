
import {
  Statement,
  Literal,
  Descend,
  Recursive,
  Slice,
  Union,
  Filter,
  Operand,
  Mapper,
  RegularExpression,
  Hashmap,
  Reduce,
} from './taxonomy.js';

// eslint-disable-next-line node/no-missing-import
import { makeObservable, observable, computed, action, isObservable } from 'mobx';

export {
  Unit,
  Root,
  Scope,
  Key,
  Index,
} from './taxonomy.js';

const annotations = new Map([
  [ Statement, {
    units: observable,
    length: computed,
    reset: action,
    push: action,
    remove: action,
  } ],
  [ Literal, {
    value: observable,
  } ],
  [ Descend, {
    unit: observable,
  } ],
  [ Recursive, {
    unit: observable,
  } ],
  [ Slice, {
    units: observable,
  } ],
  [ Union, {
    units: observable,
    length: computed,
    reset: action,
    push: action,
    remove: action,
  } ],
  [ Filter, {
    unit: observable,
  } ],
  [ Operand, {
    operator: observable,
    arity: observable,
    precedence: observable,
    left: observable,
    right: observable,
  } ],
  [ Mapper, {
    unit: observable,
  } ],
  [ RegularExpression, {
    regex: observable,
  } ],
  [ Hashmap, {
    properties: observable,
    add: action,
    remove: action,
    length: computed,
    reset: action,
    entries: computed,
  } ],
  [ Reduce, {
    operator: observable,
    units: observable,
    length: computed,
    reset: action,
    push: action,
    remove: action,
  } ],
]);

export default function annotate (unit) {
  if (isObservable(unit)) return unit;
  const anno = annotations.get(unit.constructor);
  if (!anno) return unit;
  if (unit.unit) annotate(unit.unit);
  if (unit.units) unit.units.map(annotate);
  if (unit.properties) unit.properties.forEach((v, k) => [ annotate(v), annotate(k) ]);
  if (unit.left) annotate(unit.left);
  if (unit.right) annotate(unit.right);
  if (unit.build) {
    const c = computed(unit.build.bind(unit));
    unit.build = () => c.get();
  }
  makeObservable(unit, {
    ...anno,
    weight: computed,
  });
  return unit;
}
