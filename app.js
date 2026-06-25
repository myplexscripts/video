"use strict";
console.log("Hume v0.4");

/* ============================================================ CONFIG */
const PRODUCT="Hume";
const PLEX_TV="https://plex.tv";
const LS={clientId:"hume_cid",token:"hume_token",server:"hume_server",railStyles:"hume_rail_styles",navCollapsed:"hume_nav_collapsed",font:"hume_font",detailArt:"hume_detail_art",tvMode:"hume_tv_mode",heroStyle:"hume_hero_style",hubSummaries:"hume_hub_summaries",watchedBadges:"hume_watched_badges",spoilerBlur:"hume_spoiler_blur"};
const SETTINGS_WORKER="https://hume-settings.contactdavidbusch.workers.dev";

/* ---- FONT THEMING ---- */
const FONT_STACKS={
  circular:"'Circular','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
  inter:"'Inter','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
  outfit:"'Outfit','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
};
function _loadGFont(family){
  const id="gf-"+family.toLowerCase(); if(document.getElementById(id)) return;
  const l=document.createElement("link"); l.id=id; l.rel="stylesheet";
  l.href=`https://fonts.googleapis.com/css2?family=${family.replace(/ /g,"+")}:wght@400;500;600;700;800;900&display=swap`;
  document.head.appendChild(l);
}
// Typography is fixed: Inter for body/UI, Rubik for all headings.
// (applyFont ignores its argument — kept as a no-op shim for legacy callers.)
function applyFont(){
  document.documentElement.style.setProperty("--font",FONT_STACKS.inter);
  _loadGFont("Inter"); _loadGFont("Rubik");
}
applyFont();
// Restore TV mode (applies body class before paint so cursor:none is immediate)
if(localStorage.getItem(LS.tvMode)==="1") document.body.classList.add("tv-mode");

/* ---- GENRE COLOURS ---- */
// All palette entries calibrated for:
//  (a) white text contrast — luminance kept below 155
//  (b) duotone visibility — mid-range luminance (90-145) so multiply-blending
//      a grayscale image produces visible highlights, not a near-black wash.
//  Dark originals (deep-purple, forest, maroon, black) replaced with
//  vivid mid-luminance equivalents.
const GENRE_COLORS={
  action:"#C14F30",adventure:"#BF8E00",animation:"#4CAF40",
  comedy:"#BF8E00",crime:"#A8386F",documentary:"#1E8A7A",
  drama:"#6B5BD6",fantasy:"#6B5BD6",history:"#C14F30",
  horror:"#4A5AA5",music:"#15A9FC",mystery:"#A8386F",
  romance:"#F74366","science fiction":"#15A9FC","sci-fi":"#15A9FC",
  sport:"#4CAF40",sports:"#4CAF40",thriller:"#A8386F",
  war:"#1E8A7A",western:"#C14F30",family:"#15A9FC",
  kids:"#F74366",anime:"#F74366",biography:"#6B5BD6",
  reality:"#F74366",suspense:"#A8386F",short:"#1E8A7A",
};
const _GENRE_CLR_POOL=["#C14F30","#15A9FC","#F74366","#6B5BD6","#1E8A7A","#A8386F","#BF8E00","#4CAF40"];
function genreColor(name){
  const k=(name||"").toLowerCase();
  if(GENRE_COLORS[k]) return GENRE_COLORS[k];
  let h=0; for(let i=0;i<k.length;i++) h=(h*31+k.charCodeAt(i))&0xFF;
  return _GENRE_CLR_POOL[h%_GENRE_CLR_POOL.length];
}

let _syncState="idle";          // idle | ok | unavailable
function _fnv1a(str){
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); }
  return (h>>>0).toString(16).padStart(8,"0");
}
// Resolve (and cache) a per-account sync key. Prefers the Plex account uuid/id
// from plex.tv; falls back to the server token only if that lookup fails.
async function accountKey(){
  let cached=localStorage.getItem("hume_synckey");
  if(cached) return cached;
  let id="";
  try{
    const r=await fetch(`${PLEX_TV}/api/v2/user`,{headers:plexHeaders(accountToken)});
    if(r.ok){ const u=await r.json(); id=String(u.uuid||u.id||""); }
  }catch(_){}
  if(!id && server&&server.token) id=server.token;   // fallback identity
  if(!id) return null;
  const key=_fnv1a("hume:"+id);
  localStorage.setItem("hume_synckey",key);
  return key;
}
async function loadRemoteSettings(){
  try{
    const key=await accountKey(); if(!key){ _syncState="unavailable"; return false; }
    const r=await fetch(`${SETTINGS_WORKER}/?token=${key}`);
    if(!r.ok) throw new Error("HTTP "+r.status);
    const remote=await r.json();
    let changed=false;
    if(remote && typeof remote==="object"){
      if(remote[LS.railStyles]){
        const next=JSON.stringify(remote[LS.railStyles]);
        if(next!==localStorage.getItem(LS.railStyles)){ localStorage.setItem(LS.railStyles,next); changed=true; }
      }
      if(remote[LS.navCollapsed]!=null){
        const next=String(remote[LS.navCollapsed]);
        if(next!==localStorage.getItem(LS.navCollapsed)){ localStorage.setItem(LS.navCollapsed,next); changed=true; }
      }
      if(remote[LS.detailArt]==="backdrop"||remote[LS.detailArt]==="square"){
        const next=remote[LS.detailArt];
        if(next!==localStorage.getItem(LS.detailArt)){ localStorage.setItem(LS.detailArt,next); changed=true; }
      }
      if(remote[LS.heroStyle]==="backdrop"||remote[LS.heroStyle]==="square"){
        const next=remote[LS.heroStyle];
        if(next!==localStorage.getItem(LS.heroStyle)){ localStorage.setItem(LS.heroStyle,next); changed=true; }
      }
      if(remote[LS.hubSummaries]==="0"||remote[LS.hubSummaries]==="1"){
        const next=remote[LS.hubSummaries];
        if(next!==localStorage.getItem(LS.hubSummaries)){ localStorage.setItem(LS.hubSummaries,next); changed=true; }
      }
    }
    _syncState="ok";
    return changed;
  }catch(e){ _syncState="unavailable"; console.warn("[sync] load failed:",e.message); return false; }
}
let _pushTimer=null;
function pushRemoteSettings(){
  clearTimeout(_pushTimer);
  _pushTimer=setTimeout(async()=>{
    try{
      const key=await accountKey(); if(!key){ _syncState="unavailable"; return; }
      const payload={
        [LS.railStyles]:getRailStyles(),
        [LS.navCollapsed]:localStorage.getItem(LS.navCollapsed)||"0",
        [LS.font]:localStorage.getItem(LS.font)||"circular",
        [LS.detailArt]:localStorage.getItem(LS.detailArt)||"backdrop",
        [LS.heroStyle]:localStorage.getItem(LS.heroStyle)||"backdrop",
        [LS.hubSummaries]:localStorage.getItem(LS.hubSummaries)||"0",
      };
      const r=await fetch(`${SETTINGS_WORKER}/?token=${key}`,{method:"PUT",body:JSON.stringify(payload)});
      _syncState=r.ok?"ok":"unavailable";
      if(!r.ok) console.warn("[sync] save failed: HTTP",r.status);
    }catch(e){ _syncState="unavailable"; console.warn("[sync] save failed:",e.message); }
  },800);  // debounce: batch rapid changes into one write
}
// Lightweight status probe (read-only, no localStorage mutation) for the UI.
async function pingSync(){
  try{
    const key=await accountKey(); if(!key) return "unavailable";
    const r=await fetch(`${SETTINGS_WORKER}/?token=${key}`);
    return (_syncState=r.ok?"ok":"unavailable");
  }catch(_){ return (_syncState="unavailable"); }
}
const VIDEO_TYPES=["movie","show","season","episode","clip"];

function clientId(){
  let id=localStorage.getItem(LS.clientId);
  if(!id){ id="hume-"+crypto.randomUUID(); localStorage.setItem(LS.clientId,id); }
  return id;
}
function plexHeaders(token){
  const h={"Accept":"application/json","X-Plex-Product":PRODUCT,"X-Plex-Version":"1.0",
    "X-Plex-Client-Identifier":clientId(),"X-Plex-Platform":"Web","X-Plex-Device":"Browser"};
  if(token) h["X-Plex-Token"]=token;
  return h;
}
const $=s=>document.querySelector(s);
const el=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};

document.addEventListener('click',e=>{if(e.target.closest('button')&&navigator.vibrate)navigator.vibrate(1);},{capture:true,passive:true});
window.addEventListener('scroll',()=>{document.body.classList.toggle('scrolled-down',window.scrollY>0);},{passive:true});
/* ============================================================ STATE */
let accountToken=localStorage.getItem(LS.token)||null;
let server=JSON.parse(localStorage.getItem(LS.server)||"null");
let sections=[];

/* ============================================================ AUTH */
$("#signInBtn").addEventListener("click",startLogin);
$("#logoutBtn").addEventListener("click",logout);
$("#logoutFromServers").addEventListener("click",logout);

async function startLogin(){
  $("#loginErr").classList.add("hidden");
  const popup=window.open("about:blank","plexAuth","width=620,height=720");
  try{
    const pinRes=await fetch(`${PLEX_TV}/api/v2/pins?strong=true`,{method:"POST",headers:plexHeaders()});
    const pin=await pinRes.json();
    const url=`https://app.plex.tv/auth#?clientID=${encodeURIComponent(clientId())}`
      +`&code=${pin.code}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PRODUCT)}`;
    if(popup) popup.location.href=url;
    const token=await pollPin(pin.id);
    if(popup) popup.close();
    if(!token) throw new Error("Login timed out. Try again.");
    accountToken=token; localStorage.setItem(LS.token,token);
    await afterLogin();
  }catch(e){ if(popup)popup.close(); loginErr(e.message||"Login failed"); }
}
function pollPin(id){
  return new Promise(res=>{
    let n=0;
    const iv=setInterval(async()=>{
      n++;
      try{ const r=await fetch(`${PLEX_TV}/api/v2/pins/${id}`,{headers:plexHeaders()});
        const d=await r.json(); if(d.authToken){clearInterval(iv);res(d.authToken);} }catch(_){}
      if(n>120){clearInterval(iv);res(null);}
    },1000);
  });
}
function loginErr(m){ const e=$("#loginErr"); e.textContent=m; e.classList.remove("hidden"); }
function logout(){ localStorage.removeItem(LS.token); localStorage.removeItem(LS.server);
  localStorage.removeItem("hume_synckey");
  accountToken=null; server=null; location.reload(); }

/* ============================================================ SERVER */
async function discoverServers(){
  const r=await fetch(`${PLEX_TV}/api/v2/resources?includeHttps=1&includeRelay=1`,
    {headers:plexHeaders(accountToken)});
  return (await r.json()).filter(x=>(x.provides||"").includes("server"));
}
function orderConns(c){ return [...c].sort((a,b)=>{ const s=x=>(x.local?0:1)+(x.relay?2:0); return s(a)-s(b); }); }
async function probe(uri,token){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),3500);
  try{ const r=await fetch(`${uri}/identity`,{headers:plexHeaders(token),signal:ctrl.signal});
    clearTimeout(t); return r.ok; }catch(_){ clearTimeout(t); return false; }
}
async function pickConnection(res){
  for(const c of orderConns(res.connections||[]))
    if(await probe(c.uri,res.accessToken))
      return {name:res.name,uri:c.uri,token:res.accessToken,local:c.local,relay:c.relay};
  return null;
}
async function showServerPicker(servers){
  $("#login").style.display="none"; $("#servers").style.display="flex";
  const wrap=$("#serverList"); wrap.innerHTML="<div class='loading'>Testing connections…</div>";
  const results=[];
  for(const s of servers){ const c=await pickConnection(s); if(c) results.push(c); }
  if(!results.length){
    wrap.innerHTML="";
    const box=el("div","err err-offline"); box.setAttribute("role","alert");
    box.innerHTML=`${svgIcon("wifi-slash")}
      <div><b>Can't reach your Plex server</b><div>Make sure it's online and reachable from this device, then try again.</div></div>`;
    const b=el("button","btn glass sm"); b.innerHTML=`${svgIcon("arrow-clockwise")} Try Again`;
    b.onclick=()=>showServerPicker(servers);
    box.appendChild(b); wrap.appendChild(box);
    return;
  }
  wrap.innerHTML="";
  results.forEach(c=>{
    const card=el("div","server-card");
    const tag=c.local?"<span class='badge'>Local</span>":(c.relay?"<span class='badge relay'>Relay</span>":"<span class='badge remote'>Remote</span>");
    card.innerHTML=`<div><div class="sn">${esc(c.name)}</div><div class="meta">${tag} ${new URL(c.uri).host}</div></div>`;
    const b=el("button","btn"); b.innerHTML=`${svgIcon("plug")} Connect`;
    b.onclick=()=>selectServer(c); card.appendChild(b); wrap.appendChild(card);
  });
}
function selectServer(c){ server=c; localStorage.setItem(LS.server,JSON.stringify(c));
  $("#servers").style.display="none"; bootApp(); }

const _apiCache=new Map();
const _apiBg=new Set();
const _apiInflight=new Map(); // dedup concurrent requests for the same path

const IDB_NAME="hume-cache", IDB_STORE="api", IDB_MAX=220, IDB_TTL=864e5; // 24h
const _idbTried=new Set();
function idbOpen(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(IDB_NAME,1);
    r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE); };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
}
function idbGet(key){
  return idbOpen().then(db=>new Promise(res=>{
    const r=db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(key);
    r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null);
  })).catch(()=>null);
}
function idbSet(key,val){
  idbOpen().then(db=>{ db.transaction(IDB_STORE,"readwrite").objectStore(IDB_STORE).put(val,key); }).catch(()=>{});
}
function idbDel(keys){
  if(!keys||!keys.length) return;
  idbOpen().then(db=>{ const st=db.transaction(IDB_STORE,"readwrite").objectStore(IDB_STORE); keys.forEach(k=>st.delete(k)); }).catch(()=>{});
}
function idbAllKeys(){
  return idbOpen().then(db=>new Promise(res=>{
    const r=db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).getAllKeys();
    r.onsuccess=()=>res(r.result||[]); r.onerror=()=>res([]);
  })).catch(()=>[]);
}
function idbGetAll(){
  return idbOpen().then(db=>new Promise(res=>{
    const out=[], cur=db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).openCursor();
    cur.onsuccess=e=>{ const c=e.target.result; if(c){ out.push([c.key,c.value]); c.continue(); } else res(out); };
    cur.onerror=()=>res(out);
  })).catch(()=>[]);
}
// Bound the on-disk cache. Cheap path (under cap) is a single keys-only count;
// only when we're actually over the cap do we read everything to trim oldest +
// expired. Runs once at boot, off the critical path. Touched-but-stale entries
// are also cleaned lazily in api() as they're read.
async function pruneIdb(){
  const keys=await idbAllKeys();
  if(keys.length<=IDB_MAX) return;
  const all=await idbGetAll(), now=Date.now(), drop=[];
  let live=all.filter(([k,v])=>{ if(v&&v.ts&&now-v.ts<IDB_TTL) return true; drop.push(k); return false; });
  if(live.length>IDB_MAX){ live.sort((a,b)=>a[1].ts-b[1].ts); live.slice(0,live.length-IDB_MAX).forEach(([k])=>drop.push(k)); }
  idbDel(drop);
}
async function api(path,{_bg=false}={}){
  let hit=_apiCache.get(path);
  // Lazy disk hydration: race IDB against a 25ms timeout so a cold-cache miss
  // never delays the network fetch by more than one tick.
  if(!hit&&!_bg&&!_idbTried.has(path)){
    _idbTried.add(path);
    const disk=await Promise.race([idbGet(path),new Promise(r=>setTimeout(()=>r(null),25))]);
    if(disk&&disk.ts&&Date.now()-disk.ts<IDB_TTL){ _apiCache.set(path,disk); hit=disk; }
    else if(disk){ idbDel([path]); }
  }
  const age=hit?Date.now()-hit.ts:Infinity;
  if(hit&&!_bg){
    // Serve stale immediately; kick off silent revalidation if stale > 60s
    if(age>60000&&!_apiBg.has(path)){
      _apiBg.add(path);
      api(path,{_bg:true}).catch(()=>{}).finally(()=>_apiBg.delete(path));
    }
    return hit.data;
  }
  // Dedup: if a fetch for this path is already in-flight (e.g. from a prefetch),
  // attach to it rather than firing a second identical request.
  if(_apiInflight.has(path)) return _apiInflight.get(path);
  const sep=path.includes("?")?"&":"?";
  const promise=(async()=>{
    let r;
    try{
      r=await fetch(`${server.uri}${path}${sep}X-Plex-Token=${server.token}`,{headers:plexHeaders(server.token)});
    }catch(_){
      if(hit) return hit.data; // offline: serve stale indefinitely
      const err=new Error(`Can't reach ${(server&&server.name)||"your Plex server"}. Check that it's online and try again.`);
      err.offline=true; throw err;
    }
    if(!r.ok) throw new Error(`Server error ${r.status}`);
    const data=(await r.json()).MediaContainer||{};
    const entry={data,ts:Date.now()};
    _apiCache.set(path,entry);
    idbSet(path,entry);   // persist for instant cold-start next session
    return data;
  })();
  _apiInflight.set(path,promise);
  try{ return await promise; }finally{ _apiInflight.delete(path); }
}
/* Skeleton helpers — shown instantly before data arrives so the screen
   never flashes blank during navigation. */
function skCards(n,wide){
  return Array.from({length:n},()=>`<div class="sk-card${wide?" wide":""}">
    <div class="sk sk-art"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>`).join("");
}
function skeletonHome(){
  return `<div class="sk sk-hero"></div>
    <div class="sk-rail"><div class="sk sk-title"></div><div class="sk-cards">${skCards(8,false)}</div></div>
    <div class="sk-rail"><div class="sk sk-title"></div><div class="sk-cards">${skCards(6,true)}</div></div>
    <div class="sk-rail"><div class="sk sk-title"></div><div class="sk-cards">${skCards(8,false)}</div></div>`;
}
function skeletonDetail(){
  return `<div class="sk sk-detail"></div>
    <div class="sk-rail"><div class="sk sk-title"></div><div class="sk-cards">${skCards(8,false)}</div></div>`;
}
// Playlist/collection composite art is server-generated and isn't a valid
// photo-transcoder resource — serve it directly instead.
function isDirectArt(thumb){ return thumb.startsWith("/playlists/")||thumb.includes("/composite/"); }
function img(thumb,w,h){
  if(!thumb) return "";
  if(isDirectArt(thumb)) return imgDirect(thumb,w,h);
  return `${server.uri}/photo/:/transcode?width=${w}&height=${h}&minSize=1&upscale=1`
    +`&url=${encodeURIComponent(thumb)}&X-Plex-Token=${server.token}`;
}
// Logos must keep their full shape. minSize=1 makes Plex scale-to-FILL the WxH
// box and crop the overflow (cover) — that's what chopped "MORTAL KOMBAT" to
// "RTAL KOMI". minSize=0 makes Plex scale-to-FIT inside the box (contain),
// returning the whole logo letterboxed; CSS object-fit handles final placement.
function imgLogo(thumb,w,h){
  if(!thumb) return "";
  return `${server.uri}/photo/:/transcode?width=${w}&height=${h}&minSize=0&upscale=0`
    +`&url=${encodeURIComponent(thumb)}&X-Plex-Token=${server.token}`;
}
// Composite/playlist art is generated on demand from its OWN endpoint and must
// carry explicit width/height — the photo transcoder can't size it, and the
// composite endpoint returns nothing when dimensions are omitted.
function imgDirect(path,w,h){
  if(!path) return "";
  const sep=path.includes("?")?"&":"?";
  const dims=(w?`width=${Math.round(w)}&`:"")+(h?`height=${Math.round(h)}&`:"");
  return `${server.uri}${path}${sep}${dims}minSize=1&upscale=1&X-Plex-Token=${server.token}`;
}
function imgAmbient(thumb){
  if(!thumb) return "";
  if(isDirectArt(thumb)) return imgDirect(thumb,240,240);
  // A small, lightly-blurred source preserves distinct color regions from
  // the artwork; the heavy CSS blur on #ultraBlur turns them into soft,
  // saturated color blobs rather than a single muddy wash.
  return `${server.uri}/photo/:/transcode?width=240&height=240&minSize=1&upscale=1&blur=30`
    +`&url=${encodeURIComponent(thumb)}&X-Plex-Token=${server.token}`;
}
// Spotify-style 2x2 mosaic built from the first few items' thumbs — used as

function mosaicHTML(items){
  const pics=(items||[]).map(it=>it.thumb||it.parentThumb||it.grandparentThumb).filter(Boolean).slice(0,4);
  if(!pics.length) return "";
  return `<div class="art-mosaic n${pics.length}">`
    +pics.map(t=>`<img src="${img(t,160,160)}" alt="" loading="lazy">`).join("")
    +`</div>`;
}

/* ---- ULTRABLUR ----
   One fixed, cross-fading ambient wash behind detail-style pages and the
   player. Grid/list pages clear it to keep things calm and legible. */
let ubActive=null;
function setUltraBlur(art){
  if(!art){ clearUltraBlur(); return; }
  const a=$("#ubA"), b=$("#ubB");
  const next = ubActive==="A" ? b : a, prev = ubActive==="A" ? a : b;
  next.style.backgroundImage=`url('${imgAmbient(art)}')`;
  requestAnimationFrame(()=>{ next.classList.add("show"); prev.classList.remove("show"); });
  ubActive = ubActive==="A" ? "B" : "A";
}
function clearUltraBlur(){ $("#ubA").classList.remove("show"); $("#ubB").classList.remove("show"); ubActive=null; }

