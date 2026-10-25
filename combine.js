/* Combine view: saved lists, the step builder, the count funnel and the result. Combining rules live in engine.js, storage in store.js, shared helpers in ui.js (window.App). */
(()=>{
'use strict';
const {E,$,h,ico,t,toast,modal}=window.App;
const fmt=n=>n.toLocaleString();
const COLORS=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];
const DRAFT='table-tool-combine-draft';
const LIMIT=200;

let LIB=[],RECIPES=[],store=null,R={columns:[],rows:[],stages:[],removed:[],skipped:{}};
const C={hidden:new Set(),mode:'phone',steps:[],tab:'result',q:'',pop:null,exportFrom:false,flash:null};
const byId=id=>LIB.find(l=>l.id===id);
const colorOf=l=>COLORS[l.color%COLORS.length];
const modeName=m=>t({phone:'mPhone',id:'mId',text:'mText'}[m]);
const keyCol=l=>l.keyCols[C.mode];

/* ---------- state ---------- */
function recompute(){R=E.combine(LIB,C.steps,C.mode);}
function persistDraft(){try{localStorage.setItem(DRAFT,JSON.stringify({mode:C.mode,steps:C.steps,hidden:[...C.hidden]}));}catch(e){}}
function changed(){recompute();persistDraft();App.render();}
function loadDraft(){
 let d=null;try{d=JSON.parse(localStorage.getItem(DRAFT)||'null');}catch(e){}
 if(d&&Array.isArray(d.steps)&&d.steps.length&&['phone','id','text'].includes(d.mode)){C.mode=d.mode;C.steps=d.steps.map(s=>({type:s.type,lists:(s.lists||[]).filter(id=>byId(id))}));C.hidden=new Set(Array.isArray(d.hidden)?d.hidden:[]);}
 if(!C.steps.length||C.steps[0].type!=='start')C.steps.unshift({type:'start',lists:LIB[0]?[LIB[0].id]:[]});
}
function nextColor(){const use=COLORS.map(()=>0);for(const l of LIB)use[l.color%6]++;return use.indexOf(Math.min(...use));}
function when(l){
 const d=Date.now()-l.updated;
 if(d<60000)return t('justNow');
 const days=Math.floor(d/86400000);
 if(days<1)return t('today');
 if(days<30)return t('daysAgo',days);
 return new Date(l.updated).toLocaleDateString(App.getLang()==='he'?'he-IL':'en-GB');
}

/* ---------- saved lists ---------- */
async function putList(l,keepUpdated){
 const v=await store.saveList(l,{keepUpdated});
 const i=LIB.findIndex(x=>x.id===v.id);if(i<0)LIB.push(v);else LIB[i]=v;return v;
}
async function addList({name,headers,rows,keyCols,template,date}){
 const v=await putList({id:store.newId('l'),name,color:nextColor(),headers,rows,keyCols,template:template||null,date:date||'',created:Date.now()});
 C.flash=v.id;setTimeout(()=>{C.flash=null;},1400);
 if(!C.steps.length||(C.steps[0].type==='start'&&!C.steps[0].lists.length))C.steps=[{type:'start',lists:[v.id]},...C.steps.slice(1)];
 return v;
}
function pillOf(l,extra){
 const none=keyCol(l)==null;
 return h('span',{class:'pill'+(none?' warn':''),style:'--c:'+colorOf(l),title:none?l.name+' — '+t('noCol',modeName(C.mode)):l.name},h('i'),h('b',{text:l.name}),none&&h('span',{class:'wmark',text:'!'}),extra);
}
function renderLib(){
 const box=$('lib');box.replaceChildren();
 for(const l of LIB){
  const c=keyCol(l);
  const sel=h('select',{'aria-label':t('matchOn')+': '+l.name,onchange:async e=>{const v=+e.target.value;l.keyCols={...l.keyCols,[C.mode]:v<0?null:v};await putList(l,true);changed();}},c==null&&h('option',{value:'-1',selected:true,text:t('noneCol')}),l.headers.map((x,i)=>h('option',{value:i,selected:i===c,text:(i+1)+'. '+x})));
  box.append(h('div',{class:'lcard'+(C.flash===l.id?' flash':''),style:'--c:'+colorOf(l),'data-drag':'list','data-id':l.id},
   h('span',{class:'grip',title:t('dragHint')},ico('grip')),h('span',{class:'dot'}),
   h('div',{style:'min-width:0'},h('b',{text:l.name}),h('span',{class:'m',text:t('rows',l.rows.length)+' · '+t('updated',when(l))+(l.date?' · '+t('reportOn',l.date):'')})),
   h('div',{class:'acts'},
    h('button',{type:'button',title:t('update'),'aria-label':t('update')+': '+l.name,onclick:()=>updateDialog(l)},ico('refresh')),
    h('button',{type:'button',title:t('rename'),'aria-label':t('rename')+': '+l.name,onclick:()=>renameDialog(l)},ico('pencil')),
    h('button',{type:'button',title:t('del'),'aria-label':t('del')+': '+l.name,onclick:()=>deleteDialog(l)},ico('trash'))),
   h('div',{class:'lkey'},h('span',{class:'cap',text:t('matchOn')}),sel,c==null?h('span',{class:'chip warn',text:t('noCol',modeName(C.mode))}):h('span',{class:'chip ok',text:t('usable',fmt(E.usableCount(l,C.mode)))}))));
 }
 const rb=$('recipes');rb.replaceChildren();
 if(!RECIPES.length)rb.append(h('p',{class:'hint',text:t('noRecipes')}));
 for(const r of RECIPES)rb.append(h('div',{class:'rcard'},
  h('button',{class:'load',type:'button',title:t('loadRecipe'),onclick:()=>{C.mode=r.mode;C.hidden=new Set(r.hidden||[]);C.steps=r.steps.map(s=>({type:s.type,lists:s.lists.filter(id=>byId(id))}));if(!C.steps.length||C.steps[0].type!=='start')C.steps.unshift({type:'start',lists:[]});C.pop=null;changed();}},h('span',{text:r.name})),
  h('span',{class:'live',title:t('live'),text:'●'}),
  h('button',{class:'ghost sm',style:'width:30px;padding:0',type:'button',title:t('delRecipe'),'aria-label':t('delRecipe')+': '+r.name,onclick:async()=>{await store.deleteRecipe(r.id);RECIPES=RECIPES.filter(x=>x.id!==r.id);App.render();}},ico('x'))));
}
function renderData(){
 const box=$('dataCard');box.replaceChildren(...[h('h2',{class:'card-title',text:t('dataTitle')}),
  !store.persistent&&h('div',{class:'warnbox',style:'margin-bottom:10px',text:t('memoryOnly')}),
  h('p',{class:'hint',text:t('dataHelp')}),
  h('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px'},
   h('button',{class:'sm',type:'button',onclick:backup,text:t('backup')}),
   h('button',{class:'sm',type:'button',onclick:()=>$('restoreFile').click(),text:t('restore')}),
   h('button',{class:'sm ghost',type:'button',disabled:!LIB.length&&!RECIPES.length,onclick:clearDialog,text:t('clearData')}))].filter(Boolean));
}

