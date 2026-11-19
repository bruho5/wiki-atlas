import {tr,batchLabel} from './ui.mjs';
import {PAGE_SIZE,sample,titleKey,key,article,pageBatch,searchWiki,infoWiki,linksWiki,bodyWiki,imageCredits} from './wiki.mjs';
const $=id=>document.getElementById(id), map=$('map'), nodesLayer=$('nodes'), lines=$('lines');
const catalogue=new Map(), visitedLit=new Set(), aliases=new Map(); let active=null, network='connecting', root=null, detailMode='read', renderTicket=0, searchTicket=0;
let ui='en';try{ui=localStorage.getItem('wiki-atlas-ui-v2')==='zh'?'zh':'en'}catch{}
const T=k=>tr(ui,k);
function applyLanguage(){
  document.documentElement.lang=ui==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-ui]').forEach(e=>e.textContent=T(e.dataset.ui));
  const controls={'ui-language':'ui-language',language:'wiki-language',map:'map-label','map-history':'map-history',minus:'minus',plus:'plus',recenter:'recenter'};
  for(const [id,k] of Object.entries(controls))$(id).setAttribute('aria-label',T(k));
  for(const id of ['ui-language','language']){const el=$(id);el.title=T(controls[id]);for(const opt of el.options) opt.textContent=(id==='language'?(ui==='en'?'Wiki: ':'维基：'):(ui==='en'?'UI: ':'界面：'))+(opt.value==='en'?'EN':'中文');}
  $('query').placeholder=T('search-placeholder');$('ui-language').value=ui;
  renderMapStatus();renderDetail();renderSaved();updateTrailButtons();render()
}
$('ui-language').addEventListener('change',e=>{
  ui=e.target.value;try{localStorage.setItem('wiki-atlas-ui-v2',ui)}catch{}
  $('results').hidden=true;searchTicket++;applyLanguage()
});
const trail=[];let trailCursor=-1;
let cam={x:0,y:0,z:innerWidth<781?.67:1}, pan=null, pointers=new Map(), pinch=null, lastGrowth=0, queued=false;
let saved=[];try{saved=JSON.parse(localStorage.getItem('wiki-atlas-list-v1')||'[]').filter(v=>v&&['en','zh'].includes(v.lang)&&typeof v.title==='string')}catch{}
function make(tag,txt,cls){const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;if(cls)x.className=cls;return x}
function btn(t,fn,cls){const b=make('button',t,cls);b.type='button';b.onclick=fn;return b}
function identify(lang,title,id){return id?lang+'#'+id:key(lang,title)}
function lookup(lang,title){const provisional=key(lang,title);return catalogue.get(aliases.get(provisional)??provisional)}
function add(lang,title,pos,parent=null){
  title=titleKey(title);let n=lookup(lang,title);if(n)return n;
  const k=key(lang,title);n={k,lang,title,x:pos.x,y:pos.y,parent,ids:[],data:null,pool:[],current:0,next:null,ready:false,loading:false,offline:false};catalogue.set(k,n);return n
}
function place(n,childIndex){
  if(!n)return {x:0,y:0};
  const p=catalogue.get(n.parent), outward=p?Math.atan2(n.y-p.y,n.x-p.x):-Math.PI/2;
  const series=p?[0,-.6,.6,-1.18,1.18,-1.62,1.62]:[0,1.047,2.094,3.142,4.189,5.236];
  const angle=outward+series[childIndex%series.length], base=(p?183:174)+Math.floor(childIndex/series.length)*68;
  let pos={x:n.x+base*Math.cos(angle),y:n.y+base*Math.sin(angle)};
  for(let tries=0;tries<14;tries++) { if(![...catalogue.values()].some(d=>Math.hypot(d.x-pos.x,d.y-pos.y)<66))break;const a=angle+(tries%2?-1:1)*(.21+tries*.13),r=base+Math.floor(tries/4)*28;pos={x:n.x+r*Math.cos(a),y:n.y+r*Math.sin(a)}; }
  return pos
}
function rawThumb(src){try {const u=new URL(src);return u.protocol==='https:'&&u.hostname.endsWith('.wikimedia.org')?u.href:null}catch{return null}}
function useData(lang,ds){for(const data of ds){const n=lookup(lang,data.source)??lookup(lang,data.title);if(!n)continue;n.data=data;n.id=data.id;aliases.set(key(lang,data.title),n.k);aliases.set(identify(lang,data.title,data.id),n.k);}}
async function metadata(lang,titles){
  try {
    const ds=await infoWiki(lang,titles);useData(lang,ds);render();if(!active||titles.some(t=>lookup(lang,t)?.k===active.k))renderDetail();
    const names=[...new Set(ds.map(d=>d.imageName).filter(Boolean))];
    const credits=await imageCredits(lang,names);
    for(const d of ds){const n=lookup(lang,d.source);if(n?.data?.imageName===d.imageName)n.data.credit=credits.get(d.imageName);}
    render();if(!active||titles.some(t=>lookup(lang,t)?.k===active.k))renderDetail();
  }catch{}
}
function creditedThumb(n){return n.data?.credit?rawThumb(n.data.thumbnail):null;}
function externalLink(label,href){const a=make('a',label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}

function pickNeighbors(n){
  const entries=pageBatch(n.pool,n.current);
  n.ids=entries.map((title,i)=>add(n.lang,title,place(n,i),n.k).k).filter(k=>k!==n.k);
  const missing=n.ids.map(k=>catalogue.get(k)).filter(d=>d&&!d.data);
  if(missing.length) metadata(n.lang,missing.map(d=>d.title));
}
function append(n,titles){const known=new Set([n.title.toLowerCase(),...n.pool.map(x=>x.toLowerCase())]);for(const t of titles){const s=titleKey(t), l=s.toLowerCase();if(s&&!known.has(l)){known.add(l);n.pool.push(s)}}}
async function expand(n,{direction=0,frontier=false}={}){
  if(n.loading||n.ready&&!direction)return;
  if(frontier&&(Date.now()-lastGrowth<850||network==='offline'&&!(n.title in sample)))return;
  if(frontier)lastGrowth=Date.now();
  const intent=n.intent??0;
  n.loading=true;n.error=false;renderMapStatus(); if(active===n)renderDetail();
  if(n.ready&&direction){
    const target=n.current+direction;
    if(target>=0){
      try{
        for(let i=0;i<3&&n.pool.length<=target*PAGE_SIZE&&n.next;i++){
          const res=await linksWiki(n.lang,n.title,n.next);append(n,res.titles);n.next=res.next;
        }
        if(n.pool.length>target*PAGE_SIZE){if(intent===(n.intent??0))n.current=target;}
        else if(n.next)n.error=true;
      }catch{n.error=true}
    }
  }else{
    const fallback=n.lang==='en'?sample[n.title]:null;
    try{
      const body=await bodyWiki(n.lang,n.title).catch(()=>[]);
      if(body.length){
        if(n.lang==='en'&&n.title==='Hades'){const has=new Set(body);append(n,sample.Hades.slice(1).filter(t=>has.has(t)));}
        append(n,body);
        n.next=null;
      }else{
        const links=await linksWiki(n.lang,n.title);
        append(n,links.titles);n.next=links.next;
      }
      n.ready=true;n.offline=false;network='live';
    }catch{
      if(fallback){append(n,fallback.slice(1));n.ready=true;n.offline=true}
      network='offline';
    }
  }
  if(n.ready)pickNeighbors(n);
  n.loading=false;render();if(active===n)renderDetail();
}
function ringPosition(center,index,parent=null){
  const angle=parent?Math.atan2(center.y-parent.y,center.x-parent.x)+[0,-.62,.62,-1.24,1.24,Math.PI][index%6]:-Math.PI/2+(index%6)*Math.PI/3;
  const distance=174;
  return {x:center.x+distance*Math.cos(angle),y:center.y+distance*Math.sin(angle)};
}
function displayPositions(){
  const poses=new Map();if(!active)return poses;
  poses.set(active.k,active);
  active.ids.forEach((k,i)=>poses.set(k,ringPosition(active,i)));
  for(const k of active.ids){const n=catalogue.get(k),p=poses.get(k);if(!n?.ready)continue;
    n.ids.forEach((next,j)=>{if(!poses.has(next))poses.set(next,ringPosition(p,j,active))});
  }
  return poses;
}
function screen(n){return {x:map.clientWidth/2+(n.x-cam.x)*cam.z,y:map.clientHeight/2+(n.y-cam.y)*cam.z}}
function drawSet(){
  if(!active)return [];
  const ids=new Set([active.k,...active.ids]);
  let ancestor=active;for(let i=0;i<3&&ancestor?.parent;i++){ids.add(ancestor.parent);ancestor=catalogue.get(ancestor.parent)}
  for(const k of active.ids){const n=catalogue.get(k);if(n?.ready)for(const child of n.ids)ids.add(child)}
  return [...ids].map(k=>catalogue.get(k)).filter(Boolean);
}
function clientPoint(e){const rect=map.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top}}
function moveCenter(n){cam.x=n.x;cam.y=n.y;render()}
function setActive(n,center=true){
  if(!n)return;
  active=n;visitedLit.add(n.k);
  if(center)moveCenter(n);else render();
  showMode('read');
  if(!n.data&&!n.loading)metadata(n.lang,[n.title]);
  if(!n.ready)expand(n);
}
function hashFor(n){return '#'+n.lang+'/'+encodeURIComponent(n.title)}
function persistHash(n){try{history.replaceState(null,'',hashFor(n))}catch{}}
function captureTrail(){
  if(trailCursor>=0&&active)trail[trailCursor]={k:active.k,x:cam.x,y:cam.y,z:cam.z,batch:active.current};
}
function updateTrailButtons(){
  $('trail-back').disabled=trailCursor<1;
  $('trail-next').disabled=trailCursor<0||trailCursor>=trail.length-1;
  $('trail-back').title=T('trail-back-hint');$('trail-next').title=T('trail-next-hint');
}
function sameArticle(a,b){return a&&b&&(a.k===b.k||a.lang===b.lang&&a.id&&a.id===b.id)}
function choose(n,center=true){
  if(sameArticle(active,n)){setActive(active,center);captureTrail();persistHash(active);return;}
  captureTrail();
  trail.splice(trailCursor+1);
  setActive(n,center);trail.push({k:n.k,x:cam.x,y:cam.y,z:cam.z,batch:n.current});trailCursor=trail.length-1;
  updateTrailButtons();persistHash(n);
}
function traverse(delta){
  if(trailCursor+delta<0||trailCursor+delta>=trail.length)return;
  captureTrail();const requested=trail[trailCursor+delta],n=catalogue.get(requested.k);if(!n)return;
  trailCursor+=delta;cam.x=requested.x;cam.y=requested.y;cam.z=requested.z;
  n.intent=(n.intent??0)+1;
  if(n.ready&&n.current!==requested.batch&&pageBatch(n.pool,requested.batch).length){n.current=requested.batch;pickNeighbors(n)}
  setActive(n,false);updateTrailButtons();persistHash(n);
}
function maybeGrow(){
  if(!active||active.loading||queued)return;
  const w=map.clientWidth,h=map.clientHeight;
  const positions=displayPositions();const candidates=drawSet().filter(n=>{if(n===active||n.loading||n.ready||!active.ids.includes(n.k))return false;const p=screen(positions.get(n.k)??n),border=Math.min(p.x,w-p.x,p.y,h-p.y);return border>10&&border<108});
  if(candidates.length){queued=true;expand(candidates[0],{frontier:true}).finally(()=>{queued=false})}
}
const existingDots=new Map();
function render(){
  if(renderTicket)return;
  renderTicket=requestAnimationFrame(()=>{
    renderTicket=0;const visible=drawSet(), ns=new Set(visible.map(n=>n.k)), w=map.clientWidth,h=map.clientHeight;
    const positions=displayPositions();
    for(const [k,v] of existingDots)if(!ns.has(k)){v.wrap.remove();existingDots.delete(k)}
    for(const n of visible){
      const p=screen(positions.get(n.k)??n);let v=existingDots.get(n.k);
      if(!v){
        const wrap=make('div',undefined,'dot-wrap');
        const b=btn('',()=>choose(n),'dot');b.setAttribute('aria-label',n.title);
        const initials=make('span',n.title.split(/[ _]/).slice(0,2).map(v=>[...v][0]??'').join('').toUpperCase());initials.setAttribute('aria-hidden','true');
        b.append(initials);
        const quick=make('div',undefined,'quick'),label=make('span',n.title,'quick-title');
        const add=btn('',()=>toggleSave(n),'quick-add');quick.append(label,add);wrap.append(b,quick);
        v={wrap,b,quick,add,label};existingDots.set(n.k,v);nodesLayer.append(wrap)
      }
      const {wrap,b,add,label}=v;
      const img=creditedThumb(n);
      if(img&&!b.querySelector('img')&&!b.dataset.img){const t=make('img');t.alt='';t.loading='lazy';t.referrerPolicy='no-referrer';b.dataset.img=img;t.onerror=()=>t.remove();t.src=img;b.append(t)}
      if(img&&!v.credit){v.credit=externalLink('ⓘ',n.data.credit.file);v.credit.className='quick-credit';v.quick.append(v.credit)}
      if(v.credit){v.credit.title=T('image-credit');v.credit.setAttribute('aria-label',T('image-credit')+': '+n.data.credit.author+' · '+n.data.credit.label)}
      const isSaved=savedIndex(n)>=0;
      add.textContent=isSaved?'✓':'＋'; add.setAttribute('aria-label',(isSaved?T('remove'):T('bookmark'))+n.title);add.title=isSaved?T('added'):T('add');
      label.textContent=n.title;
      wrap.hidden=p.x<-80||p.x>w+80||p.y<-80||p.y>h+80;
      wrap.style.left=p.x+'px';wrap.style.top=p.y+'px';
      wrap.style.setProperty('--size',Math.round(Math.max(32,Math.min(105,(n===active?83:57)*cam.z)))+'px');
      wrap.classList.toggle('active',n===active);b.classList.toggle('active',n===active);
      wrap.classList.toggle('near-bottom',p.y>h-78);wrap.classList.toggle('near-left',p.x<70);wrap.classList.toggle('near-right',p.x>w-70);
    }
    const svg=document.createDocumentFragment();
    for(const n of visible){const from=screen(positions.get(n.k)??n);const ids=new Set(n.ids);if(n===active&&n.parent)ids.add(n.parent);for(const k of ids){if(!ns.has(k))continue;const d=catalogue.get(k);if(!d)continue;const to=screen(positions.get(k)??d);const l=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [name,value] of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y}))l.setAttribute(name,value);svg.append(l)}}
    lines.replaceChildren(svg);renderMapStatus()
  });
}
function savedIndex(n){return saved.findIndex(d=>d.lang===n.lang&&(d.title===n.title||(d.id&&d.id===n.id)))}
function toggleSave(n){let i=savedIndex(n);if(i<0)saved.push({title:n.title,lang:n.lang,id:n.id,via:catalogue.get(n.parent)?.title??(active!==n?active?.title:undefined)});else saved.splice(i,1);try{localStorage.setItem('wiki-atlas-list-v1',JSON.stringify(saved))}catch{} renderSaved();renderDetail();render();}
function renderSaved(){
  $('count').textContent=saved.length;
  const section=$('saved');section.replaceChildren(make('h2',T('saved-title')));
  if(!saved.length){section.append(make('p',T('saved-empty'),'copy'));return}
  for(const s of saved){
    const row=make('div',undefined,'saved-entry');
    const jump=btn(s.title,()=>{const n=lookup(s.lang,s.title)??add(s.lang,s.title,active?place(active,active.ids.length):{x:0,y:0},active?.k);choose(n)});
    if(s.via)jump.append(make('div',T('from')+s.via,'muted mini'));
    const del=btn('×',()=>toggleSave(s));del.setAttribute('aria-label',T('remove')+s.title);row.append(jump,del);section.append(row)
  }
}
function renderMapStatus(){
  const el=$('map-status');const t=active?.loading?T('expanding'):network==='offline'?T('offline-map'):network==='live'?T('live-map'):T('idle-map');
  if(el.textContent!==t)el.textContent=t;
}
function renderDetail(){
  const q=$('detail'), n=active;if(!n)return;const thumb=creditedThumb(n), old=q.querySelector('.detail-image');
  q.replaceChildren();
  if(thumb){const image=old&&old.src===thumb?old:make('img',undefined,'detail-image');image.alt='';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();image.src=thumb;const c=n.data.credit;const imageLink=externalLink('',c.file);imageLink.setAttribute('aria-label',T('image-credit'));imageLink.className='image-file';imageLink.append(image);q.append(imageLink);
  const line=make('p',undefined,'image-credit muted mini');line.append(externalLink(T('image-credit'),c.file),document.createTextNode(': '+c.author+' · '));if(c.license)line.append(externalLink(c.label,c.license));else line.append(document.createTextNode(c.label));line.append(document.createTextNode(' · '+T('circle-crop')));q.append(line);}

  const heading=make('h2',n.data?.title??n.title,'detail-name');q.append(heading);
  const demo=n.lang==='en'&&sample[n.title]?.[0];
  const text=n.data?.extract?.trim().replace(/\n+/g,' ');q.append(make('p',text?text.slice(0,510)+(text.length>510?'…':''):demo?(T('demo-intro')+demo):n.loading?T('fetching-extract'):T('missing-extract'),'copy'));
  const a=make('a',T('source'));a.href=article(n.lang,n.data?.title??n.title);a.target='_blank';a.rel='noopener noreferrer';q.append(a,make('p',n.offline?T('offline-source'):n.data?T('live-source')+' '+n.lang.toUpperCase()+' '+T('wiki'):'','mini '+(n.offline?'offline':'muted')));
  if(text){const license=make('p',undefined,'copy-license muted mini');license.append(externalLink('CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'),document.createTextNode(' · '+T('excerpt-cut')));q.append(license);}

  const controls=make('div',undefined,'actions'); controls.append(btn(savedIndex(n)<0?T('add'):T('added'),()=>toggleSave(n),'primary'));
  if(!n.ready){
    const retry=btn(n.loading?T('loading'):T('retry'),()=>expand(n));retry.disabled=n.loading;controls.append(retry)
  }
  q.append(controls);
  if(n.title==='Odyssey'&&n.lang==='en'){const src=make('a',T('odyssey'));src.href='https://en.wikisource.org/wiki/The_Odyssey_(Butler)/Book_XI';src.target='_blank';src.rel='noopener noreferrer';const wrap=make('p');wrap.append(src);q.append(wrap);}
  const near=make('section',undefined,'neighbors');near.append(make('h3',T('neighbors')));
  if(!n.ids.length)near.append(make('p',n.loading?T('finding'):T('empty'),'muted'));
  else {
    const pagination=make('div',undefined,'pagination');
    const previous=btn(T('prev'),()=>expand(n,{direction:-1})),next=btn(T('next'),()=>expand(n,{direction:1}));
    previous.disabled=n.loading||n.current===0;next.disabled=n.loading||n.pool.length<=(n.current+1)*PAGE_SIZE&&!n.next;
    if(next.disabled&&!n.loading)next.title=T('page-end');
    pagination.append(previous,make('span',n.loading?T('loading'):batchLabel(ui,n.current+1,n.ids.length),'muted mini'),next);near.append(pagination);
    if(n.error)near.append(make('p',T('network-error'),'muted mini'));
  }
  for(const k of n.ids){const d=catalogue.get(k),row=make('div',undefined,'neighbor-row');if(!d)continue;const star=btn(savedIndex(d)<0?'＋':'✓',()=>toggleSave(d));star.setAttribute('aria-label',(savedIndex(d)<0?T('bookmark'):T('remove'))+d.title);row.append(btn(d.title,()=>choose(d)),star);near.append(row)}
  q.append(near)
}
function showMode(mode){detailMode=mode;for(const [id,m] of [['read-tab','read'],['saved-tab','saved'],['list-toggle','saved']])$(id).setAttribute('aria-pressed',String(mode===m));$('detail').hidden=mode!=='read';$('saved').hidden=mode!=='saved';if(mode==='read')renderDetail();else renderSaved()}
function zoomAt(z,p){
  const old=cam.z,w=map.clientWidth/2,h=map.clientHeight/2;z=Math.max(.35,Math.min(2.5,z));
  cam.x+=(p.x-w)*(1/old-1/z);cam.y+=(p.y-h)*(1/old-1/z);cam.z=z;render();maybeGrow();
}
function centered(){return {x:map.clientWidth/2,y:map.clientHeight/2}}
map.addEventListener('wheel',e=>{e.preventDefault();zoomAt(cam.z*Math.exp(-e.deltaY*.0018),clientPoint(e));},{passive:false});
map.addEventListener('pointerdown',e=>{
  if(e.target.closest('button,a'))return;
  pointers.set(e.pointerId,clientPoint(e));map.setPointerCapture(e.pointerId);
  if(pointers.size===1){pan=clientPoint(e);map.classList.add('dragging')}
  if(pointers.size===2){let [a,b]=pointers.values();pinch=Math.hypot(a.x-b.x,a.y-b.y);pan=null}
});
map.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const p=clientPoint(e);pointers.set(e.pointerId,p);
  if(pointers.size===2){const [a,b]=pointers.values(),d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0&&d>0)zoomAt(cam.z*d/pinch,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});pinch=d;return}
  if(pan){cam.x-=(p.x-pan.x)/cam.z;cam.y-=(p.y-pan.y)/cam.z;pan=p;render();maybeGrow()}
});
function release(e){pointers.delete(e.pointerId);pinch=null;pan=[...pointers.values()][0]??null;if(!pan)map.classList.remove('dragging');maybeGrow()}
map.addEventListener('pointerup',release);map.addEventListener('pointercancel',release);map.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e)});
map.addEventListener('keydown',e=>{if(e.target!==map)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();cam.x+=d[0]*36;cam.y+=d[1]*36;render();maybeGrow()}});
$('trail-back').onclick=()=>traverse(-1);$('trail-next').onclick=()=>traverse(1);
$('plus').onclick=()=>zoomAt(cam.z*1.2,centered());$('minus').onclick=()=>zoomAt(cam.z/1.2,centered());$('recenter').onclick=()=>{if(active){cam.z=innerWidth<781?.67:1;moveCenter(active)}};
$('read-tab').onclick=()=>showMode('read');$('saved-tab').onclick=()=>showMode('saved');$('list-toggle').onclick=()=>{showMode(detailMode==='saved'?'read':'saved');if(detailMode==='saved'&&innerWidth<781)$('reader').scrollIntoView({block:'nearest'})};
const results=$('results');
function openSearch(n){let node=lookup(n.lang,n.title);if(!node){node=add(n.lang,n.title,active?{x:active.x+360,y:active.y+280}:{x:0,y:0},null);if(n.id)node.id=n.id;}node.intent=(node.intent??0)+1;if(node.ready){node.current=0;node.error=false;pickNeighbors(node)}choose(node);results.hidden=true}
$('search').addEventListener('submit',async e=>{
  e.preventDefault();const exchange=++searchTicket;const q=$('query').value.trim(),lang=$('language').value;if(!q)return;
  results.hidden=false;results.replaceChildren(make('div',T('searching'),'info'));let r=[],offline=false;
  try{r=await searchWiki(lang,q);network='live'}catch{offline=true;network='offline';if(lang==='en')r=Object.keys(sample).filter(t=>t.toLowerCase().includes(q.toLowerCase())).slice(0,9).map(title=>({title,lang}));}
  if(exchange!==searchTicket)return;
  if(offline&&r.length)results.replaceChildren(make('div',T('search-offline'),'info'));else results.replaceChildren();
  if(!r.length)results.append(make('div',offline?T('search-unavailable'):T('no-results'),'info'));
  for(const n of r)results.append(btn(n.title,()=>openSearch(n)));
  renderMapStatus();
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#search'))results.hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')results.hidden=true});
new ResizeObserver(render).observe(map);
try{const m=location.hash.match(/^#(en|zh)\/(.+)$/);root=m?add(m[1],decodeURIComponent(m[2]),{x:0,y:0}):null;}catch{}
root??=add('en','Hades',{x:0,y:0});$('language').value=root.lang;choose(root);applyLanguage();
