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

test('Israeli IDs: leading zeros, separators, surrounding text',()=>{
  for(const v of ['012345678','12345678','012-345-678','ת.ז. 12345678','=\"012345678\"'])assert.deepEqual(E.ids(v),['012345678'],v);
  assert.deepEqual(E.ids('111111118 / 22222'),['111111118','000022222']);
  assert.deepEqual(E.ids('111111118 222222222'),['111111118','222222222']);
  for(const v of ['','0526070482','12/03/2024','abc','1234'])assert.deepEqual(E.ids(v),[],v);
});
test('Israeli ID check digit',()=>{
  assert.equal(E.idCheck('000000018'),true);
  assert.equal(E.idCheck('123456782'),true);
  assert.equal(E.idCheck('123456789'),false);
});
test('ID mode matches across formats and picks the ID column',()=>{
  const a=table([['Name','ID','Phone'],['x','12345678','0526070482'],['y','000000018','0541112222'],['z','333333334','0549998888']]);
  const b=table([['ת.ז.','שם'],['012345678','x'],['0000018','y'],['999999999','w']]);
  E.autoKeys({A:a,B:b},'id');
  assert.equal(a.key,1);assert.equal(b.key,0);
  const stats=E.analyze(a,b,{mode:'id',dups:'first'});
  assert.equal(stats.both,2);assert.equal(stats.aOnly,1);assert.equal(stats.bOnly,1);
});
test('ID near matches are offered and can be linked',()=>{
  const a=table([['ID'],['123456782']]),b=table([['ID'],['123456783']]);
  const stats=E.analyze(a,b,{mode:'id',dups:'first'});
  assert.deepEqual(stats.near,[['123456782','123456783']]);
  assert.equal(E.analyze(a,b,{mode:'id',dups:'first',links:stats.near}).both,1);
});

test('phone numbers are never read as IDs',()=>{
  for(const v of ['+972 52-607-0482','+972526070482','00972 52 607 0482','052-607-0482','0526070482','972526070482'])assert.deepEqual(E.ids(v),[],v);
});

/* ---------- combine ---------- */
function saved(id,name,headers,rows,keyCols){return {id,name,headers,rows,keyCols};}
const LEADS=()=>saved('leads','Leads',['Name','Phone','City'],[['A','052-607-0482','Haifa'],['B','0506998645','Eilat'],['C','054-655-6482',''],['D','0541112222','Acre'],['E','not a phone','x']],{phone:1,id:null,text:1});
const SIGN=()=>saved('sign','Signups',['Phone','Name','Event'],[['+972526070482','A2','Fair'],['0549998888','F','Fair'],['054-655-6482','C','Fair']],{phone:0,id:null,text:0});
const DNC=()=>saved('dnc','Do-not-call',['Phone'],[['0506998645'],['0549998888']],{phone:0,id:null,text:0});
test('combine: union lets the first list win and fills empty cells from later lists',()=>{
  const r=E.combine([LEADS(),SIGN()],[{type:'start',lists:['leads']},{type:'add',lists:['sign']}],'phone');
  assert.equal(r.rows.length,5);                         // 4 valid leads + 1 new signup
  assert.deepEqual(r.columns.map(c=>c.label),['Name','Phone','City','Event']);
  const a=r.rows.find(x=>x.values[0]==='A');assert.deepEqual(a.from,['leads','sign']);assert.equal(a.values[3],'Fair');
  const c=r.rows.find(x=>x.values[0]==='C');assert.equal(c.values[2],'');    // City stays empty, no list has it
  assert.deepEqual(r.skipped,{leads:1});                // 'not a phone'
  assert.deepEqual(r.stages.map(s=>s.total),[4,5]);
});
test('combine: remove takes out rows and reports which list removed them',()=>{
  const r=E.combine([LEADS(),SIGN(),DNC()],[{type:'start',lists:['leads']},{type:'add',lists:['sign']},{type:'remove',lists:['dnc']}],'phone');
  assert.equal(r.rows.length,3);
  assert.equal(r.removed.length,2);assert.ok(r.removed.every(x=>x.by==='dnc'&&x.step===2));
  assert.deepEqual(r.stages[2].counts,{dnc:2});assert.equal(r.stages[2].delta,-2);
});
test('combine: remove before add works, and keep drops rows with no match',()=>{
  const r=E.combine([LEADS(),SIGN(),DNC()],[{type:'start',lists:['sign']},{type:'remove',lists:['dnc']},{type:'add',lists:['leads']}],'phone');
  assert.equal(r.stages[1].total,2);assert.equal(r.stages[2].total,4);   // a removed number returns when a later list adds it (0506998645)
  const k=E.combine([LEADS(),SIGN()],[{type:'start',lists:['leads']},{type:'keep',lists:['sign']}],'phone');
  assert.equal(k.rows.length,2);assert.equal(k.removed.length,2);assert.ok(k.removed.every(x=>x.by===''));
});
test('combine: lists without a match column add nothing in that mode',()=>{
  const r=E.combine([LEADS(),SIGN()],[{type:'start',lists:['leads']},{type:'add',lists:['sign']}],'id');
  assert.equal(r.rows.length,0);
});
test('combine: a cell with several numbers joins rows across lists',()=>{
  const multi=saved('m','Multi',['Phone','Name'],[['052-607-0482 / 0549998888','M']],{phone:0,id:null,text:0});
  const r=E.combine([LEADS(),SIGN(),multi],[{type:'start',lists:['leads']},{type:'add',lists:['sign','m']}],'phone');
  assert.equal(r.rows.length,5);                       // 'M' bridges A and F, no new row
  assert.ok(r.rows.find(x=>x.values[0]==='A').from.includes('m'));
});
test('detectKeyCols finds phone and ID columns per list',()=>{
  const rows=[['x','12345678','052-607-0482'],['y','000000018','054-111-2222'],['z','303030309','0501112233']];
  const k=E.detectKeyCols(['Name','ת.ז.','Phone'],rows);
  assert.equal(k.id,1);assert.equal(k.phone,2);
  assert.equal(E.detectKeyCols(['Name'],[['a'],['b']]).phone,null);
});
test('combine columns report which lists contribute them',()=>{
  const r=E.combine([LEADS(),SIGN()],[{type:'start',lists:['leads']},{type:'add',lists:['sign']}],'phone');
  const by=Object.fromEntries(r.columns.map(c=>[c.label,c.lists]));
  assert.deepEqual(by.Name,['leads','sign']);assert.deepEqual(by.City,['leads']);assert.deepEqual(by.Event,['sign']);
  assert.deepEqual(r.columns.find(c=>c.key).lists,['leads','sign']);
});

