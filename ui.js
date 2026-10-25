/* Interface: state, rendering and file handling. Matching rules live in engine.js, strings in i18n.js. */
(()=>{
'use strict';
const E=window.Engine,I=window.I18N;
const $=id=>document.getElementById(id);
function h(tag,attrs,...kids){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(v===false||v==null)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?'':v);}for(const c of kids.flat()){if(c==null||c===false)continue;n.append(c.nodeType?c:document.createTextNode(c));}return n;}
const SVGNS='http://www.w3.org/2000/svg';
function ico(name){const s=document.createElementNS(SVGNS,'svg'),u=document.createElementNS(SVGNS,'use');s.setAttribute('class','i');s.setAttribute('aria-hidden','true');u.setAttribute('href','#i-'+name);s.append(u);return s;}

let lang='en';try{if(localStorage.getItem('table-tool-language')==='he')lang='he';}catch(e){}
const t=(k,...a)=>I.t(lang,k,...a);

/* ---------- state ---------- */
const S={A:E.fresh(),B:E.fresh()};
const V={mode:'phone',sel:{A:true,AB:true,B:true},dups:'first',prefer:'A',fill:true,fmt:'original',sort:false,exportSource:false,q:'',over:{},links:[],ignored:new Set(),open:null,panel:null};
let stats={both:0,aOnly:0,bOnly:0,near:[]},result={columns:[],rows:[],conflicts:0};
const isLoaded=id=>S[id].raw.length>0;
const bothLoaded=()=>isLoaded('A')&&isLoaded('B');
const LIMIT=500;

const SAMPLE={
 A:{name:'list-1.csv',rows:[['Name','Phone','City'],['יהודית לביא','052-607-0482','חיפה'],['הלל דוד','0506998645','תל אביב'],['תהילה הראל','054-655-6482','אילת'],['שמריהו הופמן','+972 52-720-4859','ירושלים'],['דנה כהן','0541112222','חיפה'],['יוסי מזרחי','03-5551234','רמת גן'],['נועה לוי','052 888 1010 / 054 300 0001','נתניה'],['רות בן־דוד','tel: 0587776655','אשדוד']]},
 B:{name:'contacts.xlsx · Sheet1',rows:[['Phone','Name','City'],['+972526070482','Judith Lavi','Haifa'],['0546556482','תהילה הראל','אילת'],['054-300-0001','נועה לוי',''],['0549998888','משה פרץ','עכו'],['0527204859','שמריהו הופמן','ירושלים'],['03-5551234','יוסי מזרחי','רמת-גן'],['0586661199','ליאור אדר','באר שבע'],['0541112223','דנה כהן','חיפה']]}
};

/* ---------- loading ---------- */
function rebuild(id){const s=S[id];s.headers=E.headers(s.raw,s.header);s.data=s.raw.slice(s.header?1:0);s.key=Math.min(s.key,Math.max(0,s.headers.length-1));}
function resetDecisions(){V.over={};V.links=[];V.ignored=new Set();V.open=null;if(V.panel==='inspect')V.panel=null;}
function autoKeys(){E.autoKeys(S,V.mode);}
function load(id,rows,name){
 const s=S[id];
 s.raw=rows.filter(r=>r.some(v=>String(v??'').trim())).map(r=>r.map(v=>String(v??'')));
 s.header=E.headerGuess(s.raw);s.auto=true;if(name!==undefined)s.name=name;
 resetDecisions();rebuild(id);autoKeys();refresh();
}
function loadSaved(id,l){
 const s=S[id];s.book=null;load(id,[l.headers,...l.rows],l.name);
 s.header=true;rebuild(id);const k=l.keyCols[V.mode]??l.keyCols.phone??l.keyCols.id??0;s.key=Math.min(k,s.headers.length-1);s.auto=false;refresh();
}
function saveToLibrary(id){const s=S[id];Lib.saveFrom({name:s.name&&!s.pasted?s.name.replace(/\.[^.]+$/,''):t('list'+id),headers:s.headers,rows:s.data,key:s.key,mode:V.mode});}
function clearList(id){S[id]=E.fresh();resetDecisions();refresh();}
function loadSample(id){const x=SAMPLE[id];S[id].book=null;load(id,x.rows.map(r=>[...r]),x.name);}

