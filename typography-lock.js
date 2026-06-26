"use strict";

/* Central typography system.
   One source of truth for body/UI text and big editorial display titles. */
(function(){
  const BODY_FONT="'Inter','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
  const DISPLAY_FONT="'Anton','Impact','Arial Narrow',sans-serif";
  const STYLE_ID="hume-type-system";

  const TYPE_CSS=`
:root{
  --font:${BODY_FONT};
  --font-head:${DISPLAY_FONT};
  --font-display:${DISPLAY_FONT};
  --type-display-leading:.86;
  --type-display-tracking:-.035em;
  --type-display-weight:400;
  --type-display-transform:uppercase;
  --type-display-size:clamp(44px,10vw,112px);
  --type-hero-size:clamp(58px,11vw,140px);
  --type-section-leading:.95;
  --type-card-leading:1.05;
  --type-ui-leading:1.2;
}

body{
  font-family:var(--font);
  line-height:var(--type-ui-leading);
}

h1,h2,h3,
.brand b,
#login h1,
#servers h1,
.view-head h1,
.section-head h2,
.rail-head h2,
.hub-title,
.dp-title,
.home-feature-copy h2,
.billboard-copy h3,
.editorial-card h3{
  font-family:var(--font-display);
  font-weight:var(--type-display-weight);
  text-transform:var(--type-display-transform);
  letter-spacing:var(--type-display-tracking);
}

h1,h2,h3,
.view-head h1,
.section-head h2,
.rail-head h2,
.billboard-copy h3,
.editorial-card h3{
  line-height:var(--type-section-leading);
}

.hub-title,
.dp-title,
.home-feature-copy h2{
  line-height:var(--type-display-leading)!important;
  letter-spacing:var(--type-display-tracking)!important;
}

.dp-title{
  font-size:var(--type-display-size)!important;
}

.home-top-cw .hub-title,
.hub-carousel .hub-title,
.home-feature-copy h2{
  font-size:var(--type-hero-size);
}

.card-title,
.media-title,
.episode-title,
.cast-name,
.actor-name,
.playlist-title,
.collection-title{
  line-height:var(--type-card-leading);
}

.meta,
.card-meta,
.dp-meta,
.dp-tagline,
.dp-summary,
.nav-item,
.btn,
.pbtn,
input,
select,
textarea{
  font-family:var(--font);
}

@media(max-width:700px){
  :root{
    --type-display-leading:.88;
    --type-display-tracking:-.03em;
    --type-display-size:clamp(42px,15vw,86px);
    --type-hero-size:clamp(50px,16vw,92px);
  }
}
`;

  let pending=false;

  function ensureTypeStyle(){
    let style=document.getElementById(STYLE_ID);
    if(!style){
      style=document.createElement("style");
      style.id=STYLE_ID;
      style.setAttribute("data-system","typography");
    }
    if(style.textContent!==TYPE_CSS) style.textContent=TYPE_CSS;
    if(style.parentNode!==document.head || document.head.lastElementChild!==style){
      document.head.appendChild(style);
    }
  }

  function applyTypographyLock(){
    document.documentElement.style.setProperty("--font",BODY_FONT);
    document.documentElement.style.setProperty("--font-head",DISPLAY_FONT);
    document.documentElement.style.setProperty("--font-display",DISPLAY_FONT);

    document
      .querySelectorAll('link#gf-inter,link#gf-rubik,link[href*="family=Rubik"]')
      .forEach(link=>link.remove());

    ensureTypeStyle();
  }

  function scheduleApply(){
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      applyTypographyLock();
    });
  }

  applyTypographyLock();
  new MutationObserver(scheduleApply).observe(document.head,{childList:true,subtree:true});
})();
