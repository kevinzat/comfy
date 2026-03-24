import * as assert from 'assert';
import { OpToHtml } from './ProofElements';

describe('OpToHtml', function() {

  it('renders = as =', function() {
    assert.strictEqual(OpToHtml('='), '=');
  });

  it('renders < as <', function() {
    assert.strictEqual(OpToHtml('<'), '<');
  });

  it('renders <= as ≤', function() {
    assert.strictEqual(OpToHtml('<='), '\u2264');
  });

});
