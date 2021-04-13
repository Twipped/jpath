
import { DEFAULT_OPERATORS } from './operators.js';
import tokenize from './tokenizer.js';
import lex from './lexer.js';
import { Debugger } from './taxonomy.js';

export * from './taxonomy.js';
export { default as tokenize } from './tokenizer.js';

export function parse (path, { operators, debug } = {}) {
  operators = { ...DEFAULT_OPERATORS, ...operators };
  const tokens = tokenize(path, { operators, debug });
  return lex(tokens, { operators, debug });
}

export function compile (path, { operators, debug, cache } = {}) {

  let fn = !debug && cache && cache.get && cache.get(path);
  if (!fn) {
    const ast = parse(path, { operators, debug });
    const trunk = ast.build();
    fn = (data) => trunk({ root: data, scope: data, current: [ data ] });
    cache && cache.set(path, fn);
  }

  return fn;
}

export function execute (path, data, { operators, debug, cache = new Map } = {}) {
  return compile(path, { operators, debug, cache })(data);
}

export function verbose (path, data, { operators }) {
  const prevDebug = Debugger.enabled;
  Debugger.enable(true);
  const ast = parse(path, { operators });
  const trunk = ast.build();
  Debugger.enter('verbose');
  const result = Debugger.exit(trunk({ root: data, scope: data, current: [ data ] }));
  Debugger.enable(prevDebug);
  return result;
}

export default {
  tokenize,
  parse,
  compile,
  execute,
  verbose,
};