/* ---------- header row ---------- */
test('headerRow skips a date or title line above the column titles',()=>{
  const body=[['A','052-607-0482','x'],['B','054-111-2222','y'],['C','0506998645','z']];
  assert.equal(E.headerRow([['15/10/2026'],['Name','Phone','City'],...body]),1);
  assert.equal(E.headerRow([['דוח מתאריך','15/10/26'],['Name','Phone','City','ID'],['A','052-607-0482','x','1'],['B','054-111-2222','y','2']]),1);
  assert.equal(E.headerRow([['Report','','','','date','15/10/26'],['Name','Phone','City','ID','x','y'],['A','052-607-0482','x','1','2','3'],['B','054-111-2222','y','1','2','3']]),1);
  assert.equal(E.headerRow([['Title'],['2026'],['Name','Phone','City'],...body]),2);      // two preamble lines
});
test('headerRow leaves ordinary tables alone',()=>{
  assert.equal(E.headerRow([['Name','Phone'],['A','052-607-0482'],['B','054-111-2222'],['C','0506998645']]),0);
  assert.equal(E.headerRow([['052-607-0482'],['054-111-2222'],['0506998645']]),-1);      // no titles at all
  assert.equal(E.headerRow([['','','','','','שם','טלפון'],['','','','','','a','0526070482'],['','','','','','b','0526070483']]),0);
  assert.equal(E.headerRow([]),-1);
});
test('tableFrom skips the lines above the header and can add the date as a column',()=>{
  const raw=[['דוח 15/10/2026'],['Name','Phone'],['A','1'],['B','2']];
  const t=E.tableFrom(raw,1);
  assert.deepEqual(t.headers,['Name','Phone']);assert.equal(t.data.length,2);assert.equal(t.date,'15/10/2026');assert.equal(t.skipped,1);
  const d=E.tableFrom(raw,1,{addDate:true,dateLabel:'Report date'});
  assert.deepEqual(d.headers,['Name','Phone','Report date']);assert.deepEqual(d.data[0],['A','1','15/10/2026']);
  assert.deepEqual(E.tableFrom(raw,-1).headers,['Column 1','Column 2']);                // no header row: everything is data
  assert.equal(E.tableFrom(raw,-1).data.length,4);
});
test('extractDate finds dates in several formats and falls back to the text',()=>{
  assert.equal(E.extractDate([['Report','2026-10-15']]),'2026-10-15');
  assert.equal(E.extractDate([['15.10.26']]),'15.10.26');
  assert.equal(E.extractDate([['Monthly report']]),'Monthly report');
  assert.equal(E.extractDate([]),'');
});
test('tableFrom drops trailing empty columns',()=>{
  const raw=[['15/10/2026','','',''],['Name','Phone','',''],['A','1','',''],['B','2','','']];
  const t=E.tableFrom(raw,1);
  assert.deepEqual(t.headers,['Name','Phone']);assert.deepEqual(t.data[0],['A','1']);
});
