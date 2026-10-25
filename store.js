/* Saved lists and recipes, kept in this browser (IndexedDB). Nothing is sent anywhere. If the browser blocks IndexedDB the store falls back to memory and reports persistent:false so the interface can warn that nothing will survive a reload. */
(function(root){
'use strict';
const FORMAT='table-tool-library',VERSION=1;

function memoryBackend(){
 const data={lists:new Map(),recipes:new Map()};
 return {persistent:false,
  async init(){},
  async all(kind){return [...data[kind].values()];},
  async put(kind,v){data[kind].set(v.id,v);},
  async del(kind,id){data[kind].delete(id);},
  async clear(){data.lists.clear();data.recipes.clear();}};
}
function idbBackend(){
 let db;
 const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
 const done=t=>new Promise((res,rej)=>{t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});
 return {persistent:true,
  init(){return new Promise((resolve,reject)=>{const r=indexedDB.open('table-tool',1);r.onupgradeneeded=()=>{r.result.createObjectStore('lists',{keyPath:'id'});r.result.createObjectStore('recipes',{keyPath:'id'});};r.onsuccess=()=>{db=r.result;resolve();};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));});},
  all(kind){return req(db.transaction(kind).objectStore(kind).getAll());},
  async put(kind,v){const t=db.transaction(kind,'readwrite');t.objectStore(kind).put(v);await done(t);},
  async del(kind,id){const t=db.transaction(kind,'readwrite');t.objectStore(kind).delete(id);await done(t);},
  async clear(){const t=db.transaction(['lists','recipes'],'readwrite');t.objectStore('lists').clear();t.objectStore('recipes').clear();await done(t);}
 };
}

const isStr=v=>typeof v==='string';
function cleanList(v){
 if(!v||!isStr(v.id)||!isStr(v.name)||!Array.isArray(v.headers)||!Array.isArray(v.rows))return null;
 const headers=v.headers.map(x=>String(x??'')),rows=[];
 for(const r of v.rows){if(!Array.isArray(r))return null;rows.push(r.map(x=>String(x??'')));}
 const kc=v.keyCols&&typeof v.keyCols==='object'?v.keyCols:{},col=x=>Number.isInteger(x)&&x>=0&&x<headers.length?x:null;
 const now=Date.now();
 return {id:v.id,name:v.name.slice(0,120)||'List',color:Number.isInteger(v.color)?v.color%6:0,headers,rows,keyCols:{phone:col(kc.phone),id:col(kc.id),text:col(kc.text)},created:Number(v.created)||now,updated:Number(v.updated)||now};
}
function cleanRecipe(v){
 if(!v||!isStr(v.id)||!isStr(v.name)||!Array.isArray(v.steps))return null;
 const types=['start','add','remove','keep'],steps=[];
 for(const s of v.steps){if(!s||!types.includes(s.type)||!Array.isArray(s.lists))return null;steps.push({type:s.type,lists:s.lists.filter(isStr)});}
 return {id:v.id,name:v.name.slice(0,120)||'Recipe',mode:['phone','id','text'].includes(v.mode)?v.mode:'phone',steps,updated:Number(v.updated)||Date.now()};
}
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

function createStore(b){
 return {
  persistent:b.persistent,
  newId,
  async lists(){return (await b.all('lists')).map(cleanList).filter(Boolean).sort((x,y)=>x.created-y.created);},
  async recipes(){return (await b.all('recipes')).map(cleanRecipe).filter(Boolean).sort((x,y)=>x.updated-y.updated);},
  async saveList(l,opts){const v=cleanList({...l,updated:opts&&opts.keepUpdated?l.updated:Date.now()});if(!v)throw new Error('invalid list');await b.put('lists',v);return v;},
  async deleteList(id){await b.del('lists',id);},
  async saveRecipe(r){const v=cleanRecipe({...r,updated:Date.now()});if(!v)throw new Error('invalid recipe');await b.put('recipes',v);return v;},
  async deleteRecipe(id){await b.del('recipes',id);},
  async exportAll(){return {app:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),lists:await this.lists(),recipes:await this.recipes()};},
  /* Merge a backup: a list or recipe already here is replaced only if the backup copy is newer. Returns counts. */
  async importAll(data){
   if(!data||data.app!==FORMAT||!Array.isArray(data.lists)||!Array.isArray(data.recipes||[]))throw new Error('notBackup');
   const have=new Map((await b.all('lists')).map(x=>[x.id,x])),haveR=new Map((await b.all('recipes')).map(x=>[x.id,x]));
   let lists=0,recipes=0,skipped=0;
   for(const raw of data.lists){const v=cleanList(raw);if(!v){skipped++;continue;}const cur=have.get(v.id);if(cur&&cur.updated>=v.updated){skipped++;continue;}await b.put('lists',v);lists++;}
   for(const raw of data.recipes||[]){const v=cleanRecipe(raw);if(!v){skipped++;continue;}const cur=haveR.get(v.id);if(cur&&cur.updated>=v.updated){skipped++;continue;}await b.put('recipes',v);recipes++;}
   return {lists,recipes,skipped};
  },
  async clearAll(){await b.clear();}
 };
}
async function open(){
 try{if(typeof indexedDB==='undefined')throw new Error('no indexedDB');const b=idbBackend();await b.init();return createStore(b);}
 catch(e){return createStore(memoryBackend());}
}
const api={open,createStore,memoryBackend,cleanList,cleanRecipe,newId};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Store=api;
})(typeof window!=='undefined'?window:globalThis);
