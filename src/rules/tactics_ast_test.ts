
import * as assert from 'assert';
import { Variable } from '../facts/exprs';
import { AlgebraTacticAst, SubstituteTacticAst, DefinitionTacticAst, ApplyTacticAst } from './tactics_ast';

const x = Variable.of('x');
const y = Variable.of('y');

describe('AlgebraTacticAst.to_string', function() {

  it('formats without refs', function() {
    const ast = new AlgebraTacticAst('=', x, []);
    assert.strictEqual(ast.to_string(), '= x');
  });

  it('formats with refs', function() {
    const ast = new AlgebraTacticAst('=', x, [1, 2]);
    assert.strictEqual(ast.to_string(), '= x since 1 2');
  });
});

describe('SubstituteTacticAst.to_string', function() {

  it('formats subst without expr', function() {
    const ast = new SubstituteTacticAst(1, true);
    assert.strictEqual(ast.to_string(), 'subst 1');
  });

  it('formats unsub without expr', function() {
    const ast = new SubstituteTacticAst(2, false);
    assert.strictEqual(ast.to_string(), 'unsub 2');
  });

  it('formats subst with expr', function() {
    const ast = new SubstituteTacticAst(1, true, x);
    assert.strictEqual(ast.to_string(), 'subst 1 => x');
  });

  it('formats unsub with expr', function() {
    const ast = new SubstituteTacticAst(3, false, y);
    assert.strictEqual(ast.to_string(), 'unsub 3 => y');
  });
});

describe('DefinitionTacticAst.to_string', function() {

  it('formats defof without refs or expr', function() {
    const ast = new DefinitionTacticAst('f', true);
    assert.strictEqual(ast.to_string(), 'defof f');
  });

  it('formats undef without refs or expr', function() {
    const ast = new DefinitionTacticAst('f', false);
    assert.strictEqual(ast.to_string(), 'undef f');
  });

  it('formats defof with refs', function() {
    const ast = new DefinitionTacticAst('f', true, [1, 2]);
    assert.strictEqual(ast.to_string(), 'defof f since 1 2');
  });

  it('formats defof with expr', function() {
    const ast = new DefinitionTacticAst('f', true, [], x);
    assert.strictEqual(ast.to_string(), 'defof f => x');
  });

  it('formats defof with refs and expr', function() {
    const ast = new DefinitionTacticAst('f', true, [1], y);
    assert.strictEqual(ast.to_string(), 'defof f since 1 => y');
  });
});

describe('ApplyTacticAst.to_string', function() {

  it('formats apply without refs or expr', function() {
    const ast = new ApplyTacticAst('thm', true);
    assert.strictEqual(ast.to_string(), 'apply thm');
  });

  it('formats unapp without refs or expr', function() {
    const ast = new ApplyTacticAst('thm', false);
    assert.strictEqual(ast.to_string(), 'unapp thm');
  });

  it('formats apply with refs', function() {
    const ast = new ApplyTacticAst('thm', true, [1, 2]);
    assert.strictEqual(ast.to_string(), 'apply thm since 1 2');
  });

  it('formats apply with expr', function() {
    const ast = new ApplyTacticAst('thm', true, [], x);
    assert.strictEqual(ast.to_string(), 'apply thm => x');
  });

  it('formats apply with refs and expr', function() {
    const ast = new ApplyTacticAst('thm', true, [1], y);
    assert.strictEqual(ast.to_string(), 'apply thm since 1 => y');
  });
});
