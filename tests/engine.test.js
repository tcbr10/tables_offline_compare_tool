'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');

function table(rows,header=true){const t=E.fresh();t.raw=rows;t.header=header;t.headers=E.headers(rows,header);t.data=rows.slice(header?1:0);return t;}
const A=()=>table([['Name','Phone','City'],['Judith','052-607-0482','Haifa'],['David','0506998645','Tel Aviv'],['Tehila','054-655-6482','Eilat'],['Dana','0541112222','Haifa'],['Noa','052 888 1010 / 054 300 0001','Netanya']]);
const B=()=>table([['Phone','Name','City'],['+972526070482','Judith L.','Haifa'],['0546556482','Tehila','Eilat'],['054-300-0001','Noa',''],['0549998888','Moshe','Acre'],['0541112223','Dana','Haifa']]);
function setup(mode='phone',links=[]){const a=A(),b=B();a.key=1;b.key=0;const stats=E.analyze(a,b,{mode,dups:'first',links});return {a,b,stats};}

test('Israeli phone formats normalize to one key',()=>{
  for(const v of ['0526070482','052-607-0482','+972 52-607-0482','00972526070482','526070482','(052) 607 0482','tel: 052-6070482'])assert.deepEqual(E.phones(v),['+972526070482'],v);
});
test('a cell with several numbers yields each of them',()=>{
  assert.deepEqual(E.phones('052 607 0482 / 054-123-4567'),['+972526070482','+972541234567']);
});
test('invalid phone cells yield no key',()=>{
  for(const v of ['','hello','123','0526070']) assert.deepEqual(E.phones(v),[],v);
});
test('parseText detects the delimiter and handles quotes',()=>{
  assert.deepEqual(E.parseText('a;b\n"x;1";"he said ""hi"""\n'),[['a','b'],['x;1','he said "hi"']]);
  assert.deepEqual(E.parseText('a\tb\n1\t2'),[['a','b'],['1','2']]);
});
test('header detection',()=>{
  assert.equal(E.headerGuess([['Name','Phone'],['A','0526070482'],['B','0526070483'],['C','0526070484']]),true);
  assert.equal(E.headerGuess([['0526070482'],['0526070483']]),false);
});
test('Venn counts and near-match suggestions',()=>{
  const {a,b,stats}=setup();
  assert.equal(stats.both,3);          // Judith, Tehila, Noa (second number)
  assert.equal(stats.aOnly,2);         // David, Dana
  assert.equal(stats.bOnly,2);         // Moshe, Dana's neighbour 0541112223
  assert.deepEqual(stats.near,[['+972541112222','+972541112223']]);
});
test('accepting a near match links the two rows',()=>{
  const {stats}=setup('phone',[['+972541112222','+972541112223']]);
  assert.equal(stats.both,4);
  assert.equal(stats.near.length,0);
});
test('ignored near matches are not suggested again',()=>{
  const a=A(),b=B();a.key=1;b.key=0;
  const stats=E.analyze(a,b,{mode:'phone',dups:'first',ignored:new Set(['+972541112222|+972541112223'])});
  assert.equal(stats.near.length,0);
});
test('operations produce the expected rows',()=>{
  const {a,b}=setup();
  const n=op=>E.compute(a,b,op,'fill-a',false).rows.length;
  assert.equal(n('union'),7);assert.equal(n('both'),3);assert.equal(n('ab'),2);assert.equal(n('ba'),2);assert.equal(n('xor'),4);assert.equal(n('a'),5);assert.equal(n('b'),5);
});
test('opFor maps Venn selections to operations',()=>{
  const m=(A,AB,B)=>E.opFor({A,AB,B});
  assert.equal(m(true,true,true),'union');assert.equal(m(false,true,false),'both');assert.equal(m(true,false,true),'xor');
  assert.equal(m(true,false,false),'ab');assert.equal(m(false,false,true),'ba');assert.equal(m(true,true,false),'a');assert.equal(m(false,true,true),'b');
  assert.equal(m(false,false,false),null);
});
test('shared rows combine, fill empty cells and report conflicts',()=>{
  const {a,b}=setup();
  const r=E.compute(a,b,'both','fill-a',false);
  const names=r.columns.map(c=>c.label);
  assert.deepEqual(names,['Name','Phone','City']);   // A's column order; the key column keeps A's label
  const noa=r.rows.find(x=>x.va[0]==='Noa');
  assert.equal(noa.values[2],'Netanya');      // B's City is empty, filled from A
  const judith=r.rows.find(x=>x.va[0]==='Judith');
  assert.deepEqual([...judith.conf],[0]);     // Name differs: Judith / Judith L.
  assert.equal(r.conflicts,1);
});
test('per-cell choice overrides the preferred side',()=>{
  const {a,b}=setup();
  const base=E.compute(a,b,'both','fill-a',false).rows.find(x=>x.va[0]==='Judith');
  assert.equal(base.values[0],'Judith');
  const over={[base.id+':field:name']:'B'};
  const r=E.compute(a,b,'both','fill-a',false,over).rows.find(x=>x.id===base.id);
  assert.equal(r.values[0],'Judith L.');
  assert.equal(r.used[0],'B');
});
test('keep-all preserves duplicate rows of the preferred table',()=>{
  const a=table([['Phone'],['0526070482'],['052-607-0482']]),b=table([['Phone'],['0526070482']]);
  E.analyze(a,b,{mode:'phone',dups:'all'});
  assert.equal(E.compute(a,b,'union','prefer-a',true).rows.length,2);
  E.analyze(a,b,{mode:'phone',dups:'first'});
  assert.equal(E.compute(a,b,'union','prefer-a',false).rows.length,1);
});
test('autoKeys picks the phone column in each table',()=>{
  const a=A(),b=B();E.autoKeys({A:a,B:b},'phone');
  assert.equal(a.key,1);assert.equal(b.key,0);
});
test('text mode ignores case and invisible characters',()=>{
  const a=table([['Id'],['ABC'],['x​y']]),b=table([['Id'],['abc'],['xy']]);
  const stats=E.analyze(a,b,{mode:'text',dups:'first'});
  assert.equal(stats.both,2);
});
