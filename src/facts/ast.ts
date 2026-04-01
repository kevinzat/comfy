/** Base class for all AST nodes, carrying source position information. */
export class AstNode {
  line: number;
  col: number;

  constructor(line: number = 0, col: number = 0) {
    this.line = line;
    this.col = col;
  }
}