/* ============================================================ BOOT */
async function afterLogin(){
  if(server && await probe(server.uri,server.token)){ $("#login").style.display="none"; bootApp(); return; }
  const servers=await discoverServers();
  if(servers.length===1){ const c=await pickConnection(servers[0]); if(c){selectServer(c);return;} }
  showServerPicker(servers);
}
// Tell the service worker about the active connection so it can pick the right
// image strategy (direct for local, Cloudflare edge-cache for remote/relay).
function notifySW(){
  if(!("serviceWorker" in navigator)||!server) return;
  let host=""; try{ host=new URL(server.uri).host; }catch(_){}
  window.__swServerMsg={type:"server",local:!!server.local,relay:!!server.relay,
    host,workerImg:SETTINGS_WORKER+"/img"};
  navigator.serviceWorker.ready.then(reg=>{
    const t=navigator.serviceWorker.controller||reg.active;
    if(t) t.postMessage(window.__swServerMsg);
  }).catch(()=>{});
}
async function bootApp(){
  $("#login").style.display="none"; $("#servers").style.display="none"; $("#app").style.display="block";
  // Preconnect to the Plex server so the first API call skips TCP+TLS setup
  if(server&&server.uri){
    const pc=document.createElement("link"); pc.rel="preconnect"; pc.href=server.uri;
    document.head.appendChild(pc);
  }
  notifySW();
  pruneIdb().catch(()=>{});   // bound the persisted cache in the background (off critical path)
  try{
    // Persisted responses are hydrated lazily per-path inside api(), so the
    // first screen paints from disk instantly without reading the whole store.
    // Render instantly from local settings; pull synced settings in parallel
    // and only refresh the UI if they actually differ from this device.
    const settingsP=loadRemoteSettings();
    const mc=await api("/library/sections");
    sections=(mc.Directory||[]).filter(s=>s.type==="movie"||s.type==="show");
    buildNav(); buildTabBar(); initNavCollapse(); maybeShowInstallHint(); route();
    settingsP.then(changed=>{
      if(!changed) return;
      initNavCollapse();
      const seg=location.hash.replace(/^#\/?/,"").split("/")[0];
      if(!seg||seg==="home") route();   // only home depends on rail styles
    });
  }catch(e){ $("#content").innerHTML=errHTML(e,"bootApp"); }
}
function buildNav(){
  const nav=$("#nav"); nav.innerHTML="";
  const item=(icon,label,fn,opts={})=>{
    const b=el("button","nav-item");
    if(opts.id) b.id=opts.id;
    if(opts.lib!=null) b.dataset.lib=opts.lib;
    const iconHTML=svgIcon(icon.replace(/^svg:/,""));
    b.innerHTML=`${iconHTML}<span class="nav-text">${esc(label)}</span>`;
    b.title=label; b.setAttribute("aria-label",label);
    b.onclick=()=>{ fn(); closeSidebar(); };
    nav.appendChild(b); return b;
  };
  item("svg:house","Home",()=>navigate("/"),{id:"navHome"});
  const lab=el("div","nav-label"); lab.textContent="Libraries"; nav.appendChild(lab);
  sections.forEach(s=> item(s.type==="show"?"svg:television":"svg:movies", s.title, ()=>navigate(`/library/${s.key}`), {lib:s.key}) );
  const lab2=el("div","nav-label"); lab2.textContent="More"; nav.appendChild(lab2);
  item("svg:playlist","Playlists",()=>navigate("/playlists"),{id:"navPlaylists"});
  item("svg:gear","Settings",()=>navigate("/settings"),{id:"navSettings"});
}
function buildTabBar(){
  const tabs=[
    {id:"tabHome",      icon:"house",           label:"Home",      action:()=>{closeTabLibPicker();navigate("/")}},
    {id:"tabLib",       icon:"movies",          label:"Library",   action:tabLibTap},
    {id:"tabPlaylists", icon:"playlist",        label:"Playlists", action:()=>{closeTabLibPicker();navigate("/playlists")}},
    {id:"tabSearch",    icon:"magnifying-glass",label:"Search",    action:()=>{closeTabLibPicker();navigate("/search")}},
    {id:"tabSettings",  icon:"gear",            label:"Settings",  action:()=>{closeTabLibPicker();navigate("/settings")}},
  ];
  tabs.forEach(t=>{
    const btn=document.getElementById(t.id);
    if(!btn) return;
    btn.innerHTML=svgIcon(t.icon)+`<span>${t.label}</span>`;
    btn.onclick=t.action;
  });
}
function tabLibTap(){
  const picker=$("#tabLibPicker");
  if(picker.classList.contains("open")){ closeTabLibPicker(); return; }
  if(sections.length<=1){
    if(sections[0]) navigate(`/library/${sections[0].key}`);
    return;
  }
  picker.innerHTML=sections.map(s=>
    `<button class="tab-lib-option" onclick="closeTabLibPicker();navigate('/library/${s.key}')">
      ${svgIcon(s.type==="show"?"television":"movies")} ${esc(s.title)}
    </button>`
  ).join("");
  picker.classList.add("open");
}
function closeTabLibPicker(){
  const p=$("#tabLibPicker");
  if(p) p.classList.remove("open");
}
function maybeShowInstallHint(){
  // Skip if already running as installed PWA
  if(navigator.standalone||window.matchMedia("(display-mode:standalone)").matches) return;
  // Skip if already dismissed
  if(localStorage.getItem("hume_install_dismissed")) return;
  // iOS Safari only (Android gets native install prompt from browser)
  if(!/iphone|ipad|ipod/i.test(navigator.userAgent)) return;
  const hint=document.getElementById("installHint");
  if(!hint) return;
  hint.classList.add("visible");
  document.getElementById("installHintDismiss").onclick=()=>{
    hint.classList.remove("visible");
    localStorage.setItem("hume_install_dismissed","1");
  };
}
function highlightTab(seg){
  const libSegs=new Set(["library","movie","show","episode","collection","genre","actor","see-all"]);
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  if(!seg||seg==="home") $("#tabHome")?.classList.add("active");
  else if(libSegs.has(seg)) $("#tabLib")?.classList.add("active");
  else if(seg==="playlists"||seg==="playlist") $("#tabPlaylists")?.classList.add("active");
  else if(seg==="search") $("#tabSearch")?.classList.add("active");
  else if(seg==="settings") $("#tabSettings")?.classList.add("active");
}

/* ============================================================ ROUTER
   Hash-based router (works on static hosting with no server rewrites).
   navigate() updates the URL; the hashchange handler re-renders via
   route(). The video player stays a plain overlay, outside the router. */
function pathForItem(it){
  if(it._collection) return `/collection/${it.ratingKey}`;
  if(it.type==="playlist") return `/playlist/${it.ratingKey}`;
  if(it.type==="movie") return `/movie/${it.ratingKey}`;
  if(it.type==="show") return `/show/${it.ratingKey}`;
  if(it.type==="season") return `/show/${it.parentRatingKey}/season/${it.ratingKey}`;
  if(it.type==="episode") return `/episode/${it.ratingKey}`;
  if(it.type==="person") return `/actor/${it.ratingKey}`;
  return null;
}
let _navDoneTimer;
function navStart(){
  const bar=document.getElementById("navBar"),c=document.getElementById("content");
  clearTimeout(_navDoneTimer);
  document.getElementById("main")?.scrollTo(0,0);
  window.scrollTo(0,0);
  if(bar){ bar.className=""; void bar.offsetWidth; bar.className="going"; }
  if(c){ c.classList.add("nav-out"); setTimeout(()=>c.classList.remove("nav-out"),130); }
  _navDoneTimer=setTimeout(navDone,8000);
}
function navDone(){
  clearTimeout(_navDoneTimer);
  const bar=document.getElementById("navBar");
  if(bar){ bar.className="done"; setTimeout(()=>{ if(bar.className==="done") bar.className=""; },500); }
  if(document.body.classList.contains("tv-mode")){
    setTimeout(()=>{
      const first=document.querySelector("#content button:not([disabled])");
      if(first&&document.activeElement===document.body) first.focus({preventScroll:true});
    },120);
  }
}
function navigate(path){
  navStart();
  if(location.hash.slice(1)===path){ route(); return; }
  location.hash=path;
}

function _tvFocusables(){
  return Array.from(document.querySelectorAll(
    "#content button:not([disabled]),#content a[href],.nav-item"
  )).filter(el=>{
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight+200;
  });
}
function _tvNav(dir){
  const cur=document.activeElement;
  const all=_tvFocusables();
  if(!all.length) return;
  if(!cur||cur===document.body||!all.includes(cur)){
    all[0].focus({preventScroll:true}); return;
  }
  const cr=cur.getBoundingClientRect();
  const cx=cr.left+cr.width/2, cy=cr.top+cr.height/2;
  const horiz=dir==="left"||dir==="right";
  const cands=all.filter(el=>{
    if(el===cur) return false;
    const r=el.getBoundingClientRect();
    if(dir==="right") return r.left   >cr.right -8;
    if(dir==="left")  return r.right  <cr.left  +8;
    if(dir==="down")  return r.top    >cr.bottom-8;
    if(dir==="up")    return r.bottom <cr.top   +8;
  });
  if(!cands.length) return;
  const best=cands.sort((a,b)=>{
    const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
    const ax=ra.left+ra.width/2, ay=ra.top+ra.height/2;
    const bx=rb.left+rb.width/2, by=rb.top+rb.height/2;
    // Primary-axis distance × 1, cross-axis × 4 to prefer straight movement
    const da=horiz?Math.abs(ax-cx)+Math.abs(ay-cy)*4:Math.abs(ay-cy)+Math.abs(ax-cx)*4;
    const db=horiz?Math.abs(bx-cx)+Math.abs(by-cy)*4:Math.abs(by-cy)+Math.abs(bx-cx)*4;
    return da-db;
  })[0];
  best.focus({preventScroll:true});
  // Scroll the horizontal carousel if the card would go off-screen
  const row=best.closest(".carousel,.cast-row,.season-rail");
  if(row){
    const br=best.getBoundingClientRect(), rr=row.getBoundingClientRect();
    if(br.right>rr.right-20) row.scrollLeft+=br.right-rr.right+52;
    else if(br.left<rr.left+20) row.scrollLeft-=rr.left-br.left+52;
  }
  best.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"});
}
function applyTvMode(on){
  document.body.classList.toggle("tv-mode",on);
  localStorage.setItem(LS.tvMode,on?"1":"0");
}
// Arrow/D-pad keys always active (even without TV mode) for keyboard users
document.addEventListener("keydown",e=>{
  const dir={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"}[e.key];
  if(dir){ e.preventDefault(); _tvNav(dir); return; }
  // Back button (Android TV sends Escape; some remotes send BrowserBack)
  if((e.key==="Escape"||e.key==="BrowserBack")&&!document.querySelector(".modal.open")){
    e.preventDefault(); history.back(); return;
  }
  // Media play/pause key and spacebar-on-player
  if(e.key==="MediaPlayPause"){
    const vid=document.querySelector("#player video");
    if(vid){ e.preventDefault(); vid.paused?vid.play():vid.pause(); }
  }
},true);

function highlightNav(seg,key){
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  let sel=null;
  if(!seg||seg==="home") sel=$("#navHome");
  else if(seg==="library") sel=document.querySelector(`.nav-item[data-lib="${key}"]`);
  else if(seg==="playlists") sel=$("#navPlaylists");
  else if(seg==="settings") sel=$("#navSettings");
  if(sel) sel.classList.add("active");
  highlightTab(seg);
}
async function metaItem(ratingKey){
  const mc=await api(`/library/metadata/${ratingKey}`);
  return (mc.Metadata||[])[0]||{ratingKey,type:"movie"};
}
async function playlistMeta(ratingKey){
  try{ const mc=await api(`/playlists/${ratingKey}`); return (mc.Metadata||[])[0]||{ratingKey,title:"Playlist"}; }
  catch(_){ return {ratingKey,title:"Playlist"}; }
}
let _routeGen=0;
const _scrollPos=new Map();
const _carouselCleanups=new Set();
function cleanupCarousels(){ _carouselCleanups.forEach(fn=>fn()); _carouselCleanups.clear(); }
/* On mobile the document scrolls (so iOS collapses its toolbar); on desktop the
   inner .main element scrolls. These helpers read/write whichever is active so
   scroll save/restore works in both modes. */
function _docScrolls(){ return window.matchMedia("(max-width:680px)").matches; }
function getScrollY(){
  if(_docScrolls()) return window.scrollY||document.documentElement.scrollTop||0;
  const m=document.getElementById("main"); return m?m.scrollTop:0;
}
function setScrollY(y){
  if(_docScrolls()){ window.scrollTo(0,y); return; }
  const m=document.getElementById("main"); if(m) m.scrollTop=y;
}
async function route(){
  const gen=++_routeGen;
  setScrollY(0);   
  $("#content")?.classList.remove("dp-wrap");
  document.body.style.removeProperty("--dp-nav-accent");
  closeSidebar(); closeLibMenus(); cleanupHeroVideo(); cleanupCarousels(); closeTrailerModal(); hideLibNav(); closeTabLibPicker();
  const raw=location.hash.replace(/^#\/?/,"");
  const [pathPart,queryPart]=raw.split("?");
  const parts=pathPart.split("/").filter(Boolean).map(p=>{ try{return decodeURIComponent(p);}catch(_){return p;} });
  const params=new URLSearchParams(queryPart||"");
  const seg=parts[0];
  const mb=$("#mobileBack");
  if(mb) mb.style.display=(!seg||seg==="home")?"none":"flex";
  highlightNav(seg,parts[1]);
  try{
    switch(seg){
      case undefined: case "": case "home": return showHome(gen);
      case "library": {
        const section=sections.find(s=>String(s.key)===parts[1]);
        if(!section) return showHome(gen);
        if(parts[2]==="all") return showLibrary(section,gen);
        if(parts[2]==="collections") return showLibraryCollections(section,gen);
        if(parts[2]==="playlists") return showLibraryPlaylists(section,gen);
        return showLibraryRecommended(section,gen);
      }
      case "movie": { const it=await metaItem(parts[1]); if(gen!==_routeGen) return; return openMovie(it); }
      case "show": { const it=await metaItem(parts[1]); if(gen!==_routeGen) return; return openShow(it,parts[2]==="season"?parts[3]:undefined); }
      case "episode": { const it=await metaItem(parts[1]); if(gen!==_routeGen) return; return openEpisode(it); }
      case "collection": { const it=await metaItem(parts[1]); if(gen!==_routeGen) return; return openCollection({...it,_collection:true}); }
      case "playlist": { const it=await playlistMeta(parts[1]); if(gen!==_routeGen) return; return openPlaylist(it); }
      case "playlists": return showPlaylists(gen);
      case "genre": return showGenrePage();
      case "settings": return showSettings();
      case "actor": return openActor(parts[1]);
      case "see-all": return showSeeAll();
      case "search": {
        const q=params.get("q")||"";
        if($("#search")) $("#search").value=q;
        if(window.innerWidth<=680) return showMobileSearch(q||undefined);
        return q ? runSearch(q) : showHome(gen);
      }
      default: return showHome(gen);
    }
  }catch(e){ if(gen===_routeGen) $("#content").innerHTML=errHTML(e); }
}
window.addEventListener("hashchange", e=>{
  _scrollPos.set(e.oldURL,getScrollY());
  route();
});

/* ============================================================ HOME */

function billboardCard(it,rank){
  const b=el("button","card billboard");
  const imgs=it.Image||[];
  const squareImg=imgs.find(i=>i.type==="backgroundSquare");
  // For episodes use grandparent (show) art; fallback: backdrop → poster
  const artSrc=img((squareImg&&squareImg.url)||it.art||it.grandparentArt||it.thumb,560,560);
  const logoImg=imgs.find(i=>i.type==="clearLogo");
  const logoSrc=logoImg?imgLogo(logoImg.url,600,300):"";
  // For episodes display show title, not episode title
  const title=it.type==="episode"?(it.grandparentTitle||it.title||""):(it.title||"");
  // Genre only — no Movie/TV type prefix
  const meta=(it.Genre||[]).slice(0,3).map(g=>g.tag).join(" · ");
  b.innerHTML=`
    <div class="art${artSrc?"":" broken"}">
      ${artSrc?`<img loading="lazy" decoding="async" alt="${esc(title)}" src="${artSrc}" onerror="this.closest('.art').classList.add('broken')">`
              :`<span class="art-fallback">${svgIcon(it.type==="show"?"television":"movies")}</span>`}
      ${rank!=null?`<div class="bill-rank">${rank}</div>`:""}
      <div class="play-hover">${svgIcon("play-circle-fill")}</div>
      <div class="bill-logo-wrap">
        ${logoSrc?`<img class="bill-logo" src="${logoSrc}" alt="${esc(title)}" onerror="this.nextElementSibling.style.display='block';this.remove()">`:""}
        <div class="bill-title"${logoSrc?' style="display:none"':''}>${esc(title)}</div>
      </div>
    </div>
    <div class="bill-meta">
      <span class="cs">${esc(meta)}</span>
    </div>`;
  
  if(artSrc) b.style.setProperty("--bill-bg",`url('${artSrc.replace(/'/g,"\\'")}')`);
  // Episodes: link to the show page, not the individual episode
  const dest=it.type==="episode"?`/show/${it.grandparentRatingKey||it.ratingKey}`:pathForItem(it);
  b.onclick=()=>{if(dest)navigate(dest);else openItem(it);};
  return b;
}
function squareBoardRailSection(title,items,libLabel,numbered,summary){
  const sec=el("div","rail-section");
  // For episode hubs, pull art from the grandparent show
  const first=items[0];
  const firstArt=first&&(first.art||first.grandparentArt||first.thumb);
  if(firstArt){const amb=el("div","rail-ambient");amb.style.backgroundImage=`url('${imgAmbient(firstArt)}')`;sec.appendChild(amb);}
  const head=el("div","rail-head");
  head.innerHTML=`<div class="rail-head-text">${libLabel?`<div class="rail-lib">${esc(libLabel)}</div>`:""}<h3>${esc(title)}</h3></div>`;
  sec.appendChild(head);
  if(summary&&getHubSummaries()){ const p=el("p","rail-summary"); p.textContent=summary; sec.appendChild(p); }
  const viewport=el("div","rail-viewport");
  const row=el("div","carousel");
  const bfrag=document.createDocumentFragment();
  items.forEach((it,i)=>bfrag.appendChild(billboardCard(it,numbered?i+1:null)));
  row.appendChild(bfrag);
  const prev=el("button","rail-arrow prev edge");prev.type="button";prev.setAttribute("aria-label","Scroll left");
  prev.innerHTML=svgIcon("caret-down");prev.firstChild.style.transform="rotate(90deg)";
  const next=el("button","rail-arrow next");next.type="button";next.setAttribute("aria-label","Scroll right");
  next.innerHTML=svgIcon("caret-down");next.firstChild.style.transform="rotate(-90deg)";
  viewport.appendChild(prev);viewport.appendChild(row);viewport.appendChild(next);
  wireRailArrows(viewport,row,prev,next);
  sec.appendChild(viewport);
  return sec;
}

/* ---- GENRE RAIL ---- */
const GENRE_CARDS_KEY="__genres__";
let _genreRailCache=null;
let _genrePageData=null;
async function fetchGenreData(){
  if(_genreRailCache) return _genreRailCache;
  const sec=sections.find(s=>s.type==="movie")||sections.find(s=>s.type==="show");
  if(!sec) return [];
  const [genresMc,itemsMc]=await Promise.all([
    api(`/library/sections/${sec.key}/genre`),
    api(`/library/sections/${sec.key}/all?sort=rating:desc&X-Plex-Container-Size=120`)
  ]);
  const genres=(genresMc.Directory||[]);
  const items=(itemsMc.Metadata||[]);
  const byGenre=new Map();
  items.forEach(it=>{
    (it.Genre||[]).forEach(g=>{
      if(!byGenre.has(g.tag)) byGenre.set(g.tag,[]);
      byGenre.get(g.tag).push(it);
    });
  });
  // Rank genres by how many top-rated items they have in our sample,
  // then take the 10 most-represented for the rail.
  const ranked=genres
    .map(g=>({g,candidates:byGenre.get(g.title)||[]}))
    .filter(x=>x.candidates.length>0)
    .sort((a,b)=>b.candidates.length-a.candidates.length)
    .slice(0,10);
  const result=[];
  for(const {g,candidates} of ranked){
    const pick=candidates[Math.floor(Math.random()*candidates.length)];
    const imgs=pick.Image||[];
    const sqImg=imgs.find(i=>i.type==="backgroundSquare");
    // Extract numeric genre ID from key (e.g. "/library/sections/1/all?genre=9" or
    // "/library/sections/1/genre/9") so the detail page can build its own clean URL
    // rather than forwarding g.key verbatim, which varies by server version.
    let genreId=null;
    try{ genreId=new URL(g.key,"https://x").searchParams.get("genre"); }catch(_){}
    if(!genreId){ const m=(g.key||"").match(/\/genres?\/(\d+)/); if(m) genreId=m[1]; }
    if(!genreId) genreId=g.ratingKey||null;
    result.push({name:g.title,genreId,sectionKey:sec.key,
      thumb:pick.thumb||pick.parentThumb,
      art:pick.art||pick.grandparentArt||pick.thumb,
      squareArt:(sqImg&&sqImg.url)||pick.thumb||pick.parentThumb});
  }
  _genreRailCache=result;
  return result;
}
function genreCard(g,style){
  const gc=genreColor(g.name);
  const artSrc=style==="billboard"?(g.art||g.thumb):(g.squareArt||g.thumb);
  const [w,h]=style==="billboard"?[560,315]:[400,400];
  const b=el("button","genre-card genre-card--"+style);
  b.style.setProperty("--gc",gc);
  b.innerHTML=`<div class="genre-art">${artSrc?`<img loading="lazy" alt="${esc(g.name)}" src="${img(artSrc,w,h)}" onerror="this.remove()">`:""}<div class="genre-fade"></div></div><div class="genre-label">${esc(g.name)}</div>`;
  b.onclick=()=>{ _genrePageData={title:g.name,genreId:g.genreId,sectionKey:g.sectionKey}; navigate("/genre"); };
  return b;
}
function genreRailSection(genreItems,style){
  if(style==="grid"){
    const sec=el("div","rail-section");
    const head=el("div","rail-head");
    head.innerHTML=`<div class="rail-head-text"><h3>Browse by Genre</h3></div>`;
    sec.appendChild(head);
    const grid=el("div","hub-grid");
    genreItems.forEach(g=>{
      const gc=genreColor(g.name);
      const src=img(g.squareArt||g.thumb,144,144);
      const btn=el("button","hub-grid-item");
      btn.style.setProperty("--gc",gc);
      btn.innerHTML=`<div class="genre-art hub-grid-art">${src?`<img loading="lazy" alt="" src="${src}" onerror="this.remove()">`:""}</div><span class="hub-grid-title">${esc(g.name)}</span>`;
      btn.onclick=()=>{_genrePageData={title:g.name,genreId:g.genreId,sectionKey:g.sectionKey};navigate("/genre");};
      grid.appendChild(btn);
    });
    sec.appendChild(grid);
    return sec;
  }
  const sec=el("div","rail-section");
  const head=el("div","rail-head");
  head.innerHTML=`<div class="rail-head-text"><h3>Browse by Genre</h3></div>`;
  const viewport=el("div","rail-viewport");
  const row=el("div","carousel");
  const frag=document.createDocumentFragment();
  genreItems.forEach(g=>frag.appendChild(genreCard(g,style)));
  row.appendChild(frag);
  const prev=el("button","rail-arrow prev edge"); prev.type="button"; prev.setAttribute("aria-label","Scroll left");
  prev.innerHTML=svgIcon("caret-down"); prev.firstChild.style.transform="rotate(90deg)";
  const nxt=el("button","rail-arrow next"); nxt.type="button"; nxt.setAttribute("aria-label","Scroll right");
  nxt.innerHTML=svgIcon("caret-down"); nxt.firstChild.style.transform="rotate(-90deg)";
  viewport.appendChild(prev); viewport.appendChild(row); viewport.appendChild(nxt);
  wireRailArrows(viewport,row,prev,nxt);
  sec.appendChild(head); sec.appendChild(viewport);
  return sec;
}
async function showGenrePage(){
  const {title,genreId,sectionKey}=_genrePageData||{};
  if(!title||!sectionKey) return showHome();
  setTitle(title); clearUltraBlur(); hideLibNav();
  const c=$("#content"); c.innerHTML=`<div class='loading'>Loading…</div>`;
  try{
    const filter=genreId||encodeURIComponent(title);
    const mc=await api(`/library/sections/${sectionKey}/all?genre=${filter}&sort=rating:desc&X-Plex-Container-Size=100`);
    const items=(mc.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type));
    c.innerHTML=pageHeadHTML(title);
    if(!items.length){ c.innerHTML+=`<div class='empty'>${svgIcon("movies")}No titles found.</div>`; return; }
    const grid=el("div","grid-view");
    const frag=document.createDocumentFragment();
    items.forEach(it=>frag.appendChild(card(it,false)));
    grid.appendChild(frag);
    c.appendChild(grid);

  }catch(e){ c.innerHTML=errHTML(e); }
}

/* ---- RAIL STYLE SETTINGS ----
   Three styles: 'poster' (2:3), 'billboard' (16:9), 'square' (1:1 + logo).
   Stored per hub-key in localStorage. Defaults: CW → billboard, rest → poster. */
function getRailStyles(){ return JSON.parse(localStorage.getItem(LS.railStyles)||"{}"); }
function getRailStyle(key){
  const s=getRailStyles()[key];
  if(key===GENRE_CARDS_KEY) return (s==="billboard"||s==="square"||s==="grid")?s:"square";
  if(s) return s;
  return /continue|on.?deck/i.test(key)?"billboard":"poster";
}
function setRailStyle(key,style){
  const s=getRailStyles(); s[key]=style; localStorage.setItem(LS.railStyles,JSON.stringify(s));
  pushRemoteSettings(); toast("Settings saved");
}
function carouselHubSection(hub){
  const sec=el("div","rail-section hub-carousel-section");
  const head=el("div","rail-head");
  head.innerHTML=`<div class="rail-head-text">${hub.lib?`<div class="rail-lib">${esc(hub.lib)}</div>`:""}<h3>${esc(hub.title)}</h3></div>`;
  sec.appendChild(head);
  if(hub.summary&&getHubSummaries()){ const p=el("p","rail-summary"); p.textContent=hub.summary; sec.appendChild(p); }
  const car=el("div","hub-carousel");
  const isCWHub=/continue|on.?deck/i.test(hub.key+hub.title);
  if(isCWHub) car.classList.add("cw-carousel");
  hub.items.forEach((it,i)=>{
    const slide=el("div","hub-cs-slide"+(i===0?" active":""));
    slide.innerHTML=heroInnerHTML(it,{kicker:false,priority:false});
    wireHero(slide,it);
    if(isCWHub&&it.type==="episode"&&it.thumb){
      const p=slide.querySelector(".hero-top .hero-summary");
      if(p){ const t=document.createElement("img"); t.className="cw-ep-thumb";
        t.src=img(it.thumb,680,382); t.alt=""; p.before(t); }
    }
    if(/trending/i.test(hub.key+' '+hub.title)){const rankEl=el("div","bill-rank");rankEl.textContent=i+1;slide.appendChild(rankEl);}
    car.appendChild(slide);
  });
  // Dots (always built; hidden on desktop for CW via CSS)
  const dots=el("div","hub-carousel-dots");
  hub.items.forEach((_,i)=>{ const d=el("button","hub-cd"+(i===0?" active":"")); d.setAttribute("aria-label",`Slide ${i+1}`); dots.appendChild(d); });
  car.appendChild(dots);
  // CW filmstrip replaces prev/next arrows on desktop
  let fsCards=[];
  if(isCWHub){
    const strip=el("div","cw-filmstrip");
    hub.items.forEach((it,i)=>{
      const thumb=it.type==="episode"?it.thumb:(it.art||it.thumb);
      const label=it.type==="episode"?(it.grandparentTitle||it.title):it.title;
      const pct=it.viewOffset&&it.duration?Math.round(it.viewOffset/it.duration*100):0;
      const btn=el("button","cw-fs-card"+(i===0?" active":""));
      btn.setAttribute("aria-label",label||"");
      btn.innerHTML=`<img loading="lazy" decoding="async" alt="${esc(label||"")}" src="${img(thumb,340,191)}">
        <div class="cw-fs-label">${esc(label||"")}</div>
        ${pct?`<div class="cw-fs-prog"><i style="width:${pct}%"></i></div>`:""}`;
      strip.appendChild(btn);
      fsCards.push(btn);
    });
    car.appendChild(strip);
  } else {
    const prev=el("button","hub-ca prev"); prev.innerHTML=svgIcon("caret-down"); prev.firstChild.style.transform="rotate(90deg)";
    const next=el("button","hub-ca next"); next.innerHTML=svgIcon("caret-down"); next.firstChild.style.transform="rotate(-90deg)";
    car.appendChild(prev); car.appendChild(next);
    // Arrow wiring added after goTo is defined below
    car._cwPrev=prev; car._cwNext=next;
  }
  sec.appendChild(car);
  const slides=Array.from(car.querySelectorAll(".hub-cs-slide"));
  const dotEls=Array.from(dots.querySelectorAll(".hub-cd"));
  const total=slides.length;
  const WIPE_DUR=500;
  const WIPE_EASE="cubic-bezier(.4,0,.2,1)";
  let cur=0, wiping=false;
  function goTo(i,fwd){
    if(wiping) return;
    const nxt=((i%total)+total)%total;
    if(nxt===cur) return;
    if(fwd===undefined) fwd=nxt>cur;
    if(cur===total-1&&nxt===0) fwd=true;
    if(cur===0&&nxt===total-1) fwd=false;
    wiping=true;
    const entering=slides[nxt], exiting=slides[cur];
    entering.style.transition="none";
    entering.style.transform=`translateX(${fwd?100:-100}%)`;
    entering.classList.add("active");
    entering.offsetWidth;
    const t=`transform ${WIPE_DUR}ms ${WIPE_EASE}`;
    entering.style.transition=t; exiting.style.transition=t;
    entering.style.transform="translateX(0)";
    exiting.style.transform=`translateX(${fwd?-100:100}%)`;
    dotEls[cur].classList.remove("active");
    if(fsCards.length){ fsCards[cur].classList.remove("active"); }
    cur=nxt;
    dotEls[cur].classList.add("active");
    if(fsCards.length){
      fsCards[cur].classList.add("active");
      fsCards[cur].scrollIntoView({behavior:"smooth",inline:"nearest",block:"nearest"});
    }
    setTimeout(()=>{
      exiting.classList.remove("active");
      exiting.style.transition="none";
      exiting.style.transform="translateX(0)";
      wiping=false;
    },WIPE_DUR);
  }
  let timer=setInterval(()=>goTo(cur+1,true),5000);
  const stop=()=>clearInterval(timer);
  const start=()=>{ stop(); timer=setInterval(()=>goTo(cur+1,true),5000); };
  _carouselCleanups.add(stop);
  if(car._cwPrev){ car._cwPrev.onclick=()=>{ stop(); goTo(cur-1,false); start(); }; }
  if(car._cwNext){ car._cwNext.onclick=()=>{ stop(); goTo(cur+1,true); start(); }; }
  fsCards.forEach((btn,i)=>{ btn.onclick=()=>{ stop(); goTo(i); start(); }; });
  dotEls.forEach((d,i)=>{ d.onclick=()=>{ stop(); goTo(i); start(); }; });
  car.addEventListener("mouseenter",stop); car.addEventListener("mouseleave",start);
  let _tx=null;
  car.addEventListener("touchstart",e=>{ stop(); _tx=e.touches[0].clientX; },{passive:true});
  car.addEventListener("touchend",e=>{
    if(_tx===null) return;
    const dx=e.changedTouches[0].clientX-_tx; _tx=null;
    if(Math.abs(dx)>48){ dx<0?goTo(cur+1,true):goTo(cur-1,false); }
    start();
  },{passive:true});
  return sec;
}
function gridHubSection(hub){
  const sec=el("div","rail-section");
  const first=hub.items[0];
  const firstArt=first&&(first.art||first.grandparentArt||first.thumb);
  if(firstArt){const amb=el("div","rail-ambient");amb.style.backgroundImage=`url('${imgAmbient(firstArt)}')`;sec.appendChild(amb);}
  const head=el("div","rail-head");
  head.innerHTML=`<div class="rail-head-text">${hub.lib?`<div class="rail-lib">${esc(hub.lib)}</div>`:""}<h3>${esc(hub.title)}</h3></div>`;
  sec.appendChild(head);
  if(hub.summary&&getHubSummaries()){const p=el("p","rail-summary");p.textContent=hub.summary;sec.appendChild(p);}
  const grid=el("div","hub-grid");
  hub.items.forEach(it=>{
    const btn=el("button","hub-grid-item");
    const thumb=img(it.thumb||it.parentThumb||it.grandparentThumb,144,144);
    btn.innerHTML=`<img class="hub-grid-thumb" loading="lazy" decoding="async" alt="${esc(it.title||'')}" src="${thumb}" onerror="this.style.opacity=0"><span class="hub-grid-title">${esc(it.title||'')}</span>`;
    btn.onclick=()=>{const r=pathForItem(it);if(r)navigate(r);else openItem(it);};
    grid.appendChild(btn);
  });
  sec.appendChild(grid);
  return sec;
}
function renderHubSection(hub,style){
  const sum=hub.summary||"";
  const isTrending=/trending/i.test(hub.key+' '+hub.title);
  if(style==="carousel") return carouselHubSection(hub);
  if(style==="grid") return gridHubSection(hub);
  if(style==="square") return squareBoardRailSection(hub.title,hub.items,hub.lib,isTrending,sum);
  const wide=style==="billboard"||hub.items.every(x=>x.type==="episode");
  const cm=hub.plexKey&&hub.plexKey.match(/\/library\/collections\/(\d+)/);
  const collId=cm?cm[1]:null;
  return railSection(hub.title,hub.items,wide,hub.featured||false,hub.lib,style==="poster"&&!wide,null,sum,collId,isTrending&&style==="billboard");
}

async function showHome(gen){
  setTitle("Home"); clearUltraBlur(); const c=$("#content"); c.innerHTML=skeletonHome();
  try{
    let cw=[];
    try{ cw=collectItems(await api("/hubs/continueWatching?count=24")); }catch(_){}
    const hubs=await api("/hubs?count=24");
    if(gen!==undefined&&gen!==_routeGen) return;
    const isDeckHub=h=>{
      const id=(h.hubIdentifier||"").toLowerCase(), t=(h.title||"").toLowerCase();
      return /continue|ondeck|on.?deck/.test(id) || t==="continue watching" || t==="on deck";
    };
    const videoHubs=(hubs.Hub||[]).filter(h=>!isDeckHub(h))
      .map(h=>{
        const first=h.Metadata&&h.Metadata[0];
        return {title:h.title, key:h.hubIdentifier||h.title,
          plexKey:h.key||"",
          items:(h.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type)),
          lib:(first&&first.librarySectionTitle)||"",
          summary:h.summary||""};
      })
      .filter(h=>h.items.length);

    c.innerHTML="";
    if(gen!==undefined&&gen!==_routeGen) return;

    const movieHubs=videoHubs.filter(h=>h.items[0]&&h.items[0].type==="movie");
    const tvHubs=videoHubs.filter(h=>!h.items[0]||h.items[0].type!=="movie");

    // Editorial hero — first movie item (or first hub item as fallback)
    const heroHub=movieHubs[0]||videoHubs[0];
    const heroItem=heroHub&&heroHub.items[0];
    if(heroItem){
      const h=await heroEl(heroItem);
      if(gen!==undefined&&gen!==_routeGen) return;
      c.appendChild(h);
    }

    // Continue Watching rail — shown below hero, header removed
    if(cw.length){
      const cwHub={title:"Continue Watching",key:"continue_watching",plexKey:"",items:cw,lib:"",featured:true,summary:""};
      const cwStyle=getRailStyle("continue_watching");
      const cwSec=renderHubSection(cwHub,cwStyle);
      cwSec.querySelector(".rail-head")?.remove();
      cwSec.querySelector(".rail-summary")?.remove();
      cwSec.style.paddingTop="0";
      c.appendChild(cwSec);
    }

    // First movie hub: editorial cards (skip the hero item to avoid duplication)
    if(heroHub&&heroHub.items[0]&&heroHub.items[0].type==="movie"){
      const editItems=heroHub.items.slice(1,5);
      if(editItems.length){
        const edSec=editorialSection(heroHub.title,editItems,heroHub.lib);
        edSec.dataset.hubId=heroHub.key;
        c.appendChild(edSec);
      }
    }

    // Remaining movie hubs: poster/billboard style
    const remainingMovieHubs=heroHub?movieHubs.filter(h=>h!==heroHub):movieHubs;
    remainingMovieHubs.slice(0,2).forEach(h=>{ const sec=renderHubSection(h,getRailStyle(h.key)); sec.dataset.hubId=h.key; c.appendChild(sec); });
    remainingMovieHubs.slice(2).forEach(h=>deferRail(h,gen,c));

    // Genre rail
    const genrePlaceholder=el("div","rail-ph");
    c.appendChild(genrePlaceholder);
    fetchGenreData().then(genres=>{
      if(!genres.length||gen!==_routeGen){genrePlaceholder.remove();return;}
      genrePlaceholder.replaceWith(genreRailSection(genres,getRailStyle(GENRE_CARDS_KEY)));
    }).catch(()=>genrePlaceholder.remove());

    // TV hubs deferred
    tvHubs.forEach(h=>deferRail(h,gen,c));

    // Collection summaries
    if(getHubSummaries()){
      [...remainingMovieHubs,...tvHubs].filter(h=>!h.summary&&h.plexKey.includes("/collections/")).forEach(async h=>{
        try{
          const m=h.plexKey.match(/\/library\/collections\/(\d+)/);
          if(!m) return;
          const coll=await api(`/library/collections/${m[1]}`);
          const s=(coll.Metadata&&coll.Metadata[0]&&coll.Metadata[0].summary)||"";
          if(!s||gen!==_routeGen) return;
          h.summary=s;
          const section=c.querySelector(`[data-hub-id="${h.key}"]`);
          if(!section) return;
          const head=section.querySelector(".rail-head");
          if(head&&!section.querySelector(".rail-summary")){
            const p=el("p","rail-summary"); p.textContent=s;
            head.insertAdjacentElement("afterend",p);
          }
        }catch(_){}
      });
    }
    if(!cw.length && !videoHubs.length)
      c.innerHTML=`<div class='empty'>${svgIcon("movies")}Nothing here yet. Add some media.</div>`;
    const saved=_scrollPos.get(location.href);
    if(saved) requestAnimationFrame(()=>{setScrollY(saved); _scrollPos.delete(location.href);});
    navDone();
    const allItems=[...cw,...videoHubs.flatMap(h=>h.items)].slice(0,8);
    (window.requestIdleCallback||setTimeout)(()=>allItems.forEach(it=>prefetchItem(it)));
  }catch(e){ if(gen===undefined||gen===_routeGen) c.innerHTML=errHTML(e); }
}
function collectItems(mc){
  if(mc.Metadata) return mc.Metadata.filter(x=>VIDEO_TYPES.includes(x.type));
  if(mc.Hub){ let a=[]; mc.Hub.forEach(h=>a=a.concat(h.Metadata||[])); return a.filter(x=>VIDEO_TYPES.includes(x.type)); }
  return [];
}

/* ---- HERO ---- */
function getHeroStyle(){ return localStorage.getItem(LS.heroStyle)||"backdrop"; }
function getHubSummaries(){ return localStorage.getItem(LS.hubSummaries)==="1"; }
function getWatchedBadges(){ return localStorage.getItem(LS.watchedBadges)!=="0"; }
function getSpoilerBlur(){ return localStorage.getItem(LS.spoilerBlur)==="1"; }
/* Shared hero markup + wiring, reused by the home hero and the hub carousel
   slides so both render the same layout (logo top-left, ratings + metadata,
   summary, actions at the bottom). */
function heroInnerHTML(it,opts={}){
  const {priority=true,full=true,kicker=false}=opts;
  const isEp=it.type==="episode";
  const title=isEp?(it.grandparentTitle||it.title):it.title;
  const tagline=!isEp&&it.tagline?it.tagline:"";
  let metaBlock="";
  if(full){
    const year=it.year||(it.originallyAvailableAt||"").slice(0,4);
    const meta=isEp
      ? `S${it.parentIndex||0} · E${it.index||0} · ${esc(it.title||"")}`
      : [year,fmtDur(it.duration),it.contentRating].filter(Boolean).join(" · ");
    const ratingBadges=ratingBadgesHTML(it);
    const ratingFallback=ratingBadges?"":(it.rating?`<span class="pill">${svgIcon("star-fill","","color:var(--accent)")} ${(+it.rating).toFixed(1)}</span>`:"");
    metaBlock=`${ratingBadges?`<div class="ratings-row">${ratingBadges}</div>`:""}
      <div class="hero-meta">${ratingFallback}<span>${esc(meta)}</span></div>
      <p class="hero-summary">${esc(it.summary||"")}</p>`;
  }
  return `
    <div class="hero-bg"><div class="hero-bg-blur"></div><img class="hero-bg-img" decoding="async" ${priority?'fetchpriority="high"':'loading="lazy"'} alt=""></div>
    <div class="hero-scrim"></div>
    <div class="hero-top">
      ${kicker?`<div class="hero-kicker">${it.viewOffset?svgIcon("play-circle-fill"):svgIcon("sparkle-fill")}${it.viewOffset?'Continue Watching':'Featured'}</div>`:""}
      ${titleArtHTML(it,title)}
      ${tagline?`<p class="hero-tagline">${esc(tagline)}</p>`:""}
      ${metaBlock}
    </div>
    <div class="hero-bottom">
      <div class="hero-actions">
        <button class="btn lg hero-play">${svgIcon("play-fill")} ${it.viewOffset?"Resume":"Play"}</button>
        ${full?`<button class="btn glass lg hero-info">${svgIcon("info")} Details</button>`:""}
      </div>
    </div>`;
}
function wireHero(wrap,it,opts={}){
  const isEp=it.type==="episode";
  const art=it.art||it.grandparentArt||it.parentArt||it.thumb;
  wrap.querySelector(".hero-bg-blur").style.backgroundImage=`url('${imgAmbient(art)}')`;
  const bgImg=wrap.querySelector(".hero-bg-img");
  bgImg.onload=()=>bgImg.classList.add("loaded");
  bgImg.onerror=()=>bgImg.remove();
  bgImg.src=img(art,1920,1080);
  applyBackdropContrast(wrap,art);
  const goToDetail=()=>{
    const target=isEp?{ratingKey:it.grandparentRatingKey,type:"show"}:it;
    const r=pathForItem(target); if(r) navigate(r); else openItem(target);
  };
  const playBtn=wrap.querySelector(".hero-play");
  if(playBtn) playBtn.onclick=e=>{e.stopPropagation();playItem(it,it.viewOffset||0);};
  const infoBtn=wrap.querySelector(".hero-info");
  if(infoBtn) infoBtn.onclick=goToDetail;
  // Standalone .hero background tap navigates to detail (two-tap-to-play)
  if(wrap.classList.contains("hero")){
    wrap.addEventListener("click",e=>{
      if(e.target.closest(".hero-play")||e.target.closest(".hero-trailer-ctrls")) return;
      goToDetail();
    });
  }
}
async function heroEl(it){
  const wrap=el("div","hero");
  wrap.innerHTML=heroInnerHTML(it,{full:false});
  setTimeout(()=>wireHero(wrap,it),0);
  setupHeroTrailer(wrap,it);
  return wrap;
}

let heroVideoEl=null, heroVideoToken=0;
function cleanupHeroVideo(){
  heroVideoToken++;
  if(heroVideoEl){ heroVideoEl.pause(); heroVideoEl.removeAttribute("src"); heroVideoEl.load(); heroVideoEl=null; }
}
async function setupHeroTrailer(wrap,it){
  const token=++heroVideoToken;
  try{
    const rk=it.type==="episode"?it.grandparentRatingKey:it.ratingKey;
    if(!rk) return;
    const extras=await fetchExtras(rk);
    if(token!==heroVideoToken) return;
    let trailer=extras.find(e=>/trailer/i.test(e.subtype||""));
    if(!trailer) return;
    if(!partOf(trailer)){
      const mc=await api(`/library/metadata/${trailer.ratingKey}`);
      if(token!==heroVideoToken) return;
      trailer=(mc.Metadata||[])[0]||trailer;
    }
    const part=partOf(trailer);
    if(!part||!part.key) return;
    const video=document.createElement("video");
    video.className="hero-video"; video.muted=true; video.loop=true; video.autoplay=true;
    video.playsInline=true; video.preload="auto"; video.setAttribute("aria-hidden","true");
    const ctrls=el("div","hero-trailer-ctrls");
    ctrls.innerHTML=`<button class="pbtn" id="heroMute" aria-label="Unmute trailer">${svgIcon("speaker-none")}</button>
      <button class="pbtn" id="heroClose" aria-label="Stop trailer preview">${svgIcon("x")}</button>`;
    let revealed=false;
    const reveal=()=>{
      if(revealed||token!==heroVideoToken) return; revealed=true;
      video.classList.add("show"); ctrls.classList.add("show");
      video.play().catch(()=>{});
    };
    video.addEventListener("canplay",()=>setTimeout(reveal,1200));
    video.addEventListener("error",()=>{
      if(heroVideoEl===video) heroVideoEl=null;
      video.remove(); ctrls.remove();
    });
    const muteBtn=ctrls.querySelector("#heroMute");
    muteBtn.onclick=()=>{
      video.muted=!video.muted;
      setSvgIcon(muteBtn,video.muted?"speaker-none":"speaker-high");
      muteBtn.setAttribute("aria-label",video.muted?"Unmute trailer":"Mute trailer");
    };
    ctrls.querySelector("#heroClose").onclick=()=>{
      cleanupHeroVideo();
      video.remove(); ctrls.remove();
    };
    wrap.querySelector(".hero-scrim").insertAdjacentElement("beforebegin",video);
    wrap.appendChild(ctrls);
    video.src=`${server.uri}${part.key}?X-Plex-Token=${server.token}`;
    heroVideoEl=video;
  }catch(_){}
}

/* ---- RAIL SECTION ----
   Each rail gets its own subtle UltraBlur color wash, derived from its
   first item's art, plus an optional small "library" kicker label. */
function railSection(title,items,wide,featured,libLabel,seeAll,actorThumb,summary,collId,numbered){
  const sec=el("div","rail-section"+(featured?" featured":""));
  const firstArt=items[0]&&(items[0].art||items[0].grandparentArt||items[0].thumb||items[0].parentThumb);
  if(firstArt){
    const amb=el("div","rail-ambient");
    amb.style.backgroundImage=`url('${imgAmbient(firstArt)}')`;
    sec.appendChild(amb);
  }
  const showSeeAllBtn=seeAll||collId;
  // Split "More with/from/in [Name]" into a small prefix kicker + the name
  const prefixM=(title||"").match(/^(More (?:with|from|in|like)|Also in|Related to)\s+/i);
  const railPrefix=prefixM?prefixM[1]:null;
  const railTitle=prefixM?title.slice(prefixM[0].length).trim():title;
  const head=el("div","rail-head"+(actorThumb?" with-avatar":""));
  head.innerHTML=`<div class="rail-head-text">`
    +`${libLabel?`<div class="rail-lib">${esc(libLabel)}</div>`:""}`
    +`${railPrefix?`<div class="rail-lib">${esc(railPrefix)}</div>`:""}`
    +`<h3>${esc(railTitle)}</h3></div>`
    +`${actorThumb?`<div class="rail-head-avatar"><img loading="lazy" alt="" src="${img(actorThumb,96,96)}"></div>`:""}`
    +`${showSeeAllBtn?`<button class="see-all">See All ${svgIcon("arrow-right")}</button>`:""}`;
  if(showSeeAllBtn) head.querySelector(".see-all").onclick=()=>{
    if(collId){ navigate("/collection/"+collId); return; }
    seeAllCache={title,items,wide,libLabel,summary}; navigate("/see-all");
  };
  sec.appendChild(head);
  if(summary&&getHubSummaries()){ const p=el("p","rail-summary"); p.textContent=summary; sec.appendChild(p); }
  const viewport=el("div","rail-viewport");
  const row=el("div","carousel");
  const rfrag=document.createDocumentFragment();
  items.forEach((it,i)=>{const c=card(it,wide);if(numbered){const r=el("div","bill-rank");r.textContent=i+1;const a=c.querySelector(".art");if(a)a.appendChild(r);}rfrag.appendChild(c);});
  row.appendChild(rfrag);
  const prev=el("button","rail-arrow prev edge"); prev.type="button"; prev.setAttribute("aria-label","Scroll left");
  prev.innerHTML=svgIcon("caret-down"); prev.firstChild.style.transform="rotate(90deg)";
  const next=el("button","rail-arrow next"); next.type="button"; next.setAttribute("aria-label","Scroll right");
  next.innerHTML=svgIcon("caret-down"); next.firstChild.style.transform="rotate(-90deg)";
  viewport.appendChild(prev); viewport.appendChild(row); viewport.appendChild(next);
  wireRailArrows(viewport,row,prev,next);
  sec.appendChild(viewport);
  return sec;
}
// Show/scroll a rail's prev/next arrows. Arrows only appear when the rail
// overflows (CSS .has-overflow), and the arrow at the current edge is hidden.
function wireRailArrows(viewport,carousel,prev,next){
  const update=()=>{
    const max=carousel.scrollWidth-carousel.clientWidth;
    viewport.classList.toggle("has-overflow",max>4);
    prev.classList.toggle("edge",carousel.scrollLeft<=2);
    next.classList.toggle("edge",carousel.scrollLeft>=max-2);
  };
  const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  const page=dir=>carousel.scrollBy({left:dir*Math.max(240,carousel.clientWidth*0.9),behavior:reducedMotion()?"instant":"smooth"});
  prev.onclick=()=>page(-1);
  next.onclick=()=>page(1);
  carousel.addEventListener("scroll",update,{passive:true});
  if(window.ResizeObserver) new ResizeObserver(update).observe(carousel);
  requestAnimationFrame(update);
}
/* Defer off-screen rail rendering: insert a placeholder, swap it for the
   real section when it's ~400px from the viewport. Data is already in
   memory (fetched upfront), so the swap is synchronous and instant. */
function deferRail(hub,gen,c){
  const ph=el("div","rail-ph"); c.appendChild(ph);
  const obs=new IntersectionObserver(entries=>{
    if(!entries[0].isIntersecting) return;
    obs.disconnect();
    if(gen!==undefined&&gen!==_routeGen){ph.remove();return;}
    const sec=renderHubSection(hub,getRailStyle(hub.key));
    sec.dataset.hubId=hub.key;
    ph.replaceWith(sec);
  },{rootMargin:"400px 0px"});
  obs.observe(ph);
}
/* Warm the detail-metadata cache when a card is hovered/focused so the
   subsequent click renders instantly (native-app feel). A short delay +
   dedupe keeps a fast mouse-sweep across a rail from spamming the server. */
const _prefetched=new Set();
function prefetchItem(it){
  if(!it||!it.ratingKey||!server) return;
  if(!(it._collection||/^(movie|show|episode|collection)$/.test(it.type||""))) return;
  const key=it.ratingKey, path=`/library/metadata/${key}`;
  if(_prefetched.has(path)) return;
  _prefetched.add(path);
  // Warm metadata + the supporting rails openMovie/openShow need, so the
  // detail page renders from cache when the user taps instead of waiting.
  api(path,{_bg:true}).catch(()=>_prefetched.delete(path));
  if(it.type==="movie"){
    api(`/library/metadata/${key}/extras`,{_bg:true}).catch(()=>{});
    api(`/library/metadata/${key}/related?count=24`,{_bg:true}).catch(()=>{});
  }else if(it.type==="show"||it.type==="episode"){
    const showKey=it.type==="episode"?(it.grandparentRatingKey||key):key;
    api(`/library/metadata/${showKey}/children`,{_bg:true}).catch(()=>{});
  }
}
function wireCardPrefetch(b,it){
  let t=null;
  b.addEventListener("pointerenter",()=>{ t=setTimeout(()=>prefetchItem(it),140); });
  b.addEventListener("pointerleave",()=>clearTimeout(t));
  b.addEventListener("focus",()=>prefetchItem(it));
}
function card(it,wide,square){
  if(it.type==="person"){
    const b=el("button","card person-card");
    const src=it.thumb?img(it.thumb,220,220):"";
    b.innerHTML=`<div class="art person-art">${src?`<img loading="lazy" alt="${esc(it.title||it.tag||"")}" src="${src}" onerror="this.closest('.art').classList.add('broken')">`:""}
      <span class="art-fallback">${svgIcon("user-switch")}</span></div>
      <div class="ct">${esc(it.title||it.tag||"")}</div><div class="cs">Person</div>`;
    b.onclick=()=>goToActor(it.ratingKey,it.tag||it.title,it.thumb);
    return b;
  }
  const b=el("button","card"+(wide?" wide":"")+(square?" square":""));
  const ep=it.type==="episode";
  const useWide = wide || ep;
  const thumb = square ? (it.thumb||it.composite||it.parentThumb)
    : ep ? (it.thumb||it.parentThumb)
    : useWide ? (it.art||it.grandparentArt||it.thumb||it.parentThumb)
    : (it.thumb||it.parentThumb);
  const pct = it.viewOffset&&it.duration ? (it.viewOffset/it.duration*100) : 0;
  const title = ep ? (it.title||it.grandparentTitle||"") : (it.title||"");
  const sub = ep ? `${it.grandparentTitle||""} · S${it.parentIndex||0}E${it.index||0}`
    : it._collection ? "Collection"
    : it.type==="playlist" ? `${it.leafCount||0} items`
    : [it.year, it.type==="show"?`${it.childCount||it.leafCount||""} Seasons`:""].filter(Boolean).join(" · ");
  const dim = square ? 320 : (useWide?480:340);
  const dim2 = square ? 320 : (useWide?270:510);
  const src=img(thumb,dim,dim2);
  const mosaic=src?"":mosaicHTML(it._mosaicItems);
  const fallbackIconHTML = it._collection ? `<span class="art-fallback">${svgIcon("stack-fill")}</span>`
    : `<span class="art-fallback">${svgIcon(it.type==="playlist"?"playlist":it.type==="show"?"television":"movies")}</span>`;
  let badge="";
  if(!pct && !it._collection && it.type!=="playlist" && getWatchedBadges()){
    if(it.type==="show"){
      const unseen=(it.leafCount||0)-(it.viewedLeafCount||0);
      if(unseen>0) badge=`<div class="unwatched-badge">${unseen}</div>`;
      else if((it.viewedLeafCount||0)>0) badge=`<div class="watched-check" aria-hidden="true">${svgIcon("check-circle-fill")}</div>`;
    }else if(!it.viewCount){
      badge=`<div class="unwatched-dot" aria-hidden="true"></div>`;
    }else{
      badge=`<div class="watched-check" aria-hidden="true">${svgIcon("check-circle-fill")}</div>`;
    }
  }
  const blurArt=ep&&!it.viewCount&&getSpoilerBlur();
  b.innerHTML=`
    <div class="art${src||mosaic?"":" broken"}${blurArt?" ep-blur":""}">
      ${src?`<img class="${useWide&&!square?"wide":""}" loading="lazy" decoding="async" alt="${esc(title)}"
        src="${src}" onerror="this.closest('.art').classList.add('broken')">`:mosaic}
      ${fallbackIconHTML}
      <div class="play-hover">${svgIcon("play-circle-fill")}</div>
      ${badge}
      ${pct?`<div class="watch-prog"><i style="width:${pct}%"></i></div>`:""}
    </div>
    <div class="ct">${esc(title)}</div>
    <div class="cs">${esc(sub)}</div>`;
  // If a composite cover fails to load but we have the items, degrade to a
  // mosaic rather than a bare placeholder icon (playlist/collection covers).
  if(src && it._mosaicItems && it._mosaicItems.length){
    const im=b.querySelector(".art > img");
    if(im) im.addEventListener("error",()=>{
      const mo=mosaicHTML(it._mosaicItems); if(!mo) return;
      const art=im.closest(".art"); art.classList.remove("broken");
      im.insertAdjacentHTML("beforebegin",mo); im.remove();
    },{once:true});
  }
  b.onclick=()=>{
    if(it.type==="person"){ goToActor(it.ratingKey,it.tag||it.title,it.thumb); return; }
    const r=pathForItem(it); if(r) navigate(r); else openItem(it);
  };
  wireCardPrefetch(b,it);
  return b;
}

/* ============================================================ EDITORIAL CARD
   Magazine-style featured item: 1:1 square art on the left, large bold title
   overlapping the image/background boundary, right-aligned meta + summary.
   Two-tap rule: tapping navigates to the detail page, not directly to playback. */
function editorialCard(it){
  const b=el("button","editorial-card");
  b.setAttribute("type","button");
  const isEp=it.type==="episode";
  const title=isEp?(it.grandparentTitle||it.title):it.title;
  const art=it.thumb||it.parentThumb||it.grandparentArt||it.art;
  const imgSrc=art?img(art,640,640):"";
  const year=it.year||(it.originallyAvailableAt||"").slice(0,4);
  const metaParts=[year,it.contentRating,
    it.type==="show"?(it.childCount>1?`${it.childCount} Seasons`:(it.childCount===1?"1 Season":"")):"",
  ].filter(Boolean);
  const logo=(it.Image||[]).find(i=>i.type==="clearLogo");
  const titleHTML=logo
    ? `<img class="ec-logo" src="${imgLogo(logo.url,560,200)}" alt="${esc(title)}">`
    : `<h3>${esc(title)}</h3>`;
  b.innerHTML=`
    <div class="ec-art">
      ${imgSrc?`<img loading="lazy" decoding="async" alt="${esc(title)}" src="${imgSrc}" onerror="this.closest('.ec-art').classList.add('broken')">`:""}
      <span class="art-fallback">${svgIcon(it.type==="show"?"television":"movies")}</span>
    </div>
    <div class="ec-title">${titleHTML}</div>
    <div class="ec-meta">
      ${metaParts.length?`<div class="ec-label">${esc(metaParts.join(" · "))}</div>`:""}
      ${it.summary?`<p class="ec-summary">${esc(it.summary)}</p>`:""}
    </div>`;
  b.onclick=()=>{const r=pathForItem(it);if(r)navigate(r);else openItem(it);};
  wireCardPrefetch(b,it);
  return b;
}
function editorialSection(title,items,libLabel){
  const sec=el("div","editorial-section");
  if(title){
    const head=el("div","editorial-head");
    head.innerHTML=`${libLabel?`<div class="rail-lib">${esc(libLabel)}</div>`:""}<h2>${esc(title)}</h2>`;
    sec.appendChild(head);
  }
  const frag=document.createDocumentFragment();
  items.slice(0,4).forEach(it=>frag.appendChild(editorialCard(it)));
  sec.appendChild(frag);
  return sec;
}

/* ============================================================ SEE ALL
   Destination for a rail's "See All" button — shows only that rail's own
   items (not the whole library), populated from seeAllCache. */
function showSeeAll(){
  const cache=seeAllCache;
  if(!cache) return showHome();
  setTitle(cache.title); clearUltraBlur();
  const c=$("#content");
  c.innerHTML=pageHeadHTML(cache.title,cache.items.length,cache.libLabel);
  if(cache.summary){ const p=el("p","rail-summary"); p.textContent=cache.summary; c.appendChild(p); }
  const grid=el("div","grid-view"); c.appendChild(grid);
  cache.items.forEach(it=>grid.appendChild(card(it,cache.wide)));
}

/* ============================================================ LIBRARY */
const LIB_SORTS=[
  {key:"added",  label:"Recently Added",   icon:"clock-counter-clockwise"},
  {key:"title",  label:"Title (A–Z)",      icon:"sort-ascending"},
  {key:"year",   label:"Release Year",     icon:"calendar-blank"},
  {key:"rating", label:"Rating",           icon:"star-fill"},
  {key:"watched",label:"Recently Watched", icon:"eye"},
];
const LIB_FILTERS=[
  {key:"all",       label:"All"},
  {key:"unwatched", label:"Unwatched"},
  {key:"inprogress",label:"In Progress"},
  {key:"watched",   label:"Watched"},
];
let libState=null;
let seeAllCache=null;
/* ---- LIBRARY TABS (Recommended / Library, like Plex) ---- */
function libTabsHTML(section,active){
  return `<div class="lib-tabs">
    <button class="lib-tab${active==="recommended"?" active":""}" data-href="/library/${section.key}">Recommended</button>
    <button class="lib-tab${active==="all"?" active":""}" data-href="/library/${section.key}/all">Library</button>
  </div>`;
}
function wireLibTabs(c){ c.querySelectorAll(".lib-tab[data-href]").forEach(b=>{ b.onclick=()=>navigate(b.dataset.href); }); }
function showLibNav(section,active){
  const nav=$("#libNav"); if(!nav) return;
  nav.innerHTML=`<span id="libNavName">${esc(section.title)}</span><div class="lib-nav-tabs">`
    +[{k:"recommended",l:"Recommended",h:`/library/${section.key}`},
      {k:"all",l:"Library",h:`/library/${section.key}/all`},
      {k:"collections",l:"Collections",h:`/library/${section.key}/collections`},
    ].map(t=>`<button class="lib-nav-tab${active===t.k?" active":""}" data-href="${t.h}"><span class="frost-text">${t.l}</span></button>`).join("")
    +"</div>";
  nav.querySelectorAll(".lib-nav-tab").forEach(b=>b.onclick=()=>navigate(b.dataset.href));
  nav.classList.add("visible");
}
function hideLibNav(){ const n=$("#libNav"); if(n) n.classList.remove("visible"); }
/* ---- LIBRARY RECOMMENDED ----
   Curated per-library hubs (Recently Added, Recently Released, etc.),
   the default landing page for a library — mirrors Plex's own UI. */
async function showLibraryRecommended(section,gen){
  setTitle(section.title); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const hubs=await api(`/hubs/sections/${section.key}?count=24`);
    if(gen!==undefined&&gen!==_routeGen) return;
    const videoHubs=(hubs.Hub||[])
      .map(h=>({title:h.title, items:(h.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type))}))
      .filter(h=>h.items.length);
    showLibNav(section,"recommended");
    c.innerHTML="";
    if(!videoHubs.length){
      const empty=el("div","empty");
      empty.innerHTML=`${svgIcon("sparkle-fill")}No recommendations yet.
        <div style="margin-top:14px"><button class="btn glass sm" id="libGoAll">Browse all ${esc(section.type==="show"?"shows":"movies")}</button></div>`;
      c.appendChild(empty);
      $("#libGoAll").onclick=()=>navigate(`/library/${section.key}/all`);
    }else{
      videoHubs.forEach(h=>{
        const wide=h.items.every(x=>x.type==="episode");
        c.appendChild(railSection(h.title,h.items,wide,false,undefined,!wide));
      });
    }
    const saved=_scrollPos.get(location.href);
    if(saved) requestAnimationFrame(()=>{setScrollY(saved); _scrollPos.delete(location.href);});
  }catch(e){ if(gen===undefined||gen===_routeGen) c.innerHTML=errHTML(e); }
}
async function showLibrary(section,gen){
  setTitle(section.title); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const all=await api(`/library/sections/${section.key}/all`);
    if(gen!==undefined&&gen!==_routeGen) return;
    showLibNav(section,"all");
    const items=all.Metadata||[];
    const genreSet=new Set();
    items.forEach(it=>(it.Genre||[]).forEach(g=>g.tag&&genreSet.add(g.tag)));
    const genres=[...genreSet].sort((a,b)=>a.localeCompare(b));
    libState={section,items,genres,sort:"added",filter:"all",genre:""};
    c.innerHTML="";
    const wrap=el("div","lib-wrap");
    wrap.innerHTML=libToolbarHTML(section)+`<div class="grid-view" id="libGrid"></div>`;
    c.appendChild(wrap);
    wireLibToolbar();
    renderLibGrid();
  }catch(e){ c.innerHTML=errHTML(e); }
}
async function showLibraryCollections(section,gen){
  setTitle(section.title); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  showLibNav(section,"collections");
  try{
    const colls=await api(`/library/sections/${section.key}/collections`).catch(()=>({}));
    if(gen!==undefined&&gen!==_routeGen) return;
    const items=(colls.Metadata||colls.Directory||[]).map(x=>({...x,_collection:true}));
    c.innerHTML="";
    if(!items.length){ c.innerHTML=`<div class='empty'>${svgIcon("stack-fill")}No collections in this library.</div>`; return; }
    const grid=el("div","grid-view lib-page");
    const frag=document.createDocumentFragment();
    items.forEach(it=>frag.appendChild(card(it)));
    grid.appendChild(frag);
    c.appendChild(grid);
  }catch(e){ c.innerHTML=errHTML(e); }
}
async function showLibraryPlaylists(section,gen){
  setTitle(section.title); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  showLibNav(section,"playlists");
  try{
    const mc=await api("/playlists");
    let pls=(mc.Metadata||[]).filter(p=>p.playlistType==="video");
    await Promise.all(pls.map(async p=>{
      try{
        const ic=await api(`/playlists/${p.ratingKey}/items?X-Plex-Container-Size=4`);
        p._mosaicItems=(ic.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type));
      }catch(_){ p._mosaicItems=[]; }
    }));
    if(gen!==undefined&&gen!==_routeGen) return;
    const sk=String(section.key);
    const filtered=pls.filter(p=>(p._mosaicItems||[]).some(it=>
      String(it.librarySectionID||it.librarySectionKey||"")===sk||
      String(it.librarySectionTitle||"")===section.title));
    const show=filtered.length?filtered:pls;
    c.innerHTML="";
    if(!show.length){ c.innerHTML=`<div class='empty'>${svgIcon("playlist")}No video playlists.</div>`; return; }
    const grid=el("div","grid-view lib-page");
    const frag=document.createDocumentFragment();
    show.forEach(p=>frag.appendChild(card(p,false,true)));
    grid.appendChild(frag);
    c.appendChild(grid);
  }catch(e){ if(gen===undefined||gen===_routeGen) c.innerHTML=errHTML(e); }
}
function libToolbarHTML(section){
  const sort=LIB_SORTS.find(s=>s.key===libState.sort)||LIB_SORTS[0];
  const filter=LIB_FILTERS.find(f=>f.key===libState.filter)||LIB_FILTERS[0];
  const menu=(items,kind,cur)=>items.map(o=>{
    const v=o.key!==undefined?o.key:o;
    return `<button data-${kind}="${esc(v)}" class="${v===cur?"active":""}" role="menuitemradio" aria-checked="${v===cur}">
      ${svgIcon("check","ck")}<span class="ml">${esc(o.label!==undefined?o.label:(v||"All Genres"))}</span></button>`;
  }).join("");
  const genreCtrl=libState.genres.length?`
    <div class="lib-ctrl-wrap" id="libGenreWrap">
      <button class="lib-ctrl" id="libGenreBtn" aria-haspopup="true" aria-expanded="false">
        ${svgIcon("tag","lead")}<span id="libGenreCap">${libState.genre?esc(libState.genre):"All Genres"}</span>
        ${svgIcon("caret-down","caret")}</button>
      <div class="lib-menu" role="menu">${menu([{key:"",label:"All Genres"},...libState.genres.map(g=>({key:g,label:g}))],"genre",libState.genre)}</div>
    </div>`:"";
  return `<div class="lib-toolbar">
    <span class="lib-title">All ${section.type==="show"?"Shows":"Movies"}</span>
    <span class="lib-count" id="libCount"></span>
    <span class="spacer"></span>
    <div class="lib-ctrl-wrap" id="libSortWrap">
      <button class="lib-ctrl" id="libSortBtn" aria-haspopup="true" aria-expanded="false">
        ${svgIcon(sort.icon,"lead")}<span class="cap">Sort:</span> <span id="libSortCap">${esc(sort.label)}</span>
        ${svgIcon("caret-down","caret")}</button>
      <div class="lib-menu" role="menu">${menu(LIB_SORTS,"sort",libState.sort)}</div>
    </div>
    <div class="lib-ctrl-wrap" id="libFilterWrap">
      <button class="lib-ctrl" id="libFilterBtn" aria-haspopup="true" aria-expanded="false">
        ${svgIcon("funnel","lead")}<span class="cap">Show:</span> <span id="libFilterCap">${esc(filter.label)}</span>
        ${svgIcon("caret-down","caret")}</button>
      <div class="lib-menu" role="menu">${menu(LIB_FILTERS,"filter",libState.filter)}</div>
    </div>
    ${genreCtrl}
  </div>`;
}
function wireLibToolbar(){
  ["libSortWrap","libFilterWrap","libGenreWrap"].forEach(id=>{
    const w=$("#"+id); if(!w) return;
    const btn=w.querySelector(".lib-ctrl");
    btn.onclick=e=>{ e.stopPropagation();
      const open=w.classList.contains("open"); closeLibMenus();
      if(!open){ w.classList.add("open"); btn.setAttribute("aria-expanded","true"); } };
    w.querySelectorAll(".lib-menu button").forEach(b=>{
      b.onclick=()=>{
        if("sort" in b.dataset) libState.sort=b.dataset.sort;
        else if("filter" in b.dataset) libState.filter=b.dataset.filter;
        else if("genre" in b.dataset) libState.genre=b.dataset.genre;
        closeLibMenus(); updateLibControls(); renderLibGrid();
      };
    });
  });
}
function closeLibMenus(){ document.querySelectorAll(".lib-ctrl-wrap.open").forEach(w=>{
  w.classList.remove("open"); const b=w.querySelector(".lib-ctrl"); if(b) b.setAttribute("aria-expanded","false"); }); }
