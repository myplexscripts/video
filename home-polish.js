"use strict";

/* Homepage design layer
   Fast path: no full-page rescans, no forced home re-render, no 1920px backdrop
   loading for carousel slides. */
(function(){
  const HOME_LIMIT=10;
  const sampledAccentUrls=new Set();
  let patched=false;
  let scheduled=false;

  const style=document.createElement("style");
  style.id="home-polish-style";
  style.textContent=`
    #ultraBlur,.rail-ambient{display:none!important}

    body.home-redesign #content:not(.dp-wrap){
      --home-poster-w:220px;
      --home-wide-w:calc(2 * var(--home-poster-w) + var(--rail-gap,22px));
      background:#050505!important;
    }

    body.home-redesign #content:not(.dp-wrap)> .hero.home-static-hidden{display:none!important}
    body.home-redesign #content:not(.dp-wrap) .title-logo,
    body.home-redesign #content:not(.dp-wrap) .bill-logo,
    body.home-redesign #content:not(.dp-wrap) .ec-logo{display:none!important}

    body.home-redesign #content:not(.dp-wrap) .title-line{display:block!important}
    body.home-redesign #content:not(.dp-wrap) .title-line+.title-line{margin-top:-.08em!important}

    body.home-redesign #content:not(.dp-wrap) .hume-text-title,
    body.home-redesign #content:not(.dp-wrap)> .hero h2,
    body.home-redesign #content:not(.dp-wrap) .hub-cs-slide h2{
      display:block!important;
      font-family:var(--font-display)!important;
      font-weight:400!important;
      text-transform:uppercase!important;
      letter-spacing:.045em!important;
      line-height:.86!important;
      color:var(--main-colour,var(--main-color,var(--squiggle-color,var(--text))))!important;
      text-shadow:none!important;
      filter:drop-shadow(0 10px 18px rgba(35,37,43,.78)) drop-shadow(0 3px 4px rgba(22,24,30,.66))!important;
      margin:0!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hero-top::after{
      content:"";
      display:block;
      width:min(330px,52vw);
      height:28px;
      margin:10px 0 14px;
      background:var(--secondary-colour,var(--secondary-color,var(--quote-accent,#FF5EC4)));
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='34' viewBox='0 0 320 34'%3E%3Cpath d='M7 18 C35 4 54 30 83 17 C112 5 132 29 161 17 C190 5 211 30 241 17 C271 4 294 28 313 17' fill='none' stroke='black' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E");
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='34' viewBox='0 0 320 34'%3E%3Cpath d='M7 18 C35 4 54 30 83 17 C112 5 132 29 161 17 C190 5 211 30 241 17 C271 4 294 28 313 17' fill='none' stroke='black' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E");
      -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
      -webkit-mask-size:100% 100%;mask-size:100% 100%;
    }

    body.home-redesign #content:not(.dp-wrap) .hero-tagline{color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--dim))))!important;font-family:var(--font-head,var(--font))!important;font-size:clamp(22px,2.2vw,42px)!important;line-height:1.08!important;font-weight:800!important;letter-spacing:-.03em!important;max-width:28ch!important;margin:10px 0 0!important}
    body.home-redesign #content:not(.dp-wrap) .hero-meta,
    body.home-redesign #content:not(.dp-wrap) .ratings-row,
    body.home-redesign #content:not(.dp-wrap) .hero-summary{display:none!important}

    body.home-redesign #content:not(.dp-wrap) .hero-actions{display:flex!important;gap:16px!important;align-items:center!important}
    body.home-redesign #content:not(.dp-wrap) .hero-actions .btn{height:54px!important;border-radius:999px!important;border:none!important;padding:0 30px!important;background:var(--secondary-colour,var(--secondary-color,var(--accent-glass,#f5f5f7)))!important;color:var(--dp-btn-text,#141005)!important;box-shadow:none!important}
    body.home-redesign #content:not(.dp-wrap) .hero-actions .btn.glass{background:rgba(255,255,255,.08)!important;color:var(--text)!important}

    /* Top home feature: Continue Watching carousel. */
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw{position:relative!important;min-height:100dvh!important;padding:calc(var(--pill-clear) + 10px) var(--edge) 86px!important;margin:0!important;overflow:hidden!important;background:#050505!important;isolation:isolate!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw>.rail-head,
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw>.rail-summary{display:none!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel{position:relative!important;height:calc(100dvh - var(--pill-clear) - 112px)!important;min-height:560px!important;overflow:hidden!important;background:#050505!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-cs-slide{position:absolute!important;inset:0!important;display:grid!important;grid-template-columns:minmax(340px,48%) minmax(360px,1fr)!important;gap:clamp(34px,5vw,88px)!important;align-items:center!important;padding:0!important;background:#050505!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-cs-slide:not(.active){pointer-events:none!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-cs-slide .hero-bg{display:none!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .home-feature-art{grid-column:1!important;align-self:center!important;justify-self:stretch!important;width:100%!important;max-width:600px!important;aspect-ratio:1/1!important;position:relative!important;overflow:hidden!important;background:#141416!important;border:1px solid rgba(255,255,255,.10)!important;z-index:2!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .home-feature-art img{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important;filter:saturate(1.04) contrast(1.03)!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .home-feature-art::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,transparent 68%,#050505 100%)!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hero-top{grid-column:2!important;position:relative!important;z-index:3!important;padding:0!important;margin:0!important;text-align:left!important;transform:translateX(clamp(-130px,-6vw,-64px))!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw h2,
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hume-text-title{font-size:clamp(82px,8vw,164px)!important;max-width:min(54vw,980px)!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hero-bottom{grid-column:2!important;position:relative!important;z-index:3!important;padding:0!important;margin-top:18px!important;transform:translateX(clamp(-130px,-6vw,-64px))!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel-dots{position:absolute!important;left:calc(50% + 16px)!important;bottom:26px!important;z-index:8!important}
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw .cw-filmstrip{display:none!important}

    /* Other carousel-style hubs. */
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw){padding-top:64px!important;margin:0!important;background:#050505!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw)>.rail-head{margin-bottom:18px!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hub-carousel{position:relative!important;height:clamp(480px,60vh,660px)!important;overflow:hidden!important;margin:0 var(--edge)!important;background:#050505!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hub-cs-slide{position:absolute!important;inset:0!important;display:grid!important;grid-template-columns:minmax(300px,44%) minmax(340px,1fr)!important;gap:clamp(28px,4vw,70px)!important;align-items:center!important;background:#050505!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hub-cs-slide .hero-bg{display:none!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .home-feature-art{grid-column:1!important;width:100%!important;max-width:500px!important;aspect-ratio:1/1!important;position:relative!important;overflow:hidden!important;background:#141416!important;border:1px solid rgba(255,255,255,.10)!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .home-feature-art img{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hero-top{grid-column:2!important;padding:0!important;text-align:left!important;transform:translateX(clamp(-96px,-5vw,-42px))!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) h2,
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hume-text-title{font-size:clamp(68px,6.6vw,132px)!important;max-width:min(56vw,900px)!important}
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hero-bottom{grid-column:2!important;padding:0!important;margin-top:18px!important;transform:translateX(clamp(-96px,-5vw,-42px))!important}

    /* Standard rails. */
    body.home-redesign #content:not(.dp-wrap) .rail-section{padding-top:84px!important;overflow:visible!important}
    body.home-redesign #content:not(.dp-wrap) .rail-head,
    body.home-redesign #content:not(.dp-wrap) .editorial-head{display:grid!important;grid-template-columns:minmax(0,var(--home-wide-w)) max-content!important;grid-template-areas:"text see"!important;column-gap:clamp(18px,4vw,44px)!important;margin:0 var(--edge) 20px!important;padding-top:30px!important;border-top:1px solid var(--line)!important;align-items:start!important}
    body.home-redesign #content:not(.dp-wrap) .rail-head-text,
    body.home-redesign #content:not(.dp-wrap) .editorial-head>div:first-child{grid-area:text!important;width:min(var(--home-wide-w),100%)!important;max-width:var(--home-wide-w)!important;min-width:0!important}
    body.home-redesign #content:not(.dp-wrap) .rail-lib{display:none!important}
    body.home-redesign #content:not(.dp-wrap) .rail-reason{display:block!important;color:var(--secondary-colour,var(--secondary-color,var(--quote-accent,var(--accent))))!important;font-size:14px!important;line-height:1!important;font-weight:800!important;letter-spacing:.24em!important;text-transform:uppercase!important;margin:0 0 12px!important}
    body.home-redesign #content:not(.dp-wrap) .rail-head h3,
    body.home-redesign #content:not(.dp-wrap) .editorial-head h2,
    body.home-redesign #content:not(.dp-wrap) .section h3{font-family:var(--font-display)!important;font-size:clamp(50px,6.4vw,98px)!important;font-weight:400!important;letter-spacing:.045em!important;line-height:.88!important;text-transform:uppercase!important;color:var(--text)!important;width:min(var(--home-wide-w),100%)!important;max-width:var(--home-wide-w)!important;margin:0!important;overflow-wrap:normal!important;word-break:normal!important}
    body.home-redesign #content:not(.dp-wrap) .see-all{grid-area:see!important;align-self:start!important;justify-self:end!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:14px!important;white-space:nowrap!important;width:auto!important;min-width:max-content!important;margin:0!important;padding:0!important;border:0!important;background:none!important;color:var(--dim)!important;font-size:22px!important;line-height:1!important;font-weight:800!important;text-align:right!important}
    body.home-redesign #content:not(.dp-wrap) .see-all br{display:none!important}
    body.home-redesign #content:not(.dp-wrap) .see-all .svgi{width:24px!important;height:24px!important;flex:0 0 auto!important;margin:0!important}

    body.home-redesign #content:not(.dp-wrap) .carousel{gap:var(--rail-gap,22px)!important;padding-bottom:28px!important;align-items:start!important}
    body.home-redesign #content:not(.dp-wrap) .carousel .card:not(.wide):not(.billboard){width:var(--home-poster-w)!important;flex:0 0 var(--home-poster-w)!important}
    body.home-redesign #content:not(.dp-wrap) .carousel .card.wide,
    body.home-redesign #content:not(.dp-wrap) .carousel .card.billboard{width:var(--home-wide-w)!important;flex:0 0 var(--home-wide-w)!important}
    body.home-redesign #content:not(.dp-wrap) .carousel .card{display:grid!important;grid-template-rows:auto 1.35em 1.35em 1.25em!important;align-content:start!important;row-gap:0!important}
    body.home-redesign #content:not(.dp-wrap) .card .art{grid-row:1!important;background:#141416!important;border:1px solid rgba(255,255,255,.08)!important}
    body.home-redesign #content:not(.dp-wrap) .card .ct,
    body.home-redesign #content:not(.dp-wrap) .card .bill-title,
    body.home-redesign #content:not(.dp-wrap) .bill-title{grid-row:2!important;font-family:var(--font-head,var(--font))!important;font-size:26px!important;font-weight:800!important;line-height:1.04!important;letter-spacing:-.03em!important;color:var(--text)!important;margin:16px 0 0!important;min-height:1.1em!important;white-space:nowrap!important;display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
    body.home-redesign #content:not(.dp-wrap) .card .cs,
    body.home-redesign #content:not(.dp-wrap) .card .bill-meta{grid-row:3!important;min-height:1.35em!important;font-size:17px!important;line-height:1.25!important;margin:10px 0 0!important;color:var(--dim)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.home-redesign #content:not(.dp-wrap) .home-watch-status{grid-row:4!important;min-height:1.25em!important;margin-top:10px!important;color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--dim))))!important;font-size:13px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:.12em!important;text-transform:uppercase!important}

    @media(max-width:680px){
      body.home-redesign #content:not(.dp-wrap){--home-poster-w:164px;--home-wide-w:calc(2 * var(--home-poster-w) + var(--rail-gap,20px))}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw{min-height:calc(100dvh - var(--tab-h,64px))!important;padding:0 0 48px!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel{height:calc(100dvh - var(--tab-h,64px) - 48px)!important;min-height:620px!important;margin:0!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-cs-slide{display:flex!important;flex-direction:column!important;gap:0!important;align-items:center!important;justify-content:flex-start!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .home-feature-art{order:1!important;width:100vw!important;max-width:none!important;border:0!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .home-feature-art::after{background:linear-gradient(to top,#050505 0%,rgba(5,5,5,.46) 24%,transparent 56%)!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hero-top{order:2!important;width:100%!important;padding:0 var(--edge)!important;text-align:center!important;transform:none!important;margin-top:clamp(-72px,-13vw,-42px)!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw h2,
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hume-text-title{font-size:clamp(50px,14vw,86px)!important;max-width:calc(100vw - 24px)!important;margin:0 auto!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hero-top::after{margin:6px auto 10px!important;width:min(260px,72vw)!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hero-bottom{order:3!important;width:100%!important;padding:0 var(--edge)!important;text-align:center!important;transform:none!important;margin:0!important;display:flex!important;justify-content:center!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hero-actions{width:100%!important;justify-content:center!important}
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel-dots{left:50%!important;transform:translateX(-50%)!important;bottom:14px!important}

      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw){padding-top:56px!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hub-carousel{height:620px!important;margin:0!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hub-cs-slide{display:flex!important;flex-direction:column!important;gap:0!important;align-items:center!important;justify-content:flex-start!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .home-feature-art{width:100vw!important;max-width:none!important;border:0!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hero-top{width:100%!important;padding:0 var(--edge)!important;text-align:center!important;transform:none!important;margin-top:clamp(-72px,-13vw,-42px)!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) h2,
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hume-text-title{font-size:clamp(46px,13vw,80px)!important;max-width:calc(100vw - 24px)!important;margin:0 auto!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hero-top::after{margin:6px auto 10px!important;width:min(260px,72vw)!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hero-bottom{width:100%!important;padding:0 var(--edge)!important;text-align:center!important;transform:none!important;margin:0!important;display:flex!important;justify-content:center!important}
      body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section:not(.home-top-cw) .hero-actions{width:100%!important;justify-content:center!important}

      body.home-redesign #content:not(.dp-wrap) .rail-section{padding-top:64px!important}
      body.home-redesign #content:not(.dp-wrap) .rail-head,
      body.home-redesign #content:not(.dp-wrap) .editorial-head{grid-template-columns:minmax(0,calc(100vw - (var(--edge) * 2) - 112px)) max-content!important;column-gap:18px!important;margin:0 var(--edge) 18px!important}
      body.home-redesign #content:not(.dp-wrap) .rail-head-text,
      body.home-redesign #content:not(.dp-wrap) .rail-head h3,
      body.home-redesign #content:not(.dp-wrap) .editorial-head h2{width:min(var(--home-wide-w),calc(100vw - (var(--edge) * 2) - 112px))!important;max-width:min(var(--home-wide-w),calc(100vw - (var(--edge) * 2) - 112px))!important}
      body.home-redesign #content:not(.dp-wrap) .rail-reason{font-size:12px!important;letter-spacing:.2em!important;margin-bottom:10px!important}
      body.home-redesign #content:not(.dp-wrap) .rail-head h3,
      body.home-redesign #content:not(.dp-wrap) .editorial-head h2,
      body.home-redesign #content:not(.dp-wrap) .section h3{font-size:clamp(40px,11vw,64px)!important}
      body.home-redesign #content:not(.dp-wrap) .see-all{font-size:18px!important;gap:10px!important}
      body.home-redesign #content:not(.dp-wrap) .card .ct,
      body.home-redesign #content:not(.dp-wrap) .card .bill-title,
      body.home-redesign #content:not(.dp-wrap) .bill-title{font-size:19px!important}
      body.home-redesign #content:not(.dp-wrap) .card .cs,
      body.home-redesign #content:not(.dp-wrap) .card .bill-meta{font-size:15px!important}
    }
  `;
  document.head.appendChild(style);

  function cleanEmoji(str){return String(str||"").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,"").replace(/[\uFE0E\uFE0F]/g,"").replace(/\s+/g," ").trim();}
  function escLocal(str){if(typeof esc==="function") return esc(str);return String(str||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));}
  function colonHTML(str){const raw=cleanEmoji(str),i=raw.indexOf(":");if(i<0)return escLocal(raw);const a=raw.slice(0,i+1).trim(),b=raw.slice(i+1).trim();return b?`<span class="title-line">${escLocal(a)}</span><span class="title-line">${escLocal(b)}</span>`:escLocal(raw);}
  function splitRailTitle(title){const raw=cleanEmoji(title);const because=raw.match(/^Because\s+You\s+Watched\s+(.+)$/i);if(because)return{reason:"Because you watched",title:because[1].trim()};const more=raw.match(/^(More\s+(?:with|from|in|like)|Also\s+in|Related\s+to)\s+(.+)$/i);if(more)return{reason:more[1].replace(/\s+/g," "),title:more[2].trim()};return{reason:"",title:raw};}
  function normalizeSeeAll(btn){if(btn)btn.innerHTML="See All "+(typeof svgIcon==="function"?svgIcon("arrow-right"):"→");}
  function normalizeTitle(el,text){if(!el)return;const raw=cleanEmoji(text||el.textContent||"");if(!raw||el.dataset.homeTitleRaw===raw)return;el.innerHTML=colonHTML(raw);el.dataset.homeTitleRaw=raw;}

  function makeSeeAll(sec,title,items,wide,libLabel,summary,collId){
    const all=Array.isArray(items)?items:[];
    sec.dataset.homeTotal=String(all.length);
    sec.dataset.homeOriginalTitle=cleanEmoji(title);
    const head=sec.querySelector(":scope > .rail-head,:scope > .editorial-head");
    if(!head)return;
    let btn=head.querySelector(".see-all");
    if(all.length<=HOME_LIMIT){btn?.remove();return;}
    if(!btn){btn=document.createElement("button");btn.className="see-all";btn.type="button";head.appendChild(btn);}
    normalizeSeeAll(btn);
    btn.onclick=()=>{if(collId&&typeof navigate==="function"){navigate("/collection/"+collId);return;}try{seeAllCache={title:cleanEmoji(title),items:all,wide,libLabel,summary};}catch(_){}if(typeof navigate==="function")navigate("/see-all");};
  }

  function polishRailHead(sec,title){
    const head=sec.querySelector(":scope > .rail-head,:scope > .editorial-head");if(!head)return;
    const sourceTitle=cleanEmoji(title||sec.dataset.homeOriginalTitle||head.querySelector("h2,h3")?.textContent||"");
    const info=splitRailTitle(sourceTitle),text=head.querySelector(".rail-head-text")||head;
    head.querySelectorAll(":scope .rail-lib").forEach(el=>el.remove());
    const titleEl=head.querySelector("h2,h3");if(titleEl)normalizeTitle(titleEl,info.title||titleEl.textContent);
    let reason=head.querySelector(":scope .rail-reason");
    if(info.reason){if(!reason){reason=document.createElement("div");reason.className="rail-reason";text.insertBefore(reason,titleEl||text.firstChild);}reason.textContent=info.reason;}else reason?.remove();
    normalizeSeeAll(head.querySelector(".see-all"));
  }

  function trimSection(sec){[":scope .carousel>.card",":scope .carousel>.genre-card",":scope .hub-cs-slide",":scope .hub-carousel-dots .hub-cd",":scope .cw-filmstrip .cw-fs-card"].forEach(selector=>Array.from(sec.querySelectorAll(selector)).forEach((el,i)=>{if(i>=HOME_LIMIT)el.remove();}));}
  function syncCardSlots(sec){sec.querySelectorAll?.(":scope .carousel>.card").forEach(card=>{if(card.querySelector(":scope > .home-watch-status"))return;const status=document.createElement("div");status.className="home-watch-status";status.textContent=(card.classList.contains("watched")||card.querySelector(".watched-check,.watched-badge,[aria-label*='Watched' i]"))?"Watched":"";card.appendChild(status);});}
  function replaceLogos(root){root.querySelectorAll?.(".ec-logo").forEach(imgEl=>{const h=document.createElement("h3");normalizeTitle(h,imgEl.getAttribute("alt")||"");imgEl.replaceWith(h);});root.querySelectorAll?.(".bill-title").forEach(el=>{el.style.display="block";});root.querySelectorAll?.(".bill-logo,.title-logo").forEach(el=>el.remove());}

  function sampleAccentFromUrl(url,root){
    if(!url||!root||typeof extractImgAccent!=="function"||sampledAccentUrls.has(url))return;
    sampledAccentUrls.add(url);
    const run=()=>{const done=imgEl=>{try{extractImgAccent(imgEl,root);}catch(_){}};try{if(typeof _loadCorsImg==="function"){_loadCorsImg(url).then(imgEl=>{if(imgEl)done(imgEl);}).catch(()=>{});return;}}catch(_){}const probe=new Image();probe.crossOrigin="anonymous";probe.onload=()=>done(probe);probe.onerror=()=>{};probe.src=url;};
    (window.requestIdleCallback||setTimeout)(run,{timeout:1200});
  }

  function itemTitle(it){return it?.type==="episode"?(it.grandparentTitle||it.title||""):(it?.title||"");}
  function itemSquareSource(it){const images=it?.Image||[];return images.find(image=>image.type==="backgroundSquare")?.url||it?.thumb||it?.parentThumb||it?.grandparentThumb||it?.art||it?.grandparentArt||"";}

  function wireLightweightHero(wrap,it){
    const isEp=it?.type==="episode";
    const playBtn=wrap.querySelector(".hero-play");
    if(playBtn&&typeof playItem==="function")playBtn.onclick=e=>{e.stopPropagation();playItem(it,it.viewOffset||0);};
    const goToDetail=()=>{const target=isEp?{ratingKey:it.grandparentRatingKey,type:"show"}:it;const r=typeof pathForItem==="function"?pathForItem(target):"";if(r&&typeof navigate==="function")navigate(r);else if(typeof openItem==="function")openItem(target);};
    const infoBtn=wrap.querySelector(".hero-info");if(infoBtn)infoBtn.onclick=goToDetail;
  }

  function ensureSlideSquareAndText(wrap,it,opts={}){
    if(!wrap)return;
    const title=itemTitle(it)||wrap.querySelector("h2,.hume-text-title,.title-logo")?.getAttribute?.("alt")||wrap.querySelector("h2,.hume-text-title")?.textContent||"";
    const src=itemSquareSource(it);
    const active=opts.force||wrap.classList.contains("active")||wrap.classList.contains("hero");
    const artUrl=src&&typeof img==="function"?img(src,active?640:420,active?640:420):"";
    wrap.querySelector(".hero-bg")?.remove();
    let feature=wrap.querySelector(":scope > .home-feature-art");
    if(!feature){feature=document.createElement("div");feature.className="home-feature-art";feature.innerHTML='<img alt="" decoding="async" loading="lazy">';wrap.insertBefore(feature,wrap.querySelector(".hero-top"));}
    const im=feature.querySelector("img");
    if(im&&artUrl&&im.getAttribute("src")!==artUrl){im.src=artUrl;if(active)im.onload=()=>sampleAccentFromUrl(artUrl,wrap);}
    const top=wrap.querySelector(".hero-top")||wrap;
    top.querySelector(".title-logo")?.remove();
    let h=top.querySelector("h2,.hume-text-title");
    if(!h){h=document.createElement("h2");h.className="hume-text-title";top.insertBefore(h,top.firstChild);}
    normalizeTitle(h,title);
    if(active&&artUrl)sampleAccentFromUrl(artUrl,wrap);
    wireLightweightHero(wrap,it);
  }

  function ensureSlideSquareFromDOM(slide){
    if(!slide)return;
    slide.querySelector(".hero-bg")?.remove();
    let feature=slide.querySelector(":scope > .home-feature-art");
    if(!feature){feature=document.createElement("div");feature.className="home-feature-art";feature.innerHTML='<img alt="" decoding="async" loading="lazy">';slide.insertBefore(feature,slide.querySelector(".hero-top"));}
    const h=slide.querySelector(".hero-top h2,.hero-top .hume-text-title");if(h)normalizeTitle(h,h.textContent);
    slide.querySelectorAll(".title-logo").forEach(el=>el.remove());
  }

  function finishSection(sec,title,total){sec.dataset.homeOriginalTitle=cleanEmoji(title||sec.dataset.homeOriginalTitle||"");if(total!=null)sec.dataset.homeTotal=String(total);polishRailHead(sec,sec.dataset.homeOriginalTitle);trimSection(sec);syncCardSlots(sec);replaceLogos(sec);return sec;}

  function patchFactories(){
    if(patched)return;patched=true;

    try{if(typeof setupHeroTrailer==="function"&&!setupHeroTrailer.__homeFastDisabled){setupHeroTrailer=function(){return Promise.resolve();};setupHeroTrailer.__homeFastDisabled=true;}}catch(_){}
    try{if(typeof getRailStyle==="function"&&!getRailStyle.__humePolished){const originalGetRailStyle=getRailStyle;getRailStyle=function(key){return /continue|on.?deck/i.test(String(key||""))?"carousel":originalGetRailStyle(key);};getRailStyle.__humePolished=true;}}catch(_){}
    try{if(typeof titleArtHTML==="function")titleArtHTML=function(_it,title){return `<h2 class="hume-text-title">${colonHTML(title)}</h2>`;};}catch(_){}

    try{
      if(typeof wireHero==="function"&&!wireHero.__humePolished){
        const originalWireHero=wireHero;
        wireHero=function(wrap,it,opts={}){
          if(wrap?.classList?.contains("hub-cs-slide")){ensureSlideSquareAndText(wrap,it,{force:wrap.classList.contains("active")});schedulePolish();return;}
          const out=originalWireHero(wrap,it,opts);
          if(wrap?.classList?.contains("hero"))ensureSlideSquareAndText(wrap,it,{force:true});
          schedulePolish();
          return out;
        };
        wireHero.__humePolished=true;
      }
    }catch(_){}

    try{if(typeof railSection==="function"&&!railSection.__humePolished){const originalRailSection=railSection;railSection=function(title,items=[],wide,featured,_libLabel,seeAll,actorThumb,summary,collId,numbered){const all=Array.isArray(items)?items:[],info=splitRailTitle(title);const sec=originalRailSection(info.title,all.slice(0,HOME_LIMIT),wide,featured,"",false,actorThumb,summary,collId,numbered);finishSection(sec,title,all.length);makeSeeAll(sec,title,all,wide,"",summary,collId);return sec;};railSection.__humePolished=true;}}catch(_){}
    try{if(typeof squareBoardRailSection==="function"&&!squareBoardRailSection.__humePolished){const originalSquareBoardRailSection=squareBoardRailSection;squareBoardRailSection=function(title,items=[],_libLabel,numbered,summary){const all=Array.isArray(items)?items:[],info=splitRailTitle(title);const sec=originalSquareBoardRailSection(info.title,all.slice(0,HOME_LIMIT),"",numbered,summary);finishSection(sec,title,all.length);makeSeeAll(sec,title,all,false,"",summary,"");return sec;};squareBoardRailSection.__humePolished=true;}}catch(_){}
    try{if(typeof carouselHubSection==="function"&&!carouselHubSection.__humePolished){const originalCarouselHubSection=carouselHubSection;carouselHubSection=function(hub){const all=hub.items||[],info=splitRailTitle(hub.title);const sec=originalCarouselHubSection({...hub,title:info.title,lib:"",items:all.slice(0,HOME_LIMIT)});finishSection(sec,hub.title,all.length);makeSeeAll(sec,hub.title,all,true,"",hub.summary,"");sec.querySelectorAll(".hub-cs-slide").forEach((slide,index)=>ensureSlideSquareAndText(slide,all[index],{force:index===0}));return sec;};carouselHubSection.__humePolished=true;}}catch(_){}
    try{if(typeof editorialSection==="function"&&!editorialSection.__humePolished){const originalEditorialSection=editorialSection;editorialSection=function(title,items=[],_libLabel){const all=Array.isArray(items)?items:[],info=splitRailTitle(title);const sec=originalEditorialSection(info.title,all.slice(0,HOME_LIMIT),"");finishSection(sec,title,all.length);makeSeeAll(sec,title,all,false,"","","");return sec;};editorialSection.__humePolished=true;}}catch(_){}
  }

  function promoteTopContinueWatching(content){
    const hero=content.querySelector(":scope > .hero");if(!hero)return;
    const firstRail=hero.nextElementSibling;
    const isCw=firstRail&&(firstRail.classList.contains("rail-section")||firstRail.classList.contains("hub-carousel-section"))&&(firstRail.querySelector(".cw-carousel,.hub-carousel")||firstRail.dataset.homeOriginalTitle==="Continue Watching");
    if(!isCw)return;
    hero.classList.add("home-static-hidden");
    firstRail.classList.add("home-top-cw");
    firstRail.style.paddingTop="";
    firstRail.querySelectorAll(".hub-cs-slide").forEach((slide,index)=>ensureSlideSquareFromDOM(slide,index===0));
  }

  function ensureContinueWatchingLabel(content){
    const hero=content.querySelector(":scope > .hero"),firstRail=hero&&hero.nextElementSibling;
    if(!firstRail||!firstRail.classList.contains("rail-section")||firstRail.querySelector(":scope > .rail-head"))return;
    const head=document.createElement("div");head.className="rail-head";head.innerHTML='<div class="rail-head-text"><h3>Continue Watching</h3></div>';
    firstRail.dataset.homeOriginalTitle="Continue Watching";firstRail.insertBefore(head,firstRail.firstChild);syncCardSlots(firstRail);
  }

  function polishRenderedHome(){
    patchFactories();
    const content=document.getElementById("content");
    const hero=content?.firstElementChild?.classList.contains("hero")?content.firstElementChild:null;
    const isHome=!!(hero&&content&&!content.classList.contains("dp-wrap"));
    document.body.classList.toggle("home-redesign",isHome);
    if(!isHome)return;
    ensureContinueWatchingLabel(content);
    promoteTopContinueWatching(content);
    content.querySelectorAll(":scope > .rail-section,:scope > .editorial-section").forEach(sec=>{
      const original=sec.dataset.homeOriginalTitle||sec.querySelector("h2,h3")?.textContent||"";
      polishRailHead(sec,original);trimSection(sec);syncCardSlots(sec);
      const total=Number(sec.dataset.homeTotal||0);
      if(total>HOME_LIMIT)normalizeSeeAll(sec.querySelector(".see-all"));
      if(total>0&&total<=HOME_LIMIT)sec.querySelector(".see-all")?.remove();
      sec.querySelectorAll(".hub-cs-slide").forEach(ensureSlideSquareFromDOM);
    });
    replaceLogos(content);
  }

  function schedulePolish(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polishRenderedHome();});}

  patchFactories();
  polishRenderedHome();
  setTimeout(polishRenderedHome,0);

  const content=document.getElementById("content");
  if(content)new MutationObserver(schedulePolish).observe(content,{childList:true,subtree:false});
})();