let excelPromise;
function excel(){
 if(window.XLSX)return Promise.resolve(window.XLSX);if(excelPromise)return excelPromise;
 excelPromise=new Promise((resolve,reject)=>{const s=h('script');s.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const fail=()=>{excelPromise=null;reject(Object.assign(new Error('excelFail'),{key:'excelFail'}));};
  const timer=setTimeout(()=>{s.remove();fail();},25000);
  s.onload=()=>{clearTimeout(timer);window.XLSX?resolve(window.XLSX):fail();};s.onerror=()=>{clearTimeout(timer);fail();};document.head.append(s);});
 return excelPromise;
}
function readSheet(id){const s=S[id];load(id,window.XLSX.utils.sheet_to_json(s.book.Sheets[s.sheet],{header:1,defval:'',raw:false,blankrows:false}));}
async function importFile(id,file){
 if(!file)return;
 const s=S[id];s.msg={k:'loading',a:[file.name]};render();
 try{
  if(/\.(xlsx|xls|xlsm|xlsb)$/i.test(file.name)){
   const X=await excel(),book=X.read(await file.arrayBuffer(),{type:'array'});
   if(!book.SheetNames.length)throw Object.assign(new Error('noSheets'),{key:'noSheets'});
   s.book=book;s.sheet=book.SheetNames[0];readSheet(id);S[id].name=file.name;
  }else{
   const text=await file.text();s.book=null;load(id,E.parseText(text),file.name);
  }
  S[id].msg={k:'loaded',a:[file.name]};
 }catch(e){S[id].msg={k:e.key||null,text:e.message,bad:true};}
 finally{$('file-'+id).value='';}
 render();
}
/* Read a file into rows for the library: CSV/TSV/TXT or one sheet of an Excel workbook. */
async function readFile(file){
 if(/\.(xlsx|xls|xlsm|xlsb)$/i.test(file.name)){
  const X=await excel(),book=X.read(await file.arrayBuffer(),{type:'array'});
  if(!book.SheetNames.length)throw Object.assign(new Error('noSheets'),{key:'noSheets'});
  return {book,sheets:book.SheetNames,sheet:book.SheetNames[0],rows:sheetRows(book,book.SheetNames[0])};
 }
 return {book:null,sheets:[],sheet:'',rows:E.parseText(await file.text())};
}
function sheetRows(book,name){return window.XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false,blankrows:false});}
function pasteInto(id,text){const s=S[id];s.book=null;load(id,E.parseText(text),'');S[id].pasted=true;S[id].msg=null;render();}

/* ---------- compute ---------- */
const prefSide=()=>V.prefer.toLowerCase();
function recompute(){
 stats=E.analyze(S.A,S.B,{mode:V.mode,dups:V.dups,links:V.links,ignored:V.ignored});
 const op=E.opFor(V.sel);
 result=op&&bothLoaded()?E.compute(S.A,S.B,op,(V.fill?'fill-':'prefer-')+prefSide(),V.dups==='all',V.over):{columns:[],rows:[],conflicts:0};
 if(V.sort)result.rows.sort((a,b)=>a.key.localeCompare(b.key));
}
function refresh(){recompute();render();}

const local=k=>k.startsWith('+972')?'0'+k.slice(4):k;
function fmtKey(k){if(V.fmt==='local')return local(k);if(V.fmt==='digits')return k.replace(/^\+/,'');return k;}
function output(forExport){
 const hs=result.columns.map(c=>c.label),k=result.columns.findIndex(c=>c.key);let src=false;
 if(forExport&&V.exportSource){let label=t('source'),i=2;while(hs.some(x=>x.toLowerCase()===label.toLowerCase()))label=t('source')+' ('+i+++')';hs.push(label);src=true;}
 const rows=result.rows.map(r=>{const v=[...r.values];if(k>=0&&V.mode==='phone'&&V.fmt!=='original')v[k]=(r.keys||[r.key]).map(fmtKey).join(' / ');if(src)v.push(r.source);return v;});
 return {hs,rows,k};
}
const code=()=>(V.sel.A?'a':'')+(V.sel.AB?'m':'')+(V.sel.B?'b':'');
const NAMES={amb:['rMerge','dMerge'],m:['rMatch','dMatch'],ab:['rUn','dUn'],a:['rA','dA'],b:['rB','dB'],am:['rCleanA','dCleanA'],mb:['rCleanB','dCleanB'],'':['rNone','dNone']};
const PRESETS=[['pAll','amb'],['pMatch','m'],['pUn','ab'],['pAB','a'],['pBA','b']];
function setCode(c){V.sel={A:c.includes('a'),AB:c.includes('m'),B:c.includes('b')};refresh();}
function toggleArea(r){V.sel[r]=!V.sel[r];refresh();}