function updateLibControls(){
  const sort=LIB_SORTS.find(s=>s.key===libState.sort)||LIB_SORTS[0];
  const filter=LIB_FILTERS.find(f=>f.key===libState.filter)||LIB_FILTERS[0];
  const set=(sel,txt)=>{const e=$(sel);if(e)e.textContent=txt;};
  set("#libSortCap",sort.label); set("#libFilterCap",filter.label); set("#libGenreCap",libState.genre||"All Genres");
  const si=$("#libSortBtn .lead"); if(si) si.className="ph "+sort.icon+" lead";
  const sync=(id,attr,cur)=>{ const w=$("#"+id); if(!w) return;
    w.querySelectorAll(".lib-menu button").forEach(b=>{
      const on=(b.dataset[attr]||"")===cur; b.classList.toggle("active",on); b.setAttribute("aria-checked",on); }); };
  sync("libSortWrap","sort",libState.sort); sync("libFilterWrap","filter",libState.filter); sync("libGenreWrap","genre",libState.genre);
}
function renderLibGrid(){
  const grid=$("#libGrid"); if(!grid||!libState) return;
  const f=libState.filter, g=libState.genre;
  let items=libState.items.filter(it=>{
    if(g && !(it.Genre||[]).some(x=>x.tag===g)) return false;
    if(f==="all") return true;
    const isShow=it.type==="show", wc=it.viewedLeafCount||0, total=it.leafCount||0;
    if(f==="inprogress") return isShow ? (wc>0&&wc<total) : (it.viewOffset>0);
    if(f==="watched")    return isShow ? (total>0&&wc>=total) : (it.viewCount>0&&!it.viewOffset);
    if(f==="unwatched")  return isShow ? (wc===0) : (!it.viewCount&&!it.viewOffset);
    return true;
  });
  const val={
    added:  it=>it.addedAt||0,
    title:  it=>(it.titleSort||it.title||"").toLowerCase(),
    year:   it=>it.year||parseInt((it.originallyAvailableAt||"").slice(0,4))||0,
    rating: it=>it.rating||it.audienceRating||0,
    watched:it=>it.lastViewedAt||0,
  }[libState.sort]||(it=>it.addedAt||0);
  items.sort((a,b)=> libState.sort==="title"
    ? String(val(a)).localeCompare(String(val(b)))
    : (val(b)-val(a)));
  grid.innerHTML="";
  const cnt=$("#libCount"); if(cnt) cnt.textContent=`${items.length} ${items.length===1?"title":"titles"}`;
  if(!items.length){ grid.innerHTML=`<div class='empty' style='grid-column:1/-1'>${svgIcon("funnel")}No titles match these filters.</div>`; return; }
  const BATCH=60;
  let offset=0;
  const renderBatch=()=>{
    const frag=document.createDocumentFragment();
    items.slice(offset,offset+BATCH).forEach(it=>frag.appendChild(card(it)));
    grid.appendChild(frag);
    offset+=BATCH;
    if(offset<items.length){
      const sentinel=el("div"); sentinel.style.cssText="height:1px;grid-column:1/-1";
      grid.appendChild(sentinel);
      const obs=new IntersectionObserver(en=>{
        if(!en[0].isIntersecting) return;
        obs.disconnect(); sentinel.remove(); renderBatch();
      },{rootMargin:"300px"});
      obs.observe(sentinel);
    }
  };
  renderBatch();
}

