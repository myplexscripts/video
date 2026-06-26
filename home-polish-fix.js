"use strict";

/* Small render-timing guard for the home polish layer. */
(function(){
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

  function pruneSmallSeeAll(){
    const c=document.getElementById("content");
    if(!document.body.classList.contains("home-redesign")||!c||c.classList.contains("dp-wrap")) return;
    c.querySelectorAll(".rail-section,.editorial-section").forEach(sec=>{
      const count=sec.querySelectorAll(".carousel>.card,.carousel>.genre-card,.hub-cs-slide,.editorial-card").length;
      if(count>0&&count<10) sec.querySelector(".see-all")?.remove();
    });
  }

  function run(){
    ensureContinueWatchingLabel();
    pruneSmallSeeAll();
  }

  run();
  setTimeout(run,0);
  setTimeout(run,250);
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
})();
