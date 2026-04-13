/**
 * Thrown in response to some type of user error. Bugs should be indicated using
 * the normal Error class.
 */
export class UserError extends Error {
  /** 1-indexed line number where the error occurred, or 0 if unknown. */
  line: number;
  /** 1-indexed column number where the error occurred, or 0 if unknown. */
  col: number;

  constructor(msg: string, line: number = 0, col: number = 0) {
    super(msg);
    this.line = line;
    this.col = col;

    // hack workaround of TS transpiling bug (so gross)
    Object.setPrototypeOf(this, UserError.prototype);
  }
}