/* ---------- dialogs ---------- */
function field(label,node){return h('label',{class:'field'},h('span',{class:'cap',text:label}),node);}
function renameDialog(l){
 const name=h('input',{type:'text',id:'rn-name',value:l.name});
 modal(t('rename'),field(t('mName'),name),async()=>{const v=name.value.trim();if(!v){name.focus();return false;}l.name=v;await putList(l,true);changed();});
}
function deleteDialog(l){
 modal(t('delTitle',l.name),h('p',{class:'hint',style:'font-size:14px',text:t('delBody')}),async()=>{
  await store.deleteList(l.id);LIB=LIB.filter(x=>x.id!==l.id);
  for(const s of C.steps)s.lists=s.lists.filter(id=>id!==l.id);
  changed();toast(t('deleted',l.name));
 },t('del'));
}
function clearDialog(){
 modal(t('clearTitle'),h('p',{class:'hint',style:'font-size:14px',text:t('clearBody')}),async()=>{await store.clearAll();LIB=[];RECIPES=[];C.hidden=new Set();C.steps=[{type:'start',lists:[]}];changed();toast(t('cleared'));},t('clearData'));
}
async function backup(){
 const data=await store.exportAll(),blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=h('a');
 a.href=url;a.download='table-tool-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 toast(t('backedUp',data.lists.length,data.recipes.length));
}
async function restore(file){
 try{
  const r=await store.importAll(JSON.parse(await file.text()));
  LIB=await store.lists();RECIPES=await store.recipes();loadDraft();changed();toast(t('restored',r.lists,r.recipes,r.skipped));
 }catch(e){toast(t('notBackup'));}
 finally{$('restoreFile').value='';}
}
$('restoreFile').onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);};

