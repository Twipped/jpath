
import { DEFAULT_OPERATORS } from './operators.js';
import tokenize from './tokenizer.js';
import lex from './lexer.js';
import { Debugger } from './taxonomy.js';

export * from './taxonomy.js';
export { default as tokenize } from './tokenizer.js';
export { DEFAULT_OPERATORS } from './operators.js';

export function parse (path, { operators, debug } = {}) {
  operators = { ...DEFAULT_OPERATORS, ...operators };
  const tokens = tokenize(path, { operators, debug });
  return lex(tokens, { operators, debug });
}

export function parseSafe (...args) {
  try {
    return { ast: parse(...args), error: null };
  } catch (error) {
    return { ast: null, error };
  }
}

export function compile (path, { operators, debug, cache } = {}) {

  let fn = !debug && cache && cache.get && cache.get(path);
  if (!fn) {
    const ast = parse(path, { operators, debug });
    fn = ast.make();
    cache && cache.set(path, fn);
  }

  return fn;
}

export function compileSafe (path, { operators, debug, cache } = {}) {

  let fn = !debug && cache && cache.get && cache.get(path);
  if (!fn) {
    try {
      const ast = parse(path, { operators, debug });
      fn = ast.make();
      cache && cache.set(path, fn);
      return { fn, error: null };
    } catch (error) {
      return { fn: null, error };
    }
  }

  return { fn, error: null };
}

const executeCache = new Map();
export function execute (path, data, { operators, debug, cache = executeCache } = {}) {
  return compile(path, { operators, debug, cache })(data);
}

export function verbose (path, data, { operators } = {}) {
  const prevDebug = Debugger.enabled;
  Debugger.enable(true);
  const ast = parse(path, { operators });
  const fn = ast.make();
  Debugger.enter();
  const result = Debugger.exit(fn(data));
  result.ast = ast;
  Debugger.enable(prevDebug);
  return result;
}

export default {
  parse,
  parseSafe,
  compile,
  compileSafe,
  execute,
};
