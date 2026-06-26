"use strict";

/* Home-page polish layer
   Keeps the user-selectable rail styles, but makes the homepage use the same
   editorial language as detail pages: square art, text titles, dynamic colours,
   clean rail labels, 10 visible items per hub, and no UltraBlur. */
(function(){
  const HOME_LIMIT=10;

  const style=document.createElement("style");
  style.id="home-polish-style";
  style.textContent=`
    #ultraBlur,
    .rail-ambient{display:none!important}

    body.home-redesign #content:not(.dp-wrap){
      --home-poster-w:260px;
      --home-wide-w:calc(2 * var(--home-poster-w) + var(--rail-gap,20px));
      background:#050505!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero{
      min-height:100dvh!important;
      max-height:none!important;
      aspect-ratio:auto!important;
      display:grid!important;
      grid-template-columns:minmax(340px,52%) minmax(320px,1fr)!important;
      grid-template-rows:1fr auto auto 1fr!important;
      gap:0 clamp(28px,5vw,72px)!important;
      align-items:end!important;
      padding:calc(var(--pill-clear) + 12px) var(--edge) 86px!important;
      background:#050505!important;
      isolation:isolate!important;
      overflow:hidden!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-bg{
      opacity:.28!important;
      filter:saturate(1.02) contrast(1.02)!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-bg-blur{display:none!important}

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-bg-img{
      object-position:center 18%!important;
      filter:brightness(.54) saturate(1.02)!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-scrim{
      z-index:1!important;
      background:
        linear-gradient(to top,#050505 0%,rgba(5,5,5,.96) 24%,rgba(5,5,5,.42) 58%,transparent 100%),
        linear-gradient(90deg,rgba(5,5,5,.86) 0%,rgba(5,5,5,.32) 48%,rgba(5,5,5,.84) 100%)!important;
    }

    body.home-redesign .home-feature-art{
      grid-column:1!important;
      grid-row:1/5!important;
      align-self:center!important;
      justify-self:stretch!important;
      position:relative!important;
      z-index:2!important;
      aspect-ratio:1/1!important;
      overflow:hidden!important;
      background:#141416!important;
      border:1px solid rgba(255,255,255,.08)!important;
    }

    body.home-redesign .home-feature-art img{
      width:100%!important;
      height:100%!important;
      display:block!important;
      object-fit:cover!important;
      object-position:center!important;
      opacity:1!important;
      filter:saturate(1.04) contrast(1.03)!important;
    }

    body.home-redesign .home-feature-art::after{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:linear-gradient(to right,transparent 60%,#050505 100%)!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-top{
      grid-column:2!important;
      grid-row:2!important;
      position:relative!important;
      z-index:3!important;
      padding:0!important;
      margin:0!important;
      text-align:left!important;
      transform:translateX(clamp(-176px,-9vw,-84px))!important;
      filter:drop-shadow(0 10px 18px rgba(35,37,43,.78)) drop-shadow(0 3px 4px rgba(22,24,30,.66))!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .title-logo,
    body.home-redesign #content:not(.dp-wrap) .bill-logo,
    body.home-redesign #content:not(.dp-wrap) .ec-logo{display:none!important}

    body.home-redesign #content:not(.dp-wrap)>.hero .hume-text-title,
    body.home-redesign #content:not(.dp-wrap)>.hero h2{
      display:block!important;
      font-family:var(--font-display)!important;
      font-size:clamp(72px,7.2vw,136px)!important;
      line-height:.88!important;
      font-weight:400!important;
      text-transform:uppercase!important;
      letter-spacing:.045em!important;
      color:var(--main-colour,var(--main-color,var(--squiggle-color,var(--text))))!important;
      text-shadow:none!important;
      margin:0!important;
      max-width:min(72vw,920px)!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .title-line{display:block!important}
    body.home-redesign #content:not(.dp-wrap)>.hero .title-line+.title-line{margin-top:-.08em!important}

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-top::after{
      content:"";
      display:block;
      width:min(310px,52vw);
      height:26px;
      margin:8px 0 10px;
      background:var(--secondary-colour,var(--secondary-color,var(--quote-accent,#FF5EC4)));
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='34' viewBox='0 0 320 34'%3E%3Cpath d='M7 18 C35 4 54 30 83 17 C112 5 132 29 161 17 C190 5 211 30 241 17 C271 4 294 28 313 17' fill='none' stroke='black' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E");
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='34' viewBox='0 0 320 34'%3E%3Cpath d='M7 18 C35 4 54 30 83 17 C112 5 132 29 161 17 C190 5 211 30 241 17 C271 4 294 28 313 17' fill='none' stroke='black' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E");
      -webkit-mask-repeat:no-repeat;
      mask-repeat:no-repeat;
      -webkit-mask-size:100% 100%;
      mask-size:100% 100%;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-bottom{
      grid-column:2!important;
      grid-row:3!important;
      z-index:3!important;
      padding:0!important;
      transform:translateX(clamp(-176px,-9vw,-84px))!important;
      align-self:start!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-actions{gap:16px!important}
    body.home-redesign #content:not(.dp-wrap)>.hero .btn{
      height:54px!important;
      border-radius:999px!important;
      border:none!important;
      padding:0 30px!important;
      background:var(--secondary-colour,var(--secondary-color,var(--accent-glass,#f5f5f7)))!important;
      color:var(--dp-btn-text,#141005)!important;
      box-shadow:none!important;
    }
    body.home-redesign #content:not(.dp-wrap)>.hero .btn.glass{background:rgba(255,255,255,.08)!important;color:var(--text)!important}

    body.home-redesign #content:not(.dp-wrap) .bill-title{display:block!important}
    body.home-redesign #content:not(.dp-wrap) .bill-logo-wrap{align-items:flex-start!important;text-align:left!important}

    body.home-redesign #content:not(.dp-wrap) .rail-section{padding-top:84px!important;overflow:visible!important}
    body.home-redesign #content:not(.dp-wrap) .rail-head{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) auto!important;
      grid-template-areas:"text see"!important;
      gap:16px 28px!important;
      margin:0 var(--edge) 20px!important;
      padding-top:30px!important;
      border-top:1px solid var(--line)!important;
      align-items:start!important;
    }

    body.home-redesign #content:not(.dp-wrap) .rail-head-text{grid-area:text!important;min-width:0!important}
    body.home-redesign #content:not(.dp-wrap) .rail-lib,
    body.home-redesign #content:not(.dp-wrap) .rail-reason{
      color:var(--secondary-colour,var(--secondary-color,var(--quote-accent,var(--accent))))!important;
      font-size:14px!important;
      line-height:1!important;
      font-weight:800!important;
      letter-spacing:.24em!important;
      text-transform:uppercase!important;
      margin:0 0 12px!important;
    }
    body.home-redesign #content:not(.dp-wrap) .rail-reason{color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--secondary-colour))))!important}
    body.home-redesign #content:not(.dp-wrap) .rail-head h3,
    body.home-redesign #content:not(.dp-wrap) .editorial-head h2,
    body.home-redesign #content:not(.dp-wrap) .section h3{
      font-family:var(--font-display)!important;
      font-size:clamp(44px,8.2vw,88px)!important;
      font-weight:400!important;
      letter-spacing:.045em!important;
      line-height:.9!important;
      text-transform:uppercase!important;
      color:var(--text)!important;
      margin:0!important;
      max-width:12ch!important;
    }
    body.home-redesign #content:not(.dp-wrap) .see-all{
      grid-area:see!important;
      align-self:start!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      background:none!important;
      color:var(--dim)!important;
      font-size:22px!important;
      line-height:1.05!important;
      font-weight:800!important;
      text-align:right!important;
      min-width:72px!important;
    }
    body.home-redesign #content:not(.dp-wrap) .see-all .svgi{width:24px!important;height:24px!important;margin-left:8px!important;vertical-align:-.15em!important}

    body.home-redesign #content:not(.dp-wrap) .carousel{gap:var(--rail-gap,20px)!important;padding-bottom:28px!important}
    body.home-redesign #content:not(.dp-wrap) .carousel .card:not(.wide):not(.billboard){width:var(--home-poster-w)!important;flex:0 0 var(--home-poster-w)!important}
    body.home-redesign #content:not(.dp-wrap) .carousel .card.wide,
    body.home-redesign #content:not(.dp-wrap) .carousel .card.billboard{width:var(--home-wide-w)!important;flex:0 0 var(--home-wide-w)!important}

    body.home-redesign #content:not(.dp-wrap) .card .art{background:#141416!important;border:1px solid rgba(255,255,255,.08)!important}
    body.home-redesign #content:not(.dp-wrap) .card .ct{font-size:20px!important;font-weight:800!important;line-height:1.06!important;margin-top:16px!important;white-space:normal!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}
    body.home-redesign #content:not(.dp-wrap) .card .cs{font-size:15px!important;margin-top:8px!important;color:var(--dim)!important}

    @media(max-width:680px){
      body.home-redesign #content:not(.dp-wrap){--home-poster-w:170px;--home-wide-w:calc(2 * var(--home-poster-w) + var(--rail-gap,20px))}
      body.home-redesign #content:not(.dp-wrap)>.hero{min-height:calc(100dvh - var(--tab-h,64px))!important;display:flex!important;flex-direction:column!important;padding:0 0 48px!important;justify-content:flex-start!important}
      body.home-redesign .home-feature-art{width:100%!important;aspect-ratio:1/1!important;border:0!important;flex:0 0 auto!important}
      body.home-redesign .home-feature-art::after{background:linear-gradient(to top,#050505 0%,rgba(5,5,5,.46) 24%,transparent 56%)!important}
      body.home-redesign #content:not(.dp-wrap)>.hero .hero-top{width:100%!important;padding:0 var(--edge)!important;text-align:center!important;transform:none!important;margin-top:clamp(-72px,-13vw,-42px)!important}
      body.home-redesign #content:not(.dp-wrap)>.hero .hume-text-title,
      body.home-redesign #content:not(.dp-wrap)>.hero h2{font-size:clamp(48px,14vw,82px)!important;max-width:calc(100vw - 24px)!important;margin:0 auto!important}
      body.home-redesign #content:not(.dp-wrap)>.hero .hero-top::after{margin:6px auto 10px!important;width:min(260px,72vw)!important}
      body.home-redesign #content:not(.dp-wrap)>.hero .hero-bottom{width:100%!important;padding:0 var(--edge)!important;transform:none!important;text-align:center!important}
      body.home-redesign #content:not(.dp-wrap)>.hero .hero-actions{justify-content:center!important}
      body.home-redesign #content:not(.dp-wrap) .rail-section{padding-top:64px!important}
      body.home-redesign #content:not(.dp-wrap) .rail-head{margin:0 var(--edge) 18px!important;gap:12px 18px!important}
      body.home-redesign #content:not(.dp-wrap) .rail-lib,
      body.home-redesign #content:not(.dp-wrap) .rail-reason{font-size:12px!important;letter-spacing:.2em!important;margin-bottom:10px!important}
      body.home-redesign #content:not(.dp-wrap) .rail-head h3,
      body.home-redesign #content:not(.dp-wrap) .editorial-head h2,
      body.home-redesign #content:not(.dp-wrap) .section h3{font-size:clamp(40px,11vw,64px)!important;max-width:9ch!important}
      body.home-redesign #content:not(.dp-wrap) .see-all{font-size:18px!important;min-width:56px!important}
      body.home-redesign #content:not(.dp-wrap) .card .ct{font-size:18px!important}
    }
  `;
  document.head.appendChild(style);

  function cleanEmoji(str){
    return String(str||"")
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,"")
      .replace(/[\uFE0E\uFE0F]/g,"")
      .replace(/\s+/g," ")
      .trim();
  }

  function splitRailTitle(title){
    let raw=cleanEmoji(title);
    const because=raw.match(/^Because\s+You\s+Watched\s+(.+)$/i);
    if(because) return {label:"Because you watched",title:because[1].trim()};
    const more=raw.match(/^(More\s+(?:with|from|in|like)|Also\s+in|Related\s+to)\s+(.+)$/i);
    if(more) return {label:more[1].replace(/\s+/g," "),title:more[2].trim()};
    const top=raw.match(/^(Top\s+Rated|Recently\s+Added|Recently\s+Released|Trending|Popular)\s*(.*)$/i);
    if(top&&top[2]) return {label:top[1],title:top[2].trim()};
    return {label:"",title:raw};
  }

  function escLocal(str){
    if(typeof esc==="function") return esc(str);
    return String(str||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  }

  function breakAfterColonHTML(str){
    const raw=cleanEmoji(str);
    const idx=raw.indexOf(":");
    if(idx<0) return escLocal(raw);
    const a=raw.slice(0,idx+1).trim();
    const b=raw.slice(idx+1).trim();
    return b?`<span class="title-line">${escLocal(a)}</span><span class="title-line">${escLocal(b)}</span>`:escLocal(raw);
  }

  function makeSeeAll(sec,title,items,wide,libLabel,summary){
    const head=sec.querySelector(".rail-head,.editorial-head");
    if(!head) return;
    let btn=head.querySelector(".see-all");
    if((items||[]).length<HOME_LIMIT){
      btn?.remove();
      return;
    }
    if(!btn){
      btn=document.createElement("button");
      btn.className="see-all";
      btn.type="button";
      btn.innerHTML="See<br>All " + (typeof svgIcon==="function"?svgIcon("arrow-right"):"→");
      head.appendChild(btn);
    }
    btn.onclick=()=>{
      try{ seeAllCache={title:cleanEmoji(title),items,wide,libLabel,summary}; }catch(_){ }
      if(typeof navigate==="function") navigate("/see-all");
    };
  }

  function polishRailHead(sec,title,libLabel){
    const info=splitRailTitle(title);
    const head=sec.querySelector(".rail-head,.editorial-head");
    if(!head) return;
    const text=head.querySelector(".rail-head-text")||head;
    const titleEl=head.querySelector("h3,h2");
    if(titleEl) titleEl.textContent=info.title||cleanEmoji(titleEl.textContent);

    if(libLabel&&!head.querySelector(".rail-lib")){
      const lib=document.createElement("div");
      lib.className="rail-lib";
      lib.textContent=cleanEmoji(libLabel);
      text.insertBefore(lib,text.firstChild);
    }

    if(info.label&&!head.querySelector(".rail-reason")){
      const reason=document.createElement("div");
      reason.className="rail-reason";
      reason.textContent=info.label;
      const firstTitle=text.querySelector("h3,h2");
      text.insertBefore(reason,firstTitle||text.firstChild);
    }
  }

  function trimSection(sec){
    sec.querySelectorAll(":scope .carousel").forEach(row=>{
      Array.from(row.children)
        .filter(el=>el.classList.contains("card")||el.classList.contains("genre-card"))
        .forEach((el,i)=>{ if(i>=HOME_LIMIT) el.remove(); });
    });
    const slides=Array.from(sec.querySelectorAll(":scope .hub-cs-slide"));
    slides.forEach((el,i)=>{ if(i>=HOME_LIMIT) el.remove(); });
    sec.querySelectorAll(":scope .hub-carousel-dots .hub-cd").forEach((el,i)=>{ if(i>=HOME_LIMIT) el.remove(); });
    sec.querySelectorAll(":scope .cw-filmstrip .cw-fs-card").forEach((el,i)=>{ if(i>=HOME_LIMIT) el.remove(); });
  }

  function replaceLogos(root=document){
    root.querySelectorAll?.(".ec-logo").forEach(img=>{
      const h=document.createElement("h3");
      h.innerHTML=breakAfterColonHTML(img.getAttribute("alt")||"");
      img.replaceWith(h);
    });
    root.querySelectorAll?.(".bill-title").forEach(el=>{ el.style.display="block"; });
    root.querySelectorAll?.(".bill-logo").forEach(el=>el.remove());
  }

  function sampleAccentFromUrl(url,root){
    if(!url||!root||typeof extractImgAccent!=="function") return;
    const done=imgEl=>{ try{ extractImgAccent(imgEl,root); }catch(_){ } };
    try{
      if(typeof _loadCorsImg==="function"){
        _loadCorsImg(url).then(imgEl=>{ if(imgEl) done(imgEl); }).catch(()=>{});
        return;
      }
    }catch(_){ }
    const probe=new Image();
    probe.crossOrigin="anonymous";
    probe.onload=()=>done(probe);
    probe.onerror=()=>{};
    probe.src=url;
  }

  function applyHomeHeroArt(wrap,it){
    if(!wrap||!it) return;
    const isEp=it.type==="episode";
    const title=isEp?(it.grandparentTitle||it.title||""):(it.title||"");
    const imgs=it.Image||[];
    const square=imgs.find(i=>i.type==="backgroundSquare")?.url || it.thumb || it.parentThumb || it.grandparentThumb || it.art || it.grandparentArt;
    const artUrl=square&&typeof img==="function"?img(square,900,900):"";

    let feature=wrap.querySelector(".home-feature-art");
    if(!feature){
      feature=document.createElement("div");
      feature.className="home-feature-art";
      feature.innerHTML='<img alt="" decoding="async">';
      wrap.insertBefore(feature,wrap.querySelector(".hero-top"));
    }
    const im=feature.querySelector("img");
    if(im&&artUrl&&im.src!==artUrl){
      im.onload=()=>sampleAccentFromUrl(artUrl,wrap);
      im.src=artUrl;
    }

    const top=wrap.querySelector(".hero-top");
    if(top){
      top.querySelector(".title-logo")?.remove();
      let h=top.querySelector("h2,.hume-text-title");
      if(!h){
        h=document.createElement("h2");
        h.className="hume-text-title";
        top.insertBefore(h,top.querySelector(".hero-tagline,.hero-meta,.ratings-row,.hero-summary"));
      }
      h.innerHTML=breakAfterColonHTML(title);
    }

    if(artUrl) sampleAccentFromUrl(artUrl,wrap);
  }

  try{
    if(typeof titleArtHTML==="function"){
      titleArtHTML=function(_it,title){ return `<h2 class="hume-text-title">${breakAfterColonHTML(title)}</h2>`; };
    }
  }catch(_){ }

  try{
    if(typeof wireHero==="function"){
      const originalWireHero=wireHero;
      wireHero=function(wrap,it,opts={}){
        const out=originalWireHero(wrap,it,opts);
        applyHomeHeroArt(wrap,it);
        return out;
      };
    }
  }catch(_){ }

  function patchRailFactories(){
    try{
      if(typeof railSection==="function"&&!railSection.__humePolished){
        const originalRailSection=railSection;
        railSection=function(title,items=[],wide,featured,libLabel,seeAll,actorThumb,summary,collId,numbered){
          const allItems=Array.isArray(items)?items:[];
          const info=splitRailTitle(title);
          const sec=originalRailSection(info.title,allItems.slice(0,HOME_LIMIT),wide,featured,libLabel,false,actorThumb,summary,collId,numbered);
          polishRailHead(sec,title,libLabel);
          makeSeeAll(sec,title,allItems,wide,libLabel,summary);
          trimSection(sec);
          replaceLogos(sec);
          return sec;
        };
        railSection.__humePolished=true;
      }
    }catch(_){ }

    try{
      if(typeof squareBoardRailSection==="function"&&!squareBoardRailSection.__humePolished){
        const originalSquareBoardRailSection=squareBoardRailSection;
        squareBoardRailSection=function(title,items=[],libLabel,numbered,summary){
          const allItems=Array.isArray(items)?items:[];
          const info=splitRailTitle(title);
          const sec=originalSquareBoardRailSection(info.title,allItems.slice(0,HOME_LIMIT),libLabel,numbered,summary);
          polishRailHead(sec,title,libLabel);
          makeSeeAll(sec,title,allItems,false,libLabel,summary);
          trimSection(sec);
          replaceLogos(sec);
          return sec;
        };
        squareBoardRailSection.__humePolished=true;
      }
    }catch(_){ }

    try{
      if(typeof carouselHubSection==="function"&&!carouselHubSection.__humePolished){
        const originalCarouselHubSection=carouselHubSection;
        carouselHubSection=function(hub){
          const allItems=hub.items||[];
          const info=splitRailTitle(hub.title);
          const displayHub={...hub,title:info.title,items:allItems.slice(0,HOME_LIMIT)};
          const sec=originalCarouselHubSection(displayHub);
          polishRailHead(sec,hub.title,hub.lib);
          makeSeeAll(sec,hub.title,allItems,true,hub.lib,hub.summary);
          trimSection(sec);
          replaceLogos(sec);
          return sec;
        };
        carouselHubSection.__humePolished=true;
      }
    }catch(_){ }

    try{
      if(typeof editorialSection==="function"&&!editorialSection.__humePolished){
        const originalEditorialSection=editorialSection;
        editorialSection=function(title,items=[],libLabel){
          const allItems=Array.isArray(items)?items:[];
          const info=splitRailTitle(title);
          const sec=originalEditorialSection(info.title,allItems.slice(0,HOME_LIMIT),libLabel);
          polishRailHead(sec,title,libLabel);
          makeSeeAll(sec,title,allItems,false,libLabel,"");
          trimSection(sec);
          replaceLogos(sec);
          return sec;
        };
        editorialSection.__humePolished=true;
      }
    }catch(_){ }
  }

  function ensureContinueWatchingLabel(){
    const c=document.getElementById("content");
    if(!document.body.classList.contains("home-redesign")||!c||c.classList.contains("dp-wrap")) return;
    const hero=c.querySelector(":scope > .hero");
    const firstRail=hero&&hero.nextElementSibling;
    if(!firstRail||!firstRail.classList.contains("rail-section")||firstRail.querySelector(".rail-head")) return;
    const head=document.createElement("div");
    head.className="rail-head";
    head.innerHTML='<div class="rail-head-text"><div class="rail-lib">Library</div><h3>Continue Watching</h3></div>';
    firstRail.insertBefore(head,firstRail.firstChild);
  }

  function syncHome(){
    patchRailFactories();
    replaceLogos(document);
    ensureContinueWatchingLabel();
    const c=document.getElementById("content");
    const hero=c&&c.firstElementChild&&c.firstElementChild.classList.contains("hero")?c.firstElementChild:null;
    document.body.classList.toggle("home-redesign",!!(hero&&c&&!c.classList.contains("dp-wrap")));
  }

  patchRailFactories();
  syncHome();
  new MutationObserver(syncHome).observe(document.body,{childList:true,subtree:true});
})();
