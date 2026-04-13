/**
 * Thrown in response to some type of user error. Bugs should be indicated using
 * the normal Error class.
 */
export class UserError extends Error {
  /** 1-indexed line number where the error occurred, or 0 if unknown. */
  line: number;
  /** 1-indexed column number where the error occurred, or 0 if unknown. */
  col: number;
  /** Length of the offending token, or 0 if unknown. */
  length: number;

  constructor(msg: string, line: number, col: number, length: number) {
    super(msg);
    this.line = line;
    this.col = col;
    this.length = length;

    // hack workaround of TS transpiling bug (so gross)
    Object.setPrototypeOf(this, UserError.prototype);
  }
}