/* ============================================================ PLAYLISTS */
/* ---- SETTINGS PAGE ---- */
async function showSettings(){
  setTitle("Settings"); clearUltraBlur(); hideLibNav();
  const c=$("#content");
  const da=localStorage.getItem(LS.detailArt)||"backdrop";
  const hs=getHeroStyle();
  const daBtn=(id,label)=>`<button class="rail-style-btn${da===id?" active":""}" data-detailart="${id}">${label}</button>`;
  const hsBtn=(id,label)=>`<button class="rail-style-btn${hs===id?" active":""}" data-herostyle="${id}">${label}</button>`;
  c.innerHTML=`<div class="page-head" style="margin-top:var(--pill-clear)"><div class="page-head-text"><h2>Settings</h2></div></div>
    <div class="settings-wrap">
    <div class="settings-group">
      <div class="settings-group-head">Appearance</div>
      <div class="settings-row">
        <div class="settings-label">Detail Art
          <small>Art style on movie &amp; show pages on mobile.</small>
        </div>
        <div class="rail-style-btns" id="settingsDetailArtBtns">
          ${daBtn("backdrop","Backdrop")}${daBtn("square","Square")}
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-label">Featured Hero
          <small>Art style for the hero banner at the top of the home screen.</small>
        </div>
        <div class="rail-style-btns" id="settingsHeroStyleBtns">
          ${hsBtn("backdrop","Backdrop")}${hsBtn("square","Square")}
        </div>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group-head">Hubs</div>
      <div class="settings-group-head" style="font-size:12px;text-transform:none;letter-spacing:0;color:var(--dim);padding-top:0;font-weight:400">
        Choose how each hub looks on the home screen.
      </div>
      <div class="settings-row">
        <div class="settings-label">Watch Status Badges
          <small>Show watched / unwatched indicators on all cards.</small>
        </div>
        <button class="toggle-btn${getWatchedBadges()?" active":""}" id="watchedBadgesToggle">${getWatchedBadges()?"On":"Off"}</button>
      </div>
      <div class="settings-row">
        <div class="settings-label">Spoiler Prevention
          <small>Blur thumbnails for unwatched episodes. Clears once you've watched them.</small>
        </div>
        <button class="toggle-btn${getSpoilerBlur()?" active":""}" id="spoilerBlurToggle">${getSpoilerBlur()?"On":"Off"}</button>
      </div>
      <div class="settings-row">
        <div class="settings-label">Hub Descriptions
          <small>Show the description below each hub title when available.</small>
        </div>
        <button class="toggle-btn${getHubSummaries()?" active":""}" id="hubSummariesToggle">${getHubSummaries()?"On":"Off"}</button>
      </div>
      <div id="settingsRailRows"><div class="loading" style="padding:24px 0">Loading hubs…</div></div>
    </div>
    <div class="settings-group">
      <div class="settings-group-head">Playback</div>
      <div class="settings-row">
        <div class="settings-label">TV / D-pad Mode
          <small>Enables arrow-key spatial navigation and auto-focus for TV remotes, game controllers, and D-pads. Hides the mouse cursor.</small>
        </div>
        <button class="toggle-btn${document.body.classList.contains("tv-mode")?" active":""}" id="tvModeToggle">${document.body.classList.contains("tv-mode")?"On":"Off"}</button>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group-head">Sync</div>
      <div class="settings-row">
        <div class="settings-label">Cross-device settings
          <small id="syncStatusText">Checking…</small>
        </div>
        <span class="sync-dot" id="syncDot"></span>
      </div>
    </div></div>`;
  // Wire detail art picker
  c.querySelectorAll("#settingsDetailArtBtns .rail-style-btn").forEach(btn=>{
    btn.onclick=()=>{
      localStorage.setItem(LS.detailArt,btn.dataset.detailart);
      pushRemoteSettings(); toast("Settings saved");
      c.querySelectorAll("#settingsDetailArtBtns .rail-style-btn").forEach(b=>b.classList.toggle("active",b===btn));
    };
  });
  // Wire hero style picker
  c.querySelectorAll("#settingsHeroStyleBtns .rail-style-btn").forEach(btn=>{
    btn.onclick=()=>{
      localStorage.setItem(LS.heroStyle,btn.dataset.herostyle);
      toast("Settings saved");
      c.querySelectorAll("#settingsHeroStyleBtns .rail-style-btn").forEach(b=>b.classList.toggle("active",b===btn));
    };
  });
  // Wire watched badges toggle
  const wbBtn=$("#watchedBadgesToggle");
  if(wbBtn) wbBtn.onclick=()=>{
    const on=localStorage.getItem(LS.watchedBadges)==="0";
    localStorage.setItem(LS.watchedBadges,on?"1":"0");
    wbBtn.textContent=on?"On":"Off";
    wbBtn.classList.toggle("active",on);
    toast(on?"Watched indicators on":"Watched indicators off");
  };
  // Wire spoiler blur toggle
  const sbBtn=$("#spoilerBlurToggle");
  if(sbBtn) sbBtn.onclick=()=>{
    const on=localStorage.getItem(LS.spoilerBlur)!=="1";
    localStorage.setItem(LS.spoilerBlur,on?"1":"0");
    sbBtn.textContent=on?"On":"Off";
    sbBtn.classList.toggle("active",on);
    toast(on?"Spoiler blur on":"Spoiler blur off");
  };
  // Wire hub summaries toggle
  const hubSumBtn=$("#hubSummariesToggle");
  if(hubSumBtn) hubSumBtn.onclick=()=>{
    const on=localStorage.getItem(LS.hubSummaries)!=="1";
    localStorage.setItem(LS.hubSummaries,on?"1":"0");
    hubSumBtn.textContent=on?"On":"Off";
    hubSumBtn.classList.toggle("active",on);
    toast(on?"Hub descriptions on":"Hub descriptions off");
  };
  // Wire TV mode toggle
  const tvBtn=$("#tvModeToggle");
  if(tvBtn) tvBtn.onclick=()=>{
    const on=!document.body.classList.contains("tv-mode");
    applyTvMode(on);
    tvBtn.textContent=on?"On":"Off";
    tvBtn.classList.toggle("active",on);
    toast(on?"TV mode on — use arrow keys or D-pad to navigate":"TV mode off");
  };
  // Reflect live sync status so failures are visible, not silent.
  (async()=>{
    const txt=$("#syncStatusText"), dot=$("#syncDot"); if(!txt) return;
    const state=await pingSync();
    if(state==="ok"){ txt.textContent="Active — your settings follow you across devices."; dot.className="sync-dot ok"; }
    else{ txt.textContent="Unavailable — settings are saved on this device only."; dot.className="sync-dot bad"; }
  })();

  // Load hubs to know what rails exist
  try{
    const [cwMc,hubsMc]=await Promise.all([
      api("/hubs/continueWatching?count=1").catch(()=>null),
      api("/hubs?count=1")
    ]);
    const hasCw=cwMc&&(cwMc.Metadata||[]).some(x=>VIDEO_TYPES.includes(x.type));
    const isDeckHub=h=>{ const id=(h.hubIdentifier||"").toLowerCase(),t=(h.title||"").toLowerCase();
      return /continue|ondeck|on.?deck/.test(id)||t==="continue watching"||t==="on deck"; };
    const videoHubs=(hubsMc.Hub||[]).filter(h=>!isDeckHub(h))
      .map(h=>({title:h.title, key:h.hubIdentifier||h.title,
        items:(h.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type)),lib:""}))
      .filter(h=>h.items.length);

    const hubs=[{title:"Continue Watching",key:"continue_watching"},{title:"Browse by Genre",key:GENRE_CARDS_KEY}];
    videoHubs.forEach(h=>hubs.push({title:h.title,key:h.key}));

    const container=$("#settingsRailRows");
    container.innerHTML="";
    const ALL_STYLES=[{v:"poster",l:"Poster"},{v:"billboard",l:"Billboard"},{v:"square",l:"Square"},{v:"carousel",l:"Carousel"},{v:"grid",l:"Grid"}];
    const GENRE_STYLES=[{v:"billboard",l:"Billboard"},{v:"square",l:"Square"},{v:"grid",l:"Grid"}];
    hubs.forEach(hub=>{
      const current=getRailStyle(hub.key);
      const styles=hub.key===GENRE_CARDS_KEY?GENRE_STYLES:ALL_STYLES;
      const row=el("div","settings-row");
      row.innerHTML=`<div class="settings-label">${esc(hub.title)}</div>
        <div class="rail-style-btns">
          ${styles.map(s=>`<button class="rail-style-btn${current===s.v?" active":""}" data-style="${s.v}">${s.l}</button>`).join("")}
        </div>`;
      row.querySelectorAll(".rail-style-btn").forEach(btn=>{
        btn.onclick=()=>{
          setRailStyle(hub.key,btn.dataset.style);
          row.querySelectorAll(".rail-style-btn").forEach(b=>b.classList.toggle("active",b===btn));
        };
      });
      container.appendChild(row);
    });
    if(!hubs.length) container.innerHTML=`<div style="color:var(--dim);padding:16px 0">No hubs found.</div>`;
  }catch(e){ $("#settingsRailRows").innerHTML=errHTML(e); }
}

async function showPlaylists(gen){
  setTitle("Playlists"); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const mc=await api("/playlists");
    if(gen!==undefined&&gen!==_routeGen) return;
    const pls=(mc.Metadata||[]).filter(p=>p.playlistType==="video");
    if(!pls.length){ c.innerHTML=pageHeadHTML("Playlists")+`<div class='empty'>${svgIcon("playlist")}No video playlists.</div>`; return; }
    await Promise.all(pls.map(async p=>{
      try{
        const ic=await api(`/playlists/${p.ratingKey}/items?X-Plex-Container-Size=4`);
        p._mosaicItems=(ic.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type));
        if(!p.composite&&!p.thumb&&(ic.composite||ic.thumb)) p.thumb=ic.composite||ic.thumb;
      }catch(_){}
    }));
    if(gen!==undefined&&gen!==_routeGen) return;
    const grid=el("div","grid-view");
    const frag=document.createDocumentFragment();
    pls.forEach(p=>frag.appendChild(card(p,false,true)));
    grid.appendChild(frag);
    c.innerHTML=pageHeadHTML("Playlists"); c.appendChild(grid);

  }catch(e){ if(gen===undefined||gen===_routeGen) c.innerHTML=errHTML(e); }
}
async function openPlaylist(p){
  setTitle(p.title); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const mc=await api(`/playlists/${p.ratingKey}/items`);
    const items=(mc.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type));
    const cover=p.thumb||p.composite||mc.thumb||mc.composite;
    const pl={...p,thumb:cover};
    clearUltraBlur();
    const allEpisodes=items.length&&items.every(x=>x.type==="episode");
    c.classList.add("dp-wrap");
    c.innerHTML=collHero(pl,"Playlist",items,true)
      +(items.length
        ? allEpisodes
          ? `<div class="rail-section"><div class="rail-head"><h3>Episodes</h3></div>
            <div class="ep-row-list"></div></div>`
          : `<div class="rail-section"><div class="rail-head"><h3>Items</h3></div>
            <div class="grid-view"></div></div>`
        : `<div class='empty'>${svgIcon("playlist")}This playlist is empty.</div>`);
    fillCollItems(c,items,allEpisodes);
    wireCollActions(c,items);
    wireCollArt(c,pl);

  }catch(e){ c.innerHTML=errHTML(e); }
}

/* ============================================================ DETAIL */
async function openItem(it){
  if(it._collection) return openCollection(it);
  if(it.type==="playlist") return openPlaylist(it);
  if(it.type==="movie") return openMovie(it);
  if(it.type==="show") return openShow(it);
  if(it.type==="season") return openShow({ratingKey:it.parentRatingKey,type:"show",title:it.parentTitle},it.ratingKey);
  if(it.type==="episode") return openEpisode(it);
  playItem(it,it.viewOffset||0);
}
async function openCollection(it){
  setTitle(it.title); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const [meta,childrenMc]=await Promise.all([
      api(`/library/metadata/${it.ratingKey}`).catch(()=>({})),
      api(`/library/collections/${it.ratingKey}/children`)
    ]);
    const m={...it,...(meta.Metadata||[])[0]};
    if(!m.thumb) m.thumb=childrenMc.thumb;
    if(!m.art) m.art=childrenMc.art;
    const items=(childrenMc.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type));
    clearUltraBlur();
    const allEpisodes=items.length&&items.every(x=>x.type==="episode");
    c.classList.add("dp-wrap");
    c.innerHTML=collHero(m,"Collection",items,false)
      +(items.length
        ? allEpisodes
          ? `<div class="rail-section"><div class="rail-head"><h3>Episodes</h3></div>
            <div class="ep-row-list"></div></div>`
          : `<div class="rail-section"><div class="rail-head"><h3>Items</h3></div>
            <div class="grid-view"></div></div>`
        : `<div class='empty'>${svgIcon("stack")}This collection is empty.</div>`);
    fillCollItems(c,items,allEpisodes);
    wireCollActions(c,items);
    wireCollArt(c,m);

  }catch(e){ c.innerHTML=errHTML(e); }
}
function metaBits(m,isMovie){
  const year=m.year||(m.originallyAvailableAt||"").slice(0,4);
  const bits=[];
  if(year) bits.push(esc(String(year)));
  if(m.contentRating) bits.push(`<span class="pill">${esc(m.contentRating)}</span>`);
  if(isMovie&&m.duration) bits.push(fmtDur(m.duration));
  if(!isMovie){
    const seasons=m.childCount||m.seasonCount||0;
    if(seasons) bits.push(`${seasons} Season${seasons===1?"":"s"}`);
    if(m.leafCount) bits.push(`${m.leafCount} Episode${m.leafCount===1?"":"s"}`);
  }
  return bits.join('<span class="sep"></span>');
}
/* ---- COLLECTION / PLAYLIST HERO ----
   A dedicated editorial header for collections and playlists: cover art,
   description, item count, total duration, and creation date — instead of
   dropping them into a generic grid. */
// Best-available art for a collection/playlist backdrop: its own art/cover,
// falling back to the first item's art so an empty cover doesn't leave the
// hero backdrop blank.
function collArt(m,items){
  return m.art||m.thumb||(items[0]&&(items[0].art||items[0].grandparentArt||items[0].thumb));
}
// The collection/playlist's OWN backdrop art for the hero. When it has none,
// returns "" so the hero falls back to the ambient ultrablur rather than a
// blurred copy of the cover or an arbitrary item's art (item 2). (Collections
// inherit the children container's art into m.art in openCollection, so they
// still get a proper backdrop here.)
function collBackdrop(m){
  return m.art||"";
}
function collHero(m,kicker,items,square){
  const isPlaylist=m.type==="playlist";
  const hasLogo=(m.Image||[]).some(i=>i.type==="clearLogo");
  const backdrop=collBackdrop(m);
  const bits=[`${items.length} item${items.length===1?"":"s"}`];
  const totalDur=items.reduce((a,b)=>a+(b.duration||0),0);
  if(totalDur) bits.push(fmtDur(totalDur));
  if(m.addedAt) bits.push(`Added ${fmtDate(m.addedAt)}`);
  if(m.smart) bits.push("Smart");
  const metaHTML=`<div class="coll-meta">${bits.map(esc).join('<span class="sep"></span>')}</div>`;
  const playBtns=items.length?`
        <button class="btn lg" id="collPlay">${svgIcon("play-fill")} Play</button>
        <button class="btn glass lg" id="collShuffle">${svgIcon("shuffle")} Shuffle</button>`:"";
  // Only render the in-hero backdrop layer when there's a real backdrop image;
  // with none, the hero stays transparent so the page's ambient ultrablur
  // shows through instead (item 2).
  // A collection with its own backdrop art: use the editorial dp-* layout.
  // The cover poster goes right, info left — same rhythm as movie/show pages.
  if(m.art||hasLogo){
    const src=img(m.thumb,440,square?440:660);
    const mosaic=src?"":mosaicHTML(items);
    const fallbackIconHTML=square?`<span class="art-fallback">${svgIcon("playlist")}</span>`:`<span class="art-fallback">${svgIcon("stack-fill")}</span>`;
    return `<div class="dp-hero dp-hero--split">
      ${backdrop?`<div class="dp-backdrop"><img id="collBackdropImg" alt="" loading="lazy" decoding="async"></div>`:""}
      <div class="dp-fold">
        <div class="dp-head">
          <p class="dp-kicker">${esc(kicker)}</p>
          <h1 class="dp-title">${esc(m.title)}</h1>
          ${waveHorizSVG()}
        </div>
        <div class="dp-poster${square?"":" dp-poster--portrait"}">
          ${src?`<img id="collPosterImg" alt="" src="${src}">`:`<div class="coll-art${square?" square":""}${mosaic?"":" broken"}">${mosaic||""}${fallbackIconHTML}</div>`}
        </div>
        <div class="dp-meta">${bits.map(esc).join('<span class="sep"></span>')}</div>
        <div class="dp-controls">
          ${playBtns?`<div class="dp-actions">${playBtns}</div>`:""}
        </div>
      </div>
      ${dpSummaryHTML(m.summary,"",!!backdrop)}
    </div>`;
  }
  const src=img(m.thumb,440,square?440:660);
  const mosaic=src?"":mosaicHTML(items);
  const fallbackIconHTML=square?`<span class="art-fallback">${svgIcon("playlist")}</span>`:`<span class="art-fallback">${svgIcon("stack-fill")}</span>`;
  return `<div class="coll-hero">
    <div class="coll-art${square?" square":""}${src||mosaic?"":" broken"}">
      ${src?`<img src="${src}" alt="">`:mosaic}
      ${fallbackIconHTML}
    </div>
    <div class="coll-info">
      <div class="coll-kicker">${esc(kicker)}</div>
      <h2>${esc(m.title)}</h2>
      ${m.summary?`<div class="coll-desc">${esc(m.summary)}</div>`:""}
      ${metaHTML}
      ${playBtns?`<div class="coll-actions">${playBtns}</div>`:""}
    </div>
  </div>`;
}
/* ---- EPISODE ROW LIST ----
   Renders one row of the numbered episode list used by TV
   collections/playlists, mirroring the official Plex app's playlist view. */
function epRowHTML(it,idx){
  const pct=it.viewOffset&&it.duration?(it.viewOffset/it.duration*100):0;
  const watched=it.viewCount>0&&!pct;
  return `<button class="ep-row">
    <div class="ep-row-num">${idx+1}</div>
    <div class="ep-row-thumb"><img loading="lazy" alt="" src="${img(it.thumb||it.parentThumb||it.grandparentThumb,220,124)}">
      ${pct?`<div class="ep-row-prog"><i style="width:${pct}%"></i></div>`:""}
    </div>
    <div class="ep-row-body">
      <div class="ep-row-show">${esc(it.grandparentTitle||"")}</div>
      <div class="ep-row-ep">S${it.parentIndex||0} · E${it.index||0} — ${esc(it.title||"")}${epWatchedIcon(watched)}</div>
    </div>
    <div class="ep-row-dur">${it.duration?fmtClock(it.duration/1000):""}</div>
  </button>`;
}
// Fills the rail placeholder rendered alongside collHero with either a
// numbered episode list (TV collections/playlists) or a poster grid.
function fillCollItems(c,items,allEpisodes){
  if(!items.length) return;
  if(allEpisodes){
    const list=c.querySelector(".ep-row-list");
    items.forEach((it,idx)=>{
      list.insertAdjacentHTML("beforeend",epRowHTML(it,idx));
      list.lastElementChild.onclick=()=>navigate(`/episode/${it.ratingKey}`);
    });
  }else{
    const grid=c.querySelector(".grid-view");
    const cfrag=document.createDocumentFragment();
    items.forEach(it=>cfrag.appendChild(card(it)));
    grid.appendChild(cfrag);
  }
}
function wireCollActions(c,items){
  // If the composite cover ever fails to load, fall back to a mosaic built
  // from the items so the header never collapses to a bare placeholder icon.
  const art=c.querySelector(".coll-art"), cover=art&&art.querySelector(":scope > img");
  if(cover) cover.addEventListener("error",()=>{
    const mo=mosaicHTML(items);
    if(mo){ art.classList.remove("broken"); cover.insertAdjacentHTML("beforebegin",mo); cover.remove(); }
    else art.classList.add("broken");
  },{once:true});
  if(!items.length) return;
  const playBtn=c.querySelector("#collPlay"), shuffleBtn=c.querySelector("#collShuffle");
  if(playBtn) playBtn.onclick=()=>playItem(items[0],items[0].viewOffset||0);
  if(shuffleBtn) shuffleBtn.onclick=()=>playItem(items[Math.floor(Math.random()*items.length)],0);
}
/* ---- TITLE ART ----
   Plex serves a transparent "clear logo" title treatment for many movies
   and shows; use it in place of the plain text title when available. */
function titleArtHTML(item,fallbackTitle){
  const title=fallbackTitle!=null?fallbackTitle:(item.title||"");
  const logo=(item.Image||[]).find(i=>i.type==="clearLogo");
  return logo?`<img class="title-logo" src="${imgLogo(logo.url,800,300)}" alt="${esc(title)}">`:`<h2>${esc(title)}</h2>`;
}

const _bgContrast=new Map();   // art url -> {bright, glow}
function applyBackdropContrast(heroEl,art){
  if(!heroEl||!art) return;
  const apply=r=>{
    if(!heroEl.isConnected) return;
    heroEl.classList.toggle("bright-bg",r.bright);
    if(r.glow) heroEl.style.setProperty('--img-glow',r.glow);
  };
  if(_bgContrast.has(art)){ apply(_bgContrast.get(art)); return; }
  const probe=new Image();
  probe.crossOrigin="anonymous";
  probe.onload=()=>{
    let bright=false, glow='';
    try{
      const w=72,h=40,cv=document.createElement("canvas"); cv.width=w; cv.height=h;
      const ctx=cv.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(probe,0,0,w,h);
      const cols=Math.max(1,Math.round(w*0.62));
      const d=ctx.getImageData(0,0,cols,h).data;
      let lum=0,rS=0,gS=0,bS=0,n=0;
      for(let i=0;i<d.length;i+=4){
        const a=d[i+3]/255;
        rS+=d[i]*a; gS+=d[i+1]*a; bS+=d[i+2]*a;
        lum+=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])*a; n++;
      }
      bright = n ? (lum/n/255)>0.52 : false;
      if(n) glow=`rgba(${Math.round(rS/n)},${Math.round(gS/n)},${Math.round(bS/n)},.65)`;
    }catch(_){ bright=false; }   // tainted canvas (no CORS) — skip, keep baseline
    const r={bright,glow}; _bgContrast.set(art,r); apply(r);
  };
  probe.onerror=()=>{ const r={bright:false,glow:''}; _bgContrast.set(art,r); };
  probe.src=img(art,192,108);
}
function trailerIconBtnHTML(extras){
  const trailer=(extras||[]).find(e=>/trailer/i.test(e.subtype||""));
  return trailer?`<button class="btn glass icon" id="ratingsTrailerBtn" aria-label="Watch trailer" title="Watch trailer">${svgIcon("trailer")}</button>`:"";
}
/* SVG wave helpers — horizontal divider and vertical squiggle.
   Both use currentColor so --squiggle-color (set dynamically from art) drives the tint. */