/* The import dialog serves Add list and Update list: a file or pasted cells become headers + rows. The header row is detected (a date or title line above the column titles is skipped), can be changed, and is remembered with the list so the next file in the same template loads the same way. */
function importDialog({title,existing,file,onDone,okLabel}){
 const tpl=existing&&existing.template;
 const st={raw:null,hr:0,hrAuto:true,addDate:!!(tpl&&tpl.addDate),dateLabel:tpl&&tpl.dateLabel||''};
 let book=null,sheet='',data=null,m;
 const nameIn=existing?null:h('input',{type:'text',id:'imp-name',value:''});
 const fileIn=h('input',{type:'file',accept:'.xlsx,.xls,.xlsm,.xlsb,.csv,.tsv,.txt',hidden:true});
 const paste=h('textarea',{class:'paste',id:'imp-paste',spellcheck:'false',placeholder:t('pastePh'),'aria-label':t('pastedName')});
 const info=h('div',{class:'imp-info',role:'status'}),sheetBox=h('div'),hdrBox=h('div',{class:'hdrbox'});
 function setRaw(rows){
  st.raw=rows.filter(r=>r.some(v=>String(v??'').trim())).map(r=>r.map(v=>String(v??'')));
  if(tpl&&tpl.manual){st.hr=Math.max(-1,Math.min(tpl.hr,st.raw.length-1));st.hrAuto=false;}
  else{st.hr=E.headerRow(st.raw);st.hrAuto=true;}
  analyze();
 }
 function analyze(){
  if(!st.raw||!st.raw.length){data=null;hdrBox.replaceChildren();info.replaceChildren(h('span',{class:'hint',text:t('impNone')}));if(m)m.ok().disabled=true;return;}
  const tb=E.tableFrom(st.raw,st.hr,{addDate:st.addDate,dateLabel:st.dateLabel}),headers=tb.headers,body=tb.data,keyCols=E.detectKeyCols(headers,body);
  data={headers,rows:body,keyCols,date:tb.date,template:{hr:st.hr,manual:!st.hrAuto,addDate:st.addDate&&!!tb.date,dateLabel:st.dateLabel}};
  const hc=App.headerControls(st,analyze,'imp');
  hdrBox.replaceChildren(hc.field,...(hc.extras?[hc.extras]:[]));
  const found=[['phone',t('mPhone')],['id',t('mId')]].filter(([k])=>keyCols[k]!=null).map(([k,n])=>n+' → '+headers[keyCols[k]]);
  const parts=[h('div',{text:t('rowsCols',body.length,headers.length)}),h('div',{class:found.length?'':'warn-text',text:found.length?t('impFound',found.join(' · ')):t('impNoKey')})];
  if(existing){
   const same=JSON.stringify(headers)===JSON.stringify(existing.headers),kc=same?existing.keyCols:keyCols;
   const mode=kc[C.mode]!=null?C.mode:kc.phone!=null?'phone':kc.id!=null?'id':'text';
   const keysOf=(rs,c)=>{const set=new Set();if(c==null)return set;for(const r of rs)for(const k of E.rowKeys(r[c],mode))set.add(k);return set;};
   const oldK=keysOf(existing.rows,existing.keyCols[mode]),newK=keysOf(body,kc[mode]);
   let added=0,same2=0;for(const k of newK)oldK.has(k)?same2++:added++;
   parts.push(h('div',{class:'diff'},h('b',{text:t('diffTitle',modeName(mode))}),h('span',{class:'chip ok',text:'+'+fmt(added)+' '+t('diffNew')}),h('span',{class:'chip warn',text:'−'+fmt(oldK.size-same2)+' '+t('diffGone')}),h('span',{class:'chip',text:fmt(same2)+' '+t('diffSame')})));
   if(!same)parts.push(h('div',{class:'warnbox',text:t('diffCols')}));
   data.keyCols=kc;
  }
  info.replaceChildren(...parts);if(m)m.ok().disabled=false;
 }
 async function readIt(f){
  info.replaceChildren(h('span',{class:'hint',text:t('loading',f.name)}));
  try{
   const r=await App.readFile(f);book=r.book;sheet=r.sheet;
   if(nameIn&&!nameIn.value.trim())nameIn.value=f.name.replace(/\.[^.]+$/,'');
   sheetBox.replaceChildren(r.sheets.length>1?field(t('sheet'),h('select',{id:'imp-sheet',onchange:e=>{sheet=e.target.value;setRaw(App.sheetRows(book,sheet));}},r.sheets.map(n=>h('option',{value:n,selected:n===sheet,text:n})))):'');
   setRaw(r.rows);
  }catch(e){st.raw=null;info.replaceChildren(h('div',{class:'warnbox',text:e.key?t(e.key):e.message}));if(m)m.ok().disabled=true;}
 }
 fileIn.onchange=()=>{if(fileIn.files[0])readIt(fileIn.files[0]);};
 let timer;paste.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!paste.value.trim())return;book=null;sheetBox.replaceChildren();setRaw(E.parseText(paste.value));},250);});
 const body=h('div',{style:'display:flex;flex-direction:column;gap:12px'},
  nameIn&&field(t('mName'),nameIn),
  h('div',{style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap'},h('button',{class:'sm',type:'button',onclick:()=>fileIn.click()},ico('upload'),t('importFile')),fileIn,h('span',{class:'hint',text:t('impOr')})),
  paste,sheetBox,hdrBox,info);
 m=modal(title,body,async()=>{
  if(!data)return false;
  if(nameIn&&!nameIn.value.trim()){nameIn.focus();return false;}
  await onDone({name:nameIn?nameIn.value.trim():existing.name,...data});
 },okLabel,{wide:true});
 m.ok().disabled=true;analyze();
 const sheetEl=$('modal').querySelector('.sheet'),hasF=e=>!!e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
 sheetEl.addEventListener('dragover',e=>{if(hasF(e)){e.preventDefault();sheetEl.classList.add('over');}});
 sheetEl.addEventListener('dragleave',e=>{if(!sheetEl.contains(e.relatedTarget))sheetEl.classList.remove('over');});
 sheetEl.addEventListener('drop',e=>{sheetEl.classList.remove('over');if(hasF(e)){e.preventDefault();e.stopPropagation();const f=e.dataTransfer.files[0];if(f)readIt(f);}});
 if(file)readIt(file);
}
function addDialog(file){
 importDialog({title:t('mAddTitle'),file,onDone:async d=>{const v=await addList(d);changed();toast(t('savedList',v.name));}});
}
function updateDialog(l,file){
 importDialog({title:t('updateTitle',l.name),existing:l,file,okLabel:t('updateOk'),onDone:async d=>{
  const old=l.rows.length;l.headers=d.headers;l.rows=d.rows;l.keyCols=d.keyCols;l.template=d.template;l.date=d.date;await putList(l);
  C.flash=l.id;setTimeout(()=>{C.flash=null;},1400);changed();toast(t('updatedMsg',l.name,fmt(d.rows.length),fmt(old)));
 }});
}
const SAMPLES=[
 ['Sample leads',['Name','Phone','City'],[['יהודית לביא','052-607-0482','חיפה'],['הלל דוד','0506998645','תל אביב'],['תהילה הראל','054-655-6482','אילת'],['שמריהו הופמן','+972 52-720-4859','ירושלים'],['דנה כהן','0541112222','חיפה'],['יוסי מזרחי','03-5551234','רמת גן'],['נועה לוי','052 888 1010 / 054 300 0001','נתניה'],['רות בן־דוד','tel: 0587776655','אשדוד']]],
 ['Sample signups',['Phone','Name','Event'],[['+972526070482','Judith Lavi','Spring fair'],['0546556482','תהילה הראל','Spring fair'],['054-300-0001','נועה לוי','Spring fair'],['0549998888','משה פרץ','Spring fair'],['0586661199','ליאור אדר','Spring fair']]],
 ['Sample do-not-call',['Phone','Note'],[['0506998645','Asked to stop'],['0549998888','Asked to stop'],['052-720-4859','Asked to stop']]]
];
async function addSamples(){
 for(const [name,headers,rows] of SAMPLES)await addList({name,headers,rows,keyCols:E.detectKeyCols(headers,rows)});
 C.steps=[{type:'start',lists:[LIB[0].id]},{type:'add',lists:[LIB[1].id]},{type:'remove',lists:[LIB[2].id]}];changed();
}

/* ---------- steps ---------- */
const STEP_ICON={start:'▶',add:'+',remove:'−',keep:'∩'};
function dragChip(el,si,id){el.dataset.drag='chip';el.dataset.step=si;el.dataset.id=id;el.prepend(h('span',{class:'grip','aria-hidden':'true'},ico('grip')));return el;}
function moveStep(i,d){const j=i+d;if(i<1||j<1||j>=C.steps.length)return;[C.steps[i],C.steps[j]]=[C.steps[j],C.steps[i]];C.pop=null;changed();}
function stepCard(st,si,stage,last){
 const lists=st.lists.map(byId).filter(Boolean),free=LIB.filter(l=>!st.lists.includes(l.id)),rtl=App.getLang()==='he';
 const chips=lists.map((l,i)=>dragChip(pillOf(l,[
  st.type==='add'&&lists.length>1&&h('button',{class:'mv',type:'button','aria-label':t('earlier'),onclick:()=>{if(i>0){[st.lists[i-1],st.lists[i]]=[st.lists[i],st.lists[i-1]];changed();}}},ico(rtl?'right':'left')),
  st.type==='add'&&lists.length>1&&h('button',{class:'mv',type:'button','aria-label':t('later'),onclick:()=>{if(i<lists.length-1){[st.lists[i+1],st.lists[i]]=[st.lists[i],st.lists[i+1]];changed();}}},ico(rtl?'left':'right')),
  st.type!=='start'&&h('button',{class:'rm',type:'button','aria-label':t('remove'),onclick:()=>{st.lists.splice(i,1);changed();}},ico('x'))]),si,l.id));
 const toggle=e=>{e.stopPropagation();C.pop=C.pop===si?null:si;App.render();};
 const btn=st.type==='start'?h('button',{class:'sm',type:'button',onclick:toggle},lists.length?t('changeList'):t('chooseList')):h('button',{class:'sm',type:'button',onclick:toggle},ico('plus'),t('addToStep'));
 const source=st.type==='start'?LIB:free;
 const pop=C.pop===si?h('div',{class:'pop',role:'menu',onclick:e=>e.stopPropagation()},source.length?source.map(l=>h('button',{type:'button',role:'menuitem',onclick:()=>{if(st.type==='start')st.lists=[l.id];else st.lists.push(l.id);C.pop=null;changed();}},h('span',{class:'dot',style:'width:10px;height:10px;border-radius:50%;background:'+colorOf(l)}),l.name,h('span',{class:'m',text:fmt(l.rows.length)}))):h('div',{class:'none',text:t('noMore')})):null;
 const dl=stage.empty?'':st.type==='start'?'= '+fmt(stage.total):st.type==='add'?'+'+fmt(stage.delta)+'  =  '+fmt(stage.total):'−'+fmt(-stage.delta)+'  =  '+fmt(stage.total);
 const help={add:'firstWins',remove:'removeHelp',keep:'keepHelp'}[st.type];
 return h('div',{class:'step'+(last?' last':''),'data-t':st.type,'data-step':si},
  h('div',st.type==='start'?{class:'node','aria-hidden':'true',text:STEP_ICON.start}:{class:'node grab','aria-hidden':'true',title:t('dragStep'),'data-drag':'step','data-step':si,text:STEP_ICON[st.type]}),
  h('div',{class:'sbody','data-drop':'into'},
   h('div',{class:'shead'},h('b',{text:t(st.type)}),h('span',{class:'delta '+(st.type==='add'?'add':st.type==='start'?'':st.type==='keep'?'keep':'rem'),text:dl}),
    st.type!=='start'&&h('span',{class:'smove'},
     h('button',{class:'ghost sm',type:'button',disabled:si<=1,'aria-label':t('moveUp'),title:t('moveUp'),onclick:()=>moveStep(si,-1)},ico('up')),
     h('button',{class:'ghost sm',type:'button',disabled:si>=C.steps.length-1,'aria-label':t('moveDown'),title:t('moveDown'),onclick:()=>moveStep(si,1)},ico('down')),
     h('button',{class:'ghost sm',type:'button','aria-label':t('removeStep'),title:t('removeStep'),onclick:()=>{C.steps.splice(si,1);C.pop=null;changed();}},ico('x')))),
   h('div',{class:'chips-row'},chips,btn),pop,
   stage.empty?h('p',{class:'hintline',style:'color:var(--warn)',text:t('emptyStep')}):(help&&h('p',{class:'hintline',text:t(help)}))));
}
function renderSteps(){
 const box=$('cSteps');box.replaceChildren();
 C.steps.forEach((st,i)=>box.append(stepCard(st,i,R.stages[i]||{},i===C.steps.length-1)));
 $('cAddstep').replaceChildren(...[['add','stepAdd'],['remove','stepRemove'],['keep','stepKeep']].map(([ty,k])=>h('button',{type:'button','data-drop':'newstep','data-ty':ty,onclick:e=>{e.stopPropagation();C.steps.push({type:ty,lists:[]});C.pop=C.steps.length-1;changed();},text:t(k)})));
 for(const b of document.querySelectorAll('#cModeSeg button'))b.setAttribute('aria-pressed',String(b.dataset.mode===C.mode));
 $('cModeHelp').textContent=t({phone:'cHelpPhone',id:'cHelpId',text:'cHelpText'}[C.mode]);
}
function renderFunnel(){
 const box=$('cFunnel');box.replaceChildren();const max=Math.max(1,...R.stages.map(s=>Math.max(s.total,s.total-s.delta)));
 R.stages.forEach((s,i)=>{
  const st=C.steps[i],ls=st.lists.map(byId).filter(Boolean);
  const label=st.type==='start'?t('start')+' '+(ls[0]?.name||'—'):t(st.type)+' '+(ls.map(l=>l.name).join(', ')||'—');
  const prev=s.total-s.delta;
  box.append(h('div',{class:'frow','data-t':st.type},h('span',{class:'lbl',title:label,text:label}),
   h('div',{class:'track'},h('div',{class:'fill cut',style:'width:'+(Math.max(prev,s.total)/max*100)+'%;'+(st.type==='add'||st.type==='start'?'display:none':'')}),h('div',{class:'fill',style:'width:'+(s.total/max*100)+'%'})),
   h('span',{class:'num',text:fmt(s.total)})));
  const per=Object.entries(s.counts).filter(([,n])=>n>0);
  if(per.length&&st.type!=='start')box.append(h('div',{class:'per'},per.map(([id,n])=>{const l=byId(id);return h('span',{class:'pill',style:'--c:'+(l?colorOf(l):'var(--mute)')},h('i'),h('b',{text:(l?l.name:t('noMatchRemoved'))+' '+(st.type==='add'?'+':'−')+fmt(n)}));})));
 });
 const sk=Object.entries(R.skipped).filter(([id])=>byId(id));
 if(sk.length)box.append(h('p',{class:'hintline',text:t('skipped',sk.map(([id,n])=>byId(id).name+' '+fmt(n)).join(', '))}));
}

/* ---------- result ---------- */
function fromCell(from){
 const ls=from.map(byId).filter(Boolean),wrap=h('div',{class:'from'});
 ls.slice(0,2).forEach(l=>wrap.append(h('span',{class:'pill',style:'--c:'+colorOf(l),title:l.name},h('i'),h('b',{text:l.name}))));
 if(ls.length>2)wrap.append(h('span',{class:'pill',title:ls.slice(2).map(l=>l.name).join(', ')},h('b',{text:'+'+(ls.length-2)})));
 return wrap;
}
const visIdx=()=>R.columns.map((c,i)=>i).filter(i=>!C.hidden.has(R.columns[i].id));
function renderResult(){
 const tabs=$('cTabs');
 tabs.replaceChildren(
  h('button',{role:'tab','aria-selected':String(C.tab==='result'),type:'button',onclick:()=>{C.tab='result';App.render();}},t('tabResult')+' ',h('b',{text:fmt(R.rows.length)})),
  h('button',{role:'tab','aria-selected':String(C.tab==='removed'),type:'button',onclick:()=>{C.tab='removed';App.render();}},t('tabRemoved')+' ',h('b',{text:fmt(R.removed.length)})));
 const vis=visIdx(),q=C.q.toLowerCase().trim(),isR=C.tab==='result',src=isR?R.rows:R.removed;
 const f=q?src.filter(r=>vis.some(i=>String(r.values[i]).toLowerCase().includes(q))):src;
 const tbl=$('cGrid');tbl.replaceChildren();
 tbl.append(h('thead',{},h('tr',{},h('th',{text:isR?t('from'):t('removedBy')}),vis.map(i=>h('th',{class:R.columns[i].key?'key':'',text:R.columns[i].label})))));
 const body=h('tbody');
 if(!f.length)body.append(h('tr',{},h('td',{class:'none',colspan:vis.length+1,text:C.steps.some(s=>s.lists.length)?t('noRows'):t('emptyResult')})));
 for(const r of f.slice(0,LIMIT)){
  const l=!isR&&r.by?byId(r.by):null;
  body.append(h('tr',{},h('td',{},isR?fromCell(r.from):(l?pillOf(l):h('span',{class:'hint',text:r.by===''?t('noMatchRemoved'):t('step')+' '+(r.step+1)}))),
   vis.map(i=>{const c=R.columns[i];return h('td',{class:c.key&&C.mode!=='text'?'k':'',dir:c.key&&C.mode!=='text'?'ltr':'auto',text:String(r.values[i]).trim()?r.values[i]:'—'});})));
 }
 tbl.append(body);
 $('cNote').textContent=f.length>LIMIT?t('noteResult',LIMIT,fmt(f.length)):(isR?t('noteAll'):t('noteRemoved'));
 for(const id of ['cXlsx','cCsv','cCopy','cSaveList'])$(id).disabled=!R.rows.length;
 $('cColBtn').textContent=t('columnsBtn',vis.length,R.columns.length);$('cColBtn').disabled=!R.columns.length;
}
function exportKind(kind){
 const vis=visIdx(),hs=vis.map(i=>R.columns[i].label);if(C.exportFrom)hs.push(t('fromLists'));
 const rows=R.rows.map(r=>{const v=vis.map(i=>r.values[i]);if(C.exportFrom)v.push(r.from.map(id=>byId(id)?.name||'').filter(Boolean).join(' + '));return v;});
 return App.exportData(kind,{hs,rows},'combined');
}
function saveResultDialog(){
 const name=h('input',{type:'text',id:'sr-name',value:t('defaultResult')});
 modal(t('mSaveListTitle'),h('div',{style:'display:flex;flex-direction:column;gap:10px'},field(t('mName'),name),h('p',{class:'hint',text:t('saveListHelp')})),async()=>{
  const v=name.value.trim();if(!v){name.focus();return false;}
  const vis=visIdx(),headers=vis.map(i=>R.columns[i].label),rows=R.rows.map(r=>vis.map(i=>r.values[i])),keyCols=E.detectKeyCols(headers,rows),ki=vis.findIndex(i=>R.columns[i].key);
  if(ki>=0)keyCols[C.mode]=ki;
  const l=await addList({name:v,headers,rows,keyCols});changed();toast(t('savedList',l.name));
 });
}
function saveRecipeDialog(){
 const name=h('input',{type:'text',id:'rec-name',value:''});
 modal(t('mSaveRecipeTitle'),h('div',{style:'display:flex;flex-direction:column;gap:10px'},field(t('mName'),name),h('p',{class:'hint',text:t('mRecipeHelp')})),async()=>{
  const v=name.value.trim();if(!v){name.focus();return false;}
  const r=await store.saveRecipe({id:store.newId('r'),name:v,mode:C.mode,hidden:[...C.hidden],steps:C.steps.map(s=>({type:s.type,lists:[...s.lists]}))});
  RECIPES.push(r);App.render();toast(t('savedRecipe',v));
 });
}

function openColumns(){
 const src=id=>{const l=byId(id);return l?{id,name:l.name,color:colorOf(l)}:null;};
 const items=R.columns.map(c=>({id:c.id,label:c.label,key:c.key,sources:c.lists.map(src).filter(Boolean)}));
 const used=[...new Set(items.flatMap(i=>i.sources.map(s=>s.id)))].map(src);
 App.pickColumns({items,visible:new Set(items.filter(i=>!C.hidden.has(i.id)).map(i=>i.id)),sources:used,
  groupOf:i=>i.key?{k:'0',label:t('colsKey')}:i.sources.length>1?{k:'9',label:t('colsSeveral')}:{k:'1'+(i.sources[0]?i.sources[0].name:''),label:t('colsOnlyList',i.sources[0]?i.sources[0].name:'—')},
  onApply:vis=>{C.hidden=new Set(items.filter(i=>!vis.has(i.id)).map(i=>i.id));changed();}});
}

/* ---------- render ---------- */
function renderCombine(){
 if(App.getView()!=='combine'||!store)return;
 const has=LIB.length>0;
 $('cOnboard').hidden=has;$('cBuilder').hidden=!has;
 renderLib();renderData();
 if(has){renderSteps();renderFunnel();renderResult();}
}
App.onRender(renderCombine);

/* ---------- wiring ---------- */
$('addListBtn').onclick=()=>addDialog();
$('cAddFirst').onclick=()=>addDialog();
$('cSamples').onclick=addSamples;
$('cSaveList').onclick=saveResultDialog;
$('cColBtn').onclick=openColumns;
$('cSaveRecipe').onclick=saveRecipeDialog;
$('cXlsx').onclick=()=>exportKind('xlsx');$('cCsv').onclick=()=>exportKind('csv');$('cCopy').onclick=()=>exportKind('copy');
$('cFrom').onchange=e=>{C.exportFrom=e.target.checked;};
$('cSearch').oninput=e=>{C.q=e.target.value;if(R.rows)renderResult();};
for(const b of document.querySelectorAll('#cModeSeg button'))b.onclick=()=>{C.mode=b.dataset.mode;changed();};
document.addEventListener('click',()=>{if(C.pop!==null){C.pop=null;App.render();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&C.pop!==null&&App.$('modal').hidden){C.pop=null;App.render();}});

/* Dropping a file: on a saved list updates that list, elsewhere on the Saved lists panel adds a new list, and inside an open add/update dialog loads it there. */
{const hasFiles=e=>!!e.dataTransfer&&[...e.dataTransfer.types].includes('Files'),inView=()=>App.getView()==='combine',lib=()=>$('libCard');
 const clear=()=>{lib().classList.remove('drop-hot');for(const c of document.querySelectorAll('.lcard.drop-hot'))c.classList.remove('drop-hot');};
 const cardAt=e=>e.target.closest&&e.target.closest('.lcard');
 document.addEventListener('dragover',e=>{
  if(!inView()||!hasFiles(e))return;
  e.preventDefault();
  if(!$('modal').hidden)return;
  clear();const c=cardAt(e);if(c)c.classList.add('drop-hot');else if(e.target.closest('#libCard'))lib().classList.add('drop-hot');
 });
 document.addEventListener('dragleave',e=>{if(!e.relatedTarget)clear();});
 document.addEventListener('drop',e=>{
  if(!inView()||!hasFiles(e))return;
  if(!$('modal').hidden){if(!e.target.closest('.sheet'))e.preventDefault();return;}   /* the open dialog handles its own drops */
  e.preventDefault();e.stopPropagation();
  const f=e.dataTransfer.files[0],c=cardAt(e);clear();
  if(!f)return;
  if(c){const l=byId(c.dataset.id);if(l)updateDialog(l,f);}
  else if(e.target.closest('#libCard'))addDialog(f);
 },true);}

/* ---------- drag and drop (pointer based, so mouse, touch and pen all work) ---------- */
const DND={pending:null,drag:null,timer:null};
const payloadOf=el=>{const k=el.dataset.drag;return k==='list'?{kind:'list',id:el.dataset.id}:k==='chip'?{kind:'chip',id:el.dataset.id,step:+el.dataset.step}:k==='step'?{kind:'step',step:+el.dataset.step}:null;};
document.addEventListener('pointerdown',e=>{
 if(App.getView()!=='combine'||(e.pointerType==='mouse'&&e.button!==0))return;
 const el=e.target.closest('[data-drag]');if(!el)return;
 const onGrip=!!e.target.closest('.grip');
 if(e.target.closest('button,select,input,textarea,a')&&!onGrip)return;
 if(e.pointerType!=='mouse'&&!onGrip&&el.dataset.drag!=='step')return;   /* touch and pen drag from the grip so the page can still scroll */
 DND.pending={el,payload:payloadOf(el),x:e.clientX,y:e.clientY};
});
document.addEventListener('pointermove',e=>{
 const p=DND.pending;
 if(p&&!DND.drag){if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<6)return;beginDrag(p,e);}
 if(DND.drag){e.preventDefault();DND.last=e;moveDrag(e);}
},{passive:false});
document.addEventListener('pointerup',()=>{if(DND.drag)endDrag(true);DND.pending=null;});
document.addEventListener('pointercancel',()=>{if(DND.drag)endDrag(false);DND.pending=null;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&DND.drag){e.stopPropagation();endDrag(false);}},true);
document.addEventListener('click',e=>{if(DND.swallow){e.stopPropagation();e.preventDefault();DND.swallow=false;}},true);

