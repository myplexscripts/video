"use strict";

/* Detail-page dynamic colour contrast
   Loaded after app.js so it replaces the artwork accent sampler with the same
   palette logic, plus an actual WCAG contrast-ratio comparison for foregrounds. */
(function(){
  const DARK_TEXT="#141005";
  const LIGHT_TEXT="#ffffff";

  function hslToRgb(h,s,l){
    s/=100; l/=100;
    const a=s*Math.min(l,1-l);
    const f=n=>{
      const k=(n+h/30)%12;
      return l-a*Math.max(Math.min(k-3,9-k,1),-1);
    };
    return [f(0),f(8),f(4)];
  }
  function relLumFromRgb01(rgb){
    return rgb.reduce((sum,c,i)=>{
      const lin=c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
      return sum+[0.2126,0.0722,0.7152][i]*lin;
    },0);
  }
  function hexLum(hex){
    const raw=hex.replace("#","");
    const full=raw.length===3?raw.split("").map(c=>c+c).join(""):raw;
    const r=parseInt(full.slice(0,2),16)/255;
    const g=parseInt(full.slice(2,4),16)/255;
    const b=parseInt(full.slice(4,6),16)/255;
    return relLumFromRgb01([r,g,b]);
  }
  function contrastRatio(a,b){
    const hi=Math.max(a,b), lo=Math.min(a,b);
    return (hi+0.05)/(lo+0.05);
  }
  function hslLum(h,s,l){ return relLumFromRgb01(hslToRgb(h,s,l)); }
  function boostL(h,s,l){ while(hslLum(h,s,l)<0.175&&l<95) l+=2; return l; }
  function readableForegroundForHsl(h,s,l){
    const bg=hslLum(h,s,l);
    const darkRatio=contrastRatio(bg,hexLum(DARK_TEXT));
    const lightRatio=contrastRatio(bg,hexLum(LIGHT_TEXT));
    return darkRatio>=lightRatio?DARK_TEXT:LIGHT_TEXT;
  }
  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
    if(max===min) return [0,0,l];
    const d=max-min, s=l>.5?d/(2-max-min):d/(max+min);
    const h=max===r?((g-b)/d+(g<b?6:0)):max===g?((b-r)/d+2):((r-g)/d+4);
    return [h/6*360,s,l];
  }

  function contrastCheckedExtractImgAccent(imgEl,heroEl){
    if(!heroEl||!imgEl) return;
    try{
      const cv=document.createElement("canvas");
      cv.width=cv.height=48;
      const cx=cv.getContext("2d");
      cx.drawImage(imgEl,0,0,48,48);
      const px=cx.getImageData(0,0,48,48).data;
      const buckets=new Array(36).fill(0);
      for(let i=0;i<px.length;i+=4){
        const [h,s,l]=rgbToHsl(px[i],px[i+1],px[i+2]);
        if(s>.15&&l>.08&&l<.9) buckets[Math.floor(h/10)%36]+=s;
      }
      let best=0,bestN=0;
      buckets.forEach((n,i)=>{ if(n>bestN){ bestN=n; best=i; } });
      if(!bestN) return;

      const h=best*10+5, h2=(h+120)%360, h3=(h+240)%360;
      const sl=boostL(h,88,56), al=boostL(h2,82,60), tl=boostL(h3,80,52), bl=boostL(h,75,48);
      const root=heroEl.closest(".dp-wrap")||heroEl;

      root.style.setProperty("--squiggle-color",`hsl(${h},88%,${sl}%)`);
      root.style.setProperty("--quote-accent",`hsl(${h2},82%,${al}%)`);
      root.style.setProperty("--triad-accent",`hsl(${h3},80%,${tl}%)`);
      root.style.setProperty("--dp-btn",`hsl(${h},75%,${bl}%)`);
      root.style.setProperty("--dp-btn-text",readableForegroundForHsl(h,75,bl));
      document.body.style.setProperty("--dp-nav-accent",`hsl(${h2},82%,${al}%)`);
    }catch(_){}
  }

  window.extractImgAccent=contrastCheckedExtractImgAccent;
  try{ extractImgAccent=contrastCheckedExtractImgAccent; }catch(_){}
})();