function waveHorizSVG(){
  return `<div class="wave-wrap"><svg viewBox="0 0 380 32" xmlns="http://www.w3.org/2000/svg" style="color:var(--quote-accent,var(--accent))">
    <path d="M 8 13 C 28 5, 44 24, 66 17 C 86 11, 104 27, 128 20 C 150 13, 168 28, 192 21 C 212 15, 232 29, 256 22 C 276 16, 298 30, 322 23 C 342 17, 362 30, 374 22"
      fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg></div>`;
}
function waveVertSVG(){
  return `<svg viewBox="0 0 28 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="color:var(--squiggle-color,var(--faint))">
    <path d="M 14 12 C 8 18, 8 24, 14 30 S 20 42, 14 48 S 8 60, 14 66 S 20 78, 14 84 S 8 96, 14 102 S 20 114, 14 120 S 8 132, 14 138 S 20 150, 14 156 S 8 168, 14 174 S 20 186, 14 192 S 8 204, 14 210 S 20 222, 14 228 S 8 240, 14 246 S 20 258, 14 264 S 8 276, 14 282 S 20 294, 14 300 S 8 312, 14 318 S 20 330, 14 336 S 8 348, 14 354"
      fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
/* Looping flourish wave — sits under the tagline. Uses currentColor so the
   --quote-accent tint (set dynamically from art) drives the stroke. */
function waveTriSVG(){
  return `<div class="dp-quote-wave"><svg viewBox="0 0 420 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M26 46 C104 24, 198 22, 316 26 C356 27, 382 28, 400 30 C330 33, 266 42, 202 58 C176 64, 154 74, 154 88 C154 104, 184 106, 190 92 C196 78, 168 78, 172 94 C176 112, 212 112, 232 98" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg></div>`;
}
/* Dominant-colour extraction — samples the poster/art at 48×48,
   finds the most vivid hue bucket, then sets two CSS custom properties
   on the hero element: --squiggle-color (waves) and --quote-accent (tagline rules). */
function _rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
  if(max===min) return [0,0,l];
  const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);
  const h=max===r?((g-b)/d+(g<b?6:0)):max===g?((b-r)/d+2):((r-g)/d+4);
  return [h/6*360,s,l];
}
/* Returns WCAG relative luminance of an HSL colour (0–1). */
function _hslLuminance(h,s,l){
  s/=100;l/=100;
  const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;return l-a*Math.max(Math.min(k-3,9-k,1),-1);};
  return [f(0),f(8),f(4)].reduce((lum,c,i)=>{
    const lin=c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
    return lum+[0.2126,0.0722,0.7152][i]*lin;
  },0);
}
/* Step lightness up until contrast ≥ 4.5:1 against black (luminance ≥ 0.175). */
function _boostL(h,s,l){while(_hslLuminance(h,s,l)<0.175&&l<95)l+=2;return l;}
function extractImgAccent(imgEl,heroEl){
  if(!heroEl||!imgEl) return;
  try{
    const cv=document.createElement("canvas");
    cv.width=cv.height=48;
    const cx=cv.getContext("2d");
    cx.drawImage(imgEl,0,0,48,48);
    const px=cx.getImageData(0,0,48,48).data;
    const buckets=new Array(36).fill(0);
    for(let i=0;i<px.length;i+=4){
      const [h,s,l]=_rgbToHsl(px[i],px[i+1],px[i+2]);
      if(s>.15&&l>.08&&l<.9) buckets[Math.floor(h/10)%36]+=s;
    }
    let best=0,bestN=0;
    buckets.forEach((n,i)=>{if(n>bestN){bestN=n;best=i;}});
    if(!bestN) return;
    const h=best*10+5,h2=(h+180)%360;
    const sl=_boostL(h,88,56),al=_boostL(h2,82,60),bl=_boostL(h,75,48);
    heroEl.style.setProperty("--squiggle-color",`hsl(${h},88%,${sl}%)`);
    heroEl.style.setProperty("--quote-accent",`hsl(${h2},82%,${al}%)`);
    heroEl.style.setProperty("--dp-btn",`hsl(${h},75%,${bl}%)`);
    document.body.style.setProperty("--dp-nav-accent",`hsl(${h2},82%,${al}%)`);
  }catch(_){}
}
function dpStarsHTML(){
  const stars=[1,2,3,4,5].map(n=>
    `<button data-star="${n}" aria-label="Rate ${n} star${n===1?"":"s"}">${svgIcon("star-empty")}</button>`).join("");
  return `<div class="dp-rate"><div class="rate-stars" role="group" aria-label="Your rating">${stars}</div></div>`;
}
function dpStatsHTML(m,isMovie){
  const stats=[];
  if(m.addedAt) stats.push({l:"Added to Library",v:fmtDate(m.addedAt)});
  stats.push({l:"Last Watched",v:m.lastViewedAt?fmtDate(m.lastViewedAt):"Not yet viewed",k:"last-watched"});
  if(!isMovie) stats.push({l:"Episodes Watched",v:m.leafCount?`${m.viewedLeafCount||0} of ${m.leafCount}`:"—"});
  else stats.push({l:"Times Watched",v:m.viewCount?String(m.viewCount):"Not yet viewed"});
  return `<div class="dp-stats" id="dpStats">${stats.map(s=>
    `<div class="dp-stat"${s.k?` data-stat="${s.k}"`:""}>`+
    `<span class="dp-sl">${esc(s.l)}</span><span class="dp-sv">${esc(s.v)}</span></div>`
  ).join("")}</div>`;
}
function parseAwards(str){
  if(!str||str==="N/A") return [];
  const rows=[];
  const prizes='Oscars?|Golden Globes?|BAFTAs?|Emmys?|Grammys?|SAG Awards?|Primetime Emmys?';
  const wonM=str.match(new RegExp(`Won (\\d+) (${prizes})`,'i'));
  if(wonM){
    const n=wonM[1], prize=wonM[2].replace(/s$/i,'');
    rows.push({l:`${prize}${parseInt(n)!==1?'s':''} Won`,v:n});
  }
  const nomM=str.match(new RegExp(`Nominated for (\\d+) (${prizes})`,'i'));
  if(nomM){
    const n=nomM[1], prize=nomM[2].replace(/s$/i,'');
    rows.push({l:`${prize}${parseInt(n)!==1?'s':''} Nominated`,v:n});
  }
  const leadWins=wonM?parseInt(wonM[1]):0;
  const addlM=str.match(/Another (\d+) wins?/i);
  const soloM=!addlM&&str.match(/(?:^|\s)(\d+) wins?/i);
  let totalWins=null;
  if(addlM) totalWins=leadWins+parseInt(addlM[1]);
  else if(soloM) totalWins=parseInt(soloM[1]);
  if(totalWins!==null){
    if(wonM&&totalWins>leadWins) rows.push({l:'Total Wins',v:String(totalWins)});
    else if(!wonM) rows.push({l:'Wins',v:String(totalWins)});
  }
  const totalNomM=str.match(/(\d+) nominations?/i);
  if(totalNomM) rows.push({l:'Nominations',v:totalNomM[1]});
  return rows;
}
function dpFilmStatsHTML(td,od,isMovie){
  const items=[];
  if(isMovie){
    if(td?.budget>0) items.push({l:"Budget",v:fmtMoney(td.budget)});
    const gross=td?.revenue>0?fmtMoney(td.revenue):(od?.BoxOffice&&od.BoxOffice!=="N/A"?od.BoxOffice:null);
    if(gross) items.push({l:"Box Office",v:gross});
  }
  parseAwards(od?.Awards).forEach(r=>items.push(r));
  if(!items.length) return "";
  return `<section class="dp-prod-section"><h3>Production Information</h3>`+
    `<div class="dp-stats dp-film-stats">${items.map(s=>
      `<div class="dp-stat"><span class="dp-sl">${esc(s.l)}</span><span class="dp-sv">${esc(s.v)}</span></div>`
    ).join("")}</div></section>`;
}
/* Shared summary block for all dp-* heroes: heading, comma genre line,
   then vertical squiggle + body text. `over` overlaps the heading onto the
   backdrop scrim directly above it (mobile flow only). */
function dpSummaryHTML(summary,genres,over,badges){
  if(!summary&&!genres&&!badges) return "";
  return `<div class="dp-summary-wrap${over?" over-backdrop":""}">
    <h2>Summary</h2>
    ${genres?`<div class="dp-genres">${genres}</div>`:""}
    <div class="dp-summary-body">
      <div class="dp-squiggle">${waveVertSVG()}</div>
      ${summary?`<div class="dp-summary">${esc(summary)}</div>`:"<div></div>"}
    </div>
    ${badges?`<div class="dp-badges"><div class="ratings-row">${badges}</div></div>`:""}
  </div>`;
}
function dpFilmCreditsHTML(m){
  const directors=(m.Director||[]).slice(0,2).map(d=>esc(d.tag)).join(", ");
  const writers=(m.Writer||[]).slice(0,2).map(w=>esc(w.tag)).join(", ");
  return `<div class="dp-film-credits" id="dpFilmCredits">
    ${directors?`<div class="dp-film-credit"><span class="dp-fc-role">Directed by</span><span class="dp-fc-name">${directors}</span></div>`:""}
    ${writers?`<div class="dp-film-credit"><span class="dp-fc-role">Written by</span><span class="dp-fc-name">${writers}</span></div>`:""}
  </div>`;
}
function detailHero(m,isMovie,actionsHTML,extras){
  const top3genres=(m.Genre||[]).slice(0,3).map(g=>esc(g.tag)).join(", ");
  const badges=ratingBadgesHTML(m);
  const trailer=trailerIconBtnHTML(extras);
  const squareUrl=(m.Image||[]).find(i=>i.type==="backgroundSquare")?.url||"";
  const hasBackdrop=!!m.art&&(squareUrl?true:m.art!==m.thumb);
  return `<div class="dp-hero dp-hero--split">
    ${hasBackdrop?`<div class="dp-backdrop"><img id="dpBackdropImg" alt="" loading="lazy" decoding="async"></div>`:""}
    <div class="dp-fold">
      <div class="dp-head">
        <h1 class="dp-title">${esc(m.title||"")}</h1>
        ${waveHorizSVG()}
        <div class="dp-rate-row">
          ${dpStarsHTML()}
        </div>
      </div>
      <div class="dp-poster"><img id="dpPosterImg" alt="" decoding="async" fetchpriority="high"></div>
      <div class="dp-actions-wrap">
        <div class="dp-actions-line">
          <div class="dp-actions" id="dpActions">${actionsHTML}${trailer}</div>
        </div>
        ${badges?`<div class="dp-fold-badges"><div class="ratings-row">${badges}</div></div>`:""}
      </div>
      <div class="dp-meta">${metaBits(m,isMovie)}</div>
      ${m.tagline?`<div class="dp-quote-block"><p class="dp-dropquote">${esc(m.tagline)}</p>${waveTriSVG()}</div>`:""}
    </div>
    ${dpSummaryHTML(m.summary,top3genres,hasBackdrop,badges)}
  </div>`;
}
/* ---- EPISODE DETAIL HERO ---- */
function episodeHero(m,actionsHTML){
  const bits=[fmtAirDate(m.originallyAvailableAt),fmtDur(m.duration)].filter(Boolean);
  if(m.contentRating) bits.push(`<span class="pill">${esc(m.contentRating)}</span>`);
  const badges=ratingBadgesHTML(m);
  return `<div class="dp-hero">
    <div class="dp-fold">
      <div class="dp-head">
        <button class="dp-kicker" id="epBackBtn">${svgIcon("back")} ${esc(m.grandparentTitle||"")} · Season ${m.parentIndex||0}</button>
        <h1 class="dp-title">${m.index?`${m.index}. `:""}${esc(m.title||"")}</h1>
        ${waveHorizSVG()}
        ${dpStarsHTML()}
      </div>
      <div class="dp-poster dp-poster--wide"><img id="dpPosterImg" alt="" decoding="async" fetchpriority="high"></div>
      <div class="dp-meta">${bits.join('<span class="sep"></span>')}</div>
      <div class="dp-controls">
        <div class="dp-actions">${actionsHTML}${watchedToggleHTML(m,true)}</div>
      </div>
    </div>
    ${dpSummaryHTML(m.summary,"",false,badges)}
  </div>`;
}
/* ---- RATINGS ROW ----
   Parses Plex's Rating[] (image-keyed by source) into IMDb / Rotten Tomatoes /
   TMDB badges, plus a Trailer badge if one is available among the extras. */
/* ---- RATING BADGES ----
   Per-source colored badges (IMDb/RT-critic/RT-audience/TMDB), shared by
   the detail-page ratings row and the home hero's meta line. */
function ratingBadgesHTML(m){
  const out=[];
  const addBadge=(src,val)=>{
    if(!src||val==null) return;
    const v=+val;
    if(src.includes("imdb")){
      out.push(`<span class="rating-badge" aria-label="IMDb rating ${v.toFixed(1)} out of 10"><span class="src"><img src="assets/images/icons/ui/IMDB.svg" alt=""></span><b>${v.toFixed(1)}</b></span>`);
    }else if(src.includes("rottentomatoes")){
      const variant=src.split(".").pop();
      const audience=variant==="upright"||variant==="spilled";
      const pct=Math.round(v*10);
      let icon;
      if(audience) icon=variant==="spilled"?"Rotten_Tomatoes_Popcorn_tipped":"Rotten_Tomatoes_Popcorn";
      else if(variant==="certified"||variant==="certified_fresh") icon="Certified_Fresh";
      else icon=(variant==="rotten"||pct<60)?"Rotten_Tomatoes_rotten":"Rotten_Tomatoes";
      out.push(`<span class="rating-badge" aria-label="Rotten Tomatoes ${audience?"audience":"critic"} score ${pct}%"><span class="src"><img src="assets/images/icons/ui/${icon}.svg" alt=""></span><b>${pct}%</b></span>`);
    }else if(src.includes("themoviedb")){
      out.push(`<span class="rating-badge" aria-label="TMDB rating ${v.toFixed(1)} out of 10"><span class="src"><img src="assets/images/icons/ui/TMDB.svg" alt=""></span><b>${v.toFixed(1)}</b></span>`);
    }
  };
  (m.Rating||[]).forEach(r=>addBadge(r.image,r.value));
  // Fallback for hub items that omit the Rating[] array but carry top-level fields
  if(!out.length){
    addBadge(m.ratingImage,m.rating);
    addBadge(m.audienceRatingImage,m.audienceRating);
  }
  return out.join("");
}
function ratingsRowHTML(m,extras){
  const out=[ratingBadgesHTML(m)];
  const trailer=(extras||[]).find(e=>/trailer/i.test(e.subtype||""));
  if(trailer) out.push(`<button class="rating-badge trailer" id="ratingsTrailerBtn">${svgIcon("trailer")}Trailer</button>`);
  const body=out.filter(Boolean).join("");
  return body?`<div class="ratings-row">${body}</div>`:"";
}
/* ---- STAT ROW ----
   Added / first-watched / last-watched / episode-progress, mirroring the
   bottom metadata strip on a streaming service's title page. */
function statRowHTML(m,isMovie){
  const stats=[];
  if(m.addedAt) stats.push(`<div class="stat"><span class="sl">Added to library</span><span class="sv">${esc(fmtDate(m.addedAt))}</span></div>`);
  if(m.lastViewedAt) stats.push(`<div class="stat" data-stat="last-watched"><span class="sl">Last watched</span><span class="sv">${esc(fmtDate(m.lastViewedAt))}</span></div>`);
  if(!isMovie&&m.leafCount) stats.push(`<div class="stat"><span class="sl">Episodes watched</span><span class="sv">${m.viewedLeafCount||0} of ${m.leafCount}</span></div>`);
  else if(isMovie&&m.viewCount) stats.push(`<div class="stat"><span class="sl">Times watched</span><span class="sv">${m.viewCount}</span></div>`);
  return stats.length?`<div class="stat-row" id="statRow">${stats.join("")}</div>`:"";
}
async function injectFirstWatched(ratingKey,isShow){
  const row=$("#dpStats"); if(!row) return;
  try{
    const param=isShow?`grandparentRatingKey=${ratingKey}`:`metadataItemID=${ratingKey}`;
    const mc=await api(`/status/sessions/history/all?${param}&sort=viewedAt%3Aasc&X-Plex-Container-Size=1`);
    const first=(mc.Metadata||[])[0]; if(!first||!first.viewedAt) return;
    const stat=el("div","dp-stat");
    stat.innerHTML=`<span class="dp-sl">First watched</span><span class="dp-sv">${esc(fmtDate(first.viewedAt))}</span>`;
    row.insertBefore(stat,row.querySelector('[data-stat="last-watched"]')||null);
  }catch(_){}
}
/* ---- EXTRAS RAIL (trailers, behind-the-scenes, deleted scenes...) ---- */
async function fetchExtras(ratingKey){
  try{ const mc=await api(`/library/metadata/${ratingKey}/extras`); return mc.Metadata||[]; }catch(_){ return []; }
}
/* ---- RELATED RAILS (similar titles, "More with [actor]", collections...) ---- */
async function fetchRelated(ratingKey){
  try{
    const mc=await api(`/library/metadata/${ratingKey}/related?count=24`);
    return (mc.Hub||[]).map(h=>({title:h.title,hubIdentifier:h.hubIdentifier,items:(h.Metadata||[]).filter(x=>VIDEO_TYPES.includes(x.type))})).filter(h=>h.items.length);
  }catch(_){ return []; }
}
function appendRelatedRails(c,related,m){
  const cast=(m&&m.Role)||[];
  const frag=document.createDocumentFragment();
  related.forEach(h=>{
    const wide=h.items.every(x=>x.type==="episode");
    let actorThumb=null;
    if(/\.actor\./i.test(h.hubIdentifier||"")){
      const name=(h.title||"").replace(/^More with\s+/i,"").trim();
      const role=cast.find(r=>r.tag===name);
      if(role&&role.thumb) actorThumb=role.thumb;
    }
    frag.appendChild(railSection(h.title,h.items,wide,false,null,false,actorThumb));
  });
  c.appendChild(frag);
}
const EXTRA_LABELS={trailer:"Trailer",behindthescenes:"Behind the Scenes",deleted:"Deleted Scene",
  featurette:"Featurette",interview:"Interview",scene:"Scene",short:"Short",other:"Extra"};
function extraCardHTML(e){
  const label=EXTRA_LABELS[(e.subtype||"").toLowerCase()]||"Extra";
  return `<button class="card wide extra-card" data-rk="${esc(String(e.ratingKey))}">
    <div class="art"><img class="wide" loading="lazy" src="${img(e.thumb,480,270)}" alt="">
      <div class="extra-badge">${esc(label)}</div>
      ${e.duration?`<div class="extra-dur">${fmtClock(e.duration/1000)}</div>`:""}
      <div class="play-hover">${svgIcon("play-circle-fill")}</div>
    </div>
    <div class="ct">${esc(e.title)}</div>
  </button>`;
}
function extrasRailHTML(extras){
  if(!extras||!extras.length) return "";
  const trailers=extras.filter(e=>/trailer/i.test(e.subtype||""));
  const others=extras.filter(e=>!/trailer/i.test(e.subtype||""));
  const items=[...trailers,...others];
  if(!items.length) return "";
  return `<div class="rail-section"><div class="rail-head"><h3>Trailers &amp; Extras</h3></div>
    <div class="carousel">${items.map(extraCardHTML).join("")}</div></div>`;
}
function wireExtras(c,extras,trailerBtnId){
  c.querySelectorAll(".extra-card").forEach(b=>{
    const e=extras.find(x=>String(x.ratingKey)===b.dataset.rk);
    if(!e) return;
    b.onclick=/trailer/i.test(e.subtype||"")?()=>openTrailerModal(e):()=>playItem(e,0);
  });
  const tb=trailerBtnId&&c.querySelector(`#${trailerBtnId}`);
  if(tb){ const t=extras.find(e=>/trailer/i.test(e.subtype||"")); if(t) tb.onclick=()=>openTrailerModal(t); }
}
/* ---- TRAILER WINDOW ----
   Small floating player for trailer extras (Trailers rail / ratings-row
   Trailer badge), separate from the full-screen player. */
let trailerModalEl=null, trailerHls=null, trailerSession=null;
function closeTrailerModal(){
  if(!trailerModalEl) return;
  const modal=trailerModalEl; trailerModalEl=null;
  modal.classList.remove("show");
  const video=modal.querySelector("video");
  if(trailerHls){ trailerHls.destroy(); trailerHls=null; }
  if(trailerSession){ stopSession(trailerSession); trailerSession=null; }
  if(video){ video.onerror=null; video.pause(); video.removeAttribute("src"); video.load(); }
  setTimeout(()=>modal.remove(),250);
}
async function openTrailerModal(item){
  closeTrailerModal();
  const modal=el("div","trailer-modal");
  modal.innerHTML=`<div class="trailer-window">
      <button class="pbtn" id="trailerClose" aria-label="Close trailer">${svgIcon("x")}</button>
      <div class="trailer-state" id="trailerLoading"><div class="ring"></div></div>
      <div class="trailer-state hidden" id="trailerError">${svgIcon("warning-circle")}<span>Trailer unavailable</span></div>
      <video id="trailerVideo" controls playsinline preload="metadata" aria-label="Trailer"></video>
    </div>`;
  modal.addEventListener("click",e=>{ if(e.target===modal) closeTrailerModal(); });
  modal.querySelector("#trailerClose").onclick=closeTrailerModal;
  $("#app").appendChild(modal);
  trailerModalEl=modal;
  requestAnimationFrame(()=>{ modal.classList.add("show"); modal.querySelector("#trailerClose")?.focus(); });
  const video=modal.querySelector("#trailerVideo");
  const loading=modal.querySelector("#trailerLoading"), error=modal.querySelector("#trailerError");
  const fail=()=>{ if(trailerModalEl!==modal) return; loading.classList.add("hidden"); error.classList.remove("hidden"); };
  video.addEventListener("canplay",()=>{ if(trailerModalEl!==modal) return;
    loading.classList.add("hidden"); error.classList.add("hidden"); video.classList.add("show"); video.play().catch(()=>{}); });
  try{
    let full=item;
    if(!partOf(full)){ const mc=await api(`/library/metadata/${item.ratingKey}`); full=(mc.Metadata||[])[0]||item; }
    if(trailerModalEl!==modal) return;
    const part=partOf(full);
    if(!part||!part.key){ fail(); return; }
    // Try direct play first; if the browser can't decode the file (HEVC, MKV,
    // AC3...) fall back to an HLS transcode — the same path Plex itself uses —
    // instead of showing "unavailable". A watchdog covers silent stalls.
    let settled=false;
    const toTranscode=()=>{ if(settled||trailerModalEl!==modal) return; settled=true;
      clearTimeout(wd); transcodeTrailer(video,full.ratingKey,fail); };
    video.addEventListener("canplay",()=>{ settled=true; clearTimeout(wd); },{once:true});
    video.onerror=toTranscode;
    const wd=setTimeout(toTranscode,7000);
    video.src=`${server.uri}${part.key}?X-Plex-Token=${server.token}`;
  }catch(_){ fail(); }
}
// HLS transcode fallback for the trailer modal (self-contained: own Hls instance
// and session so it never collides with the main player's state).
function transcodeTrailer(video,ratingKey,fail){
  const session="hume-"+crypto.randomUUID();
  trailerSession=session;
  const params=new URLSearchParams({
    path:`/library/metadata/${ratingKey}`,
    mediaIndex:0, partIndex:0, protocol:"hls", fastSeek:1,
    directPlay:0, directStream:1, directStreamAudio:1,
    subtitles:"burn", subtitleSize:100, audioBoost:100, mediaBufferSize:102400,
    location:server.local?"lan":"wan", autoAdjustQuality:0,
    maxVideoBitrate:40000, videoQuality:100, offset:0,
    "X-Plex-Client-Identifier":clientId(), "X-Plex-Session-Identifier":session,
    "X-Plex-Platform":"Web", session:session, "X-Plex-Token":server.token
  });
  const m3u8=`${server.uri}/video/:/transcode/universal/start.m3u8?${params.toString()}`;
  video.onerror=null; video.removeAttribute("src"); video.load();
  if(window.Hls&&Hls.isSupported()){
    if(trailerHls) trailerHls.destroy();
    const h=new Hls({ xhrSetup:(xhr,url)=>{
      const u=url.indexOf("X-Plex-Token")===-1
        ? url+(url.indexOf("?")===-1?"?":"&")+"X-Plex-Token="+encodeURIComponent(server.token) : url;
      xhr.open("GET",u,true);
    }});
    trailerHls=h;
    h.attachMedia(video);
    h.on(Hls.Events.MEDIA_ATTACHED,()=>h.loadSource(m3u8));
    h.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}));
    h.on(Hls.Events.ERROR,(_,d)=>{ if(!d.fatal) return;
      if(d.type===Hls.ErrorTypes.NETWORK_ERROR){ h.startLoad(); }
      else if(d.type===Hls.ErrorTypes.MEDIA_ERROR){ h.recoverMediaError(); }
      else fail(); });
  }else{
    video.src=m3u8; video.onerror=fail;
    video.onloadedmetadata=()=>video.play().catch(()=>{});
  }
}
function castRailHTML(m){
  const cast=(m.Role||[]).slice(0,12);
  if(!cast.length) return "";
  return `<div class="rail-section"><div class="rail-head"><h3>Cast &amp; Crew</h3><span class="count">${cast.length}</span></div>
    <div class="cast-row" id="castRow">`+cast.map(r=>{
      // Extract person ratingKey from multiple possible sources in priority order:
      // (1) r.ratingKey — direct field (some Plex versions)
      // (2) r.key      — e.g. /library/metadata/{personRk} (newer Plex)
      
      let personRk="";
      if(r.ratingKey) personRk=String(r.ratingKey);
      else if(r.key){const km=r.key.match(/^\/library\/metadata\/(\d+)/);if(km) personRk=km[1];}
      else if(r.thumb){const tm=r.thumb.match(/^\/library\/metadata\/(\d+)\/thumb/);if(tm) personRk=tm[1];}
      return `<button class="cast"${r.id?` data-actor-id="${r.id}"`:""} data-actor-name="${esc(r.tag)}" data-actor-thumb="${esc(r.thumb||"")}"${personRk?` data-actor-rk="${personRk}"`:""}>`
        +`<div class="art${r.thumb?"":" no-img"}">${r.thumb?`<img loading="lazy" alt="" src="${img(r.thumb,224,224)}" onerror="this.closest('.art').classList.add('no-img')">`:""}</div>`
        +`<div class="nm">${esc(r.tag)}</div><div class="rl">${esc((r.role||"").split("/")[0].trim())}</div></button>`;
    }).join("")+`</div></div>`;
}
function wireCastRail(c){
  c.querySelectorAll(".cast[data-actor-id]").forEach(btn=>{
    btn.onclick=()=>goToActor(btn.dataset.actorId,btn.dataset.actorName,btn.dataset.actorThumb,btn.dataset.actorRk);
  });
}

/* ---- ACTOR PAGES ---- */
const actorCache={};
function goToActor(id,name,thumb,personRk){
  if(name) actorCache[id]={name,thumb,personRk:personRk||""};
  navigate(`/actor/${id}`);
}
function fmtBornDied(born,died){
  const fmt=v=>{
    if(!v) return "";
    if(typeof v==="string"){const[y,m,d]=v.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});}
    return new Date(v*1000).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  };
  return died?`Born ${fmt(born)} · Died ${fmt(died)}`:`Born ${fmt(born)}`;
}

/* Filmography list section: acting/directing/producing tabs with full credit list.
   Credits come from /library/metadata/{personId} Role[]/Director[]/Producer[] arrays.
   Items without ratingKey are not in the library (shown dimmed, not clickable).
   Items with ratingKey get an "On Hume" badge and navigate on click. */
function filmogSection(acting,directing,producing){
  const tabs=[
    {label:"Actor",  items:acting},
    {label:"Director",items:directing},
    {label:"Producer",items:producing},
  ].filter(t=>t.items.length);
  if(!tabs.length) return null;
  const wrap=el("div","section filmog-section");
  const h=document.createElement("h3"); h.textContent="Filmography"; wrap.appendChild(h);
  const tabBar=el("div","filmog-tabs");
  const listEl=el("div","filmog-list");
  const render=items=>{
    listEl.innerHTML=items.map(cr=>{
      const inLib=!!cr.ratingKey;
      const rk=inLib?` data-rk="${esc(String(cr.ratingKey))}" data-ctype="${esc(cr.type||"")}"` :"";
      return `<button class="filmog-item${inLib?" in-lib":""}"${rk}${!inLib?" disabled":""}>
        <span class="filmog-year">${cr.year||"—"}</span>
        <div class="filmog-info">
          <div class="filmog-title">${esc(cr.tag||"Untitled")}${cr.role?` <span class="filmog-as">as ${esc(cr.role)}</span>`:""}
          </div>${inLib?`<div class="filmog-badge">On Hume</div>`:""}
        </div></button>`;
    }).join("");
  };
  tabs.forEach((t,i)=>{
    const b=el("button","filmog-tab"+(i===0?" active":""));
    b.textContent=`${t.label} (${t.items.length})`;
    b.onclick=()=>{ tabBar.querySelectorAll(".filmog-tab").forEach(x=>x.classList.remove("active")); b.classList.add("active"); render(t.items); };
    tabBar.appendChild(b);
  });
  render(tabs[0].items);
  wrap.appendChild(tabBar);
  wrap.appendChild(listEl);
  listEl.addEventListener("click",e=>{
    const item=e.target.closest(".filmog-item.in-lib[data-rk]");
    if(!item) return;
    const rk=item.dataset.rk, ctype=item.dataset.ctype;
    if(ctype==="show") navigate(`/show/${rk}`);
    else navigate(`/movie/${rk}`);
  });
  return wrap;
}

function showBioModal(actorName,bio){
  const overlay=el("div","bio-modal-overlay");
  const body=esc(bio).replace(/\n\n+/g,"</p><p>").replace(/\n/g,"<br>");
  overlay.innerHTML=`<div class="bio-modal">`
    +`<div class="bio-modal-head"><h2>${esc(actorName)}</h2>`
    +`<button class="bio-modal-close" aria-label="Close">&#x2715;</button></div>`
    +`<div class="bio-modal-body"><p>${body}</p></div></div>`;
  const close=()=>{overlay.remove();document.removeEventListener("keydown",onKey);};
  const onKey=e=>{if(e.key==="Escape")close();};
  overlay.querySelector(".bio-modal-close").onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  document.addEventListener("keydown",onKey);
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.querySelector(".bio-modal-close")?.focus());
}

function knownForSectionTmdb(tmdbCast,libByNorm,libByRk){
  if(!tmdbCast||!tmdbCast.length) return null;
  const normT=t=>t.toLowerCase().replace(/[^a-z0-9]/g,"");
  // Deduplicate, filter talk/news/reality genres and self-appearances
  const SKIP_GENRES=new Set([10767,10763,10764]);
  const SELF_RE=/\b(self|herself|himself|guest)\b/i;
  const seenId=new Set();
  const filtered=tmdbCast.filter(cr=>{
    const k=`${cr.media_type}-${cr.id}`;
    if(seenId.has(k)) return false; seenId.add(k);
    if((cr.genre_ids||[]).some(g=>SKIP_GENRES.has(g))) return false;
    if(SELF_RE.test(cr.character||"")) return false;
    return true;
  });
  const sorted=filtered.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  const top=sorted.slice(0,8);
  if(!top.length) return null;
  const sec=el("div","rail-section");
  const head=el("div","rail-head");
  head.innerHTML=`<div class="rail-head-text"><h3>Known For</h3></div><span class="count">${top.length}</span>`;
  const viewport=el("div","rail-viewport");
  const row=el("div","carousel");
  const kfrag=document.createDocumentFragment();
  top.forEach(cr=>{
    const title=cr.title||cr.name||"";
    const libItem=libByNorm.get(normT(title));
    if(libItem){
      kfrag.appendChild(card(libItem,false));
    } else {
      const b=el("button","card tmdb-card");
      const posterUrl=cr.poster_path?`https://image.tmdb.org/t/p/w342${cr.poster_path}`:"";
      const year=cr.release_date?cr.release_date.slice(0,4):cr.first_air_date?cr.first_air_date.slice(0,4):"";
      const mediaLabel=cr.media_type==="tv"?"TV Show":"Movie";
      const sub=[year,mediaLabel].filter(Boolean).join(" · ");
      b.innerHTML=`<div class="art${posterUrl?"":" broken"}">`
        +(posterUrl?`<img loading="lazy" decoding="async" alt="${esc(title)}" src="${posterUrl}" onerror="this.closest('.art').classList.add('broken')">`:"")
        +`<span class="art-fallback">${svgIcon(cr.media_type==="tv"?"television":"movies")}</span></div>`
        +`<div class="ct">${esc(title)}</div><div class="cs">${esc(sub)}</div>`;
      b.onclick=()=>window.open(`https://www.themoviedb.org/${cr.media_type==="tv"?"tv":"movie"}/${cr.id}`,"_blank","noopener,noreferrer");
      kfrag.appendChild(b);
    }
  });
  row.appendChild(kfrag);
  const prev=el("button","rail-arrow prev edge"); prev.type="button"; prev.setAttribute("aria-label","Scroll left");
  prev.innerHTML=svgIcon("caret-down"); prev.firstChild.style.transform="rotate(90deg)";
  const next=el("button","rail-arrow next"); next.type="button"; next.setAttribute("aria-label","Scroll right");
  next.innerHTML=svgIcon("caret-down"); next.firstChild.style.transform="rotate(-90deg)";
  viewport.appendChild(prev); viewport.appendChild(row); viewport.appendChild(next);
  wireRailArrows(viewport,row,prev,next);
  sec.appendChild(head); sec.appendChild(viewport);
  return sec;
}

