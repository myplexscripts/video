"use strict";

/* Keeps the runtime font stack aligned with the visual system:
   Inter for body and UI, Anton for headings and display text. */
(function(){
  const BODY_FONT="'Inter','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
  const DISPLAY_FONT="'Anton','Impact','Arial Narrow',sans-serif";

  function applyTypographyLock(){
    document.documentElement.style.setProperty("--font",BODY_FONT);
    document.documentElement.style.setProperty("--font-head",DISPLAY_FONT);
    document.documentElement.style.setProperty("--font-display",DISPLAY_FONT);

    document
      .querySelectorAll('link#gf-inter,link#gf-rubik,link[href*="family=Rubik"]')
      .forEach(link=>link.remove());
  }

  applyTypographyLock();
  new MutationObserver(applyTypographyLock).observe(document.head,{childList:true,subtree:true});
})();