/* ---------- toast ---------- */
function toast(msg,action){const n=$('toast');n.replaceChildren(document.createTextNode(msg));if(action)n.append(h('button',{type:'button',class:'tbtn',onclick:()=>{action.run();n.hidden=true;},text:action.label}));n.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{n.hidden=true;},action?6000:3200);}

/* ---------- dialog ---------- */
let modalOpener=null;
function closeModal(){const m=$('modal');if(m.hidden)return;m.hidden=true;m.replaceChildren();if(modalOpener&&document.contains(modalOpener))modalOpener.focus();modalOpener=null;}
/* body: a node. onOk may return false to keep the dialog open. okLabel null hides the confirm button. */
function modal(title,body,onOk,okLabel,opts){
 const m=$('modal');modalOpener=document.activeElement;m.hidden=false;
 const ok=okLabel===null?null:h('button',{class:'primary',type:'button',id:'modalOk',onclick:async()=>{if(onOk&&(await onOk())===false)return;closeModal();},text:okLabel||t('save')});
 m.replaceChildren(h('div',{class:'sheet'+(opts&&opts.wide?' wide':''),role:'dialog','aria-modal':'true','aria-label':title},h('h2',{text:title}),body,h('div',{class:'acts'},h('button',{type:'button',onclick:closeModal,text:t('cancel')}),ok)));
 const first=m.querySelector('input:not([type=file]),textarea,select')||m.querySelector('button.primary');if(first)first.focus();
 return {close:closeModal,ok:()=>$('modalOk')};
}
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});

/* ---------- list cards ---------- */
function msgNode(s){if(!s.msg)return null;const m=s.msg,text=m.k?t(m.k,...(m.a||[])):m.text;return text?h('div',{class:'msg'+(m.bad?' bad':''),text}):null;}
function listCard(id){
 const box=$('list'+id),s=S[id];box.replaceChildren();
 const head=(sub,extra)=>h('div',{class:'list-head'},h('span',{class:'tag '+id,'aria-hidden':'true',text:id}),h('div',{class:'list-name'},h('b',{text:sub?(s.name||t('pastedName')):t('list'+id)}),sub&&h('span',{text:sub})),extra);
 if(!isLoaded(id)){
  const area=h('textarea',{class:'paste',id:'paste-'+id,spellcheck:'false','aria-label':t('pasteLabel',id),placeholder:t('pastePh')});
  let timer;area.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(area.value.trim())pasteInto(id,area.value);},200);});
  box.append(head(null),h('div',{class:'drop'},h('span',{class:'ic','aria-hidden':'true'},ico('upload')),h('b',{text:t('dropTitle')}),h('p',{text:t('dropSub')}),
   h('div',{class:'row'},h('button',{class:'primary sm',type:'button',id:'upload-'+id,onclick:()=>$('file-'+id).click(),text:t('importFile')}),window.Lib&&Lib.count()?h('button',{class:'sm',type:'button',id:'saved-'+id,onclick:()=>Lib.pick(l=>loadSaved(id,l)),text:t('useSaved')}):null),area,msgNode(s)));
  return;
 }
 const hs=s.headers,k=s.key;
 const keySel=h('select',{id:'key-'+id,'aria-label':t('matchOn'),onchange:e=>{s.key=+e.target.value;s.auto=false;refresh();}},hs.map((x,c)=>h('option',{value:c,selected:c===k,text:(c+1)+'. '+x})));
 const hdr=h('input',{type:'checkbox',id:'header-'+id,checked:s.header,onchange:e=>{s.header=e.target.checked;rebuild(id);autoKeys();refresh();}});
 const sheetSel=s.book&&h('label',{class:'field'},h('span',{class:'cap',text:t('sheet')}),h('select',{id:'sheet-'+id,onchange:e=>{s.sheet=e.target.value;readSheet(id);}},s.book.SheetNames.map(n=>h('option',{value:n,selected:n===s.sheet,text:n}))));
 const chips=h('div',{class:'chips'});
 if(s.auto&&s.data.length)chips.append(h('span',{class:'chip ok',text:t('auto')}));
 const numeric=V.mode==='phone'||V.mode==='id',multi=s.data.filter(r=>E.rowKeys(r[s.key],V.mode).length>1).length;
 const badCheck=V.mode==='id'?s.data.filter(r=>E.rowKeys(r[s.key],'id').some(k=>!E.idCheck(k))).length:0;
 if(s.invalid.length)chips.append(h('span',{class:'chip warn',text:t('excluded',s.invalid.length)}));
 if(multi&&numeric)chips.append(h('span',{class:'chip',text:t(V.mode==='id'?'multiId':'multi',multi)}));
 if(badCheck)chips.append(h('span',{class:'chip warn',title:t('badCheckHelp'),text:t('badCheck',badCheck)}));
 if(s.duplicates)chips.append(h('span',{class:'chip warn',text:t('dups',s.duplicates)}));
 chips.append(h('span',{class:'chip',text:t('uniqueKeys',s.index.size)}));
 const valid=s.data.length-s.invalid.length;
 const warn=valid>=10&&s.index.size<=Math.max(2,valid*0.1)?h('div',{class:'warnbox',text:t('lowDistinct',hs[k],s.index.size,valid)}):null;
 const mini=h('table',{},h('thead',{},h('tr',{},hs.map((x,c)=>h('th',{class:c===k?'key':'',text:x})))),h('tbody',{},s.data.slice(0,5).map(r=>h('tr',{},hs.map((_,c)=>h('td',{dir:'auto',text:r[c]??''}))))));
 const excl=s.invalid.length?h('details',{class:'excl'},h('summary',{text:t('showExcluded',s.invalid.length)}),h('pre',{text:s.invalid.slice(0,100).map(v=>t('dataRow',v.i+1,v.value)).join('\n')+(s.invalid.length>100?'\n'+t('first100'):'')})):null;
 box.append(...[
  head(t('rowsCols',s.data.length,hs.length),h('span',{class:'head-acts'},window.Lib?h('button',{class:'ghost sm',type:'button',id:'tolib-'+id,title:t('saveToLibraryHelp'),onclick:()=>saveToLibrary(id),text:t('saveToLibrary')}):null,h('button',{class:'ghost sm',type:'button',onclick:()=>clearList(id),text:t('remove')}))),
  h('div',{class:'fields'},h('label',{class:'field'},h('span',{class:'cap',text:t('matchOn')}),keySel),sheetSel,h('label',{class:'check'},hdr,h('span',{text:t('header')}))),
  chips,warn,excl,msgNode(s),
  h('details',{class:'peek'},h('summary',{text:t('peek')}),h('div',{class:'mini'},mini))].filter(Boolean));
}

