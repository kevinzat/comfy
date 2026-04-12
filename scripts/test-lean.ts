/**
 * For each .prf file in src/proof/proofs/, generate the Lean 4 translation,
 * write it to an output directory, and verify it compiles by running `lean`.
 *
 * Usage: npx vitest run scripts/test-lean.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { parseProofFile } from '../src/proof/proof_file';
import { toLean } from '../src/proof/lean';

const proofsDir = path.join(import.meta.dirname, '..', 'src', 'proof', 'proofs');
const prfFiles = fs.readdirSync(proofsDir)
    .filter(f => f.endsWith('.prf'))
    .sort();

describe('lean compilation', function() {
  it('found .prf files to test', function() {
    assert.ok(prfFiles.length > 0, `No .prf files found in ${proofsDir}`);
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-lean-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  for (const file of prfFiles) {
    it(`${file} compiles in Lean`, function() {
      const source = fs.readFileSync(path.join(proofsDir, file), 'utf-8');
      const pf = parseProofFile(source).file;
      const lean = toLean(pf);

      const leanFile = path.join(tmpDir, file.replace('.prf', '.lean'));
      fs.writeFileSync(leanFile, lean);

      try {
        execFileSync('lean', [leanFile], { stdio: 'pipe' });
      } catch (err: any) {
        const stderr = err.stderr?.toString() ?? '';
        const stdout = err.stdout?.toString() ?? '';
        assert.fail(`lean failed on ${file}:\n${stderr}\n${stdout}`);
      }
    }, 60_000);
  }
});