const TMDB_KEY="a9263943cdfdc2dd3d836e06a2cdb10b";
const TMDB_BASE="https://api.themoviedb.org/3";
// TMDB responses are public and identical for every user, so we route them
// through the Cloudflare Worker which edge-caches them — popular actors load
// from Cloudflare's cache instead of a fresh TMDB round-trip. Falls back to
// calling TMDB directly if the Worker is unreachable or not yet updated.
async function tmdbFetch(path){
  try{
    const r=await fetch(`${SETTINGS_WORKER}/tmdb?path=${encodeURIComponent(path)}`);
    if(r.ok) return await r.json();
  }catch(_){}
  const sep=path.includes("?")?"&":"?";
  const r=await fetch(`${TMDB_BASE}${path}${sep}api_key=${TMDB_KEY}`);
  if(!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}

/* ---- DETAIL PAGE ENRICHMENT (TMDB + OMDb) ---- */
function getExternalIds(m){
  const ids={};
  (m.Guid||[]).forEach(g=>{
    if(g.id.startsWith("tmdb://")) ids.tmdb=g.id.slice(7);
    if(g.id.startsWith("imdb://")) ids.imdb=g.id.slice(7);
  });
  return ids;
}
async function fetchTmdbEnrich(ids,isMovie){
  if(!ids.tmdb) return null;
  const type=isMovie?"movie":"tv";
  // include_image_language=en,null pulls English + textless backdrops so we can
  // prefer clean (logo-free) frames for the storyline section.
  try{ return await tmdbFetch(`/${type}/${ids.tmdb}?append_to_response=keywords,credits,images&include_image_language=en,null`); }
  catch(_){ return null; }
}
const OMDB_KEY="6079f41c";
async function fetchOmdb(imdbId){
  if(!imdbId||!OMDB_KEY) return null;
  try{
    // plot=full returns the long-form synopsis used by the storyline section.
    const r=await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&plot=full&i=${imdbId}`);
    const d=await r.json();
    return d.Response==="True"?d:null;
  }catch(_){ return null; }
}

function _loadCorsImg(src){
  return new Promise(res=>{
    const im=new Image(); im.crossOrigin="anonymous"; im.decoding="async";
    im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src;
  });
}
function _aHash(imgEl){
  try{
    const cv=document.createElement("canvas"); cv.width=8; cv.height=8;
    const ctx=cv.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(imgEl,0,0,8,8);
    const d=ctx.getImageData(0,0,8,8).data;
    const g=[]; let sum=0;
    for(let i=0;i<64;i++){ const v=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; g.push(v); sum+=v; }
    const avg=sum/64;
    return g.map(v=>v>=avg?1:0);
  }catch(_){ return null; }  // tainted canvas → fall back to file-path dedupe only
}
function _hamming(a,b){ let n=0; for(let i=0;i<64;i++) if(a[i]!==b[i]) n++; return n; }
async function pickUniqueBackdrops(backdrops,max){
  const seen=new Set();
  const pool=(backdrops||[])
    .filter(b=>b.file_path&&b.aspect_ratio>=1.6&&b.aspect_ratio<=2.0)
    .filter(b=>!seen.has(b.file_path)&&seen.add(b.file_path))
    // no-language (null iso_639_1) first — clean images without text overlays
    .sort((a,b)=>{
      const aLang=a.iso_639_1==null?0:1, bLang=b.iso_639_1==null?0:1;
      return (aLang-bLang)||(b.vote_average-a.vote_average)||(b.width-a.width);
    })
    .slice(1,9);  // skip index 0 — it's usually the hero backdrop already shown
  const loaded=await Promise.all(pool.map(async b=>{
    const im=await _loadCorsImg(`https://image.tmdb.org/t/p/w300${b.file_path}`);
    return {path:b.file_path,hash:im?_aHash(im):null};
  }));
  const accepted=[],hashes=[];
  for(const {path,hash} of loaded){
    if(accepted.length>=max) break;
    if(hash&&hashes.some(h=>_hamming(h,hash)<=6)) continue;  // perceptual near-dupe
    if(hash) hashes.push(hash);
    accepted.push(path);
  }
  return accepted;
}
function splitParagraphs(text){
  if(!text) return [];
  // Honour explicit paragraph breaks if OMDb supplies any.
  let parts=text.split(/\n{2,}|\r\n\r\n/).map(s=>s.trim()).filter(Boolean);
  if(parts.length>1) return parts;
  // Otherwise group sentences into ~3 pseudo-paragraphs.
  const sentences=text.replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]+(?:["'’”)\]]+)?|\S.*$/g)||[text];
  if(sentences.length<=2) return [text.trim()];
  const per=Math.ceil(sentences.length/3),groups=[];
  for(let i=0;i<sentences.length;i+=per) groups.push(sentences.slice(i,i+per).join(" ").trim());
  return groups.filter(Boolean);
}
function dpStoryHTML(paragraphs,imgPaths){
  if(!paragraphs.length) return "";
  
  const figs=imgPaths.slice(0,paragraphs.length).map(p=>
    `<figure class="dp-story-fig"><img loading="lazy" decoding="async" alt="" src="https://image.tmdb.org/t/p/w780${p}"></figure>`);
  let html=`<section class="dp-story"><div class="dp-story-head"><h3>Storyline</h3></div>`;
  paragraphs.forEach((p,i)=>{
    if(figs[i]) html+=figs[i];
    html+=`<p class="dp-story-p">${esc(p)}</p>`;
  });
  return html+`</section>`;
}
function fmtMoney(n){
  n=Number(n)||0;
  if(n<=0) return null;
  if(n>=1e9) return `$${(n/1e9).toFixed(1)}B`;
  if(n>=1e6) return `$${Math.round(n/1e6)}M`;
  return `$${n.toLocaleString()}`;
}
const CREW_JOBS=[
  {label:"Director of Photography",jobs:["Director of Photography"]},
  {label:"Music",jobs:["Original Music Composer","Music"]},
  {label:"Production Design",jobs:["Production Designer"]},
  {label:"Costume Design",jobs:["Costume Designer"]},
];
function enrichDetailPage(c,m,isMovie,appendStats){
  const ids=getExternalIds(m);
  if(!ids.tmdb&&!ids.imdb){
    if(appendStats){ c.insertAdjacentHTML("beforeend",dpStatsHTML(m,isMovie)); injectFirstWatched(m.ratingKey,!isMovie); }
    return;
  }
  Promise.all([fetchTmdbEnrich(ids,isMovie),fetchOmdb(ids.imdb)])
    .then(([td,od])=>{
      
      const creditsBlock=c.querySelector("#dpFilmCredits");
      if(creditsBlock){
        const crew=td?.credits?.crew||[];
        CREW_JOBS.forEach(({label,jobs})=>{
          const found=crew.find(cr=>jobs.includes(cr.job));
          if(found){
            creditsBlock.insertAdjacentHTML("beforeend",
              `<div class="dp-film-credit"><span class="dp-fc-role">${esc(label)}</span><span class="dp-fc-name">${esc(found.name)}</span></div>`);
          }
        });
      }
      
      const anchor=c.querySelector("#dpFilmStatsAnchor");
      if(anchor){
        const filmStats=dpFilmStatsHTML(td,od,isMovie);
        if(filmStats) anchor.insertAdjacentHTML("afterend",filmStats);
      }
      // 3. Personal stats grid (at very bottom, before keywords)
      if(appendStats){ c.insertAdjacentHTML("beforeend",dpStatsHTML(m,isMovie)); injectFirstWatched(m.ratingKey,!isMovie); }
      // 4. Keyword pills (very last) — hidden behind a tap to avoid spoilers
      const kws=(td?.keywords?.keywords||td?.keywords?.results||[]).slice(0,12);
      if(kws.length){
        c.insertAdjacentHTML("beforeend",
          `<div class="dp-tags" id="dpTags">`+
          `<button class="dp-tags-toggle" type="button" aria-expanded="false" aria-controls="dpKeywords">${svgIcon("tag")} Tags <span class="dp-tags-hint">may contain spoilers</span></button>`+
          `<div class="dp-keywords" id="dpKeywords">${kws.map(k=>`<span class="dp-keyword">${esc(k.name)}</span>`).join("")}</div>`+
          `</div>`);
        const tags=c.querySelector("#dpTags"), tBtn=tags?.querySelector(".dp-tags-toggle"), tKw=tags?.querySelector("#dpKeywords");
        if(tBtn) tBtn.onclick=()=>{
          const on=tags.classList.toggle("revealed");
          tBtn.setAttribute("aria-expanded",on?"true":"false");
        };
        // Tapping the blurred pills also reveals them.
        if(tKw) tKw.onclick=()=>{
          if(!tags.classList.contains("revealed")){ tags.classList.add("revealed"); tBtn.setAttribute("aria-expanded","true"); }
        };
      }
      // 5. Storyline — OMDb full plot split into paragraphs with de-duplicated
      //    TMDB backdrops interleaved between them. Runs last (and async, so the
      //    image hashing never blocks the rest of the enrichment); inserts just
      //    below the hero once ready.
      const fullPlot=od?.Plot&&od.Plot!=="N/A"?od.Plot:"";
      const wordCount=s=>(s||"").trim().split(/\s+/).filter(Boolean).length;
      
      
      const plotWords=wordCount(fullPlot), summaryWords=wordCount(m.summary);
      if(fullPlot&&plotWords>summaryWords+50){
        const paras=splitParagraphs(fullPlot);
        (async()=>{
          const imgs=await pickUniqueBackdrops(td?.images?.backdrops,paras.length);
          const story=dpStoryHTML(paras,imgs);
          const hero=c.querySelector(".dp-hero");
          if(story&&hero&&!c.querySelector(".dp-story")) hero.insertAdjacentHTML("afterend",story);
        })();
      }
    })
    .catch(()=>{
      if(appendStats){ c.insertAdjacentHTML("beforeend",dpStatsHTML(m,isMovie)); injectFirstWatched(m.ratingKey,!isMovie); }
    });
}

async function openActor(id){
  const cached=actorCache[id]||{};
  const name=cached.name||"Actor", thumb=cached.thumb||"";
  setTitle(name); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const movieSections=sections.filter(s=>s.type==="movie");
    const showSections=sections.filter(s=>s.type==="show");
    const CONTENT_TYPES=new Set(["movie","show","episode","season","clip","artist","album","track","collection","playlist"]);
    // Round 1: TMDB search + Plex content queries, all in parallel
    const [tmdbSearch,bioMc,moviesResults,showsResults,episodeResults]=await Promise.all([
      name&&name!=="Actor"?tmdbFetch(`/search/person?query=${encodeURIComponent(name)}&limit=5`).catch(()=>null):Promise.resolve(null),
      api(`/library/metadata/${id}`).catch(()=>null),
      Promise.all(movieSections.map(s=>api(`/library/sections/${s.key}/all?type=1&actor=${id}`).then(r=>r.Metadata||[]).catch(()=>[]))),
      Promise.all(showSections.map(s=>api(`/library/sections/${s.key}/all?type=2&actor=${id}`).then(r=>r.Metadata||[]).catch(()=>[]))),
      Promise.all(showSections.map(s=>api(`/library/sections/${s.key}/all?type=4&actor=${id}`).then(r=>r.Metadata||[]).catch(()=>[]))),
    ]);
    // Round 2: TMDB person detail + credits (if search found a result)
    const tmdbId=(tmdbSearch?.results||[])[0]?.id;
    let tmdbPerson=null, tmdbCredits=null;
    if(tmdbId){
      [tmdbPerson,tmdbCredits]=await Promise.all([
        tmdbFetch(`/person/${tmdbId}`).catch(()=>null),
        tmdbFetch(`/person/${tmdbId}/combined_credits`).catch(()=>null),
      ]);
    }
    // Plex person metadata as fallback
    const plexMeta=(bioMc?.Metadata||[])[0];
    const isPlexPerson=plexMeta&&!CONTENT_TYPES.has(plexMeta.type);
    // Flatten Plex library results
    const movies=[].concat(...moviesResults);
    const shows=[].concat(...showsResults);
    const allEpisodes=[].concat(...episodeResults);
    const allTitles=[...movies,...shows];
    // Build normalized-title → library item map for "On Hume" badge matching
    const normTitle=t=>t.toLowerCase().replace(/[^a-z0-9]/g,"");
    const libByNorm=new Map(allTitles.map(t=>[normTitle(t.title),t]));
    const libByRk=new Map(allTitles.map(t=>[String(t.ratingKey),t]));
    // Biography and birth info: TMDB primary, Plex fallback
    const bio=tmdbPerson?.biography||(isPlexPerson?plexMeta.summary||"":"");
    const bornAt=tmdbPerson?.birthday||(isPlexPerson&&plexMeta.bornAt?plexMeta.bornAt:null);
    const diedAt=tmdbPerson?.deathday||(isPlexPerson&&plexMeta.diedAt?plexMeta.diedAt:null);
    const birthPlace=tmdbPerson?.place_of_birth||null;
    // Filmography: TMDB primary, Plex fallback
    let actingCredits=[], directingCredits=[], producingCredits=[];
    if(tmdbCredits){
      const seen=new Set();
      const castItems=(tmdbCredits.cast||[]).filter(cr=>{
        const k=`${cr.media_type}-${cr.id}`;
        if(seen.has(k)) return false; seen.add(k); return true;
      });
      const mkCredit=cr=>{
        const title=cr.title||cr.name||"";
        const year=cr.release_date?+cr.release_date.slice(0,4):cr.first_air_date?+cr.first_air_date.slice(0,4):0;
        const libItem=libByNorm.get(normTitle(title));
        return {tag:title,year,role:cr.character||cr.job||"",ratingKey:libItem?String(libItem.ratingKey):"",type:cr.media_type==="tv"?"show":"movie"};
      };
      actingCredits=castItems.map(mkCredit).sort((a,b)=>(b.year||0)-(a.year||0));
      const crew=tmdbCredits.crew||[];
      directingCredits=crew.filter(cr=>cr.department==="Directing").map(mkCredit).sort((a,b)=>(b.year||0)-(a.year||0));
      producingCredits=crew.filter(cr=>cr.job==="Producer"||cr.job==="Executive Producer").map(mkCredit).sort((a,b)=>(b.year||0)-(a.year||0));
    } else {
      // TMDB unavailable — use Plex person metadata or library items
      actingCredits=isPlexPerson?(plexMeta.Role||[]):[];
      directingCredits=isPlexPerson?(plexMeta.Director||[]):[];
      producingCredits=isPlexPerson?(plexMeta.Producer||[]):[];
      if(!actingCredits.length&&(movies.length||shows.length)){
        actingCredits=[
          ...movies.map(m=>({tag:m.title,year:m.year,ratingKey:m.ratingKey,type:"movie"})),
          ...shows.map(s=>({tag:s.title,year:s.year,ratingKey:s.ratingKey,type:"show"})),
        ].sort((a,b)=>(b.year||0)-(a.year||0));
      }
    }
    
    // The heuristic always applies, supplementing whatever type=2 returns.
    const mainShowKeys=new Set(shows.map(s=>String(s.ratingKey)));
    if(allEpisodes.length>0){
      const epCount={};
      allEpisodes.forEach(ep=>{const k=String(ep.grandparentRatingKey);epCount[k]=(epCount[k]||0)+1;});
      Object.entries(epCount).forEach(([k,n])=>{if(n>=3)mainShowKeys.add(k);});
    }
    const guestEps=allEpisodes.filter(ep=>!mainShowKeys.has(String(ep.grandparentRatingKey)));
    const seenTitles=allTitles.filter(t=>t.type==="movie"?t.viewCount>0:t.viewedLeafCount>0);
    const totalItems=movies.length+shows.length+guestEps.length;
    const photoSrc=thumb?img(thumb,280,280):"";
    const moviesSorted=[...movies].sort((a,b)=>(b.year||0)-(a.year||0));
    const showsSorted=[...shows].sort((a,b)=>(b.year||0)-(a.year||0));
    c.innerHTML=`<div class="actor-head">
      <div class="actor-photo">${photoSrc?`<img src="${photoSrc}" alt="" onerror="this.style.visibility='hidden'">`:""}\n      </div><div class="actor-info"><h1>${esc(name)}</h1>\n      ${bio?`<p class="actor-bio">${esc(bio)}</p>`:""}\n      <div class="actor-sub">${totalItems} title${totalItems===1?"":"s"} on this server</div>\n      </div></div>`;
    const bioEl=c.querySelector(".actor-bio");
    if(bioEl&&bio){
      const toggle=el("button","bio-toggle"); toggle.textContent="Read more";
      toggle.onclick=()=>showBioModal(name,bio);
      bioEl.insertAdjacentElement("afterend",toggle);
      requestAnimationFrame(()=>{if(bioEl.scrollHeight<=bioEl.clientHeight+4) toggle.remove();});
    }
    if(bornAt||birthPlace){
      const vitals=el("div","actor-vitals");
      const fmtV=v=>{
        if(!v) return "";
        if(typeof v==="string"){const[y,m,d]=v.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});}
        return new Date(v*1000).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
      };
      if(bornAt){const e=el("div","vital-item");e.innerHTML=`<div class="vital-label">Born</div><div class="vital-value">${fmtV(bornAt)}</div>`;vitals.appendChild(e);}
      if(diedAt){const e=el("div","vital-item");e.innerHTML=`<div class="vital-label">Died</div><div class="vital-value">${fmtV(diedAt)}</div>`;vitals.appendChild(e);}
      if(birthPlace){const e=el("div","vital-item");e.innerHTML=`<div class="vital-label">Birthplace</div><div class="vital-value">${esc(birthPlace)}</div>`;vitals.appendChild(e);}
      c.querySelector(".actor-head").insertAdjacentElement("afterend",vitals);
    }
    if(moviesSorted.length) c.appendChild(railSection("Movies",moviesSorted,false,false));
    if(showsSorted.length) c.appendChild(railSection("TV Shows",showsSorted,false,false));
    const kfSec=tmdbCredits?knownForSectionTmdb(tmdbCredits.cast,libByNorm,libByRk)
      :(allTitles.length?railSection("Known For",[...allTitles].sort((a,b)=>(b.audienceRating||b.rating||0)-(a.audienceRating||a.rating||0)).slice(0,8),false,false):null);
    if(kfSec) c.appendChild(kfSec);
    if(guestEps.length) c.appendChild(railSection("Guest Appearances",guestEps,true,false));
    if(seenTitles.length) c.appendChild(railSection("You've Seen Them In",seenTitles,false,false));
    const filmog=filmogSection(actingCredits,directingCredits,producingCredits);
    if(filmog) c.appendChild(filmog);
    if(!totalItems&&!actingCredits.length) c.insertAdjacentHTML("beforeend","<div class='empty'>No titles found for this person.</div>");

  }catch(e){ c.innerHTML=errHTML(e); }
}

function rateFloatHTML(m){
  const stars=[1,2,3,4,5].map(n=>
    `<button data-star="${n}" aria-label="Rate ${n} star${n===1?"":"s"}">${svgIcon("star-empty")}</button>`).join("");
  return `<div class="rate-float">
    <div class="rate-stars" role="group" aria-label="Your rating">${stars}</div>
  </div>`;
}
function paintStars(root,value){
  root.querySelectorAll(".rate-stars button").forEach(b=>{
    const n=+b.dataset.star;
    const icon=value>=n?"star-fill":value>=n-0.5?"star-half-fill":"star-empty";
    b.innerHTML=svgIcon(icon,icon==="star-empty"?"":"filled");
  });
}
async function rateItem(ratingKey,stars){
  await fetch(`${server.uri}/:/rate?key=${ratingKey}&identifier=com.plexapp.plugins.library&rating=${stars*2}&X-Plex-Token=${server.token}`,
    {method:"PUT",headers:plexHeaders(server.token)});
}
function wireRateFloat(c,m){
  const root=c.querySelector(".rate-float,.dp-rate"); if(!root) return;
  const group=root.querySelector(".rate-stars");
  const current=()=>(m.userRating||0)/2;
  paintStars(root,current());
  const buttons=[...group.querySelectorAll("button")];
  const valueFromEvent=(b,e)=>{
    const n=+b.dataset.star;
    if(!e.clientX&&!e.clientY) return n;
    const r=b.getBoundingClientRect();
    return (e.clientX-r.left)<r.width/2?n-0.5:n;
  };
  buttons.forEach(b=>{
    b.onmousemove=e=>paintStars(root,valueFromEvent(b,e));
    b.onclick=async e=>{
      const val=valueFromEvent(b,e), prev=current(), next=val===prev?0:val;
      paintStars(root,next);
      try{ await rateItem(m.ratingKey,next); m.userRating=next*2; }
      catch(_){ paintStars(root,prev); }
    };
  });
  group.onmouseleave=()=>paintStars(root,current());
  // Touch swipe: drag across stars to rate; drag left of all stars to reset to 0
  const starFromTouch=t=>{
    for(const b of buttons){
      const r=b.getBoundingClientRect();
      if(t.clientX>=r.left&&t.clientX<=r.right) return +b.dataset.star;
    }
    if(buttons.length&&t.clientX<buttons[0].getBoundingClientRect().left) return 0;
    return +buttons[buttons.length-1].dataset.star;
  };
  let touchMoved=false, pendingVal=null;
  group.addEventListener("touchstart",()=>{ touchMoved=false; pendingVal=null; },{passive:true});
  group.addEventListener("touchmove",e=>{
    touchMoved=true; pendingVal=starFromTouch(e.touches[0]);
    paintStars(root,pendingVal); e.preventDefault();
  },{passive:false});
  group.addEventListener("touchend",async()=>{
    if(!touchMoved||pendingVal===null) return;
    const prev=current(), next=pendingVal;
    paintStars(root,next);
    try{ await rateItem(m.ratingKey,next); m.userRating=next*2; }
    catch(_){ paintStars(root,prev); }
  },{passive:true});
  group.addEventListener("touchcancel",()=>paintStars(root,current()),{passive:true});
}
/* Split heroes show the stars beside the play buttons (left, under the art) on
   desktop, but under the title on mobile. CSS can't reparent, so we move the
   single .dp-rate-row node between its mobile home (.dp-head) and the desktop
   action line. One shared resize listener keeps it correct across breakpoints. */
function placeDpRateRow(c){
  const rate=c.querySelector(".dp-hero--split .dp-rate-row"); if(!rate) return;
  const head=c.querySelector(".dp-hero--split .dp-head");
  const line=c.querySelector(".dp-hero--split .dp-actions-line");
  if(!head||!line) return;
  if(window.matchMedia("(min-width:681px)").matches){
    if(rate.parentElement!==line) line.appendChild(rate);
  }else if(rate.parentElement!==head){
    head.appendChild(rate);
  }
}
let _dpRateResizeBound=false;
function ensureDpRateResize(){
  if(_dpRateResizeBound) return;
  _dpRateResizeBound=true;
  window.addEventListener("resize",()=>{ const c=$("#content"); if(c) placeDpRateRow(c); });
}
/* Flat editorial art loader for movie/show/episode pages.
   Uses Plex backgroundSquare (1:1) for the poster, m.art for the backdrop strip.
   No ambient blur — flat editorial look. */
function wireCollArt(c,m){
  const posterImg=c.querySelector("#collPosterImg");
  if(posterImg){
    if(posterImg.complete) posterImg.classList.add("loaded");
    else posterImg.onload=()=>posterImg.classList.add("loaded");
  }
  const backdropImg=c.querySelector("#collBackdropImg");
  if(backdropImg){
    const src=collBackdrop(m);
    if(src){backdropImg.onload=()=>backdropImg.classList.add("loaded");backdropImg.src=img(src,1600,900);}
  }
}
function wireDetailArt(c,m,isEp){
  clearUltraBlur();
  const hero=c.querySelector(".dp-hero");
  const posterImg=c.querySelector("#dpPosterImg");
  let posterSampled=false;
  // Sample the dominant hue from a CORS-clean copy (the visible <img> has no
  // crossOrigin so it always paints; getImageData on it would taint the canvas).
  const sampleAccent=u=>{ if(u) _loadCorsImg(u).then(ci=>{ if(ci) extractImgAccent(ci,hero); }); };
  if(posterImg){
    if(isEp){
      const src=m.thumb||m.art||m.grandparentArt;
      if(src){const u=img(src,960,540);posterImg.onload=()=>posterImg.classList.add("loaded");posterImg.src=u;posterSampled=true;sampleAccent(u);}
    } else {
      const squareUrl=(m.Image||[]).find(i=>i.type==="backgroundSquare")?.url;
      const src=squareUrl||m.thumb||m.art;
      if(src){const u=img(src,800,800);posterImg.onload=()=>posterImg.classList.add("loaded");posterImg.src=u;posterSampled=true;sampleAccent(u);}
    }
  }
  const backdropImg=c.querySelector("#dpBackdropImg");
  if(backdropImg){
    const src=m.art||m.grandparentArt||m.thumb;
    if(src){
      const bu=img(src,1600,900);
      backdropImg.onload=()=>backdropImg.classList.add("loaded");
      backdropImg.src=bu;
      if(!posterSampled) sampleAccent(bu);
    }
  }
}
function wireBackdrop(c,art,mobileArt){
  const isMobile=window.innerWidth<=560;
  const pref=localStorage.getItem(LS.detailArt)||"backdrop";
  const ubSrc=isMobile&&pref==="square"&&mobileArt?mobileArt:art;
  setUltraBlur(ubSrc);
  wireDetailBg(c,art,mobileArt);
}
function wireDetailBg(c,art,mobileArt){
  if(!art) return;
  const pref=localStorage.getItem(LS.detailArt)||"backdrop";
  const isMobile=window.innerWidth<=560;
  const useSq=isMobile&&pref==="square"&&!!mobileArt;
  const src=useSq?mobileArt:art;
  const hero=c.querySelector(".detail-hero.full");
  if(hero&&useSq) hero.classList.add("sq");
  const blur=c.querySelector(".detail-bg-blur");
  if(blur) blur.style.backgroundImage=`url('${imgAmbient(src)}')`;
  const bgImg=c.querySelector(".detail-bg-img");
  if(bgImg){ bgImg.onload=()=>bgImg.classList.add("loaded"); bgImg.src=img(src,useSq?800:isMobile?800:1600,useSq?800:isMobile?600:900); }
  applyBackdropContrast(c.querySelector(".detail-hero"),art);
}
async function openMovie(it){
  setTitle(it.title); const c=$("#content"); c.innerHTML=skeletonDetail();
  try{
    const [mc,extras,related]=await Promise.all([api(`/library/metadata/${it.ratingKey}`),fetchExtras(it.ratingKey),fetchRelated(it.ratingKey)]);
    const m=(mc.Metadata||[])[0]||it;
    const resume=(m.viewOffset?`<button class="btn lg" id="resumeBtn">${svgIcon("play-fill")} Resume · ${fmtClock(m.viewOffset/1000)}</button>
      <button class="btn glass lg" id="restartBtn">${svgIcon("arrow-counter-clockwise")} Start over</button>`
      :`<button class="btn lg" id="playBtnD">${svgIcon("play-fill")} Play</button>`)+watchedToggleHTML(m,true);
    c.classList.add("dp-wrap");
    c.innerHTML=detailHero(m,true,resume,extras)+castRailHTML(m)+dpFilmCreditsHTML(m)+extrasRailHTML(extras);
    appendRelatedRails(c,related,m);
    c.insertAdjacentHTML("beforeend",'<div id="dpFilmStatsAnchor"></div>');
    wireDetailArt(c,m,false);
    wireExtras(c,extras,"ratingsTrailerBtn");
    wireCastRail(c);
    if(m.viewOffset){ $("#resumeBtn").onclick=()=>playItem(m,m.viewOffset); $("#restartBtn").onclick=()=>playItem(m,0); }
    else $("#playBtnD").onclick=()=>playItem(m,0);
    wireWatchedToggle(c,m,true);
    wireRateFloat(c,m);
    placeDpRateRow(c); ensureDpRateResize();
    enrichDetailPage(c,m,true,true);

    navDone();
  }catch(e){ c.innerHTML=errHTML(e); }
}
/* ---- SEASON SWITCHER (artwork cards, not pill tabs) ---- */
function seasonCard(s,active){
  const b=el("button","card season-card"+(active?" active":""));
  if(active) b.setAttribute("aria-current","true");
  b.innerHTML=`<div class="art"><img loading="lazy" alt="" src="${img(s.thumb,300,450)}"></div>
    <div class="ct">${esc(s.title||`Season ${s.index}`)}</div>
    <div class="cs">${s.leafCount?`${s.leafCount} episodes`:""}</div>`;
  return b;
}
async function openShow(it,jumpSeasonKey){
  setTitle(it.title); const c=$("#content"); c.innerHTML=skeletonDetail();
  try{
    const [meta,seasonsMc,extras,related]=await Promise.all([
      api(`/library/metadata/${it.ratingKey}`),
      api(`/library/metadata/${it.ratingKey}/children`),
      fetchExtras(it.ratingKey),
      fetchRelated(it.ratingKey)
    ]);
    const show=(meta.Metadata||[])[0]||it;
    const seasons=(seasonsMc.Metadata||[]).filter(s=>s.type==="season");
    const actions=`<button class="btn lg" id="playShow">${svgIcon("play-fill")} Play</button>
      <button class="btn glass lg icon" id="shuffleShow" aria-label="Shuffle" title="Shuffle">${svgIcon("shuffle")}</button>${watchedToggleHTML(show,false)}`;
    c.classList.add("dp-wrap");
    c.innerHTML=detailHero(show,false,actions,extras)
      +(seasons.length?`<div class="rail-section"><div class="rail-head"><h3>Seasons</h3><span class="count">${seasons.length}</span></div>
        <div class="season-rail" id="seasonRail"></div></div>`:"")
      +`<div class="section" style="padding-bottom:0"><h3 id="epListHeading">Episodes</h3></div><div class="ep-list carousel" id="epList"></div>`
      +castRailHTML(show)
      +dpFilmCreditsHTML(show)
      +extrasRailHTML(extras);
    appendRelatedRails(c,related,show);
    c.insertAdjacentHTML("beforeend",'<div id="dpFilmStatsAnchor"></div>');
    wireDetailArt(c,show,false);
    wireExtras(c,extras,"ratingsTrailerBtn");
    wireCastRail(c);
    wireRateFloat(c,show);
    placeDpRateRow(c); ensureDpRateResize();
    enrichDetailPage(c,show,false,true);

    const rail=$("#seasonRail");
    let activeSeason=seasons[0];
    if(jumpSeasonKey){ const f=seasons.find(s=>String(s.ratingKey)===String(jumpSeasonKey)); if(f) activeSeason=f; }
    if(rail) seasons.forEach(s=>{
      const b=seasonCard(s,s===activeSeason);
      b.onclick=()=>{ rail.querySelectorAll(".season-card").forEach(t=>{t.classList.remove("active");t.removeAttribute("aria-current");});
        b.classList.add("active"); b.setAttribute("aria-current","true"); activeSeason=s; loadEpisodes(s);
        history.replaceState(null,"",location.pathname+location.search+`#/show/${show.ratingKey}/season/${s.ratingKey}`); };
      rail.appendChild(b);
    });
    if(activeSeason) loadEpisodes(activeSeason);
    else $("#epList").innerHTML="<div class='empty'>No seasons found.</div>";
    $("#playShow").onclick=async()=>{
      const mc2=await api(`/library/metadata/${activeSeason.ratingKey}/children`);
      const eps=mc2.Metadata||[]; if(eps.length) playItem(eps[0],eps[0].viewOffset||0);
    };
    $("#shuffleShow").onclick=async()=>{
      const mc2=await api(`/library/metadata/${activeSeason.ratingKey}/children`);
      const eps=mc2.Metadata||[]; if(eps.length) playItem(eps[Math.floor(Math.random()*eps.length)],0);
    };
    wireWatchedToggle(c,show,false,()=>{ if(activeSeason) loadEpisodes(activeSeason); });

    navDone();
  }catch(e){ c.innerHTML=errHTML(e); }
}
/* ---- EPISODE WATCHED ICON ---- */
function epWatchedIcon(watched){
  return (watched&&getWatchedBadges())?` ${svgIcon("check-circle-fill","","color:var(--accent)")}`:"";
}
function closeEpMenus(){ document.querySelectorAll(".ep-menu-wrap.open").forEach(w=>{
  w.classList.remove("open"); const b=w.querySelector(".ep-more"); if(b) b.setAttribute("aria-expanded","false"); }); }
/* ---- MARK WATCHED / UNWATCHED ----
   Plex's legacy progress-report endpoints; same raw-fetch pattern as
   rateItem() for /:/rate. */
async function setWatched(ratingKey,watched){
  await fetch(`${server.uri}/:/${watched?"scrobble":"unscrobble"}?key=${ratingKey}&identifier=com.plexapp.plugins.library&X-Plex-Token=${server.token}`,
    {headers:plexHeaders(server.token)});
}
/* ---- WATCHED TOGGLE ----
   Pill button on movie/show/episode detail pages that flips the item's
   watched state via setWatched(), then repaints the button and stat row in
   place. For shows, "watched" means every episode has been seen. */
