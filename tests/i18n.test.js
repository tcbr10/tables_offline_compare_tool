'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {dict,t}=require('../i18n.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const ui=read('ui.js'),html=read('index.html');

test('English and Hebrew define the same keys',()=>{
  assert.deepEqual(Object.keys(dict.he).sort(),Object.keys(dict.en).sort());
});
test('every key used by the interface exists',()=>{
  const used=new Set();
  for(const m of ui.matchAll(/\bt\('([A-Za-z0-9]+)'[,)]/g))used.add(m[1]);
  for(const m of html.matchAll(/data-i18n(?:-ph|-aria)?="([A-Za-z0-9]+)"/g))used.add(m[1]);
  for(const k of used)assert.ok(k in dict.en,'missing string: '+k);
});
test('no unused strings',()=>{
  const unused=Object.keys(dict.en).filter(k=>!ui.includes("'"+k+"'")&&!html.includes('"'+k+'"'));
  assert.deepEqual(unused,[]);
});
test('function strings render in both languages',()=>{
  assert.match(t('he','rowsCols',1200,3),/1,200|1200/);
  assert.match(t('en','showingFirst',500,'900'),/500/);
  assert.equal(t('en','nope'),'nope');
});