/* ---------- match settings ---------- */
function matchCard(){
 const c=$('matchCard');c.replaceChildren();
 c.hidden=!bothLoaded();if(c.hidden)return;
 const help={phone:'mPhoneHelp',id:'mIdHelp',text:'mTextHelp',exact:'mExactHelp'}[V.mode];
 c.append(h('h2',{class:'card-title',text:t('howMatch')}),
  h('div',{class:'seg',role:'group','aria-label':t('howMatch')},[['phone','mPhone'],['id','mId'],['text','mText'],['exact','mExact']].map(([m,k])=>h('button',{type:'button','aria-pressed':String(V.mode===m),onclick:()=>{V.mode=m;V.links=[];V.ignored=new Set();V.over={};autoKeys();refresh();},text:t(k)}))),
  h('p',{class:'help',text:t(help)}));
 if(!stats.both)c.append(h('div',{class:'notice',text:t('noShared')}));
 if(stats.near.length){
  c.append(h('div',{class:'sug'},h('span',{class:'cap',text:t('sugTitle')}),stats.near.slice(0,5).map(([ka,kb])=>h('div',{class:'sug-row'},
   h('div',{},h('code',{text:local(ka)+' ↔ '+local(kb)}),h('div',{class:'mock',text:t('sugOne')})),
   h('div',{class:'btns'},h('button',{class:'sm primary',type:'button',onclick:()=>{V.links.push([ka,kb]);toast(t('linked'));refresh();},text:t('accept')}),h('button',{class:'sm ghost',type:'button',onclick:()=>{V.ignored.add(ka+'|'+kb);refresh();},text:t('dismiss')})))),
   stats.near.length>5&&h('span',{class:'mock',text:t('moreSug',stats.near.length-5)})));
 }
}