function isWatched(m,isMovie){
  return isMovie?!!m.viewCount:(!!m.leafCount&&m.viewedLeafCount===m.leafCount);
}
function watchedToggleHTML(m,isMovie){
  const watched=isWatched(m,isMovie);
  const label=watched?"Mark as unwatched":"Mark as watched";
  return `<button class="btn glass icon${watched?" active":""}" id="watchedToggle" aria-pressed="${watched}" title="${label}" aria-label="${label}">${svgIcon(watched?"check-circle-fill":"check-circle")}</button>`;
}
function paintWatchedToggle(btn,m,isMovie){
  const watched=isWatched(m,isMovie);
  const label=watched?"Mark as unwatched":"Mark as watched";
  btn.classList.toggle("active",watched);
  btn.setAttribute("aria-pressed",watched); btn.title=label; btn.setAttribute("aria-label",label);
  btn.innerHTML=`${svgIcon(watched?"check-circle-fill":"check-circle")}`;
}
function wireWatchedToggle(c,m,isMovie,onChange){
  const btn=c.querySelector("#watchedToggle"); if(!btn) return;
  btn.onclick=async()=>{
    const next=!isWatched(m,isMovie);
    btn.disabled=true;
    try{
      await setWatched(m.ratingKey,next);
      if(isMovie){ m.viewCount=next?1:0; m.viewOffset=0; }
      else m.viewedLeafCount=next?(m.leafCount||0):0;
      m.lastViewedAt=next?Math.floor(Date.now()/1000):null;
      paintWatchedToggle(btn,m,isMovie);
      const row=c.querySelector("#statRow"), html=statRowHTML(m,isMovie);
      if(row){ if(html) row.outerHTML=html; else row.remove(); }
      if(next) injectFirstWatched(m.ratingKey,!isMovie);
      if(onChange) onChange(next);
    }catch(_){}
    finally{ btn.disabled=false; }
  };
}
async function loadEpisodes(season){
  const list=$("#epList"); list.innerHTML="<div class='loading'>Loading episodes…</div>";
  const heading=$("#epListHeading");
  if(heading) heading.textContent=season.title||`Season ${season.index}`;
  try{
    const mc=await api(`/library/metadata/${season.ratingKey}/children`);
    const eps=mc.Metadata||[]; list.innerHTML="";
    const now=Date.now();
    eps.forEach(epm=>{
      const pct=epm.viewOffset&&epm.duration?(epm.viewOffset/epm.duration*100):0;
      const watched=epm.viewCount>0&&!pct;
      const upcoming=!epm.duration&&epm.originallyAvailableAt&&new Date(epm.originallyAvailableAt).getTime()>now;
      const tag=upcoming?`Coming ${fmtComing(epm.originallyAvailableAt)}`:(epm.index?`Episode ${epm.index}`:"Episode");
      const card=el("div","ep-card");
      card.innerHTML=`
        <button class="ep-thumb" aria-label="Play ${esc(epm.title||"Episode")}"${upcoming?" disabled":""}>
          <img loading="lazy" alt="" src="${img(epm.thumb,440,248)}">
          <div class="ep-tag${upcoming?" upcoming":""}">${esc(tag)}</div>
          ${!upcoming?`<div class="ep-play">${svgIcon("play-circle-fill")}</div>`:""}
          ${pct?`<div class="ep-prog"><i style="width:${pct}%"></i></div>`:""}
        </button>
        <div class="ep-card-body">
          <div class="et">${esc(epm.title)}${epWatchedIcon(watched)}</div>
          <div class="ed">${esc(epm.summary||"")}</div>
          <div class="ep-card-foot">
            <span class="edur">${epm.duration?`${svgIcon("play-circle-fill")} ${fmtDur(epm.duration)}`:(upcoming?esc(tag):"")}</span>
            ${!upcoming?`<div class="ep-menu-wrap">
              <button class="ep-more" aria-haspopup="true" aria-expanded="false" aria-label="More options for ${esc(epm.title||"episode")}">${svgIcon("dots-three")}</button>
              <div class="ep-menu" role="menu">
                <button role="menuitem" data-action="watched">${svgIcon("check-circle-fill")}<span>Mark as Watched</span></button>
                <button role="menuitem" data-action="unwatched">${svgIcon("check-circle")}<span>Mark as Unwatched</span></button>
              </div>
            </div>`:""}
          </div>
        </div>`;
      if(!upcoming) card.querySelector(".ep-thumb").onclick=()=>navigate(`/episode/${epm.ratingKey}`);
      const moreBtn=card.querySelector(".ep-more");
      if(moreBtn){
        const wrap=card.querySelector(".ep-menu-wrap");
        moreBtn.onclick=e=>{ e.stopPropagation();
          const willOpen=!wrap.classList.contains("open"); closeEpMenus();
          if(willOpen){ wrap.classList.add("open"); moreBtn.setAttribute("aria-expanded","true"); } };
        const markAs=async(val)=>{
          wrap.classList.remove("open");
          try{
            await setWatched(epm.ratingKey,val);
            epm.viewCount=val?1:0; epm.viewOffset=0;
            card.querySelector(".et").innerHTML=`${esc(epm.title)}${epWatchedIcon(val)}`;
            const prog=card.querySelector(".ep-prog"); if(prog) prog.remove();
          }catch(_){}
        };
        wrap.querySelector('[data-action="watched"]').onclick=()=>markAs(true);
        wrap.querySelector('[data-action="unwatched"]').onclick=()=>markAs(false);
      }
      list.appendChild(card);
    });
    if(!eps.length) list.innerHTML="<div class='empty'>No episodes.</div>";
    // Update Play button to reflect resume point or next unwatched episode
    const inProgress=eps.find(e=>(e.viewOffset||0)>0);
    const firstUnwatched=eps.find(e=>!e.viewCount);
    const upNext=inProgress||firstUnwatched;
    if(upNext){
      const playBtn=$("#playShow");
      if(playBtn){
        const epLabel=`S${upNext.parentIndex||""}E${upNext.index||""}`;
        const timeStr=upNext.viewOffset?` · ${fmtClock(upNext.viewOffset/1000)}`:"";
        playBtn.innerHTML=`${svgIcon("play-fill")} ${upNext.viewOffset?"Resume":"Play"} ${epLabel}${timeStr}`;
        playBtn.onclick=()=>playItem(upNext,upNext.viewOffset||0);
      }
    }
  }catch(e){ list.innerHTML=errHTML(e); }
}
/* ---- EPISODE DETAIL PAGE ---- */
async function openEpisode(it){
  setTitle(it.title||"Episode"); const c=$("#content"); c.innerHTML="<div class='loading'>Loading…</div>";
  try{
    const mc=await api(`/library/metadata/${it.ratingKey}`);
    const m=(mc.Metadata||[])[0]||it;
    const resume=m.viewOffset?`<button class="btn lg" id="resumeBtn">${svgIcon("play-fill")} Resume · ${fmtClock(m.viewOffset/1000)}</button>
      <button class="btn glass lg" id="restartBtn">${svgIcon("arrow-counter-clockwise")} Start over</button>`
      :`<button class="btn lg" id="playBtnD">${svgIcon("play-fill")} Play</button>`;
    const siblingsMc=m.parentRatingKey?await api(`/library/metadata/${m.parentRatingKey}/children`).catch(()=>({})):{};
    const siblings=(siblingsMc.Metadata||[]).filter(s=>s.type==="episode");
    c.classList.add("dp-wrap");
    c.innerHTML=episodeHero(m,resume)+castRailHTML(m)
      +(siblings.length?`<div class="rail-section"><div class="rail-head"><h3>More from Season ${m.parentIndex||""}</h3><span class="count">${siblings.length}</span></div>
        <div class="carousel" id="epSiblingRail"></div></div>`:"");
    if(siblings.length){ const row=$("#epSiblingRail");
      const sfrag=document.createDocumentFragment();
      siblings.forEach(s=>{
        const cd=card(s,true);
        if(String(s.ratingKey)===String(m.ratingKey)){
          cd.classList.add("current");
          const art=cd.querySelector(".art");
          if(art){ const tag=document.createElement("div"); tag.className="now-badge";
            tag.innerHTML=`${svgIcon("play-fill")} Now viewing`; art.appendChild(tag); }
        }
        sfrag.appendChild(cd);
      });
      row.appendChild(sfrag);
    }
    c.insertAdjacentHTML("beforeend",dpStatsHTML(m,true));
    wireDetailArt(c,m,true);
    wireCastRail(c);
    const back=$("#epBackBtn");
    if(back) back.onclick=()=>navigate(`/show/${m.grandparentRatingKey}/season/${m.parentRatingKey}`);
    if(m.viewOffset){ $("#resumeBtn").onclick=()=>playItem(m,m.viewOffset); $("#restartBtn").onclick=()=>playItem(m,0); }
    else $("#playBtnD").onclick=()=>playItem(m,0);
    wireWatchedToggle(c,m,true);
    injectFirstWatched(m.ratingKey,false);
    wireRateFloat(c,m);
    enrichDetailPage(c,m,true);

    navDone();
  }catch(e){ c.innerHTML=errHTML(e); }
}

/* ============================================================ SEARCH */
function showMobileSearch(prefill){
  setTitle("Search"); clearUltraBlur();
  const c=$("#content");
  c.innerHTML=`<div class="mobile-search-landing" id="mobileSearchPage">
    <div class="ms-hero">
      <h2>Search</h2>
      <div class="ms-field">
        <span class="svgi" style="--i:url('assets/images/icons/ui/magnifying-glass.svg')" aria-hidden="true"></span>
        <input id="mobileSearchInput" type="search" placeholder="Movies, shows, people…"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
    </div>
    <div id="mobileSearchResults"></div>
    <div class="ms-spacer"></div>
  </div>`;
  const inp=c.querySelector("#mobileSearchInput");
  if(!inp) return;
  if(prefill){ inp.value=prefill; runMobileSearch(prefill); }
  else{ requestAnimationFrame(()=>inp.focus()); loadMobileSearchLanding(); }
  let st=null;
  inp.addEventListener("input",e=>{
    clearTimeout(st);
    const q=e.target.value.trim();
    const res=document.getElementById("mobileSearchResults");
    if(!q){ loadMobileSearchLanding(); history.replaceState(null,"",location.pathname+location.search+"#/search"); return; }
    st=setTimeout(()=>{
      if(q.length>=2){
        history.replaceState(null,"",location.pathname+location.search+`#/search?q=${encodeURIComponent(q)}`);
        runMobileSearch(q);
      }
    },500);
  });
}
async function loadMobileSearchLanding(){
  const container=document.getElementById("mobileSearchResults");
  if(!container) return;
  container.innerHTML="";
  try{
    const genres=await fetchGenreData();
    if(!genres.length) return;
    const cur=document.getElementById("mobileSearchResults");
    if(!cur||cur.innerHTML!=="") return; // user started typing, don't clobber results
    const label=el("div","");
    label.style.cssText="padding:16px 16px 4px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)";
    label.textContent="Browse";
    cur.appendChild(label);
    const sec=genreRailSection(genres,getRailStyle(GENRE_CARDS_KEY));
    sec.querySelector(".rail-head")?.remove();
    sec.style.paddingTop="0";
    cur.appendChild(sec);
  }catch(e){ /* fail silently */ }
}
async function runMobileSearch(q){
  const container=document.getElementById("mobileSearchResults");
  if(!container) return;
  container.innerHTML="<div class='loading' style='margin:24px 0'>Searching…</div>";
  try{
    const mc=await api(`/hubs/search?query=${encodeURIComponent(q)}&limit=40`);
    const hubs=(mc.Hub||[]).map(h=>{
      const isPeopleHub=/people|actor|cast/i.test(h.title)||h.type==="person";
      const items=[...(h.Metadata||[]),...(h.Directory||[])]
        .map(x=>{const isPerson=x.type==="person"||isPeopleHub;return isPerson?{...x,type:"person",title:x.tag||x.title||x.name||""}:x;})
        .filter(x=>["movie","show","episode","season","person"].includes(x.type));
      return {title:h.title,items};
    }).filter(h=>h.items.length);
    if(!hubs.length){ container.innerHTML=`<div class="empty" style="padding:40px 0">${svgIcon("magnifying-glass")}No results for "${esc(q)}"</div>`; return; }
    container.innerHTML="";
    hubs.forEach(h=>container.appendChild(railSection(h.title,h.items,h.items.every(i=>i.type==="episode"),false)));
  }catch(e){ container.innerHTML=errHTML(e); }
}
let searchTimer=null;
$("#search").addEventListener("input",e=>{
  clearTimeout(searchTimer); const q=e.target.value.trim();
  searchTimer=setTimeout(()=>{
    const cur=location.hash.replace(/^#\/?/,"").split("?")[0];
    if(q.length>=2){
      const path=`/search?q=${encodeURIComponent(q)}`;
      if(cur==="search"){ history.replaceState(null,"",location.pathname+location.search+"#"+path); runSearch(q); }
      else location.hash=path;
    }else if(!q && cur==="search") navigate("/");
  },350);
});
async function runSearch(q){
  setTitle(`Results for "${q}"`); clearUltraBlur(); const c=$("#content"); c.innerHTML="<div class='loading'>Searching…</div>";
  try{
    const mc=await api(`/hubs/search?query=${encodeURIComponent(q)}&limit=40`);
    const hubs=(mc.Hub||[]).map(h=>{
      const isPeopleHub=/people|actor|cast/i.test(h.title)||h.type==="person";
      const items=[...(h.Metadata||[]),...(h.Directory||[])]
        .map(x=>{
          const isPerson=x.type==="person"||isPeopleHub;
          return isPerson?{...x,type:"person",title:x.tag||x.title||x.name||""}:x;
        })
        .filter(x=>["movie","show","episode","season","person"].includes(x.type));
      return {title:h.title,items};
    }).filter(h=>h.items.length);
    const total=hubs.reduce((a,h)=>a+h.items.length,0);
    const head=`<div class="search-head"><h2>"${esc(q)}"</h2>${total?`<span class="count">${total} result${total===1?"":"s"}</span>`:""}</div>`;
    if(!hubs.length){
      c.innerHTML=head+`<div class="empty">${svgIcon("magnifying-glass")}No results for "${esc(q)}"
        <div style="margin-top:6px;font-size:13px">Try a different title, cast member, or genre.</div></div>`;
      return;
    }
    c.innerHTML=head;
    hubs.forEach(h=>c.appendChild(railSection(h.title,h.items,h.items.every(i=>i.type==="episode"),false)));

  }catch(e){ c.innerHTML=errHTML(e); }
}

const video=$("#video");
let hls=null, currentItem=null, sessionId=null, triedFallback=false, playerOpener=null;
let qIndex=0;                         // selected quality (0 = Auto)
let autoStep=0;                       // rung on AUTO_LADDER
let stalls=[], lastSeekAt=0;
let audioChanged=false, subOn=false;  // track overrides force the server-mux path
let prevEp=null, nextEp=null, nuTimer=null;
let nextEpWarmed=false, warmedNext=null; // warmedNext: {ratingKey,sessionId,res,br} | null
let everPlayed=false;
let introMarkerDone=false, creditsUpNextShown=false; // Plex intro/credits marker state
let seasonEps=[]; // the current episode's full season, for the in-player Episodes panel

const QUALITIES=[
  {label:"Auto",        sub:"Adapts to keep playback smooth", mode:"auto"},
  {label:"Original",    sub:"Force direct play",              mode:"original"},
  {label:"1080p High",  sub:"12 Mbps", mode:"convert", res:"1920x1080", br:12000},
  {label:"1080p",       sub:"8 Mbps",  mode:"convert", res:"1920x1080", br:8000},
  {label:"720p",        sub:"4 Mbps",  mode:"convert", res:"1280x720",  br:4000},
  {label:"480p",        sub:"2 Mbps",  mode:"convert", res:"720x480",   br:2000},
];

const AUTO_LADDER=[
  {res:null,br:null},
  {res:null,br:12000},
  {res:null,br:8000},
  {res:"1280x720",br:4000},
  {res:"1280x720",br:2500},
  {res:"720x480",br:1500},
];

async function playItem(it,offsetMs){
  playerOpener=document.activeElement;
  $("#player").classList.add("show");
  $("#playOnBtn").classList.remove("hidden");
  playerLoading(true,"Loading", it);
  // Always pull full metadata WITH chapters + intro/credits markers so the
  // chapters panel and the credits-triggered "Up Next" have data to work with
  // (a detail-page item usually arrives without either).
  let full=it;
  try{ const mc=await api(`/library/metadata/${it.ratingKey}?includeChapters=1&includeMarkers=1`); full=(mc.Metadata||[])[0]||it; }catch(_){}
  currentItem=full; triedFallback=false; autoStep=0; stalls=[]; everPlayed=false;
  introMarkerDone=false; creditsUpNextShown=false;
  audioChanged=false; subOn=isSubSelected();
  prevEp=null; nextEp=null; nextEpWarmed=false; hideNextUp(); $("#skipIntro").hidden=true;
  seasonEps=[];
  updateEpNav();
  loadAdjacentEpisodes();
  if(full.type==="episode"){
    $("#pTitle").innerHTML=`<span class="pt-main">${esc(full.grandparentTitle||"")}</span>`
      +`<span class="pt-sub">Season ${full.parentIndex} · Episode ${full.index} · ${esc(full.title||"")}</span>`;
    $("#miniTitle").textContent=`${full.grandparentTitle} · S${full.parentIndex}E${full.index} · ${full.title}`;
  }else{
    $("#pTitle").innerHTML=`<span class="pt-main">${esc(full.title||"")}</span>`;
    $("#miniTitle").textContent=full.title||"";
  }
  updatePauseInfo();
  buildPlayerMenu();
  renderChapterMarks();
  if(panelOpen()) renderPanel();
  startStream(offsetMs||0);
  bindActivity();
  setTimeout(()=>$("#playBtn").focus(),50);
}
function partOf(it){ const m=(it.Media||[])[0]; return m&&(m.Part||[])[0]; }
function mediaOf(it){ return (it.Media||[])[0]; }
function streamsOf(){ const p=partOf(currentItem); return (p&&p.Stream)||[]; }
function defaultSubSelected(it){ const p=partOf(it); return !!(p&&(p.Stream||[]).some(s=>s.streamType===3&&s.selected)); }
function isSubSelected(){ return defaultSubSelected(currentItem); }

function canDirectPlay(it){
  const m=mediaOf(it); if(!m) return false;
  const cont=(m.container||"").toLowerCase();
  const vc=(m.videoCodec||"").toLowerCase();
  const ac=(m.audioCodec||"").toLowerCase();
  const okC=["mp4","m4v","mov"].includes(cont);
  const okV=vc==="h264"||(vc==="hevc"&&video.canPlayType('video/mp4; codecs="hvc1"')!=="");
  const okA=["aac","mp3"].includes(ac);
  if(!(okC&&okV&&okA)) return false;
  return video.canPlayType('video/mp4; codecs="avc1.640028,mp4a.40.2"')!=="";
}

function startStream(offsetMs){
  hideNextUp();
  const q=QUALITIES[qIndex]||QUALITIES[0];
  const needsServerMux = audioChanged || subOn;  // chosen tracks require the HLS path
  let useDirect=false, res=null, br=null;
  if(q.mode==="original"){ useDirect=true; }
  else if(q.mode==="auto"){
    if(!needsServerMux && autoStep===0 && canDirectPlay(currentItem)) useDirect=true;
    else { const r=AUTO_LADDER[Math.min(autoStep,AUTO_LADDER.length-1)]; res=r.res; br=r.br; }
  }
  else { res=q.res; br=q.br; }

  
  const warm=(!useDirect && warmedNext && warmedNext.ratingKey===String(currentItem.ratingKey)
    && warmedNext.res===res && warmedNext.br===br) ? warmedNext : null;
  if(warmedNext && warmedNext!==warm) stopSession(warmedNext.sessionId);
  warmedNext=null;
  if(sessionId && sessionId!==(warm&&warm.sessionId)) stopSession(sessionId); // free the old transcoder on the server
  sessionId=warm?warm.sessionId:"hume-"+crypto.randomUUID();

  cleanupHls(); video.onerror=null;
  if(useDirect) directPlay(offsetMs,q.mode==="original");
  else transcode(offsetMs,res,br);
}

function directPlay(offsetMs,forced){
  const part=partOf(currentItem);
  if(!part){ transcode(offsetMs,null,null); return; }
  playerLoading(true,"Loading");
  setStatus(false,"Direct Play");
  const url=`${server.uri}${part.key}?X-Plex-Token=${server.token}`;
  let settled=false;
  const wd=setTimeout(()=>{ if(!settled&&!forced){ settled=true; doFallback(offsetMs);} },8000);
  video.src=url;
  video.onloadedmetadata=()=>{ settled=true; clearTimeout(wd);
    if(offsetMs) video.currentTime=offsetMs/1000; video.play().catch(()=>{}); };
  video.onerror=()=>{ if(settled)return; settled=true; clearTimeout(wd);
    if(forced){ playerLoading(true,"This file can't direct play in a browser"); } else doFallback(offsetMs); };
  startTimeline();
}
function doFallback(offsetMs){ if(triedFallback){ playerLoading(true,"Playback failed"); return; }
  triedFallback=true; transcode(offsetMs,null,null); }

function transcode(offsetMs,res,br){
  cleanupHls(); playerLoading(true,"Preparing stream");
  const params=new URLSearchParams({
    path:`/library/metadata/${currentItem.ratingKey}`,
    mediaIndex:0, partIndex:0, protocol:"hls", fastSeek:1,
    directPlay:0, directStream:1, directStreamAudio:1,
    subtitles:"burn", subtitleSize:100, audioBoost:100, mediaBufferSize:102400,
    location:server.local?"lan":"wan", autoAdjustQuality:0,
    maxVideoBitrate: br||40000,            // high cap => Plex copies h264 instead of re-encoding
    videoQuality:100, offset:Math.floor((offsetMs||0)/1000),
    "X-Plex-Client-Identifier":clientId(), "X-Plex-Session-Identifier":sessionId,
    "X-Plex-Platform":"Web", session:sessionId, "X-Plex-Token":server.token
  });
  if(res) params.set("videoResolution",res);
  const m3u8=`${server.uri}/video/:/transcode/universal/start.m3u8?${params.toString()}`;
  setStatus(!!br, br?`Streaming · ${br>=8000?"1080p":br>=2500?"720p":"480p"} cap`:"Streaming");

  if(window.Hls&&Hls.isSupported()){
    hls=new Hls({
      maxBufferLength:30,            // ~30s forward prefetch: rides out brief drops
      maxMaxBufferLength:60,
      backBufferLength:30,           // trim behind playhead: bounds memory
      manifestLoadingMaxRetry:8, manifestLoadingRetryDelay:1000, manifestLoadingMaxRetryTimeout:20000,
      fragLoadingMaxRetry:10, fragLoadingRetryDelay:1000, fragLoadingMaxRetryTimeout:20000,
      // Plex's segment URLs don't carry auth; append the token to every request
      xhrSetup:(xhr,url)=>{
        const u=url.indexOf("X-Plex-Token")===-1
          ? url+(url.indexOf("?")===-1?"?":"&")+"X-Plex-Token="+encodeURIComponent(server.token)
          : url;
        xhr.open("GET",u,true);
      }
    });
    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED,()=>hls.loadSource(m3u8));
    hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}));
    hls.on(Hls.Events.ERROR,(_,d)=>{
      if(!d.fatal) return;
      if(d.type===Hls.ErrorTypes.NETWORK_ERROR){ hls.startLoad(); }
      else if(d.type===Hls.ErrorTypes.MEDIA_ERROR){ hls.recoverMediaError(); }
      else{ playerLoading(true,"Stream error — try a lower quality"); }
    });
  }else{
    video.src=m3u8;
    video.onloadedmetadata=()=>video.play().catch(()=>{});
  }
  startTimeline();
}
function cleanupHls(){ if(hls){ hls.destroy(); hls=null; } }
function stopSession(id){
  fetch(`${server.uri}/video/:/transcode/universal/stop?session=${encodeURIComponent(id)}&X-Plex-Token=${server.token}`)
    .catch(()=>{});
}

/* ---- stall-based quality adaptation (Auto only) ---- */
video.addEventListener("waiting",()=>{
  playerLoading(true,"Buffering");
  if(performance.now()-lastSeekAt<2500) return;       // seeks legitimately buffer
  if((QUALITIES[qIndex]||{}).mode!=="auto") return;
  const now=performance.now();
  stalls=stalls.filter(t=>now-t<45000); stalls.push(now);
  if(stalls.length>=3 && autoStep<AUTO_LADDER.length-1){
    autoStep++; stalls=[];
    toast("Lowering quality to keep playback smooth");
    startStream((video.currentTime||0)*1000);
  }
});
video.addEventListener("seeking",()=>{ lastSeekAt=performance.now(); });
video.addEventListener("playing",()=>{ everPlayed=true; playerLoading(false); });
video.addEventListener("canplay",()=>playerLoading(false));

/* ---- settings menu: Quality / Audio / Subtitles ----
   role=menuitemradio + aria-checked mirrors the visual checkmark (i.ck) for
   screen readers; arrow-key navigation is handled by the shared menu
   keydown handler below. */
function buildPlayerMenu(){
  const m=$("#pMenu"); m.innerHTML="";
  const add=(html)=>{ m.insertAdjacentHTML("beforeend",html); };
  const radio=(active,html,onclick)=>{
    const b=el("button",active?"active":""); b.setAttribute("role","menuitemradio");
    b.setAttribute("aria-checked",String(active));
    b.innerHTML=`${svgIcon("check","ck")}${html}`;
    b.onclick=onclick; m.appendChild(b);
  };
  add('<div class="mh">Quality</div>');
  QUALITIES.forEach((q,i)=>{
    radio(i===qIndex, `<span class="ml">${q.label}<span class="msub">${q.sub}</span></span>`, ()=>{
      qIndex=i; autoStep=0; stalls=[]; closeSettingsMenu();
      buildPlayerMenu(); startStream((video.currentTime||0)*1000);
    });
  });
  const streams=streamsOf();
  const auds=streams.filter(s=>s.streamType===2);
  if(auds.length>1){
    add('<div class="mh">Audio</div>');
    auds.forEach(s=>{
      radio(!!s.selected, `<span class="ml">${esc(s.displayTitle||s.language||("Track "+s.index))}</span>`,
        ()=>selectStream("audio",s));
    });
  }
  const subs=streams.filter(s=>s.streamType===3);
  if(subs.length){
    add('<div class="mh">Subtitles</div>');
    radio(!subs.some(s=>s.selected), `<span class="ml">Off</span>`, ()=>selectStream("sub",null));
    subs.forEach(s=>{
      radio(!!s.selected, `<span class="ml">${esc(s.displayTitle||s.language||("Subtitle "+s.index))}</span>`,
        ()=>selectStream("sub",s));
    });
  }
}
function closeSettingsMenu(){ $("#pMenu").classList.remove("open"); $("#settingsBtn").setAttribute("aria-expanded","false"); }
async function selectStream(kind,s){
  const part=partOf(currentItem); if(!part||!part.id) return;
  closeSettingsMenu();
  const t=video.currentTime*1000||0;
  try{
    const q = kind==="audio"
      ? `audioStreamID=${s.id}` : `subtitleStreamID=${s?s.id:0}`;
    await fetch(`${server.uri}/library/parts/${part.id}?${q}&allParts=1&X-Plex-Token=${server.token}`,
      {method:"PUT",headers:plexHeaders(server.token)});
    // update local stream flags so the menu reflects reality without a refetch
    streamsOf().forEach(x=>{
      if(kind==="audio"&&x.streamType===2) x.selected=(x.id===s.id);
      if(kind==="sub"&&x.streamType===3)   x.selected=(s&&x.id===s.id)?true:false;
    });
    if(kind==="audio") audioChanged=true;
    subOn=isSubSelected();
    buildPlayerMenu();
    startStream(t);   // restart in place; server muxes/burns the chosen tracks
  }catch(_){ toast("Couldn't switch track"); }
}
$("#settingsBtn").onclick=e=>{ e.stopPropagation(); closePanel(); $("#chaptersBtn").setAttribute("aria-expanded","false");
  const open=$("#pMenu").classList.toggle("open"); $("#settingsBtn").setAttribute("aria-expanded",String(open));
  if(open) $("#pMenu").querySelector("button")?.focus(); };
document.addEventListener("click",e=>{
  if(!$("#pMenu").contains(e.target)&&e.target!==$("#settingsBtn")){ $("#pMenu").classList.remove("open"); $("#settingsBtn").setAttribute("aria-expanded","false"); }
});

/* ---- chapters ---- */
function renderChapterMarks(){
  const wrap=$("#chapterMarks"); wrap.innerHTML="";
  const chapters=(currentItem&&currentItem.Chapter)||[];
  const dur=currentItem&&currentItem.duration;
  if(!chapters.length||!dur) return;
  chapters.forEach(ch=>{
    if(!ch.startTimeOffset) return;
    const mark=el("div","p-chapter-mark");
    mark.style.left=(ch.startTimeOffset/dur*100)+"%";
    wrap.appendChild(mark);
  });
}
/* ---- RIGHT PANEL: chapters / play queue ---- */
function panelOpen(){ return $("#pPanel").classList.contains("show"); }
function openPanel(){
  $("#pMenu").classList.remove("open"); $("#settingsBtn").setAttribute("aria-expanded","false");
  $("#pPanel").classList.add("show"); $("#pPanel").setAttribute("aria-hidden","false");
  $("#pPanelScrim").classList.add("show");
  $("#player").classList.add("panel-open");
  $("#chaptersBtn").setAttribute("aria-expanded","true");
  renderPanel();
}
function closePanel(){
  $("#pPanel").classList.remove("show"); $("#pPanel").setAttribute("aria-hidden","true");
  $("#pPanelScrim").classList.remove("show");
  $("#player").classList.remove("panel-open");
  $("#chaptersBtn").setAttribute("aria-expanded","false");
}
function togglePanel(){ panelOpen()?closePanel():openPanel(); }
function panelItem(opts){
  const b=el("button","pp-item"+(opts.now?" now":""));
  b.innerHTML=`<div class="pp-thumb"><img loading="lazy" alt="" src="${img(opts.thumb,144,81)}">
    ${opts.pct?`<div class="pp-prog"><i style="width:${opts.pct}%"></i></div>`:""}</div>
    <div class="pp-text"><div class="pp-t">${esc(opts.title||"")}</div><div class="pp-s">${esc(opts.sub||"")}</div></div>`;
  if(opts.onClick) b.onclick=opts.onClick;
  return b;
}
function panelSection(label){
  const sec=el("div","pp-section");
  const head=el("div","pp-head"); head.textContent=label;
  const list=el("div","pp-list");
  sec.appendChild(head); sec.appendChild(list);
  return sec;
}
function renderPanel(){
  const body=$("#pPanelBody"); body.innerHTML="";
  const chapters=(currentItem&&currentItem.Chapter)||[];
  if(chapters.length){
    const sec=panelSection("Chapters"), list=sec.querySelector(".pp-list");
    const cur=video.currentTime||0;
    chapters.forEach((ch,idx)=>{
      const start=(ch.startTimeOffset||0)/1000;
      const end=ch.endTimeOffset?ch.endTimeOffset/1000:(chapters[idx+1]?chapters[idx+1].startTimeOffset/1000:1e9);
      list.appendChild(panelItem({
        thumb:ch.thumb, title:ch.tag||("Chapter "+(idx+1)), sub:fmtClock(start),
        now:cur>=start&&cur<end,
        onClick:()=>{ if(video.duration) video.currentTime=start; video.play().catch(()=>{}); }
      }));
    });
    body.appendChild(sec);
  }
  if(currentItem&&currentItem.type==="episode"&&(seasonEps||[]).length){
    const sec=panelSection("Play Queue"), list=sec.querySelector(".pp-list");
    seasonEps.forEach(ep=>{
      const now=String(ep.ratingKey)===String(currentItem.ratingKey);
      const pct=ep.viewOffset&&ep.duration?(ep.viewOffset/ep.duration*100):0;
      list.appendChild(panelItem({
        thumb:ep.thumb||ep.parentThumb, title:ep.title||("Episode "+ep.index),
        sub:now?"Now playing":("E"+(ep.index||"?")), now, pct,
        onClick:now?null:()=>playItem(ep,0)
      }));
    });
    body.appendChild(sec);
    setTimeout(()=>sec.querySelector(".pp-item.now")?.scrollIntoView({block:"nearest"}),280);
  }
}
$("#chaptersBtn").onclick=e=>{ e.stopPropagation(); togglePanel(); };
$("#pPanelClose").onclick=closePanel;
$("#pPanelScrim").onclick=closePanel;

/* ---- accessible menu keyboard navigation (arrows / escape / tab) ---- */
function menuKeyHandler(menu,toggleBtn){
  menu.addEventListener("keydown",e=>{
    const items=[...menu.querySelectorAll("button")];
    const i=items.indexOf(document.activeElement);
    if(e.key==="ArrowDown"){ e.preventDefault(); (items[i+1]||items[0])?.focus(); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); (items[i-1]||items[items.length-1])?.focus(); }
    else if(e.key==="Home"){ e.preventDefault(); items[0]?.focus(); }
    else if(e.key==="End"){ e.preventDefault(); items[items.length-1]?.focus(); }
    else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); menu.classList.remove("open");
      if(toggleBtn) { toggleBtn.setAttribute("aria-expanded","false"); toggleBtn.focus(); } }
    else if(e.key==="Tab"){ menu.classList.remove("open"); if(toggleBtn) toggleBtn.setAttribute("aria-expanded","false"); }
  });
}
menuKeyHandler($("#pMenu"),$("#settingsBtn"));

