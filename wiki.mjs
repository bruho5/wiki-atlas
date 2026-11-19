export const PAGE_SIZE=6;
export const sample={
  'Hades':['希腊神话中的冥界之神。他的名字也用于指代亡者所居的冥界。','Greek underworld','Persephone','Odyssey','Orpheus','Hades (video game)','Hades II','Cerberus','Homer','Theogony','Zagreus','Styx','Supergiant Games'],
  'Greek underworld':['古希腊神话中的亡者世界，可顺着冥河、守门者与下冥界的故事继续探索。','Styx','Cerberus','Odyssey','Orpheus','Persephone','Hades','Elysium','Tartarus'],
  'Persephone':['希腊神话中的珀耳塞福涅，冥界王后。','Hades','Demeter','Greek underworld','Homeric Hymns'],
  'Odyssey':['归于荷马名下的古希腊史诗。卷十一叙述奥德修斯向亡灵求问。','Homer','Greek underworld','Odysseus','Iliad','Circe','Tiresias'],
  'Orpheus':['希腊神话中的诗人兼乐师，曾为寻找欧律狄刻而进入冥界。','Eurydice','Greek underworld','Hades','Persephone'],
  'Hades (video game)':['Supergiant Games 的动作游戏，讲述扎格列欧斯尝试离开冥界的故事。','Hades II','Supergiant Games','Zagreus','Greek underworld','Orpheus','Persephone'],
  'Hades II':['Supergiant Games 的续作，主角为墨利诺厄。','Hades (video game)','Supergiant Games','Melinoë','Hecate','Chronos','Greek underworld'],
  'Cerberus':['希腊神话中守卫冥界入口的犬。','Greek underworld','Hades','Heracles'],
  'Homer':['《伊利亚特》和《奥德赛》传统上归于荷马。','Odyssey','Iliad'],
  'Theogony':['赫西俄德的古希腊诗作，叙述诸神的谱系。','Hesiod','Hades','Tartarus'],
  'Zagreus':['希腊神话中的人物，亦是游戏《Hades》的主角。','Hades','Hades (video game)','Persephone'],
  'Styx':['希腊神话中的冥河，亦是女神的名字。','Greek underworld','Charon','Hades','Tartarus'],
  'Supergiant Games':['制作《Hades》和《Hades II》的独立游戏工作室。','Hades (video game)','Hades II','Bastion (video game)','Transistor (video game)'],
  'Elysium':['希腊神话中亡者世界的一部分。','Greek underworld','Hades'],
  'Tartarus':['希腊神话中的深渊。','Greek underworld','Theogony','Hades']
};
export const titleKey=t=>t.trim().replaceAll('_',' ');
export const key=(lang,title)=>lang+':'+titleKey(title);
export const article=(lang,title)=>'https://'+lang+'.wikipedia.org/wiki/'+encodeURIComponent(titleKey(title).replaceAll(' ','_'));
export const pageBatch=(pool,batch,limit=PAGE_SIZE)=>pool.slice(batch*limit,(batch+1)*limit);
let running=0; const jobs=[];
function drain(){while(running<2&&jobs.length){running++;let {fn,ok,no}=jobs.shift();Promise.resolve().then(fn).then(ok,no).finally(()=>{running--;drain()});}}
export const wiki=(lang,params)=>new Promise((ok,no)=>{jobs.push({ok,no,fn:async()=>{
  if(!['en','zh'].includes(lang))throw Error('Unsupported wiki');
  const u=new URL('https://'+lang+'.wikipedia.org/w/api.php');
  u.search=new URLSearchParams({format:'json',formatversion:'2',origin:'*',...params}).toString();
  const r=await fetch(u,{signal:AbortSignal.timeout(7800),credentials:'omit'});
  if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(j.error)throw Error(j.error.code);return j;
}});drain()});
export async function searchWiki(lang,q){
  const r=await wiki(lang,{action:'query',list:'search',srnamespace:'0',srlimit:'9',srsearch:q});
  return (r.query?.search??[]).map(v=>({title:v.title,lang,id:v.pageid}));
}
export async function infoWiki(lang,titles){
  const r=await wiki(lang,{action:'query',redirects:'1',prop:'pageimages|extracts',piprop:'thumbnail|name',pithumbsize:'220',pilicense:'free',pilimit:'18',exintro:'1',explaintext:'1',exlimit:'18',titles:titles.join('|')});
  const pages=r.query?.pages??[];
  const alias=new Map([...(r.query?.normalized??[]),...(r.query?.redirects??[])].map(a=>[a.from,a.to]));
  return titles.map(t=>{let normalized=t;for(let i=0;i<5&&alias.has(normalized);i++)normalized=alias.get(normalized);const p=pages.find(x=>x.title===normalized);return p&&!p.missing?{source:t,title:p.title,id:p.pageid,thumbnail:p.thumbnail?.source,imageName:p.pageimage,extract:p.extract}:null}).filter(Boolean);
}
export async function linksWiki(lang,title,continuation){
  const r=await wiki(lang,{action:'query',titles:title,redirects:'1',prop:'links',plnamespace:'0',pllimit:'60',...(continuation??{})});
  return {titles:(r.query?.pages?.[0]?.links??[]).map(v=>v.title),next:r.continue??null};
}
export async function leadWiki(lang,title){
  const r=await wiki(lang,{action:'parse',page:title,redirects:'1',section:'0',prop:'text',disableeditsection:'1'});
  const html=r.parse?.text;if(!html)return [];
  const doc=new DOMParser().parseFromString(html,'text/html');
  return [...doc.querySelectorAll('p a[href^="/wiki/"]')].map(a=>{try{return titleKey(decodeURIComponent(a.getAttribute('href').split('#')[0].slice(6)));}catch{return ''}}).filter(t=>t&&!t.includes(':'));
}
export async function bodyWiki(lang,title){
  const r=await wiki(lang,{action:'parse',page:title,redirects:'1',prop:'text',disableeditsection:'1'});
  if(!r.parse?.text)return [];
  const doc=new DOMParser().parseFromString(r.parse.text,'text/html');
  doc.querySelectorAll('table, nav, aside, .navbox, .vertical-navbox, .infobox, .reference, .references, .reflist, .hatnote, .metadata, .sistersitebox, .side-box, .mw-editsection, #toc, .authority-control').forEach(e=>e.remove());
  const container=doc.querySelector('.mw-parser-output')??doc.body, titles=[];
  for(const el of container.querySelectorAll('h2, h3, p a[href^="/wiki/"], li a[href^="/wiki/"]')){
    if(/^H[23]$/.test(el.tagName)){if(/^(References|External links|Further reading|Bibliography|Sources|Footnotes|Notes|参考资料|參考資料|参考文献|參考文獻|外部链接|外部連結|注释|註釋)/i.test(el.textContent.trim()))break;continue;}
    try{const t=titleKey(decodeURIComponent(el.getAttribute('href').split('#')[0].slice(6)));if(t&&!t.includes(':')&&!titles.includes(t))titles.push(t)}catch{}
    if(titles.length>=450)break;
  }
  return titles;
}