function beginDrag(p,e){
 document.querySelectorAll('.pop').forEach(n=>n.remove());C.pop=null;
 const src=p.el.dataset.drag==='step'?p.el.closest('.step'):p.el,r=src.getBoundingClientRect();
 const ghost=src.cloneNode(true);ghost.classList.add('dgh');if(p.payload.kind==='step')ghost.classList.add('gstep');
 ghost.removeAttribute('data-drag');ghost.querySelectorAll('[data-drag]').forEach(n=>n.removeAttribute('data-drag'));
 ghost.style.width=Math.min(r.width,p.payload.kind==='step'?r.width:340)+'px';document.body.append(ghost);
 DND.drag={...p,src,ghost,dx:Math.min(p.x-r.left,60),dy:Math.min(p.y-r.top,24),target:null};
 src.classList.add('dragging');document.body.classList.add('is-dragging','drag-'+p.payload.kind);
 DND.last=e;DND.timer=setInterval(()=>{if(DND.last)moveDrag(DND.last);},40);
}
function clearMarks(){for(const n of document.querySelectorAll('.drop-hot,.drop-before,.drop-after,.ins-before'))n.classList.remove('drop-hot','drop-before','drop-after','ins-before');}
function resolveTarget(e){
 const pl=DND.drag.payload,under=document.elementFromPoint(e.clientX,e.clientY);if(!under)return null;
 if(under.closest('#libCard')&&pl.kind!=='list')return {type:'remove',el:$('libCard')};
 if(pl.kind==='step'){
  const box=$('cSteps').getBoundingClientRect();
  if(e.clientY<box.top-30||e.clientY>box.bottom+30||e.clientX<box.left-30||e.clientX>box.right+30)return null;
  const steps=[...$('cSteps').children];let idx=steps.length;
  for(let i=1;i<steps.length;i++){const r=steps[i].getBoundingClientRect();if(e.clientY<r.top+r.height/2){idx=i;break;}}
  return {type:'reorder',idx,el:steps[Math.min(idx,steps.length-1)],after:idx>=steps.length};
 }
 const nb=under.closest('#cAddstep [data-drop=newstep]');if(nb)return {type:'newstep',ty:nb.dataset.ty,el:nb};
 const body=under.closest('#cSteps .sbody');
 if(body){
  const si=+body.closest('.step').dataset.step,st=C.steps[si];
  const chips=[...body.querySelectorAll('.chips-row>.pill:not(.dragging)')];let at=chips.length;
  if(st.type==='add')for(let i=0;i<chips.length;i++){const r=chips[i].getBoundingClientRect(),cx=r.left+r.width/2,rtl=App.getLang()==='he';if(e.clientY<r.top||(e.clientY<=r.bottom&&(rtl?e.clientX>cx:e.clientX<cx))){at=i;break;}}
  return {type:'into',step:si,at,el:body,marker:st.type==='add'?(chips[at]||body.querySelector('.chips-row>button.sm')):null};
 }
 return null;
}
function moveDrag(e){
 const d=DND.drag;if(!d)return;
 d.ghost.style.left=(e.clientX-d.dx)+'px';d.ghost.style.top=(e.clientY-d.dy)+'px';
 const m=70;if(e.clientY<m)window.scrollBy(0,-Math.ceil((m-e.clientY)/4));else if(innerHeight-e.clientY<m)window.scrollBy(0,Math.ceil((m-(innerHeight-e.clientY))/4));
 const tg=resolveTarget(e);d.target=tg;clearMarks();
 if(!tg)return;
 if(tg.type==='reorder')tg.el.classList.add(tg.after?'drop-after':'drop-before');
 else{tg.el.classList.add('drop-hot');if(tg.marker)tg.marker.classList.add('ins-before');}
}
function endDrag(commit){
 const d=DND.drag;clearInterval(DND.timer);DND.drag=null;DND.last=null;
 d.ghost.remove();d.src.classList.remove('dragging');document.body.classList.remove('is-dragging','drag-list','drag-chip','drag-step');clearMarks();
 DND.swallow=true;setTimeout(()=>{DND.swallow=false;},0);
 if(commit&&d.target)applyDrop(d.payload,d.target);
}
function applyDrop(pl,tg){
 const before=JSON.stringify(C.steps),nameOf=id=>byId(id)?.name||'';let msg='';
 const detach=()=>{if(pl.kind==='chip'){const o=C.steps[pl.step];if(o)o.lists=o.lists.filter(x=>x!==pl.id);}};
 if(tg.type==='remove'){
  if(pl.kind==='chip'){detach();msg=t('chipRemoved',nameOf(pl.id));}
  else if(pl.kind==='step'){C.steps.splice(pl.step,1);msg=t('stepRemoved');}
 }else if(tg.type==='newstep'){detach();C.steps.push({type:tg.ty,lists:[pl.id]});msg=t('stepAdded');}
 else if(tg.type==='reorder'){const [st]=C.steps.splice(pl.step,1);let idx=tg.idx;if(pl.step<idx)idx--;C.steps.splice(Math.max(1,idx),0,st);msg=t('stepMoved');}
 else if(tg.type==='into'){
  const st=C.steps[tg.step],same=pl.kind==='chip'&&pl.step===tg.step;
  if(!same&&st.lists.includes(pl.id)){toast(t('already',nameOf(pl.id)));return;}
  if(st.type==='start'){detach();st.lists=[pl.id];}
  else{if(same)st.lists=st.lists.filter(x=>x!==pl.id);else detach();st.lists.splice(Math.min(tg.at,st.lists.length),0,pl.id);}
  msg=same?t('chipReordered'):t('chipMoved',nameOf(pl.id),t(st.type));
 }
 C.pop=null;changed();
 toast(msg,{label:t('undo'),run:()=>{C.steps=JSON.parse(before);changed();}});
}

