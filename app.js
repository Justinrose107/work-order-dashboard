const $=id=>document.getElementById(id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workbook=null,parsed={rows:[],headers:[]},now=Date.now(),page=1,view='tracked',filtered=[],demoMode=false,restoring=false,persistTimer=null;
const pageSize=30;
const views={tracked:'Pending closure',overdue:'Over 72 hours',missing:'Missing completion time',grace:'Within 72 hours',invalid:'Needs review',closed:'Closed / Canceled',all:'All records'};
const filterIds=['search','region','sub','country','status','owner','type','priority','warranty'];
let dbPromise=null;
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(resolve=>{
    if(!('indexedDB' in window)){resolve(null);return;}
    try{
      const req=indexedDB.open('work-order-dashboard-local',1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('state'))req.result.createObjectStore('state');};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
    }catch{resolve(null);}
  });
  return dbPromise;
}
function dbGet(key){return openDb().then(db=>new Promise(resolve=>{if(!db){resolve(null);return;}try{const req=db.transaction('state','readonly').objectStore('state').get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>resolve(null);}catch{resolve(null);}}));}
function dbPut(key,value){return openDb().then(db=>new Promise(resolve=>{if(!db){resolve(false);return;}try{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch{resolve(false);}}));}
function dbDelete(key){return openDb().then(db=>new Promise(resolve=>{if(!db){resolve(false);return;}try{const tx=db.transaction('state','readwrite');tx.objectStore('state').delete(key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch{resolve(false);}}));}
function currentPrefs(){return {sheet:$('sheet').value,timezone:$('timezone').value,view,sort:$('sort').value,filters:Object.fromEntries(filterIds.map(id=>[id,$(id).value]))};}
function schedulePersist(){if(restoring)return;clearTimeout(persistTimer);persistTimer=setTimeout(()=>dbPut('prefs',currentPrefs()),180);}
function setFileMeta(saved=false){$('filemeta').textContent=(demoMode?'Demo data · ':'')+num(parsed.rows.length)+' rows · '+parsed.headers.length+' columns · '+(saved?'Saved locally in this browser':'Local processing');}
function applyPrefs(prefs){
  if(!prefs)return;
  restoring=true;
  if(prefs.timezone)$('timezone').value=String(prefs.timezone);
  if(prefs.view&&views[prefs.view])view=prefs.view;
  if(prefs.sort&&[...$('sort').options].some(o=>o.value===prefs.sort))$('sort').value=prefs.sort;
  const savedFilters=prefs.filters||{};
  if(typeof savedFilters.search==='string')$('search').value=savedFilters.search;
  if(typeof savedFilters.region==='string')$('region').value=savedFilters.region;
  updateSub();
  filterIds.filter(id=>!['search','region','sub'].includes(id)).forEach(id=>{if(typeof savedFilters[id]==='string'&&[...$(id).options].some(o=>o.value===savedFilters[id]))$(id).value=savedFilters[id];});
  if(typeof savedFilters.sub==='string'&&[...$('sub').options].some(o=>o.value===savedFilters.sub))$('sub').value=savedFilters.sub;
  restoring=false;page=1;render();
}
const fmt=(t)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(t);
const num=n=>n.toLocaleString('en-GB');
const matches=(r,v)=>v==='all'||(v==='tracked'?['overdue','missing'].includes(r.kind):r.kind===v);
function options(id,values,label,preserve=true){const current=preserve?$(id).value:'';$(id).innerHTML='<option value="">'+label+'</option>'+values.map(v=>'<option value="'+escapeHTML(v)+'">'+escapeHTML(v)+'</option>').join('');if(values.includes(current))$(id).value=current;}
function baseRows(skipRegion=false){const q=$('search').value.trim().toLowerCase();return parsed.rows.filter(r=>(skipRegion||(!$('region').value||r.region===$('region').value)&&(!$('sub').value||r.sub===$('sub').value))&&['country','status','owner','type','priority','warranty'].every(k=>!$(k).value||r[k]===$(k).value)&&(!q||Object.keys(WO.columns([])).some(k=>String(r[k]??'').toLowerCase().includes(q))));}
function updateSub(){const b=$('region').value;options('sub',[...new Set(parsed.rows.filter(r=>!b||r.region===b).map(r=>r.sub))].sort(),'All subregions');}
function reset(){['search','region','sub','country','status','owner','type','priority','warranty'].forEach(k=>$(k).value='');$('sort').value='oldest';view='tracked';page=1;updateSub();render();}
function render(){
  now=Date.now();$('asof').textContent=fmt(now)+' UTC+8';parsed.rows.forEach(r=>{r.kind=WO.classify(r,now);r.hours=Number.isFinite(r.completeMs)&&r.completeMs!==null?(now-r.completeMs)/3600000:null;});
  const base=baseRows();const count=v=>base.filter(r=>matches(r,v)).length;
  $('metrics').innerHTML=[['Pending closure',count('tracked'),'Over 72 hours + Missing completion time','primary'],['Over 72 hours',count('overdue'),'Service completed; awaiting closure',''],['Missing completion time',count('missing'),'Follow up on service or update the timestamp',''],['Within 72 hours',count('grace'),'Within the grace period; excluded from pending','']].map(([label,n,hint,cls])=>'<div class="metric '+cls+'"><div class="label">'+label+'</div><div class="num">'+(parsed.rows.length?num(n):'—')+'</div><div class="hint">'+hint+'</div></div>').join('');
  const regional=baseRows(true).filter(r=>matches(r,'tracked'));const regions=[...Object.keys(WO.REGIONS),...(parsed.rows.some(r=>r.region==='Unmatched')?['Unmatched']:[])];const max=Math.max(1,...regions.map(k=>regional.filter(r=>r.region===k).length));
  $('regions').innerHTML=regions.map(k=>{const rs=regional.filter(r=>r.region===k),over=rs.filter(r=>r.kind==='overdue').length;return '<button class="region-card '+($('region').value===k?'active':'')+'" data-region="'+k+'"><span class="region-name">'+k+'</span><b>'+ (parsed.rows.length?num(rs.length):'—')+'</b><small>Pending closure</small><div class="bar"><i style="width:'+rs.length/max*100+'%"></i></div><small>Over 72h <strong>'+over+'</strong></small></button>';}).join('');
  $('tabs').innerHTML=Object.entries(views).map(([key,label])=>'<button class="tab '+(view===key?'active':'')+'" aria-pressed="'+(view===key)+'" data-view="'+key+'">'+label+'<span>'+num(count(key))+'</span></button>').join('');
  filtered=base.filter(r=>matches(r,view)).sort((a,b)=>{if($('sort').value==='id')return a.id.localeCompare(b.id);const at=Number.isFinite(a.completeMs)&&a.completeMs!==null?a.completeMs:null,bt=Number.isFinite(b.completeMs)&&b.completeMs!==null?b.completeMs:null;if(at===null)return bt===null?a.row-b.row:1;if(bt===null)return -1;return $('sort').value==='oldest'?at-bt:bt-at;});
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);
  $('resultcount').textContent=parsed.rows.length?views[view]+' · '+num(filtered.length)+' rows'+(demoMode?' · Demo data':''):'Import a work order file to begin';
  $('tbody').innerHTML=filtered.length?filtered.slice((page-1)*pageSize,page*pageSize).map(r=>'<tr><td><button class="id-link" data-row="'+r.row+'">'+escapeHTML(r.id||'Missing order number · Row '+r.row)+'</button><small title="'+escapeHTML(r.account)+'">'+escapeHTML(r.account||'—')+'</small></td><td>'+escapeHTML(r.region)+'<small>'+escapeHTML(r.sub)+'</small></td><td>'+escapeHTML(r.country||'—')+'</td><td><span class="badge">'+escapeHTML(r.status||'Not provided')+'</span></td><td>'+escapeHTML(r.complete||'Not provided')+'</td><td class="'+(r.kind==='overdue'?'age':'missing')+'">'+age(r)+'</td><td>'+escapeHTML(r.owner||'—')+'</td><td>'+escapeHTML(r.priority||'—')+'</td><td>'+escapeHTML(r.created||'—')+'</td></tr>').join(''):'<tr><td colspan="9" class="empty">'+(parsed.rows.length?'No work orders match your filters.<br>Try another category or reset filters.':'Import a work order spreadsheet to start tracking.<br>Data is processed only in this browser.')+'</td></tr>';
  $('pageinfo').textContent='Page '+page+' / '+pages+' · Rows per page: '+pageSize+' rows';$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('export').disabled=!filtered.length;
}
function age(r){if(r.kind==='closed')return 'Excluded';if(r.kind==='invalid')return 'Needs review';if(r.hours===null)return 'Missing completion time';return Math.floor(r.hours/24)+'d '+Math.floor(r.hours%24)+'h';}
function adopt(result){parsed=result;const msgs=[];if(result.duplicate)msgs.push(result.duplicate+' duplicate work order numbers retained. Please review; counts are per row.');if(result.blankId)msgs.push(result.blankId+' rows have no work order number.');const issues=parsed.rows.filter(r=>r.regionIssue).length;if(issues)msgs.push(issues+' rows have missing or inconsistent region data (subregion mapping takes precedence).');const invalid=parsed.rows.filter(r=>WO.classify(r,Date.now())==='invalid').length;if(invalid)msgs.push(invalid+' rows have invalid timestamps or missing statuses and are listed under Needs review.');$('message').textContent=msgs.join('; ');options('region',[...Object.keys(WO.REGIONS),...(parsed.rows.some(r=>r.region==='Unmatched')?['Unmatched']:[])],'All regions',false);['country','status','owner','type','priority','warranty'].forEach(k=>options(k,[...new Set(parsed.rows.map(r=>r[k]).filter(Boolean))].sort(),'All',false));reset();setFileMeta();}
function parseSheet(prefs=null){if(!workbook)return;try{const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value],{header:1,defval:'',raw:true});adopt(WO.parse(matrix,{offset:Number($('timezone').value),date1904:!!workbook.Workbook?.WBProps?.date1904}));if(prefs)applyPrefs(prefs);else{render();schedulePersist();}}catch(e){parsed={rows:[],headers:[]};reset();$('message').textContent=e.message;$('filemeta').textContent='This sheet cannot generate a dashboard. Select another sheet or import a different file.';}}
async function importFile(file){if(!file)return;if(!/\.(xlsx|xls|csv)$/i.test(file.name)){$('message').textContent='Please select an .xlsx, .xls or .csv file.';return;}if(file.size>40*1024*1024){$('message').textContent='This file exceeds 40 MB. Export a smaller dataset and try again.';return;}$('message').textContent='Reading spreadsheet…';try{if(typeof XLSX==='undefined')throw Error('The Excel parser could not load. Check that the parser file is available.');const buffer=await file.arrayBuffer();const next=XLSX.read(buffer,{type:'array',nodim:true});const names=next.SheetNames.filter((n,i)=>!next.Workbook?.Sheets?.[i]?.Hidden);if(!names.length)throw Error('No readable, visible worksheets were found.');workbook=next;demoMode=false;$('filename').textContent=file.name;options('sheet',names,'Select worksheet',false);$('sheet').value=names.find(n=>{try{WO.parse(XLSX.utils.sheet_to_json(next.Sheets[n],{header:1,defval:''}));return true;}catch{return false;}})||names[0];$('sheet').disabled=false;parseSheet();const saved=await dbPut('source',{name:file.name,size:file.size,buffer,savedAt:Date.now()});setFileMeta(saved);if(saved)$('message').textContent=$('message').textContent?$('message').textContent+' Saved locally in this browser.':'Saved locally in this browser.';schedulePersist();}catch(e){$('message').textContent='Import failed: '+e.message;}finally{$('file').value='';}}
async function restoreSaved(){
  const saved=await dbGet('source');
  if(!saved||!saved.buffer){render();return;}
  try{
    const next=XLSX.read(saved.buffer,{type:'array',nodim:true});
    const names=next.SheetNames.filter((n,i)=>!next.Workbook?.Sheets?.[i]?.Hidden);
    if(!names.length)throw Error('No readable, visible worksheets were found.');
    workbook=next;demoMode=false;$('filename').textContent=saved.name||'Saved workbook';
    options('sheet',names,'Select worksheet',false);$('sheet').disabled=false;
    const prefs=await dbGet('prefs');
    if(prefs?.timezone)$('timezone').value=String(prefs.timezone);
    $('sheet').value=prefs?.sheet&&names.includes(prefs.sheet)?prefs.sheet:names[0];
    parseSheet(prefs||null);setFileMeta(true);
  }catch(e){parsed={rows:[],headers:[]};render();$('message').textContent='Could not restore saved workbook: '+e.message;}
}
async function clearSaved(){
  await Promise.all([dbDelete('source'),dbDelete('prefs')]);
  workbook=null;demoMode=false;parsed={rows:[],headers:[]};
  $('sheet').disabled=true;$('sheet').innerHTML='<option>Awaiting import</option>';$('filename').textContent='Drop your work order file here, or select Import Excel';
  $('filemeta').textContent='Supports .xlsx / .xls / .csv · Dashboard generated on import';
  $('message').textContent='Saved spreadsheet and filters cleared from this browser.';reset();
}
$('file').addEventListener('change',e=>importFile(e.target.files[0]));
['dragenter','dragover'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.remove('drag');}));$('dropzone').addEventListener('drop',e=>importFile(e.dataTransfer.files[0]));
$('sheet').onchange=()=>{parseSheet();schedulePersist();};$('timezone').onchange=()=>{if(demoMode)loadDemo();else parseSheet();schedulePersist();};$('refresh').onclick=render;$('reset').onclick=()=>{reset();schedulePersist();};$('clear-saved').onclick=clearSaved;
['region','sub','country','status','owner','type','priority','warranty','sort'].forEach(k=>$(k).onchange=()=>{if(k==='region'){ $('sub').value='';updateSub();}page=1;render();schedulePersist();});$('search').oninput=()=>{page=1;render();schedulePersist();};
$('regions').onclick=e=>{const b=e.target.closest('[data-region]');if(!b)return;$('region').value=$('region').value===b.dataset.region?'':b.dataset.region;$('sub').value='';updateSub();page=1;render();schedulePersist();};
$('tabs').onclick=e=>{const b=e.target.closest('[data-view]');if(b){view=b.dataset.view;page=1;render();schedulePersist();}};
$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
$('tbody').onclick=e=>{const b=e.target.closest('[data-row]');if(!b)return;const r=parsed.rows.find(r=>r.row===Number(b.dataset.row));$('detail-content').innerHTML='<dl><dt>Category</dt><dd>'+views[r.kind]+'</dd><dt>Mapped region / Subregion</dt><dd>'+escapeHTML(r.region+' / '+r.sub)+'</dd>'+parsed.headers.map((h,i)=>'<dt>'+escapeHTML(h)+'</dt><dd>'+escapeHTML(r.raw[i]||'—')+'</dd>').join('')+'</dl>';$('detail').showModal();};$('close-detail').onclick=()=>$('detail').close();
$('export').onclick=()=>{const headers=['Work order number','Region','Subregion','Country','Account','Work order status','Service Complete Time','Category','Owner','Priority','Source row','As of (UTC+8)','Created On'];const matrix=[headers,...filtered.map(r=>[r.id,r.region,r.sub,r.country,r.account,r.status,r.complete,views[r.kind],r.owner,r.priority,r.row,fmt(now),r.created])];const out=XLSX.utils.book_new();XLSX.utils.book_append_sheet(out,XLSX.utils.aoa_to_sheet(matrix),'Filtered results');XLSX.writeFile(out,'Work_order_tracker_'+views[view].replaceAll('/','-')+'_'+new Date().toISOString().slice(0,10)+'.xlsx');};
function loadDemo(){demoMode=true;workbook=null;$('sheet').innerHTML='<option>Demo data</option>';$('sheet').disabled=true;$('filename').textContent='Demo data · No real work orders';const headers=['Work Order Number','Service Sales Region','Service Region','Work Order Status','Service Complete Time','Country','Owner','Account Name','Priority','Work Order Type','Created On'];const matrix=[headers];const local=(t)=>new Date(t+Number($('timezone').value)*3600000).toISOString().slice(0,19).replace('T',' ');Object.entries(WO.REGIONS).forEach(([b,subs],bi)=>{for(let i=0;i<14+bi*3;i++){matrix.push(['DEMO-'+b+'-'+String(i+1).padStart(3,'0'),b,subs[i%subs.length],i===0?'Closed':'In Progress',i%4===0?'':local(Date.now()-(i%5===0?30:100+i*19)*3600000),['Example country A','Example country B'][i%2],'Owner '+(i%4+1),'Example account '+(i+1),i%3?'Generally':'Urgent','Repair',local(Date.now()-(i+40)*86400000)]);}});adopt(WO.parse(matrix,{offset:Number($('timezone').value)}));}
$('demo').onclick=loadDemo;$('method').innerHTML='<div class="mapping">'+Object.entries(WO.REGIONS).map(([k,v])=>'<span><strong>'+k+'</strong> · '+v.join(' / ')+'</span>').join('')+'</div><p>Korea → KOR; RCIS subregion → CIS. Subregion mappings take precedence. When a subregion is unknown, a valid source region is retained; unmatched regions are listed separately.</p>';
['region','sub','country','status','owner','type','priority','warranty'].forEach(k=>options(k,[],'All'));render();restoreSaved();setInterval(render,60000);
