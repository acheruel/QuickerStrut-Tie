'use strict';
// Every key used by the interface exists in French and English.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STR } = require('../app/js/i18n.js');

const dir = path.join(__dirname, '..', 'app');
const sources = ['index.html', ...fs.readdirSync(path.join(dir, 'js')).map((f) => 'js/' + f)]
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

test('static keys exist in both languages', () => {
  const keys = new Set();
  for (const m of sources.matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)) keys.add(m[1]);
  for (const m of sources.matchAll(/data-i18n(?:-title)?="([A-Za-z0-9_]+)"/g)) keys.add(m[1]);
  const missing = [];
  for (const k of keys) for (const lang of ['fr', 'en']) if (STR[lang][k] === undefined) missing.push(lang + ':' + k);
  assert.deepEqual(missing, []);
});

test('dynamic key families are complete', () => {
  const fam = {
    tool_: ['select', 'node', 'member', 'support', 'load', 'outline', 'erase'],
    hint_: ['select', 'node', 'member', 'support', 'load', 'outline', 'erase'],
    mode_: ['geometry', 'forces', 'util'], kind_: ['strut', 'tie', 'zero'],
    sup_: ['none', 'null', 'pin', 'rx', 'ry'], face_: ['strut', 'tie', 'support', 'load'],
    nodeType_: ['CCC', 'CCT', 'CTT'], code_: ['S6', 'A23'], err_: ['missingNode', 'zeroLength']
  };
  const missing = [];
  for (const [p, list] of Object.entries(fam)) for (const k of list) for (const lang of ['fr', 'en']) if (STR[lang][p + k] === undefined) missing.push(lang + ':' + p + k);
  assert.deepEqual(missing, []);
});

test('French and English tables have the same keys', () => {
  assert.deepEqual(Object.keys(STR.fr).sort(), Object.keys(STR.en).sort());
});
