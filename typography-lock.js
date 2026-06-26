"use strict";

/* Temporary compatibility guard while old page scripts still inject styles.
   The design system owns the visual rules. This file only keeps the
   design-system stylesheet last in the cascade and removes old Rubik loads. */
(function(){
  const BODY_FONT="'Inter','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
  const DISPLAY_FONT="'Anton','Impact','Arial Narrow',sans-serif";
  let pending=false;

  function applyDesignSystemGuard(){
    document.documentElement.style.setProperty("--font",BODY_FONT);
    document.documentElement.style.setProperty("--font-head",DISPLAY_FONT);
    document.documentElement.style.setProperty("--font-display",DISPLAY_FONT);

    document
      .querySelectorAll('link#gf-inter,link#gf-rubik,link[href*="family=Rubik"]')
      .forEach(link=>link.remove());

    const ds=document.querySelector('link[href="design-system.css"]');
    if(ds && ds.parentNode===document.head && document.head.lastElementChild!==ds){
      document.head.appendChild(ds);
    }
  }

  function scheduleApply(){
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      applyDesignSystemGuard();
    });
  }

  applyDesignSystemGuard();
  new MutationObserver(scheduleApply).observe(document.head,{childList:true,subtree:true});
})();
