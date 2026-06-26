"use strict";

/* Render-timing guard and final homepage rules.
   Loaded after home-polish.js so these rules win. */
(function(){
  const HOME_LIMIT=10;

  const style=document.createElement("style");
  style.id="home-polish-final-rules";
  style.textContent=`
    body.home-redesign #content:not(.dp-wrap){
      --home-poster-w:260px;
      --home-wide-w:calc(2 * var(--home-poster-w) + var(--rail-gap,20px));
    }

    body.home-redesign #content:not(.dp-wrap) .rail-lib{display:none!important}

    body.home-redesign #content:not(.dp-wrap) .rail-head,
    body.home-redesign #content:not(.dp-wrap) .editorial-head{
      display:grid!important;
      grid-template-columns:minmax(0,var(--home-wide-w)) max-content!important;
      grid-template-areas:"text see"!important;
      column-gap:clamp(18px,4vw,44px)!important;
      align-items:start!important;
    }

    body.home-redesign #content:not(.dp-wrap) .rail-head-text,
    body.home-redesign #content:not(.dp-wrap) .editorial-head>div:first-child{
      grid-area:text!important;
      width:min(var(--home-wide-w),100%)!important;
      max-width:var(--home-wide-w)!important;
      min-width:0!important;
    }

    body.home-redesign #content:not(.dp-wrap) .rail-reason{
      display:block!important;
      color:var(--secondary-colour,var(--secondary-color,var(--quote-accent,var(--accent))))!important;
      font-size:14px!important;
      line-height:1!important;
      font-weight:800!important;
      letter-spacing:.24em!important;
      text-transform:uppercase!important;
      margin:0 0 12px!important;
    }

    body.home-redesign #content:not(.dp-wrap) .rail-head h3,
    body.home-redesign #content:not(.dp-wrap) .editorial-head h2,
    body.home-redesign #content:not(.dp-wrap) .section h3{
      width:min(var(--home-wide-w),100%)!important;
      max-width:var(--home-wide-w)!important;
      margin:0!important;
      overflow-wrap:normal!important;
      word-break:normal!important;
    }

    body.home-redesign #content:not(.dp-wrap) .rail-head h3 .title-line,
    body.home-redesign #content:not(.dp-wrap) .editorial-head h2 .title-line,
    body.home-redesign #content:not(.dp-wrap) .ec-title h3 .title-line,
    body.home-redesign #content:not(.dp-wrap)>.hero h2 .title-line,
    body.home-redesign #content:not(.dp-wrap)>.hero .hume-text-title .title-line{display:block!important}

    body.home-redesign #content:not(.dp-wrap) .see-all{
      grid-area:see!important;
      align-self:start!important;
      justify-self:end!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:14px!important;
      white-space:nowrap!important;
      width:auto!important;
      min-width:max-content!important;
      max-width:none!important;
      margin:0!important;
      padding:0!important;
      text-align:right!important;
      line-height:1!important;
    }

    body.home-redesign #content:not(.dp-wrap) .see-all br{display:none!important}
    body.home-redesign #content:not(.dp-wrap) .see-all .svgi{flex:0 0 auto!important;margin:0!important}

    body.home-redesign #content:not(.dp-wrap)>.hero .home-feature-art{
      display:block!important;
      visibility:visible!important;
      opacity:1!important;
      position:relative!important;
      z-index:4!important;
      background:#141416!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .home-feature-art img{
      display:block!important;
      visibility:visible!important;
      opacity:1!important;
      width:100%!important;
      height:100%!important;
      object-fit:cover!important;
    }

    body.home-redesign #content:not(.dp-wrap)>.hero .hero-top,
    body.home-redesign #content:not(.dp-wrap)>.hero .hero-bottom{z-index:5!important}

    @media(max-width:680px){
      body.home-redesign #content:not(.dp-wrap){
        --home-poster-w:170px;
        --home-wide-w:calc(2 * var(--home-poster-w) + var(--rail-gap,20px));
      }

      body.home-redesign #content:not(.dp-wrap)>.hero{
        display:flex!important;
        flex-direction:column!important;
        min-height:calc(100dvh - var(--tab-h,64px))!important;
        padding:0 0 48px!important;
      }

      body.home-redesign #content:not(.dp-wrap)>.hero .home-feature-art{
        order:1!important;
        width:100vw!important;
        height:auto!important;
        aspect-ratio:1/1!important;
        flex:0 0 auto!important;
        margin:0!important;
      }

      body.home-redesign #content:not(.dp-wrap)>.hero .hero-top{
        order:2!important;
        width:100%!important;
        margin-top:clamp(-72px,-13vw,-42px)!important;
      }

      body.home-redesign #content:not(.dp-wrap)>.hero .hero-bottom{order:3!important}

      body.home-redesign #content:not(.dp-wrap) .rail-head,
      body.home-redesign #content:not(.dp-wrap) .editorial-head{
        grid-template-columns:minmax(0,calc(100vw - (var(--edge) * 2) - 112px)) max-content!important;
        column-gap:18px!important;
      }

      body.home-redesign #content:not(.dp-wrap) .rail-head-text,
      body.home-redesign #content:not(.dp-wrap) .rail-head h3,
      body.home-redesign #content:not(.dp-wrap) .editorial-head h2{
        width:min(var(--home-wide-w),calc(100vw - (var(--edge) * 2) - 112px))!important;
        max-width:min(var(--home-wide-w),calc(100vw - (var(--edge) * 2) - 112px))!important;
      }

      body.home-redesign #content:not(.dp-wrap) .rail-reason{
        font-size:12px!important;
        letter-spacing:.2em!important;
        margin-bottom:10px!important;
      }

      body.home-redesign #content:not(.dp-wrap) .see-all{
        font-size:18px!important;
        gap:10px!important;
      }
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

  function escLocal(str){
    if(typeof esc==="function") return esc(str);
    return String(str||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  }

  function splitRailTitle(title){
    const raw=cleanEmoji(title);
    const because=raw.match(/^Because\s+You\s+Watched\s+(.+)$/i);
    if(because) return {reason:"Because you watched",title:because[1].trim()};
    const more=raw.match(/^(More\s+(?:with|from|in|like)|Also\s+in|Related\s+to)\s+(.+)$/i);
    if(more) return {reason:more[1].replace(/\s+/g," "),title:more[2].trim()};
    return {reason:"",title:raw};
  }

  function colonHTML(str){
    const raw=cleanEmoji(str);
    const idx=raw.indexOf(":");
    if(idx<0) return escLocal(raw);
    const first=raw.slice(0,idx+1).trim();
    const second=raw.slice(idx+1).trim();
    return second
      ? `<span class="title-line">${escLocal(first)}</span><span class="title-line">${escLocal(second)}</span>`
      : escLocal(raw);
  }

  function normalizeSeeAll(btn){
    if(!btn) return;
    btn.innerHTML="See All " + (typeof svgIcon==="function"?svgIcon("arrow-right"):"→");
  }

  function normalizeRailHead(sec){
    const head=sec.querySelector?.(":scope > .rail-head,:scope > .editorial-head");
    if(!head) return;

    head.querySelectorAll(":scope .rail-lib").forEach(lib=>{
      const text=cleanEmoji(lib.textContent);
      const info=splitRailTitle(text);
      if(info.reason){
        let reason=head.querySelector(":scope .rail-reason");
        if(!reason){
          reason=document.createElement("div");
          reason.className="rail-reason";
          const target=head.querySelector(".rail-head-text")||head;
          target.insertBefore(reason,target.querySelector("h2,h3")||target.firstChild);
        }
        reason.textContent=info.reason;
      }
      lib.remove();
    });

    const titleEl=head.querySelector("h2,h3");
    if(titleEl){
      const info=splitRailTitle(titleEl.textContent);
      if(info.reason){
        let reason=head.querySelector(":scope .rail-reason");
        if(!reason){
          reason=document.createElement("div");
          reason.className="rail-reason";
          const target=head.querySelector(".rail-head-text")||head;
          target.insertBefore(reason,titleEl);
        }
        reason.textContent=info.reason;
        titleEl.innerHTML=colonHTML(info.title);
      }else if(!titleEl.dataset.homeColonDone){
        titleEl.innerHTML=colonHTML(titleEl.textContent);
      }
      titleEl.dataset.homeColonDone="1";
    }

    normalizeSeeAll(head.querySelector(".see-all"));
  }

  function ensureContinueWatchingLabel(){
    const c=document.getElementById("content");
    if(!document.body.classList.contains("home-redesign")||!c||c.classList.contains("dp-wrap")) return;
    const hero=c.querySelector(":scope > .hero");
    const firstRail=hero&&hero.nextElementSibling;
    if(!firstRail||!firstRail.classList.contains("rail-section")||firstRail.querySelector(".rail-head")) return;
    const head=document.createElement("div");
    head.className="rail-head";
    head.innerHTML='<div class="rail-head-text"><h3>Continue Watching</h3></div>';
    firstRail.insertBefore(head,firstRail.firstChild);
  }

  function pruneSmallSeeAll(){
    const c=document.getElementById("content");
    if(!document.body.classList.contains("home-redesign")||!c||c.classList.contains("dp-wrap")) return;
    c.querySelectorAll(".rail-section,.editorial-section").forEach(sec=>{
      const count=sec.querySelectorAll(".carousel>.card,.carousel>.genre-card,.hub-cs-slide,.editorial-card").length;
      if(count>0&&count<HOME_LIMIT) sec.querySelector(".see-all")?.remove();
    });
  }

  function titleTextFromHero(hero){
    const h=hero.querySelector(".hero-top h2,.hero-top .hume-text-title");
    return cleanEmoji(h?.textContent||document.getElementById("viewTitle")?.textContent||"");
  }

  function ensureHomeHeroSquareArt(){
    const c=document.getElementById("content");
    const hero=c&&c.firstElementChild&&c.firstElementChild.classList.contains("hero")?c.firstElementChild:null;
    if(!hero||c.classList.contains("dp-wrap")) return;

    let feature=hero.querySelector(":scope > .home-feature-art");
    if(!feature){
      feature=document.createElement("div");
      feature.className="home-feature-art";
      feature.innerHTML='<img alt="" decoding="async">';
      hero.insertBefore(feature,hero.querySelector(".hero-top"));
    }

    let imgEl=feature.querySelector("img");
    if(!imgEl){
      imgEl=document.createElement("img");
      imgEl.alt="";
      imgEl.decoding="async";
      feature.appendChild(imgEl);
    }

    const bg=hero.querySelector(".hero-bg-img");
    const src=bg&&(bg.currentSrc||bg.src);
    if(src&&(!imgEl.getAttribute("src")||imgEl.naturalWidth===0)) imgEl.src=src;

    const top=hero.querySelector(".hero-top");
    if(top){
      top.querySelector(".title-logo")?.remove();
      let h=top.querySelector("h2,.hume-text-title");
      if(h&&!h.dataset.homeColonDone){
        h.innerHTML=colonHTML(h.textContent||titleTextFromHero(hero));
        h.dataset.homeColonDone="1";
      }
    }
  }

  function run(){
    const c=document.getElementById("content");
    const hero=c&&c.firstElementChild&&c.firstElementChild.classList.contains("hero")?c.firstElementChild:null;
    document.body.classList.toggle("home-redesign",!!(hero&&c&&!c.classList.contains("dp-wrap")));
    ensureHomeHeroSquareArt();
    ensureContinueWatchingLabel();
    pruneSmallSeeAll();
    if(c){
      c.querySelectorAll(":scope > .rail-section,:scope > .editorial-section").forEach(normalizeRailHead);
      c.querySelectorAll(".ec-title h3").forEach(h=>{
        if(!h.dataset.homeColonDone){ h.innerHTML=colonHTML(h.textContent); h.dataset.homeColonDone="1"; }
      });
    }
  }

  try{
    if(typeof wireHero==="function"&&!wireHero.__homeFinalWrap){
      const prev=wireHero;
      wireHero=function(wrap,it,opts={}){
        const out=prev(wrap,it,opts);
        setTimeout(run,0);
        return out;
      };
      wireHero.__homeFinalWrap=true;
    }
  }catch(_){ }

  run();
  setTimeout(run,0);
  setTimeout(run,250);
  setTimeout(run,1000);
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["src","class","style"]});
})();
