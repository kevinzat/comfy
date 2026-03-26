import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseProofFile } from './proof_file';
import { toLean } from './lean';


const proofsDir = path.join(__dirname, 'proofs');
const proofFiles = fs.readdirSync(proofsDir)
    .filter(f => f.endsWith('.prf'))
    .sort();

describe('toLean', function() {
  for (const file of proofFiles) {
    it(`translates ${file}`, function() {
      const source = fs.readFileSync(path.join(proofsDir, file), 'utf-8');
      const pf = parseProofFile(source);
      const lean = toLean(pf);

      // Basic structure checks
      assert.ok(lean.includes('namespace Comfy'));
      assert.ok(lean.includes('end Comfy'));
      assert.ok(lean.includes('theorem'));
      assert.ok(lean.includes(':= by'));
    });
  }

  it('concat_nil produces expected Lean structure', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'concat_nil.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('inductive List where'));
    assert.ok(lean.includes('| nil : List'));
    assert.ok(lean.includes('| cons : Int → List → List'));
    assert.ok(lean.includes('def concat : List → List → List'));
    assert.ok(lean.includes('theorem concat_nil (S : List) : concat S .nil = S := by'));
    assert.ok(lean.includes('induction S with'));
    assert.ok(lean.includes('| nil =>'));
    assert.ok(lean.includes('| cons a L ih =>'));
    assert.ok(lean.includes('simp [concat]'));
    assert.ok(lean.includes('simp [concat, ih]'));
  });

  it('tree_size has two IH names', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'tree_size.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('| node L R ih_L ih_R =>'));
    assert.ok(lean.includes('ih_L'));
    assert.ok(lean.includes('ih_R'));
  });

  it('sum_positives has by_cases', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'sum_positives.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('by_cases h : a < 0'));
    assert.ok(lean.includes('simp [sum, positives, ih, h]'));
  });

  it('rev_acc uses concat_assoc axiom', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'rev_acc.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    assert.ok(lean.includes('axiom concat_assoc'));
    assert.ok(lean.includes('concat_assoc'));
  });

  it('expressions use Lean syntax (no parens for function calls)', function() {
    const source = fs.readFileSync(path.join(proofsDir, 'concat_nil.prf'), 'utf-8');
    const pf = parseProofFile(source);
    const lean = toLean(pf);

    // Should use "concat S .nil" not "concat(S, nil)"
    assert.ok(lean.includes('concat S .nil'));
    // Constructor in patterns should use dot notation
    assert.ok(lean.includes('.nil'));
    assert.ok(lean.includes('.cons'));
  });
});
