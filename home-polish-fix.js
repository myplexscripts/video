"use strict";

/* Final homepage carousel stabilizer.
   Loaded after home-polish.js so these rules win. */
(function(){
  const style=document.createElement("style");
  style.id="home-carousel-stabilizer";
  style.textContent=`
    body.home-redesign{
      --hume-bg:#000000;
      background:#000000!important;
    }

    body.home-redesign #main,
    body.home-redesign .main,
    body.home-redesign #content,
    body.home-redesign .content{
      background:#000000!important;
    }

    body.home-redesign #content:not(.dp-wrap),
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw,
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel,
    body.home-redesign #content:not(.dp-wrap) .hub-cs-slide{
      background:transparent!important;
      background-color:transparent!important;
      background-image:none!important;
      box-shadow:none!important;
      border-color:transparent!important;
    }

    body.home-redesign #content:not(.dp-wrap)> .home-top-cw::before,
    body.home-redesign #content:not(.dp-wrap)> .home-top-cw::after,
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section::before,
    body.home-redesign #content:not(.dp-wrap)> .hub-carousel-section::after,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel::before,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel::after,
    body.home-redesign #content:not(.dp-wrap) .hub-cs-slide::before,
    body.home-redesign #content:not(.dp-wrap) .hub-cs-slide::after{
      content:none!important;
      display:none!important;
      background:none!important;
      box-shadow:none!important;
      border:0!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel{
      isolation:isolate!important;
      overflow:visible!important;
    }

    /* Hard-hide inactive slides so the next slide/image never flashes while it preloads. */
    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cs-slide{
      display:none!important;
      opacity:0!important;
      visibility:hidden!important;
      z-index:0!important;
      pointer-events:none!important;
      transform:none!important;
      transition:none!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cs-slide.active{
      display:grid!important;
      opacity:1!important;
      visibility:visible!important;
      z-index:3!important;
      pointer-events:auto!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cs-slide .hero-bg,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cs-slide .hero-bg-blur,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cs-slide .hero-scrim{
      display:none!important;
      opacity:0!important;
      visibility:hidden!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .home-feature-art{
      background:#000000!important;
      box-shadow:none!important;
      border:0!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .home-feature-art::before,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel .home-feature-art::after{
      content:none!important;
      display:none!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-carousel-dots,
    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cd{
      transition:background-color .38s ease,width .32s ease,opacity .25s ease!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cd{
      background:var(--carousel-secondary,var(--secondary-colour,var(--secondary-color,var(--quote-accent,#ff5ec4))))!important;
    }

    body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cd.active{
      background:var(--carousel-main,var(--main-colour,var(--main-color,var(--squiggle-color,#ffffff))))!important;
    }

    @media (min-width:681px){
      body.home-redesign #content:not(.dp-wrap)> .home-top-cw{
        min-height:100svh!important;
        align-items:center!important;
        justify-content:center!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel{
        width:min(1040px,calc(100vw - (var(--edge) * 2)))!important;
        margin:0 auto!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel-dots{
        position:absolute!important;
        left:50%!important;
        right:auto!important;
        bottom:20px!important;
        top:auto!important;
        transform:translateX(-50%)!important;
      }
    }

    @media (max-width:680px){
      body.home-redesign #content:not(.dp-wrap) .hub-carousel .hub-cs-slide.active{
        display:flex!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw{
        padding-top:0!important;
        margin-top:0!important;
        min-height:calc(100svh - var(--tab-h,64px))!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        overflow:hidden!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel{
        width:100vw!important;
        height:calc(100svh - var(--tab-h,64px))!important;
        min-height:0!important;
        max-height:none!important;
        margin:0!important;
        overflow:hidden!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-cs-slide{
        inset:0!important;
        height:100%!important;
        min-height:0!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .home-feature-art{
        margin-top:0!important;
        border:0!important;
      }

      body.home-redesign #content:not(.dp-wrap)> .home-top-cw .hub-carousel-dots{
        position:absolute!important;
        left:50%!important;
        right:auto!important;
        top:auto!important;
        bottom:calc(env(safe-area-inset-bottom,0px) + 14px)!important;
        transform:translateX(-50%)!important;
        margin:0!important;
        z-index:8!important;
      }
    }
  `;
  document.head.appendChild(style);

  function getSlideColour(slide,names){
    if(!slide) return "";
    const cs=getComputedStyle(slide);
    for(const name of names){
      const value=cs.getPropertyValue(name).trim();
      if(value) return value;
    }
    return "";
  }

  function syncCarousel(carousel){
    if(!carousel||!carousel.classList||!carousel.classList.contains("hub-carousel")) return;
    const active=carousel.querySelector(".hub-cs-slide.active")||carousel.querySelector(".hub-cs-slide");
    const main=getSlideColour(active,["--main-colour","--main-color","--squiggle-color"]);
    const secondary=getSlideColour(active,["--secondary-colour","--secondary-color","--quote-accent"]);
    const accent=getSlideColour(active,["--accent-colour","--accent-color","--triad-accent"]);
    if(main) carousel.style.setProperty("--carousel-main",main);
    if(secondary) carousel.style.setProperty("--carousel-secondary",secondary);
    if(accent) carousel.style.setProperty("--carousel-accent",accent);
  }

  function bindCarousel(carousel){
    if(!carousel||carousel.dataset.homeCarouselStabilized==="1") return;
    carousel.dataset.homeCarouselStabilized="1";
    syncCarousel(carousel);
    const observer=new MutationObserver(()=>syncCarousel(carousel));
    carousel.querySelectorAll(".hub-cs-slide").forEach(slide=>{
      observer.observe(slide,{attributes:true,attributeFilter:["class","style"]});
    });
  }

  function run(){
    const content=document.getElementById("content");
    if(!content||content.classList.contains("dp-wrap")) return;
    content.querySelectorAll(".hub-carousel").forEach(bindCarousel);
  }

  run();
  setTimeout(run,0);
  setTimeout(run,250);
  new MutationObserver(run).observe(document.getElementById("content")||document.body,{childList:true,subtree:true});
})();
