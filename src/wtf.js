
export const E_UNEXPECTED_EOL = 'E_UNEXPECTED_EOL';
export const E_BAD_OPERATOR = 'E_BAD_OPERATOR';
export const E_BAD_TOKEN = 'E_BAD_TOKEN';
export const E_THATS_A_BUG = 'E_THATS_A_BUG';
export const E_BAD_OPERATOR_FUNCTION = 'E_BAD_OPERATOR_FUNCTION';
export const E_UNEXPECTED_CLOSE = 'E_UNEXPECTED_CLOSE';
export const E_BAD_SYNTAX = 'E_BAD_SYNTAX';
export const E_BAD_UNIT = 'E_BAD_UNIT';

export default function wtf (
  msg,
  { code = E_BAD_TOKEN, line, column, ...extra } = {},
) {
  msg += (line ? ` (${line}:${column})` : '');
  const e = new SyntaxError(msg);
  e.code = code;
  throw Object.assign(e, extra);
}
