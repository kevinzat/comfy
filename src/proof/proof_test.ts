import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseProofFile } from './proof_file';
import { checkProofFile } from './proof_file_checker';


const proofsDir = path.join(__dirname, 'proofs');
const proofFiles = fs.readdirSync(proofsDir)
    .filter(f => f.endsWith('.prf'))
    .sort();

describe('proof files', function() {
  for (const file of proofFiles) {
    it(file, function() {
      const source = fs.readFileSync(path.join(proofsDir, file), 'utf-8');
      const pf = parseProofFile(source).file;
      checkProofFile(pf);
    });
  }
});
