/* Matching engine: pure functions with no DOM access. Loaded as a classic script in the browser (window.Engine) and with require() in the node tests. */
(function(root){
'use strict';
const fresh=()=>({raw:[],headers:[],data:[],key:0,auto:true,header:false,hr:-1,hrAuto:true,addDate:false,dateLabel:'',date:'',skippedText:'',book:null,sheet:'',name:'',index:new Map(),groups:new Map(),invalid:[],duplicates:0});
const INVISIBLE=/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g,HEB_MARKS=/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g,SPACES=/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;
function clean(v){let s=String(v??'');try{s=s.normalize('NFKC');}catch(e){}return s.replace(INVISIBLE,'').replace(HEB_MARKS,'').replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[\u06F0-\u06F9]/g,c=>String(c.charCodeAt(0)-0x6F0)).replace(/[\u2010-\u2015\u2212\u05BE]/g,'-').replace(/[\u2018\u2019\u201B\u02BC\u05F3`\u00B4]/g,"'").replace(/[\u201C\u201D\u201E\u201F\u05F4]/g,'"').replace(SPACES,' ').trim();}
function phone(v){let s=clean(v);if(/^=".*"$/.test(s))s=s.slice(2,-1);s=s.replace(/^'/,'');if(/^[\d.]+e\+?\d+$/i.test(s)){const n=Number(s);if(!Number.isSafeInteger(n)||n<0)return null;s=String(n);}if(!s||/[^\d+\s().-]/.test(s))return null;s=s.replace(/[\s().-]/g,'');if(!/^\+?\d+$/.test(s))return null;const explicit=s.startsWith('+')||s.startsWith('00'),d=s.startsWith('+')?s.slice(1):s.startsWith('00')?s.slice(2):s;let n;if(d.startsWith('972')&&(explicit||[11,12,13].includes(d.length))){n=d.slice(3).replace(/^0/,'');return /^(?:[57]\d{8}|[23489]\d{7})$/.test(n)?'+972'+n:null;}if(explicit)return /^[1-9]\d{6,14}$/.test(d)?'+'+d:null;n=d.replace(/^0/,'');return /^(?:[57]\d{8}|[23489]\d{7})$/.test(n)?'+972'+n:null;}
function key(v,mode){const s=clean(v);return !s?null:mode==='phone'?phone(s):mode==='id'?(ids(s)[0]||null):mode==='text'?s.toLowerCase():s;}
/* Every phone number in a cell. The whole cell is tried first; otherwise surrounding text ("tel:", "ext 2", names) is dropped and each run of digits is split into the segmentation that turns the most tokens into valid numbers, so "052 607 0482 / 054-123-4567" yields two numbers. */
function phones(v){const s=clean(v),whole=s&&phone(s);if(whole)return [whole];const out=[];for(const chunk of s.match(/[\d\s+().-]*\d[\d\s+().-]*/g)||[]){const t=chunk.split(/[\s.-]+/).filter(x=>/\d/.test(x)),n=t.length,best=Array(n+1).fill(null);best[n]={covered:0,nums:[]};for(let i=n-1;i>=0;i--){let b={covered:best[i+1].covered,nums:best[i+1].nums};for(let j=i;j<n&&j<i+8;j++){const p=phone(t.slice(i,j+1).join(''));if(!p)continue;const c=j-i+1+best[j+1].covered,m=best[j+1].nums.length+1;if(c>b.covered||c===b.covered&&m<b.nums.length)b={covered:c,nums:[p,...best[j+1].nums]};}best[i]=b;}for(const p of best[0].nums)if(!out.includes(p))out.push(p);}return out;}
/* Israeli ID numbers (teudat zehut): 5-9 digits, leading zeros restored so 12345678 and 012345678 are the same person. Spaces, dots and hyphens inside the number are ignored; text around it ("ת.ז. 012345678") is dropped and a cell may hold several IDs. A wrong check digit does not stop a match (typos are common), it is reported separately. */
function ids(v){let s=clean(v);if(!s)return [];s=s.replace(/^="(.*)"$/,'$1').replace(/^'/,'');const whole=s.replace(/[\s.\-]/g,'');if(/^\d{5,9}$/.test(whole))return [whole.padStart(9,'0')];const out=[],add=d=>{if(/^\d{5,9}$/.test(d)){const k=d.padStart(9,'0');if(!out.includes(k))out.push(k);}};for(const m of s.matchAll(/\d[\d\s.\-]*\d|\d/g)){const chunk=m[0];if(m.index>0&&s[m.index-1]==='+')continue;const d=chunk.replace(/[\s.\-]/g,'');if(d.startsWith('00972'))continue;if(d.length<=9)add(d);else for(const tok of chunk.split(/\s+/))add(tok.replace(/[.\-]/g,''));}return out;}
function idCheck(d){if(!/^\d{9}$/.test(d))return false;let sum=0;for(let i=0;i<9;i++){let n=Number(d[i])*(i%2?2:1);if(n>9)n-=9;sum+=n;}return sum%10===0;}
function rowKeys(v,mode){if(mode==='phone')return phones(v);if(mode==='id')return ids(v);const k=key(v,mode);return k===null?[]:[k];}
function parse(text,d){text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],s='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){s+='"';i++;}else if(q)q=false;else if(!s)q=true;else s+=c;}else if(c===d&&!q){row.push(s);s='';}else if((c==='\r'||c==='\n')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(s);if(row.some(v=>v.trim()))rows.push(row);row=[];s='';}else s+=c;}row.push(s);if(row.some(v=>v.trim()))rows.push(row);return rows;}
function parseText(text){let d=',',best=-1;for(const c of ['\t',',',';','|']){const score=parse(text,c).slice(0,40).reduce((n,r)=>n+r.length-1,0);if(score>best){best=score;d=c;}}return parse(text,d);}
const ph=s=>/phone|mobile|telephone|cellular|טלפון|נייד|פלאפון/i.test(String(s));
const HEADER_WORDS=/^(name|full name|first name|last name|email|e-mail|id|address|city|date|number|status|שם|שם מלא|שם פרטי|שם משפחה|אימייל|מייל|דוא"ל|כתובת|עיר|תאריך|מספר|סטטוס|ת"ז|ת\.ז\.?)$/i;
function kind(v){const s=clean(v);return !s?'':/\d/.test(s)&&/^[\d\s+().,\/:'"-]+$/.test(s)?'n':'t';}
function headerGuess(raw){const top=raw[0],body=raw.slice(1,51);if(!top)return false;if(top.some(v=>ph(v)||HEADER_WORDS.test(clean(v))))return true;/* A text cell above a mostly numeric column (phones, dates, IDs) is a column title. */return top.some((v,c)=>{if(kind(v)!=='t')return false;let n=0,t=0;for(const r of body){const k=kind(r[c]);if(k==='n')n++;else if(k==='t')t++;}return n>=3&&n>2*t;});}
function headers(raw,has){const hr=has===true?0:typeof has==='number'?has:-1,width=raw.reduce((m,r)=>Math.max(m,r.length),0),used=new Set(),out=[];for(let i=0;i<width;i++){const base=hr>=0?(clean(raw[hr]?.[i])||'Column '+(i+1)):'Column '+(i+1);let label=base,j=2;while(used.has(label.toLowerCase()))label=base+' ('+j+++')';used.add(label.toLowerCase());out.push(label);}return out;}
/* ---------- header row (templates with a date or title line above the column titles) ---------- */
const filled=r=>r.reduce((n,v)=>n+(clean(v)?1:0),0);
/* Index of the row holding the column titles, or -1 when the table has no title row. Lines above it that fill at most half the table's width (a date, a report name) and are followed by a fuller line are skipped. Blank rows are not counted: the index is among non-empty rows. */
function headerRow(raw){
 const head=raw.slice(0,60).map(filled).filter(n=>n>0).sort((a,b)=>a-b),width=head.length?head[Math.floor(head.length/2)]:0;
 const pre=r=>{const f=filled(r);return f>0&&((f===1&&width>=2)||(f>=2&&f*2<=width));};
 let p=0;
 while(p<Math.min(raw.length-1,9)&&pre(raw[p]))p++;
 if(p>0&&filled(raw[p])<=filled(raw[p-1]))p=0;
 return p>0||headerGuess(raw)?p:-1;
}
const DATE_RE=/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/;
const skippedText=rows=>rows.map(r=>r.map(clean).filter(Boolean).join(' · ')).filter(Boolean).join(' | ');
/* The date found in the skipped lines (or, failing that, the first skipped line as text). */
function extractDate(rows){const text=skippedText(rows),m=text.match(DATE_RE);return m?m[0]:(rows.length?skippedText(rows.slice(0,1)):'');}
/* headers + data rows for a header row index, optionally adding the skipped date as a last column. */
function tableFrom(raw,hr,opts){
 opts=opts||{};
 const skipped=hr>0?raw.slice(0,hr):[],date=extractDate(skipped),start=Math.max(hr,0);
 /* trailing columns with nothing in them (a wide date line, phantom Excel columns) are dropped */
 let width=0;for(let i=start;i<raw.length;i++)for(let c=raw[i].length-1;c>=width;c--)if(clean(raw[i][c])){width=c+1;break;}
 const body=raw.slice(start).map(r=>r.slice(0,width)),hs=headers(body,hr>=0?0:-1);
 let data=hr>=0?body.slice(1):body;const out=[...hs];
 if(opts.addDate&&date){out.push(opts.dateLabel||'Report date');data=data.map(r=>{const x=r.slice();while(x.length<hs.length)x.push('');x.push(date);return x;});}
 return {headers:out,data,date,skippedText:skippedText(skipped),skipped:skipped.length};
}

/* Rank columns as comparison keys by DISTINCT values, so a column repeating one number (e.g. a destination line) never wins. */
const ID_HEADER=/(^|[^a-z])(id|identity|national id)([^a-z]|$)|ת\.?ז|תז|זהות/i;
function rankKeys(s,mode){const sample=s.data.slice(0,500);return s.headers.map((h,c)=>{const nums=new Set(),texts=new Set();let filled=0;for(const r of sample){const t=key(r[c],'text');if(t===null)continue;filled++;texts.add(t);for(const p of (mode==='id'?ids(t):phones(t)))nums.add(p);}const isTarget=nums.size>1,keyLike=texts.size>1&&texts.size>=filled*0.5,hint=s.header&&(mode==='id'?ID_HEADER.test(String(h)):ph(h));return {c,isTarget,keyLike,score:isTarget?1e6+nums.size*(hint?2:1):keyLike?1e3+texts.size:texts.size};}).sort((x,y)=>y.score-x.score||x.c-y.c);}
/* Pick keys for tables the user has not set by hand: each table's best column, or the candidate pair sharing the most keys. */

/* Pick keys for tables the user has not set by hand: each table's best column, or the candidate pair sharing the most keys. */
function autoKeys(tables,mode){
 const ranked={};
 for(const id of ['A','B']){const s=tables[id];if(s.auto&&s.data.length){ranked[id]=rankKeys(s,mode);s.key=ranked[id][0].c;}}
 const a=tables.A,b=tables.B;
 if(a.data.length&&b.data.length&&(ranked.A||ranked.B)){
  const pool=id=>{const s=tables[id];if(!ranked[id])return [s.key];const c=ranked[id].filter(x=>mode==='phone'||mode==='id'?x.isTarget:x.isTarget||x.keyLike).slice(0,4).map(x=>x.c);return c.length?c:[s.key];};
  const keys=(id,c)=>{const set=new Set();for(const r of tables[id].data){for(const k of rowKeys(r[c],mode))set.add(k);}return set;};
  const ca=pool('A'),cb=pool('B');
  if(ca.length*cb.length>1){
   const sa=ca.map(c=>keys('A',c)),sb=cb.map(c=>keys('B',c));let best=null;
   ca.forEach((x,i)=>cb.forEach((y,j)=>{const [small,big]=sa[i].size<=sb[j].size?[sa[i],sb[j]]:[sb[j],sa[i]];let n=0;for(const k of small)if(big.has(k))n++;if(n&&(!best||n>best.n))best={n,a:x,b:y};}));
   if(best){if(a.auto)a.key=best.a;if(b.auto)b.key=best.b;}
  }
 }
}

/* Numbers sharing a cell belong to one contact: link them (union-find across both tables) so a row matches on any of its numbers. */
function linker(lists){const parent=new Map(),find=k=>{let r=k;while(parent.has(r))r=parent.get(r);while(parent.has(k)){const n=parent.get(k);parent.set(k,r);k=n;}return r;};for(const ks of lists)for(let i=1;i<ks.length;i++){const a=find(ks[0]),b=find(ks[i]);if(a!==b)parent.set(b,a);}return find;}
function buildIndex(data,col,lists,canon,dup){const index=new Map(),groups=new Map(),invalid=[];let duplicates=0;data.forEach((values,i)=>{const keys=lists[i];if(!keys.length){invalid.push({i,value:String(values[col]??'')||'(empty key)'});return;}const k=canon(keys[0]),rec={values,i,keys};if(!groups.has(k))groups.set(k,[]);groups.get(k).push(rec);if(index.has(k)){duplicates++;if(dup==='last')index.set(k,rec);}else index.set(k,rec);});return {index,groups,invalid,duplicates};}
/* Keys that exist in only one table and differ from a key that exists only in the other by exactly one digit: likely typos or neighbouring numbers. Never matched automatically. Returns [keyA,keyB] pairs. */
function nearMatches(ai,bi,ignored){
 const pairs=[];if(Math.min(ai.size,bi.size)>50000)return pairs;
 const [small,big,flip]=ai.size<=bi.size?[ai,bi,false]:[bi,ai,true];
 for(const k of small.keys()){
  if(big.has(k))continue;
  const start=k[0]==='+'?(k.startsWith('+972')?4:1):0;
  outer:for(let p=start;p<k.length;p++)for(const d of '0123456789'){
   if(d===k[p])continue;
   const v=k.slice(0,p)+d+k.slice(p+1);
   if(big.has(v)&&!small.has(v)){const pair=flip?[v,k]:[k,v];if(ignored&&ignored.has(pair.join('|')))continue;pairs.push(pair);break outer;}
  }
 }
 return pairs;
}
/* Which of the three Venn areas are selected -> the operation that produces those rows. */
function opFor(sel){
 const c=(sel.A?'a':'')+(sel.AB?'m':'')+(sel.B?'b':'');
 return {amb:'union',m:'both',ab:'xor',a:'ab',b:'ba',am:'a',mb:'b'}[c]||null;
}
/* Rebuild every table's index for the current matching mode. links = extra [keyA,keyB] pairs the user accepted as the same contact. Returns the Venn counts and the near-match suggestions. */
function analyze(a,b,opts){
 const mode=opts.mode,lists={},links=(opts.links||[]).filter(p=>p&&p.length===2);
 for(const [id,s] of [['A',a],['B',b]])lists[id]=s.data.map(r=>rowKeys(r[s.key],mode));
 const canon=linker([...lists.A,...lists.B,...links]);
 for(const [id,s] of [['A',a],['B',b]])Object.assign(s,buildIndex(s.data,s.key,lists[id],canon,opts.dups||'first'));
 let both=0;for(const k of a.index.keys())if(b.index.has(k))both++;
 const near=(mode==='phone'||mode==='id')&&a.index.size&&b.index.size?nearMatches(a.index,b.index,opts.ignored):[];
 return {both,aOnly:a.index.size-both,bOnly:b.index.size-both,near};
}
/* Join the two tables for one operation. over maps "rowId:columnId" -> 'A' | 'B' to force a side for one cell of a row that exists in both tables. Each row carries va / vb (values from each table), conf (columns that differ), used (side shown per column). */
function compute(a,b,op,pref,all,over){
 over=over||{};
 const tables={A:a,B:b},sources=['ab','a'].includes(op)?['A']:['ba','b'].includes(op)?['B']:['A','B'],columns=[],lookup=new Map();
 for(const source of sources){const t=tables[source];t.headers.forEach((label,c)=>{const id=c===t.key?'__key':'field:'+clean(label).toLowerCase();if(!lookup.has(id)){const col={id,label,refs:{},key:c===t.key};columns.push(col);lookup.set(id,col);}lookup.get(id).refs[source]=c;});}
 const used=new Set();for(const c of columns){const base=c.label;let j=2;while(used.has(c.label.toLowerCase()))c.label=base+' ('+j+++')';used.add(c.label.toLowerCase());}
 const ai=a.index,bi=b.index;let keys;
 if(op==='union')keys=[...new Set([...ai.keys(),...bi.keys()])];
 else if(op==='both')keys=[...ai.keys()].filter(k=>bi.has(k));
 else if(op==='ab')keys=[...ai.keys()].filter(k=>!bi.has(k));
 else if(op==='ba')keys=[...bi.keys()].filter(k=>!ai.has(k));
 else if(op==='xor')keys=[...ai.keys()].filter(k=>!bi.has(k)).concat([...bi.keys()].filter(k=>!ai.has(k)));
 else keys=[...(op==='a'?ai:bi).keys()];
 let conflicts=0;const rows=[];
 for(const k of keys){
  let ar=ai.get(k),br=bi.get(k);const source=ar&&br?'A+B':ar?'A':'B';
  if(['ab','a'].includes(op))br=null;
  if(['ba','b'].includes(op))ar=null;
  const chosen=ar&&br?(pref.endsWith('b')?'B':'A'):ar?'A':'B',other=chosen==='A'?'B':'A',records=all?tables[chosen].groups.get(k):[chosen==='A'?ar:br];
  for(const rec of records){
   const refs={A:ar,B:br};refs[chosen]=rec;
   const id=(refs.A?refs.A.i:'x')+':'+(refs.B?refs.B.i:'x'),both=!!(refs.A&&refs.B),conf=new Set(),va=[],vb=[],usedSide=[];
   const values=columns.map((c,x)=>{
    const get=s=>refs[s]&&c.refs[s]!==undefined?String(refs[s].values[c.refs[s]]??''):'';
    const av=get('A'),bv=get('B');va.push(av);vb.push(bv);
    if(both&&!c.key&&av.trim()&&bv.trim()&&av!==bv){conflicts++;conf.add(x);}
    const side=both&&over[id+':'+c.id]||chosen,oth=side==='A'?'B':'A';
    let v=get(side),from=side;
    if(pref.startsWith('fill-')&&!v.trim()){v=get(oth);from=oth;}
    usedSide.push(from);return v;
   });
   rows.push({id,key:k,keys:rec.keys,values,source,both,va,vb,conf,used:usedSide});
  }
 }
 return {columns,rows,conflicts};
}

/* ---------- Combine: build one list from saved lists ---------- */
/* A saved list is {id,name,headers,rows,keyCols:{phone,id,text}}: the match column is remembered per match type. */
const KEYCACHE=new WeakMap();
function listKeys(l,mode){
 const col=l.keyCols&&l.keyCols[mode];
 if(col==null||col<0||col>=l.headers.length)return l.rows.map(()=>[]);
 const c=KEYCACHE.get(l.rows);if(c&&c.mode===mode&&c.col===col)return c.keys;
 const keys=l.rows.map(r=>rowKeys(r[col],mode));KEYCACHE.set(l.rows,{mode,col,keys});return keys;
}
const usableCount=(l,mode)=>listKeys(l,mode).filter(k=>k.length).length;
/* Best match column per match type, using the same ranking as the compare view. */
function detectKeyCols(headers,rows){
 const t=fresh();t.header=true;t.headers=headers;t.data=rows;
 const out={};
 for(const mode of ['phone','id']){const r=headers.length&&rows.length?rankKeys(t,mode)[0]:null;out[mode]=r&&r.isTarget?r.c:null;}
 const txt=headers.length&&rows.length?rankKeys(t,'text')[0]:null;
 out.text=out.phone??out.id??(txt?txt.c:headers.length?0:null);
 return out;
}
/* steps: [{type:'start'|'add'|'remove'|'keep',lists:[id,...]}]. start/add put the lists' rows in (first list wins a row, later lists fill its empty cells); remove drops rows whose key is in any of the lists; keep drops rows whose key is in none of them. Returns columns, rows (with the lists each came from), a stage per step (delta, total, per-list counts), the removed rows and rows skipped for lack of a usable key. */
function combine(lists,steps,mode){
 const byId=new Map(lists.map(l=>[l.id,l]));
 const cols=[],cmap=new Map(),entries=new Set(),byKey=new Map(),stages=[],removed=[],skipped={};
 const colId=(l,c,seen)=>{if(c===l.keyCols[mode])return '__k';const base='f:'+clean(l.headers[c]).toLowerCase();const n=(seen[base]=(seen[base]||0)+1);return n>1?base+'#'+n:base;};
 const mapCols=l=>{const seen={};return l.headers.map((h,c)=>{const id=colId(l,c,seen);let col=cmap.get(id);if(!col){col={id,label:String(h),key:id==='__k',lists:[]};cmap.set(id,col);cols.push(col);}if(!col.lists.includes(l.id))col.lists.push(l.id);return col;});};
 const ingest=(l,counts)=>{
  const ks=listKeys(l,mode),cm=mapCols(l);let added=0;
  l.rows.forEach((r,i)=>{
   const k=ks[i];if(!k.length){skipped[l.id]=(skipped[l.id]||0)+1;return;}
   let e=null;for(const x of k){if(byKey.has(x)){e=byKey.get(x);break;}}
   if(!e){e={vals:{},from:[l.id],keys:[...k]};entries.add(e);added++;}
   else{if(!e.from.includes(l.id))e.from.push(l.id);for(const x of k)if(!e.keys.includes(x))e.keys.push(x);}
   for(const x of e.keys)byKey.set(x,e);
   r.forEach((v,c)=>{const col=cm[c];if(!col)return;if(!(col.id in e.vals)||!String(e.vals[col.id]).trim())e.vals[col.id]=String(v??'');});
  });
  counts[l.id]=(counts[l.id]||0)+added;
 };
 const keyMap=ls=>{const m=new Map();for(const l of ls)for(const k of listKeys(l,mode))for(const x of k)if(!m.has(x))m.set(x,l.id);return m;};
 steps.forEach((st,si)=>{
  const ls=st.lists.map(id=>byId.get(id)).filter(Boolean),counts={},before=entries.size;
  if(st.type==='start'){entries.clear();byKey.clear();for(const l of ls)ingest(l,counts);}
  else if(st.type==='add'){for(const l of ls)ingest(l,counts);}
  else{
   const set=keyMap(ls);
   for(const e of [...entries]){
    let by=null;
    if(st.type==='remove'){for(const x of e.keys)if(set.has(x)){by=set.get(x);break;}}
    else if(!e.keys.some(x=>set.has(x)))by='';
    if(by!==null){entries.delete(e);for(const x of e.keys)byKey.delete(x);if(by)counts[by]=(counts[by]||0)+1;else counts['']=(counts['']||0)+1;removed.push({e,by,step:si});}
   }
  }
  stages.push({type:st.type,counts,delta:entries.size-before,total:entries.size,empty:!ls.length&&st.type!=='start'});
 });
 const out=e=>({values:cols.map(c=>e.vals[c.id]??''),from:e.from,keys:e.keys});
 return {columns:cols,rows:[...entries].map(out),stages,removed:removed.map(x=>({...out(x.e),by:x.by,step:x.step})),skipped};
}

const api={headerRow,tableFrom,extractDate,listKeys,usableCount,detectKeyCols,combine,fresh,clean,phone,phones,ids,idCheck,key,rowKeys,parse,parseText,headerGuess,headers,rankKeys,autoKeys,nearMatches,linker,buildIndex,analyze,compute,opFor};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Engine=api;
})(typeof window!=='undefined'?window:globalThis);
