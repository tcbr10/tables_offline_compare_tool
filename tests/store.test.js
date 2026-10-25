'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Store=require('../store.js');
const mk=()=>Store.createStore(Store.memoryBackend());
const list=(id,name,extra)=>({id,name,headers:['Name','Phone'],rows:[['a','052-607-0482'],['b','054-111-2222']],keyCols:{phone:1,id:null,text:1},color:1,...extra});

test('saves, lists and deletes lists',async()=>{
  const s=mk();await s.saveList(list('l1','Leads'));await s.saveList(list('l2','Customers'));
  assert.deepEqual((await s.lists()).map(x=>x.name).sort(),['Customers','Leads']);
  await s.deleteList('l1');assert.deepEqual((await s.lists()).map(x=>x.id),['l2']);
});
test('rejects malformed lists and cleans cells to strings',async()=>{
  const s=mk();
  await assert.rejects(()=>s.saveList({id:'x',name:'bad',headers:'no',rows:[]}));
  await assert.rejects(()=>s.saveList({id:'x',name:'bad',headers:['a'],rows:['notarow']}));
  const v=await s.saveList({id:'n',name:'nums',headers:['a'],rows:[[1],[null]],keyCols:{phone:5,id:0}});
  assert.deepEqual(v.rows,[['1'],['']]);assert.equal(v.keyCols.phone,null);assert.equal(v.keyCols.id,0);
});
test('recipes keep their steps and drop unknown step types',async()=>{
  const s=mk();
  const r=await s.saveRecipe({id:'r1',name:'To contact',mode:'id',steps:[{type:'start',lists:['a']},{type:'remove',lists:['b','c']}]});
  assert.equal(r.mode,'id');assert.equal((await s.recipes()).length,1);
  await assert.rejects(()=>s.saveRecipe({id:'r2',name:'x',steps:[{type:'explode',lists:[]}]}));
});
test('backup round trip merges and keeps the newer copy',async()=>{
  const a=mk();await a.saveList(list('l1','Leads'));await a.saveRecipe({id:'r1',name:'R',steps:[{type:'start',lists:['l1']}]});
  const backup=JSON.parse(JSON.stringify(await a.exportAll()));
  assert.equal(backup.app,'table-tool-library');
  const b=mk();
  assert.deepEqual(await b.importAll(backup),{lists:1,recipes:1,skipped:0});
  assert.deepEqual(await b.importAll(backup),{lists:0,recipes:0,skipped:2});     // same copies: nothing to do
  backup.lists[0].updated+=1000;backup.lists[0].name='Leads v2';
  assert.equal((await b.importAll(backup)).lists,1);
  assert.equal((await b.lists())[0].name,'Leads v2');
});
test('import refuses files that are not a backup',async()=>{
  const s=mk();
  for(const bad of [null,{},{app:'other',lists:[]},{app:'table-tool-library',lists:'x'}])await assert.rejects(()=>s.importAll(bad),/notBackup/);
});
test('clearAll removes everything',async()=>{
  const s=mk();await s.saveList(list('l1','Leads'));await s.saveRecipe({id:'r',name:'R',steps:[]});await s.clearAll();
  assert.equal((await s.lists()).length+(await s.recipes()).length,0);
});
test('memory backend reports that nothing is persistent',()=>{assert.equal(mk().persistent,false);});