/* ---------- Venn selector ---------- */
function vennSvg(){
 const flip=lang==='he',cx={A:flip?198:122,B:flip?122:198},VR={A:['notB',flip?234:86],AB:['cA',160],B:['notA',flip?86:234]};
 const circ=(cx,r)=>`M${cx-r} 90a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;
 const n={A:stats.aOnly,AB:stats.both,B:stats.bOnly},label={A:'onlyA',AB:'both',B:'onlyB'};
 const svg=document.createElementNS(SVGNS,'svg');svg.setAttribute('viewBox','0 0 320 180');svg.setAttribute('class','venn');svg.setAttribute('role','group');svg.setAttribute('aria-label',t('show'));
 svg.innerHTML=`<defs><clipPath id="cA"><path d="${circ(cx.A,72)}"/></clipPath><clipPath id="notB"><path clip-rule="evenodd" d="M0 0H320V180H0Z ${circ(cx.B,72)}"/></clipPath><clipPath id="notA"><path clip-rule="evenodd" d="M0 0H320V180H0Z ${circ(cx.A,72)}"/></clipPath></defs>`;
 const mk=r=>{const e=document.createElementNS(SVGNS,'circle');e.setAttribute('class','vr'+(V.sel[r]?' on':''));e.setAttribute('data-r',r);e.setAttribute('cx',r==='B'?cx.B:r==='A'?cx.A:cx.B);e.setAttribute('cy',90);e.setAttribute('r',72);e.setAttribute('clip-path','url(#'+VR[r][0]+')');e.setAttribute('tabindex','0');e.setAttribute('role','checkbox');e.setAttribute('aria-checked',String(V.sel[r]));e.setAttribute('aria-label',t(label[r])+': '+n[r]);
  e.addEventListener('click',()=>toggleArea(r));e.addEventListener('keydown',ev=>{if(ev.key===' '||ev.key==='Enter'){ev.preventDefault();toggleArea(r);}});return e;};
 for(const r of ['A','AB','B'])svg.append(mk(r));
 for(const c of [cx.A,cx.B]){const p=document.createElementNS(SVGNS,'path');p.setAttribute('d',circ(c,72));p.setAttribute('class','ring');svg.append(p);}
 for(const r of ['A','AB','B']){const x=document.createElementNS(SVGNS,'text');x.setAttribute('x',VR[r][1]);x.setAttribute('y',99);x.setAttribute('class',V.sel[r]?'on':'');x.textContent=n[r].toLocaleString();svg.append(x);}
 for(const [x,l] of [[flip?250:70,'A'],[flip?70:250,'B']]){const e=document.createElementNS(SVGNS,'text');e.setAttribute('x',x);e.setAttribute('y',14);e.setAttribute('class','lbl');e.textContent=t('list'+l);svg.append(e);}
 return svg;
}
function pickCard(){
 const box=$('pickCard');box.replaceChildren();
 const c=code(),[nk,dk]=NAMES[c],n={A:stats.aOnly,AB:stats.both,B:stats.bOnly};
 const regionBtn=(r,k)=>h('button',{class:'region',type:'button','data-r':r,'aria-pressed':String(V.sel[r]),onclick:()=>toggleArea(r)},h('span',{class:'dot'}),t(k)+' ',h('b',{text:n[r].toLocaleString()}));
 box.append(h('div',{},vennSvg()),
  h('div',{},h('span',{class:'cap',text:t('show')}),h('h2',{style:'margin-top:4px',text:t(nk)}),h('p',{class:'desc',text:t(dk)}),
   h('div',{class:'regions',role:'group','aria-label':t('show')},regionBtn('A','onlyA'),regionBtn('AB','both'),regionBtn('B','onlyB')),
   h('div',{class:'presets'},h('span',{class:'cap',text:t('quick')}),PRESETS.map(([k,cd])=>h('button',{type:'button','aria-pressed':String(c===cd),onclick:()=>setCode(cd),text:t(k)})))));
}

/* ---------- results grid ---------- */
function openPanel(kind,id){if(!V.panel){opener=document.activeElement;openerRow=opener&&opener.dataset?opener.dataset.id||null:null;}V.panel=kind;V.open=id||null;render();}
function openRow(id){openPanel('inspect',id);}
function grid(){
 const d=output(false),q=V.q.toLowerCase().trim(),keep=[];
 d.rows.forEach((r,i)=>{if(!q||r.some(v=>String(v).toLowerCase().includes(q)))keep.push(i);});
 const shown=keep.slice(0,LIMIT),tbl=$('grid');tbl.replaceChildren();
 const keyCls=c=>c===d.k?'key':'';
 const head=h('thead',{},h('tr',{},h('th',{'aria-label':t('source')}),d.hs.map((x,c)=>h('th',{class:keyCls(c),text:x}))));
 const body=h('tbody');
 if(!shown.length)body.append(h('tr',{},h('td',{class:'none',colspan:d.hs.length+1,text:code()===''?t('dNone'):t('noRows')})));
 for(const i of shown){
  const r=result.rows[i],vals=d.rows[i];
  const tr=h('tr',{class:'row'+(V.open===r.id?' sel':''),'data-s':r.source==='A+B'?'AB':r.source,'data-id':r.id,tabindex:'0',onclick:()=>openRow(r.id),onkeydown:e=>{if(e.key==='Enter')openRow(r.id);}},h('td',{class:'src'},h('span',{class:'badge',text:r.source})));
  vals.forEach((v,c)=>{const isKey=c===d.k,diff=r.conf.has(c),txt=String(v);tr.append(h('td',{class:(isKey&&(V.mode==='phone'||V.mode==='id')?'k ':'')+(diff?'diff ':'')+(txt.trim()?'':'empty'),dir:isKey&&(V.mode==='phone'||V.mode==='id')?'ltr':'auto',title:diff?'A: '+r.va[c]+'  |  B: '+r.vb[c]:txt,text:txt.trim()?txt:'—'}));});
  body.append(tr);
 }
 tbl.append(head,body);
 const diffs=keep.reduce((n,i)=>n+result.rows[i].conf.size,0);
 $('count').textContent=(keep.length>LIMIT?t('showingFirst',LIMIT,keep.length.toLocaleString()):t('rows',keep.length.toLocaleString()))+(diffs?' · '+t('diffs',diffs):'');
 for(const b of ['expMain','expMore'])$(b).disabled=!result.rows.length;
}

/* ---------- slide-over panel ---------- */
let opener=null,openerRow=null;
function closePanel(){V.panel=null;V.open=null;render();const el=openerRow?document.querySelector('tr[data-id="'+CSS.escape(openerRow)+'"]'):opener;if(el&&document.contains(el))el.focus();opener=openerRow=null;}
function panel(){
 const o=$('overlay'),wasOpen=!!o.querySelector('.panel');o.replaceChildren();o.hidden=!V.panel;if(!V.panel)return;
 let title,body;
 if(V.panel==='options'){
  title=t('optTitle');
  const segs=(key,items,dis)=>h('div',{class:'seg',role:'group'},items.map(([v,l])=>h('button',{type:'button',disabled:dis,'aria-pressed':String(V[key]===v),onclick:()=>{V[key]=v;if(key==='dups')V.over={};refresh();},text:l})));
  const sw=(key,label)=>h('label',{class:'check'},h('input',{type:'checkbox',checked:V[key],onchange:e=>{V[key]=e.target.checked;refresh();}}),h('span',{text:label}));
  body=[h('div',{class:'opt'},h('span',{class:'t',text:t('oPrefer')}),segs('prefer',[['A',t('inA')],['B',t('inB')]]),sw('fill',t('oFill')),h('span',{class:'d',text:t('oPreferHelp')})),
   h('div',{class:'opt'},h('span',{class:'t',text:t('oFmt')}),segs('fmt',[['original',t('fOrig')],['intl',t('fIntl')],['local',t('fLocal')],['digits',t('fDigits')]],V.mode!=='phone'),V.mode!=='phone'&&h('span',{class:'d',text:t('oFmtPhoneOnly')}),sw('sort',t('oSort'))),
   h('div',{class:'opt'},h('span',{class:'t',text:t('oDup')}),segs('dups',[['first',t('dFirst')],['last',t('dLast')],['all',t('dAll')]]),h('span',{class:'d',text:V.dups==='all'?t('dAllHelp'):t('dupHelp')})),
   h('div',{class:'opt'},sw('exportSource',t('oSrc')))];
 }else{
  const r=result.rows.find(x=>x.id===V.open);
  if(!r){V.panel=null;o.hidden=true;return;}
  title=t('inspect');
  const only=r.both?null:t('onlyHere',r.source==='B'?t('listB'):t('listA'));
  const val=(v,isKey,use,on)=>h('button',{class:'val'+(use?' use':'')+(String(v).trim()?'':' nil')+(isKey?' k':''),type:'button',disabled:!String(v).trim()||!r.both,onclick:on,dir:isKey?'ltr':'auto',text:String(v).trim()?v:'—'});
  const rows=result.columns.map((cl,x)=>h('tr',{class:r.conf.has(x)?'cf':''},h('td',{class:'f',text:cl.label}),
   h('td',{},val(r.va[x],cl.key,r.both?r.used[x]==='A':true,()=>{V.over[r.id+':'+cl.id]='A';refresh();})),
   h('td',{},val(r.vb[x],cl.key,r.both?r.used[x]==='B':false,()=>{V.over[r.id+':'+cl.id]='B';refresh();})),
   h('td',{},h('span',{class:'val'+(cl.key?' k':''),style:'border-color:transparent',dir:cl.key?'ltr':'auto',text:String(r.values[x]).trim()?r.values[x]:'—'}))));
  body=[only&&h('div',{class:'note',text:only}),r.both&&h('div',{class:'note',text:t('pick')}),
   h('div',{style:'overflow:auto'},h('table',{class:'insp'},h('thead',{},h('tr',{},h('th',{text:t('field')}),h('th',{text:t('inA')}),h('th',{text:t('inB')}),h('th',{text:t('used')}))),h('tbody',{},rows)))];
 }
 o.append(h('div',{class:'scrim',onclick:closePanel}),h('aside',{class:'panel',role:'dialog','aria-label':title},h('div',{class:'panel-head'},h('h2',{text:title}),h('button',{class:'ghost icon',type:'button',onclick:closePanel,'aria-label':t('close')},ico('x'))),h('div',{class:'panel-body'},body)));
 const x=o.querySelector('.panel-head button');if(x&&!wasOpen)x.focus();
}

/* ---------- render ---------- */
function applyStatic(){
 document.documentElement.lang=lang;document.documentElement.dir=lang==='he'?'rtl':'ltr';document.title=t('appName');
 for(const e of document.querySelectorAll('[data-i18n]'))e.textContent=t(e.dataset.i18n);
 for(const e of document.querySelectorAll('[data-i18n-ph]'))e.placeholder=t(e.dataset.i18nPh);
 for(const e of document.querySelectorAll('[data-i18n-aria]'))e.setAttribute('aria-label',t(e.dataset.i18nAria));
 $('langEn').setAttribute('aria-pressed',String(lang==='en'));$('langHe').setAttribute('aria-pressed',String(lang==='he'));
 const dark=document.documentElement.dataset.theme==='dark';$('themeBtn').replaceChildren(ico(dark?'sun':'moon'));
}
let view='compare';try{if(localStorage.getItem('table-tool-view')==='combine')view='combine';}catch(e){}
const hooks=[];
function setView(v){view=v;try{localStorage.setItem('table-tool-view',v);}catch(e){}render();}
function render(){
 applyStatic();
 $('compareView').hidden=view!=='compare';$('combineView').hidden=view!=='combine';
 for(const b of document.querySelectorAll('#viewSeg button'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 for(const n of document.querySelectorAll('.cmp-only'))n.hidden=view!=='compare';
 const loadedCount=(isLoaded('A')?1:0)+(isLoaded('B')?1:0),both=loadedCount===2;
 $('optBtn').disabled=!both;$('swapBtn').disabled=loadedCount===0;$('resetBtn').disabled=loadedCount===0;
 listCard('A');listCard('B');matchCard();
 $('onboard').hidden=both;$('results').hidden=!both;
 if(!both){$('onboard').querySelector('h2').textContent=t(loadedCount?'emptyTitle1':'emptyTitle');$('onboard').querySelector('p').textContent=t(loadedCount?'emptySub1':'emptySub');}
 if(both){pickCard();grid();}
 panel();
 for(const f of hooks)f();
}

/* ---------- export ---------- */
let excelBusy=false;
function save(data,type,ext,base){const url=URL.createObjectURL(new Blob([data],{type})),a=h('a');a.href=url;a.download=(base||'table-'+(E.opFor(V.sel)||'result'))+'.'+ext;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
function doExport(kind){closeMenu();return exportData(kind,output(true));}
async function exportData(kind,d,base){
 if(!d.rows.length)return;
 if(kind==='csv'){save('﻿'+[d.hs,...d.rows].map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','csv',base);toast(t('exportedCsv',d.rows.length));return;}
 if(kind==='xlsx'){
  if(excelBusy)return;excelBusy=true;toast(t('preparingExcel'));
  try{const X=await excel(),ws=X.utils.aoa_to_sheet([d.hs,...d.rows]),wb=X.utils.book_new();ws['!cols']=d.hs.map(x=>({wch:Math.max(16,Math.min(40,x.length+2))}));if(ws['!ref'])ws['!autofilter']={ref:ws['!ref']};X.utils.book_append_sheet(wb,ws,'Result');save(X.write(wb,{bookType:'xlsx',type:'array'}),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx',base);toast(t('exportedXlsx',d.rows.length));}
  catch(e){toast(e.key?t(e.key):e.message);}finally{excelBusy=false;}
  return;
 }
 const text=[d.hs,...d.rows].map(r=>r.map(v=>/[\t\r\n"]/.test(v)?quote(v):v).join('\t')).join('\r\n');
 try{if(!navigator.clipboard?.writeText)throw new Error('unavailable');await navigator.clipboard.writeText(text);}
 catch(e){const ta=h('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-10000px';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(!ok){toast(t('clipboardBlocked'));return;}}
 toast(t('copied',d.rows.length));
}
function closeMenu(){$('expMenu').hidden=true;$('expMore').setAttribute('aria-expanded','false');}

/* ---------- wiring ---------- */
function swapLists(){
 [S.A,S.B]=[S.B,S.A];
 V.links=V.links.map(([a,b])=>[b,a]);
 V.ignored=new Set([...V.ignored].map(p=>p.split('|').reverse().join('|')));
 const over={};for(const [k,v] of Object.entries(V.over)){const m=k.match(/^([^:]*):([^:]*):(.*)$/);over[m[2]+':'+m[1]+':'+m[3]]=v==='A'?'B':'A';}V.over=over;
 V.open=null;if(V.panel==='inspect')V.panel=null;
 refresh();
}
function resetAll(){
 S.A=E.fresh();S.B=E.fresh();V.sel={A:true,AB:true,B:true};V.q='';$('search').value='';V.panel=null;resetDecisions();refresh();
}
for(const b of document.querySelectorAll('#viewSeg button'))b.onclick=()=>setView(b.dataset.view);
$('langEn').onclick=()=>{lang='en';try{localStorage.setItem('table-tool-language','en');}catch(e){}render();};
$('langHe').onclick=()=>{lang='he';try{localStorage.setItem('table-tool-language','he');}catch(e){}render();};
$('themeBtn').onclick=()=>{const r=document.documentElement,next=r.dataset.theme==='dark'?'light':'dark';r.dataset.theme=next;try{localStorage.setItem('table-tool-theme',next);}catch(e){}render();};
$('optBtn').onclick=()=>openPanel('options');
$('swapBtn').onclick=swapLists;
$('resetBtn').onclick=resetAll;
$('sampleBtn').onclick=()=>{for(const id of ['A','B'])if(!isLoaded(id)){S[id].book=null;const x=SAMPLE[id];S[id].raw=x.rows.map(r=>[...r]);S[id].header=true;S[id].auto=true;S[id].name=x.name;rebuild(id);}resetDecisions();autoKeys();refresh();};
$('search').oninput=e=>{V.q=e.target.value;if(bothLoaded())grid();};
$('expMain').onclick=()=>doExport('xlsx');
$('expMore').onclick=e=>{e.stopPropagation();const m=$('expMenu');m.hidden=!m.hidden;$('expMore').setAttribute('aria-expanded',String(!m.hidden));};
for(const b of document.querySelectorAll('[data-exp]'))b.onclick=()=>doExport(b.dataset.exp);
document.addEventListener('click',e=>{if(!e.target.closest('.split'))closeMenu();});
for(const id of ['A','B'])$('file-'+id).onchange=e=>importFile(id,e.target.files[0]);

/* drag and drop: onto a list, or anywhere to fill the first empty list */
const hasFiles=e=>!!e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
for(const id of ['A','B']){const box=$('list'+id);
 box.addEventListener('dragover',e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();box.classList.add('over');}});
 box.addEventListener('dragleave',e=>{if(!box.contains(e.relatedTarget))box.classList.remove('over');});
 box.addEventListener('drop',e=>{box.classList.remove('over');if(hasFiles(e)){e.preventDefault();e.stopPropagation();importFile(id,e.dataTransfer.files[0]);}});}
window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault();});
window.addEventListener('drop',e=>{if(!hasFiles(e)||view!=='compare')return;e.preventDefault();const id=!isLoaded('A')?'A':!isLoaded('B')?'B':null;if(id)importFile(id,e.dataTransfer.files[0]);else toast(t('bothFull'));});

/* paste anywhere outside a field: fills the first empty list */
document.addEventListener('paste',e=>{
 if(view!=='compare'||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
 const text=e.clipboardData&&e.clipboardData.getData('text');if(!text||!text.trim())return;
 const id=!isLoaded('A')?'A':!isLoaded('B')?'B':null;e.preventDefault();
 if(id)pasteInto(id,text);else toast(t('bothFull'));
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(!$('modal').hidden)closeModal();else if(!$('expMenu').hidden)closeMenu();else if(V.panel)closePanel();}
 if(e.key==='/'&&view==='compare'&&bothLoaded()&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){e.preventDefault();$('search').focus();}
});

window.App={E,$,h,ico,t,getLang:()=>lang,toast,modal,closeModal,excel,readFile,sheetRows,exportData,onRender:f=>hooks.push(f),render,setView,getView:()=>view,refreshCompare:refresh,
 onLang:null};
refresh();
})();