// Reuse only freely licensed PageImages, with author/license metadata and a file-page link.
export async function imageCredits(lang, images){
  if(!images.length)return new Map();
  const res=await wiki(lang,{action:'query',prop:'imageinfo',iiprop:'extmetadata',iiextmetadatafilter:'Artist|Credit|LicenseShortName|LicenseUrl',titles:images.map(n=>'File:'+n).join('|')});
  const results=new Map();
  const pure=s=>{
    if(!s)return '';
    const d=new DOMParser().parseFromString(String(s),'text/html');
    return d.body.textContent.replace(/\s+/g,' ').trim();
  };
  const aliases=new Map([...(res.query?.normalized??[]),...(res.query?.redirects??[])].map(a=>[a.from,a.to]));
  for(const requested of images){
    let name='File:'+requested;
    for(let i=0;i<5&&aliases.has(name);i++)name=aliases.get(name);
    const page=(res.query?.pages??[]).find(p=>p.title===name);
    const em=page?.imageinfo?.[0]?.extmetadata;
    if(!em)continue;
    const label=pure(em.LicenseShortName?.value);
    const author=pure(em.Artist?.value)||pure(em.Credit?.value);
    // If attribution fields are unreliable, fall back to a letter rather than showing the image.
    if(!label||!author)continue;
    const host=page.imagerepository==='shared'?'commons.wikimedia.org':lang+'.wikipedia.org';
    const file='https://'+host+'/wiki/File:'+encodeURIComponent(name.slice(5).replaceAll(' ','_'));
    const license=em.LicenseUrl?.value;
    results.set(requested,{author,label,file,license:typeof license==='string'&&/^https:\/\//i.test(license)?license:null});
  }
  return results;
}