/* ---------- library API for the compare view ---------- */
window.Lib={
 count:()=>LIB.length,
 pick(cb){
  if(!LIB.length){toast(t('noSaved'));return;}
  const m=modal(t('pickTitle'),h('div',{class:'lib'},LIB.map(l=>h('button',{type:'button',class:'pickrow',style:'--c:'+colorOf(l),onclick:()=>{App.closeModal();cb(l);}},h('span',{class:'dot'}),h('b',{text:l.name}),h('span',{class:'m',text:t('rows',l.rows.length)})))),null,null);
 },
 saveFrom({name,headers,rows,key,mode,template,date}){
  const nameIn=h('input',{type:'text',id:'sv-name',value:name});
  modal(t('saveToLibrary'),h('div',{style:'display:flex;flex-direction:column;gap:10px'},field(t('mName'),nameIn),h('p',{class:'hint',text:t('saveToLibraryHelp')})),async()=>{
   const v=nameIn.value.trim();if(!v){nameIn.focus();return false;}
   const keyCols=E.detectKeyCols(headers,rows);if(key!=null)keyCols[mode]=key;
   const l=await addList({name:v,headers:[...headers],rows:rows.map(r=>[...r]),keyCols,template,date});changed();
   toast(t('savedList',l.name),{label:t('openCombine'),run:()=>App.setView('combine')});
  });
 }
};

/* ---------- start ---------- */
(async()=>{
 store=await Store.open();
 LIB=await store.lists();RECIPES=await store.recipes();
 loadDraft();recompute();App.render();
})();
})();
