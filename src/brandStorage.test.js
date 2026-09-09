import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateBrandStorage } from './brandStorage.js';
const storage = (entries) => {
  const values = new Map(Object.entries(entries));
  return { get length() { return values.size; }, key: i => [...values.keys()][i], getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
};
test('preserves drafts, prefers existing KappGen preferences and removes obsolete tokens', () => {
 globalThis.window = {
  localStorage: storage({nichecut_draft_1:'draft',nichecut_theme:'dark',kappgen_theme:'light',nichecut_token:'obsolete',unrelated:'keep'}),
  sessionStorage: storage({nichecut_return_to_wizard_step:'3'})
 };
 migrateBrandStorage();migrateBrandStorage();
 assert.equal(window.localStorage.getItem('kappgen_draft_1'),'draft');
 assert.equal(window.localStorage.getItem('kappgen_theme'),'light');
 assert.equal(window.localStorage.getItem('kappgen_token'),null);
 assert.equal(window.localStorage.getItem('nichecut_token'),null);
 assert.equal(window.localStorage.getItem('unrelated'),'keep');
 assert.equal(window.sessionStorage.getItem('kappgen_return_to_wizard_step'),'3');
 delete globalThis.window;
});
test('does not remove legacy data when writing the replacement fails', () => {
 const local=storage({nichecut_draft_1:'draft'});
 local.setItem=()=>{ throw new Error('quota'); };
 globalThis.window={localStorage:local,sessionStorage:storage({})};
 migrateBrandStorage();
 assert.equal(local.getItem('nichecut_draft_1'),'draft');
 delete globalThis.window;
});