/* ---- transport controls ---- */
$("#playBtn").onclick=togglePlay;
$("#pauseResume").onclick=()=>video.play().catch(()=>{});
function togglePlay(){
  if(isCasting()){ remotePlayerController.playOrPause(); return; }
  if(video.paused) video.play(); else video.pause();
}
video.addEventListener("click",()=>{ if($("#player").classList.contains("min"))return; togglePlay(); });
video.addEventListener("dblclick",toggleFull);
video.addEventListener("play",()=>{ setPlayIcon(true); $("#player").classList.remove("paused"); });
video.addEventListener("pause",()=>{ setPlayIcon(false); if(everPlayed) $("#player").classList.add("paused"); });
function setPlayIcon(playing){
  const icon=svgIcon(playing?"pause":"play-fill");
  const label=playing?"Pause":"Play";
  $("#playBtn").innerHTML=icon; $("#playBtn").setAttribute("aria-label",label);
  $("#miniPlay").innerHTML=icon; $("#miniPlay").setAttribute("aria-label",label);
}

$("#back10").onclick=()=>{
  if(isCasting()){ remotePlayer.currentTime=Math.max(0,(remotePlayer.currentTime||0)-10); remotePlayerController.seek(); return; }
  video.currentTime=Math.max(0,video.currentTime-10);
};
$("#fwd10").onclick=()=>{
  if(isCasting()){ remotePlayer.currentTime=Math.min(remotePlayer.duration||1e9,(remotePlayer.currentTime||0)+10); remotePlayerController.seek(); return; }
  video.currentTime=Math.min(video.duration||1e9,video.currentTime+10);
};
$("#prevEpBtn").onclick=()=>{ if(prevEp) playItem(prevEp,0); };
$("#nextEpBtn").onclick=()=>{ if(nextEp) playItem(nextEp,0); };

video.addEventListener("timeupdate",()=>{
  const d=video.duration||0, t=video.currentTime||0;
  const pct=d?t/d*100:0;
  $("#played").style.width=pct+"%"; $("#knob").style.left=pct+"%";
  $("#curTime").textContent=fmtClock(t); $("#durTime").textContent=fmtClock(d);
  $("#seekTrack").setAttribute("aria-valuenow",String(Math.round(pct)));
  $("#seekTrack").setAttribute("aria-valuetext",`${fmtClock(t)} of ${fmtClock(d)}`);
  if(video.buffered.length){ try{ const end=video.buffered.end(video.buffered.length-1);
    $("#buffered").style.width=(d?end/d*100:0)+"%"; }catch(_){} }
  maybeWarmNext(d,t);
  handleMarkers(t);
});

/* ---- Plex intro/credits markers: Skip Intro + credits-triggered Up Next ---- */
function currentMarker(type,t){
  const ms=t*1000;
  return ((currentItem&&currentItem.Marker)||[]).find(m=>{
    if(m.type!==type) return false;
    const s=m.startTimeOffset||0, e=m.endTimeOffset||Infinity;
    return ms>=s && ms<e;
  });
}
function handleMarkers(t){
  const btn=$("#skipIntro");
  const intro=introMarkerDone?null:currentMarker("intro",t);
  if(intro){ if(btn.hidden){ btn.hidden=false; btn.dataset.to=String((intro.endTimeOffset||0)/1000); } }
  else if(!btn.hidden){ btn.hidden=true; }
  // During the credits, surface "Up Next" early (episodes with a known next).
  if(!creditsUpNextShown && nextEp && currentMarker("credits",t)){
    creditsUpNextShown=true; showNextUp();
  }
}
$("#skipIntro").onclick=()=>{
  const to=parseFloat($("#skipIntro").dataset.to||"0");
  if(to&&video.duration) video.currentTime=to;
  introMarkerDone=true; $("#skipIntro").hidden=true; video.play().catch(()=>{});
};

/* seek bar */
const track=$("#seekTrack"); let scrubbing=false;
function seekFromEvent(e){ const r=track.getBoundingClientRect();
  const x=Math.min(Math.max((e.clientX-r.left)/r.width,0),1);
  if(isCasting()){ remotePlayer.currentTime=x*(remotePlayer.duration||0); remotePlayerController.seek(); return x; }
  if(video.duration) video.currentTime=x*video.duration; return x; }
track.addEventListener("pointerdown",e=>{ scrubbing=true; track.setPointerCapture(e.pointerId); seekFromEvent(e); });
track.addEventListener("pointermove",e=>{
  const r=track.getBoundingClientRect(); const x=Math.min(Math.max((e.clientX-r.left)/r.width,0),1);
  const ht=$("#hoverTime"); ht.style.display="block"; ht.style.left=(x*100)+"%";
  ht.textContent=fmtClock(x*((isCasting()?remotePlayer.duration:video.duration)||0));
  if(scrubbing) seekFromEvent(e);
});
track.addEventListener("pointerup",()=>{ scrubbing=false; });
track.addEventListener("pointerleave",()=>{ $("#hoverTime").style.display="none"; });
/* Left/Right (±5s) and Up/Down (volume) are handled by the global keydown
   handler below even while the slider is focused; Home/End jump to the
   start/end here since those aren't otherwise mapped. */
track.addEventListener("keydown",e=>{
  if(!video.duration) return;
  if(e.key==="Home"){ e.preventDefault(); video.currentTime=0; }
  else if(e.key==="End"){ e.preventDefault(); video.currentTime=video.duration; }
});

/* volume */
const vol=$("#volSlider");
vol.oninput=e=>{ video.volume=+e.target.value; video.muted=video.volume===0; updateVolIcon(); };
$("#muteBtn").onclick=()=>{ video.muted=!video.muted; updateVolIcon(); };
function updateVolIcon(){ const v=video.muted?0:video.volume;
  const ic=v===0?"speaker-none":v<0.5?"speaker-low":"speaker-high";
  $("#muteBtn").innerHTML=svgIcon(ic);
  $("#muteBtn").setAttribute("aria-label",v===0?"Unmute":"Mute");
  vol.value=video.muted?0:video.volume; }

/* fullscreen */
$("#fullBtn").onclick=toggleFull;
function toggleFull(){ if(document.fullscreenElement) document.exitFullscreen();
  else $("#player").requestFullscreen?.().catch(()=>{}); }
document.addEventListener("fullscreenchange",()=>{
  const f=!!document.fullscreenElement;
  $("#fullBtn").innerHTML=svgIcon(f?"corners-in":"corners-out");
  $("#fullBtn").setAttribute("aria-label",f?"Exit fullscreen":"Fullscreen"); });

/* PiP */
$("#pipBtn").onclick=async()=>{ try{
  if(document.pictureInPictureElement) await document.exitPictureInPicture();
  else if(video.requestPictureInPicture) await video.requestPictureInPicture();
}catch(_){ toast("Picture-in-picture unavailable"); } };

/* Hide fullscreen/PiP controls entirely when the host page disallows them
   (e.g. a sandboxed iframe's Permissions Policy) instead of showing a
   button that silently does nothing. */
if(!document.fullscreenEnabled) $("#fullBtn").classList.add("hidden");
if(!document.pictureInPictureEnabled||!video.requestPictureInPicture) $("#pipBtn").classList.add("hidden");

/* ---- Google Cast + AirPlay ---- */
let castSession=null, remotePlayer=null, remotePlayerController=null, castSyncInterval=null;

function isCasting(){ return !!castSession; }

function startCastSync(){
  clearInterval(castSyncInterval);
  castSyncInterval=setInterval(()=>{
    if(!isCasting()||!remotePlayer){ clearInterval(castSyncInterval); return; }
    const t=remotePlayer.currentTime||0, d=remotePlayer.duration||0;
    const pct=d?t/d*100:0;
    $("#played").style.width=pct+"%"; $("#knob").style.left=pct+"%";
    $("#curTime").textContent=fmtClock(t);
    if(d) $("#durTime").textContent=fmtClock(d);
    $("#seekTrack").setAttribute("aria-valuenow",String(Math.round(pct)));
    $("#seekTrack").setAttribute("aria-valuetext",`${fmtClock(t)} of ${fmtClock(d)}`);
  },1000);
}

function castCurrentItem(){
  if(!castSession||!currentItem) return;
  const part=partOf(currentItem);
  if(!part) return;
  const url=`${server.uri}${part.key}?X-Plex-Token=${server.token}`;
  const mi=new chrome.cast.media.MediaInfo(url,"video/mp4");
  mi.metadata=new chrome.cast.media.MovieMediaMetadata();
  mi.metadata.title=currentItem.title||"";
  const thumbUrl=img(currentItem.thumb||currentItem.art,800,450);
  if(thumbUrl) mi.metadata.images=[new chrome.cast.Image(thumbUrl)];
  const req=new chrome.cast.media.LoadRequest(mi);
  req.currentTime=video.currentTime||0;
  castSession.loadMedia(req).then(()=>{
    video.pause();
    setStatus(true,"Casting");
    startCastSync();
  }).catch(e=>toast("Cast error: "+(e.description||e)));
}

window.__onGCastApiAvailable=function(isAvailable){
  if(!isAvailable) return;
  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId:chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy:chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });
  remotePlayer=new cast.framework.RemotePlayer();
  remotePlayerController=new cast.framework.RemotePlayerController(remotePlayer);
  const castBtn=$("#castBtn");
  if(castBtn) castBtn.classList.remove("hidden");

  cast.framework.CastContext.getInstance().addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,e=>{
      const connected=e.castState===cast.framework.CastState.CONNECTED;
      if(castBtn){
        castBtn.classList.toggle("casting",connected);
        castBtn.setAttribute("aria-label",connected?"Stop casting":"Cast to device");
        setSvgIcon(castBtn, connected?"screencast":"screencast");
      }
      if(connected){
        castSession=cast.framework.CastContext.getInstance().getCurrentSession();
        if(currentItem&&$("#player").classList.contains("show")) castCurrentItem();
      } else {
        const resumeAt=remotePlayer&&remotePlayer.currentTime>0?remotePlayer.currentTime:0;
        castSession=null; clearInterval(castSyncInterval);
        setStatus(false,"");
        if(resumeAt>0) video.currentTime=resumeAt;
        video.play().catch(()=>{});
      }
    }
  );
  remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,()=>{
      if(!isCasting()) return;
      const paused=remotePlayer.isPaused;
      $("#player").classList.toggle("paused",paused);
      setPlayIcon(!paused);
    }
  );
};

$("#castBtn").onclick=async()=>{
  if(typeof cast==="undefined") return;
  const ctx=cast.framework.CastContext.getInstance();
  if(ctx.getCastState()===cast.framework.CastState.CONNECTED){ ctx.endCurrentSession(true); return; }
  try{ await ctx.requestSession(); }catch(_){}
};

/* AirPlay (Safari/WebKit) */
const airBtn=$("#airplayBtn");
if(airBtn&&window.WebKitPlaybackTargetAvailabilityEvent){
  video.addEventListener("webkitplaybacktargetavailabilitychanged",e=>{
    airBtn.classList.toggle("hidden",e.availability!=="available");
  });
  airBtn.onclick=()=>video.webkitShowPlaybackTargetPicker();
}

/* ---- Play on another device (Plex clients via /clients API) ---- */
let _serverMachineId=null, _playOnCmdId=0;

async function getServerMachineId(){
  if(_serverMachineId) return _serverMachineId;
  try{
    const r=await fetch(`${server.uri}/identity?X-Plex-Token=${server.token}`,{headers:plexHeaders(server.token)});
    const xml=await r.text();
    const m=xml.match(/machineIdentifier="([^"]+)"/);
    if(m) _serverMachineId=m[1];
  }catch(_){}
  return _serverMachineId||"";
}

async function fetchPlexClients(){
  const mc=await api("/clients");
  return (mc.Server||[]).map(s=>({
    name:s.name||s.product||"Unknown Device",
    host:s.address||s.host||"",
    port:parseInt(s.port||"32500",10),
    machineId:s.machineIdentifier||"",
    platform:s.product||s.platform||""
  })).filter(c=>c.host);
}

async function playOnDevice(client){
  const machineId=await getServerMachineId();
  const su=new URL(server.uri);
  const params=new URLSearchParams({
    key:`/library/metadata/${currentItem.ratingKey}`,
    offset:String(Math.floor((video.currentTime||0)*1000)),
    machineIdentifier:machineId,
    address:su.hostname,
    port:su.port||(su.protocol==="https:"?"443":"80"),
    protocol:su.protocol.replace(":",""),
    token:server.token,
    "X-Plex-Client-Identifier":clientId(),
    commandID:String(++_playOnCmdId),
    containerKey:`/library/metadata/${currentItem.ratingKey}/children`
  });
  const url=`http://${client.host}:${client.port}/player/playback/playMedia?${params}`;
  try{
    await fetch(url,{headers:{"X-Plex-Client-Identifier":clientId(),"X-Plex-Token":server.token}});
    toast(`Playing on ${client.name}`);
  }catch(_){
    try{ await fetch(url,{mode:"no-cors"}); toast(`Sent to ${client.name}`); }
    catch(e2){ toast(`Couldn't reach ${client.name}`); }
  }
  closeDevicePicker();
}

function closeDevicePicker(){
  const dp=$("#devicePicker"); if(!dp) return;
  dp.classList.remove("open"); dp.setAttribute("aria-hidden","true");
}

async function showDevicePicker(){
  const dp=$("#devicePicker"), dl=$("#deviceList"); if(!dp||!dl) return;
  dl.innerHTML="<div class='loading' style='padding:16px 0'>Looking for devices…</div>";
  dp.classList.add("open"); dp.removeAttribute("aria-hidden");
  try{
    const clients=await fetchPlexClients();
    if(!clients.length){
      dl.innerHTML="<div style='padding:16px 0;color:var(--dim);font-size:14px'>No active Plex players found.<br><small>Open the Plex app on your device first.</small></div>";
      return;
    }
    dl.innerHTML="";
    clients.forEach(c=>{
      const btn=document.createElement("button");
      btn.className="device-item";
      btn.innerHTML=`${svgIcon("television")}<div><div class="di-name">${esc(c.name)}</div>${c.platform?`<div class="di-sub">${esc(c.platform)}</div>`:""}</div>`;
      btn.onclick=()=>playOnDevice(c);
      dl.appendChild(btn);
    });
  }catch(e){ dl.innerHTML=`<div style='padding:16px 0;color:var(--dim);font-size:14px'>Error: ${esc(e.message)}</div>`; }
}

$("#playOnBtn").onclick=showDevicePicker;
$("#devicePickerClose").onclick=closeDevicePicker;

/* minimize / expand / close */
$("#minPlayer").onclick=()=>$("#player").classList.add("min");
$("#expandPlayer").onclick=()=>$("#player").classList.remove("min");
$("#miniPlay").onclick=togglePlay;
$("#closeMini").onclick=closePlayer;
$("#closePlayer").onclick=closePlayer;
function closePlayer(){
  reportTimeline("stopped"); stopTimeline(); cleanupHls();
  if(sessionId){ stopSession(sessionId); sessionId=null; }
  if(warmedNext){ stopSession(warmedNext.sessionId); warmedNext=null; }
  hideNextUp(); $("#skipIntro").hidden=true;
  clearInterval(castSyncInterval); castSession=null;
  closeDevicePicker();
  video.pause(); video.removeAttribute("src"); video.load();
  $("#player").classList.remove("show","min","idle","loading","paused","panel-open");
  $("#playOnBtn").classList.add("hidden");
  currentItem=null;
  closeSettingsMenu(); closePanel();
  if(playerOpener&&document.contains(playerOpener)) playerOpener.focus();
  playerOpener=null;
}

/* idle / chrome auto-hide */
let idleTimer=null;
function bindActivity(){
  const p=$("#player");
  const wake=()=>{ p.classList.remove("idle"); clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{ if(!video.paused) p.classList.add("idle"); },2800); };
  ["pointermove","pointerdown","keydown"].forEach(ev=>p.addEventListener(ev,wake));
  video.addEventListener("pause",()=>{ p.classList.remove("idle"); clearTimeout(idleTimer); });
  wake();
}

/* keyboard shortcuts */
document.addEventListener("keydown",e=>{
  if(!$("#player").classList.contains("show")) return;
  if(["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return;
  switch(e.key){
    case " ": case "k": e.preventDefault(); togglePlay(); break;
    case "ArrowLeft": video.currentTime=Math.max(0,video.currentTime-5); break;
    case "ArrowRight": video.currentTime=Math.min(video.duration||1e9,video.currentTime+5); break;
    case "ArrowUp": video.volume=Math.min(1,video.volume+0.1); updateVolIcon(); break;
    case "ArrowDown": video.volume=Math.max(0,video.volume-0.1); updateVolIcon(); break;
    case "f": toggleFull(); break;
    case "m": video.muted=!video.muted; updateVolIcon(); break;
    case "Escape":
      if(panelOpen()){ closePanel(); $("#chaptersBtn").focus(); }
      else if(!document.fullscreenElement) closePlayer();
      break;
    case "c": if(currentItem) toggleSheet(); break;
  }
});

/* ---- loading state + UltraBlur backdrop ---- */
// The ultrablur wash should sample the SHOW's main backdrop, not the
// per-episode thumbnail, so episodes prefer grandparentArt.
function playerArt(item){
  if(!item) return "";
  if(item.type==="episode") return item.grandparentArt||item.art||item.grandparentThumb||item.thumb||"";
  return item.art||item.thumb||"";
}
function playerLoading(on,text,item){
  const p=$("#player");
  p.classList.toggle("loading",!!on);
  if(on) p.classList.remove("paused");
  $("#pSpinner").classList.toggle("hidden",!on);
  if(text) $("#pSpinnerText").textContent=text;
  if(on&&item){
    const art=playerArt(item);
    if(art) $("#pBackdrop").style.backgroundImage=`url('${imgAmbient(art)}')`;
  }
}
function setStatus(transcoding,text){ const s=$("#pStatus"); s.classList.remove("hidden");
  s.classList.toggle("transcode",!!transcoding); $("#pStatusText").textContent=text; }

const showLogoCache={};   // grandparentRatingKey -> clearLogo url ("" when none)
function clearLogoUrl(images){ const l=(images||[]).find(i=>i.type==="clearLogo"); return l?l.url:""; }
function updatePauseInfo(){
  const m=currentItem||{};
  let title=m.title||"", sub="";
  if(m.type==="episode"){
    title=m.grandparentTitle||m.title||"";
    sub=`S${m.parentIndex||0} · E${m.index||0} — ${m.title||""}`;
  }else{
    const bits=[];
    const year=m.year||(m.originallyAvailableAt||"").slice(0,4);
    if(year) bits.push(year);
    if(m.contentRating) bits.push(m.contentRating);
    sub=bits.join("   ·   ");
  }
  // Sample the show's main backdrop for the ultrablur wash.
  const art=playerArt(m);
  if(art) $("#pBackdrop").style.backgroundImage=`url('${imgAmbient(art)}')`;
  // Default to the text title; loadPauseLogo() swaps in the show logo async.
  $("#pPauseTitle").textContent=title;
  $("#pPauseTitle").classList.remove("hidden");
  $("#pPauseLogo").classList.add("hidden");
  $("#pPauseSub").textContent=sub;
  $("#pPauseSub").classList.toggle("hidden",!sub);
  $("#pPauseDesc").textContent=m.summary||"";
  $("#pPauseDesc").classList.toggle("hidden",!m.summary);
  loadPauseLogo(m,title);
}
// A show's clear logo lives on the show, not the episode, so for episodes we
// fetch (and cache) the show metadata to surface its title treatment.
async function loadPauseLogo(m,title){
  let url="";
  if(m.type==="episode"){
    const gk=m.grandparentRatingKey;
    if(gk!=null){
      if(gk in showLogoCache){ url=showLogoCache[gk]; }
      else{
        try{ const sm=await api(`/library/metadata/${gk}`); url=clearLogoUrl(((sm.Metadata||[])[0]||{}).Image); }
        catch(_){ url=""; }
        showLogoCache[gk]=url;
      }
    }
  }else{
    url=clearLogoUrl(m.Image);
  }
  if(currentItem!==m) return;        // item changed while awaiting
  const logoEl=$("#pPauseLogo"), titleEl=$("#pPauseTitle");
  if(url){
    logoEl.src=imgLogo(url,800,300); logoEl.alt=title;
    logoEl.classList.remove("hidden"); titleEl.classList.add("hidden");
  }else{
    logoEl.classList.add("hidden"); titleEl.classList.remove("hidden");
  }
}

/* ---- toast ---- */
let toastTimer=null;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),3200); }

/* ---- prev/next episode navigation ---- */
function updateEpNav(){
  const isEp=!!(currentItem&&currentItem.type==="episode");
  $("#prevEpBtn").classList.toggle("hidden",!isEp);
  $("#nextEpBtn").classList.toggle("hidden",!isEp);
  $("#prevEpBtn").disabled=!prevEp;
  $("#nextEpBtn").disabled=!nextEp;
}
async function loadAdjacentEpisodes(){
  if(!currentItem||currentItem.type!=="episode") return;
  const item=currentItem;
  try{
    const mc=await api(`/library/metadata/${item.parentRatingKey}/children`);
    if(currentItem!==item) return;
    const eps=mc.Metadata||[];
    seasonEps=eps;
    if(panelOpen()) renderPanel();
    const i=eps.findIndex(e=>String(e.ratingKey)===String(item.ratingKey));
    let p=i>0?eps[i-1]:null;
    let n=(i>-1&&eps[i+1])?eps[i+1]:null;
    if(!p||!n){
      // edge of season: peek at the adjacent season for the missing side
      const sm=await api(`/library/metadata/${item.grandparentRatingKey}/children`);
      if(currentItem!==item) return;
      const seasons=(sm.Metadata||[]).filter(s=>s.type==="season");
      const si=seasons.findIndex(s=>String(s.ratingKey)===String(item.parentRatingKey));
      if(!n&&si>-1&&seasons[si+1]){
        const nm=await api(`/library/metadata/${seasons[si+1].ratingKey}/children`);
        if(currentItem!==item) return;
        n=(nm.Metadata||[])[0]||null;
      }
      if(!p&&si>0){
        const pm=await api(`/library/metadata/${seasons[si-1].ratingKey}/children`);
        if(currentItem!==item) return;
        const peps=pm.Metadata||[];
        p=peps[peps.length-1]||null;
      }
    }
    prevEp=p; nextEp=n;
    updateEpNav();
    // Warm the "Up Next" thumbnail now so the overlay never pops in blank.
    if(nextEp){ const im=new Image(); im.src=img(nextEp.thumb||nextEp.parentThumb,300,169); }
  }catch(_){}
}

/* Pre-start the next episode's transcode session a little before the current
   one ends, so "Up Next"/auto-advance can resume an already-warm stream
   instead of waiting through "Preparing stream" again. */
function maybeWarmNext(dur,t){
  if(nextEpWarmed||!nextEp||!dur) return;
  if(dur-t>30) return;          // begin warming in the final ~30s
  nextEpWarmed=true;
  warmNextEpisode();
}
async function warmNextEpisode(){
  const ep=nextEp; if(!ep) return;
  let full=ep;
  const m0=mediaOf(ep);
  if(!m0||!m0.videoCodec||!((m0.Part||[])[0])){
    try{ const mc=await api(`/library/metadata/${ep.ratingKey}`); full=(mc.Metadata||[])[0]||ep; }catch(_){ return; }
    if(nextEp!==ep) return;     // user moved on while we were fetching
    nextEp=full;
  }
  const q=QUALITIES[qIndex]||QUALITIES[0];
  let res=null,br=null;
  if(q.mode==="original") return;                                  // forced direct play — nothing to warm
  if(q.mode==="convert"){ res=q.res; br=q.br; }
  else if(canDirectPlay(full)&&!defaultSubSelected(full)) return;   // will direct play — nothing to warm
  const wsid="hume-warm-"+crypto.randomUUID();
  const params=new URLSearchParams({
    path:`/library/metadata/${full.ratingKey}`,
    mediaIndex:0, partIndex:0, protocol:"hls", fastSeek:1,
    directPlay:0, directStream:1, directStreamAudio:1,
    subtitles:"burn", subtitleSize:100, audioBoost:100, mediaBufferSize:102400,
    location:server.local?"lan":"wan", autoAdjustQuality:0,
    maxVideoBitrate: br||40000, videoQuality:100, offset:0,
    "X-Plex-Client-Identifier":clientId(), "X-Plex-Session-Identifier":wsid,
    "X-Plex-Platform":"Web", session:wsid, "X-Plex-Token":server.token
  });
  if(res) params.set("videoResolution",res);
  fetch(`${server.uri}/video/:/transcode/universal/start.m3u8?${params.toString()}`).catch(()=>{});
  warmedNext={ratingKey:String(full.ratingKey),sessionId:wsid,res,br};
}
function showNextUp(){
  if(!nextEp) return;
  $("#nuImg").src=img(nextEp.thumb||nextEp.parentThumb,300,169);
  $("#nuTitle").textContent=`S${nextEp.parentIndex}E${nextEp.index} · ${nextEp.title}`;
  $("#nextUp").classList.add("show");
  let n=10;
  const btn=$("#nuPlay");
  btn.innerHTML=`${svgIcon("play-fill")} Play now · ${n}`;
  clearInterval(nuTimer);
  nuTimer=setInterval(()=>{
    n--;
    if(n<=0){ hideNextUp(); playItem(nextEp,0); return; }
    btn.innerHTML=`${svgIcon("play-fill")} Play now · ${n}`;
  },1000);
}
function hideNextUp(){ $("#nextUp").classList.remove("show"); clearInterval(nuTimer); nuTimer=null; }
$("#nuPlay").onclick=()=>{ const ep=nextEp; hideNextUp(); if(ep) playItem(ep,0); };
$("#nuCancel").onclick=hideNextUp;

/* ---- timeline / progress ---- */
let tlTimer=null;
function startTimeline(){ stopTimeline();
  tlTimer=setInterval(()=>reportTimeline(video.paused?"paused":"playing"),10000);
  video.onplay=()=>reportTimeline("playing"); video.onpause=()=>reportTimeline("paused");
  video.onended=()=>{ reportTimeline("stopped"); if(nextEp) showNextUp(); }; }
function stopTimeline(){ if(tlTimer){ clearInterval(tlTimer); tlTimer=null; } }
function reportTimeline(state){ if(!currentItem)return;
  const params=new URLSearchParams({ ratingKey:currentItem.ratingKey,
    key:`/library/metadata/${currentItem.ratingKey}`, state,
    time:Math.floor((video.currentTime||0)*1000),
    duration:Math.floor((video.duration||0)*1000)||currentItem.duration||0,
    "X-Plex-Token":server.token,"X-Plex-Client-Identifier":clientId() });
  fetch(`${server.uri}/:/timeline?${params.toString()}`,{method:"POST",headers:plexHeaders(server.token)}).catch(()=>{});
}

/* ============================================================ UTIL */
function setTitle(t){ $("#viewTitle").textContent=t; document.title=t?`${t} · ${PRODUCT}`:PRODUCT; }
// Shared top-of-page heading for library/playlists/"See All" pages, so it's
// always clear what the user is looking at — optionally with an item count
// and a small "library" kicker label above the title.
function pageHeadHTML(title,count,kicker){
  return `<div class="page-head"><div class="page-head-text">${kicker?`<div class="rail-lib">${esc(kicker)}</div>`:""}<h2>${esc(title)}</h2></div>${count!=null?`<span class="count">${count} item${count===1?"":"s"}</span>`:""}</div>`;
}
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m])); }
function svgIcon(name,cls,style){
  return `<span class="svgi${cls?` ${cls}`:""}" style="--i:url('assets/images/icons/ui/${name}.svg')${style?`;${style}`:""}" aria-hidden="true"></span>`;
}
// Swap the icon on an existing rendered .svgi span (or a container holding one)
// without rebuilding markup — keeps any classes/listeners on the element.
function setSvgIcon(elOrSpan,name){
  const s=elOrSpan.classList&&elOrSpan.classList.contains("svgi")?elOrSpan:elOrSpan.querySelector(".svgi");
  if(s) s.style.setProperty("--i",`url('assets/images/icons/ui/${name}.svg')`);
}
function fmtDur(ms){ if(!ms)return""; const m=Math.round(ms/60000);
  return m<60?m+"m":Math.floor(m/60)+"h "+(m%60)+"m"; }
function fmtDate(ts){ if(!ts) return ""; return new Date(ts*1000).toLocaleDateString(undefined,
  {year:"numeric",month:"short",day:"numeric"}); }
function fmtAirDate(s){ if(!s) return ""; const d=new Date(s); if(isNaN(d)) return "";
  return d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}); }
function fmtComing(s){ const d=new Date(s); if(isNaN(d)) return "";
  const days=(d-Date.now())/86400000;
  return days<7?d.toLocaleDateString(undefined,{weekday:"short"}):d.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
function fmtClock(s){ if(!s||isNaN(s))return"0:00"; s=Math.floor(s);
  const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`:`${m}:${String(x).padStart(2,"0")}`; }
function errHTML(e,retry){
  const msg=(e&&e.message)||String(e);
  if(e&&e.offline) return `<div class="err err-offline" role="alert">${svgIcon("wifi-slash")}
    <div><b>Server unavailable</b><div>${esc(msg)}</div></div>
    <button class="btn glass sm" onclick="${retry||"route"}()">${svgIcon("arrow-clockwise")} Try Again</button></div>`;
  return `<div class="err" role="alert">${svgIcon("warning-circle")}<div>${esc(msg)}</div></div>`;
}

$("#menuToggle").onclick=()=>{ $("#sidebar").classList.add("open"); $("#scrimNav").classList.add("show"); };
$("#scrimNav").onclick=closeSidebar;
function closeSidebar(){ $("#sidebar").classList.remove("open"); $("#scrimNav").classList.remove("show"); }

/* ---- COLLAPSIBLE SIDEBAR ----
   Desktop-only: shrink the nav to an icon rail. Persisted in localStorage so
   the choice sticks across sessions. The shell drives width via --nav-w. */
function applyNavCollapsed(collapsed){
  const shell=document.querySelector(".shell"); if(!shell) return;
  shell.classList.toggle("nav-collapsed",collapsed);
  const btn=$("#navCollapse");
  if(btn){
    const label=collapsed?"Expand sidebar":"Collapse sidebar";
    btn.title=label; btn.setAttribute("aria-label",label);
    btn.setAttribute("aria-expanded",String(!collapsed));
  }
}
function initNavCollapse(){
  applyNavCollapsed(localStorage.getItem(LS.navCollapsed)==="1");
  const btn=$("#navCollapse"); if(!btn) return;
  btn.onclick=()=>{
    const shell=document.querySelector(".shell");
    const next=!shell.classList.contains("nav-collapsed");
    applyNavCollapsed(next);
    localStorage.setItem(LS.navCollapsed,next?"1":"0");
    pushRemoteSettings(); toast("Settings saved");
  };
}
$("#searchBox").addEventListener("click",()=>$("#search").focus());
// Dismiss any open library dropdown when clicking elsewhere or pressing Escape.
document.addEventListener("click",()=>{ closeLibMenus(); closeEpMenus(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeLibMenus(); closeEpMenus(); closeTrailerModal(); } });

/* ============================================================ INIT */
(async function init(){
  if(accountToken){ $("#login").style.display="none";
    try{ await afterLogin(); }catch(e){ $("#login").style.display="flex"; loginErr("Session error: "+e.message); } }
})();
