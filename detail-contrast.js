"use strict";

/* Detail-page dynamic colour system
   Loaded after app.js so it replaces the artwork accent sampler.
   Flow: extract artwork hue -> build triad -> snap each role to the Hume palette ->
   apply readable foreground colours for buttons and controls. */
(function(){
  const style=document.createElement("style");
  style.id="detail-layout-fix";
  style.textContent=`
    /* Rating stars use the semantic accent colour. */
    .dp-wrap .rate-stars button .svgi.filled{color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--accent))))!important}
    .dp-wrap .rate-stars button:hover{color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--accent2))))!important}

    @media (min-width:901px){
      /* Desktop split hero: keep the editorial overlap, but prevent the title from
         climbing into the top control/meta area. */
      .dp-hero.dp-hero--split .dp-head{
        align-items:flex-start!important;
        text-align:left!important;
      }
      .dp-hero.dp-hero--split .dp-head .wave-wrap{
        justify-content:flex-start!important;
      }
      .dp-hero.dp-hero--split .dp-title{
        font-size:clamp(72px,6.25vw,112px)!important;
        line-height:.91;
        max-width:min(74vw,920px)!important;
      }
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-head{
        margin-top:clamp(34px,6vh,64px);
        min-height:126px;
        padding:0 var(--edge) 24px 0!important;
      }
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-title{
        right:auto!important;
        left:clamp(-176px,-9vw,-84px);
        bottom:100%;
      }
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-head .wave-wrap{
        justify-content:flex-start!important;
        transform:translate(clamp(-176px,-9vw,-84px),-14px)!important;
      }
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-rate-row{
        justify-content:flex-start!important;
        transform:translateX(clamp(-176px,-9vw,-84px));
        max-width:calc(100% + 176px);
      }
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-head .dp-rate{
        justify-content:flex-start!important;
      }
    }
  `;
  document.head.appendChild(style);

  const DARK_BG="#050505";
  const DARK_TEXT="#141005";
  const LIGHT_TEXT="#ffffff";

  const HUME_PALETTE=[
    {name:"Red",hex:"#FF4D5E"},
    {name:"Brick",hex:"#D85A43"},
    {name:"Orange",hex:"#FF8A1C"},
    {name:"Amber",hex:"#FFC533"},
    {name:"Lime",hex:"#C9F24D"},
    {name:"Olive",hex:"#B6C84A"},
    {name:"Green",hex:"#45E56F"},
    {name:"Mint",hex:"#28E0B0"},
    {name:"Teal",hex:"#2EB8A6"},
    {name:"Cyan",hex:"#20C8FF"},
    {name:"Steel",hex:"#579BC7"},
    {name:"Blue",hex:"#5C8DFF"},
    {name:"Violet",hex:"#B078FF"},
    {name:"Purple",hex:"#B05CDE"},
    {name:"Pink",hex:"#FF5EC4"},
    {name:"Rose",hex:"#E45C8A"}
  ];

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

  function hexToRgb(hex){
    const raw=hex.replace("#","");
    const full=raw.length===3?raw.split("").map(c=>c+c).join(""):raw;
    return [
      parseInt(full.slice(0,2),16),
      parseInt(full.slice(2,4),16),
      parseInt(full.slice(4,6),16)
    ];
  }

  function rgbToHex(r,g,b){
    return "#"+[r,g,b].map(v=>{
      const s=Math.round(clamp(v,0,255)).toString(16).toUpperCase();
      return s.length===1?"0"+s:s;
    }).join("");
  }

  function hslToRgb(h,s,l){
    s/=100; l/=100;
    const a=s*Math.min(l,1-l);
    const f=n=>{
      const k=(n+h/30)%12;
      return l-a*Math.max(Math.min(k-3,9-k,1),-1);
    };
    return [f(0)*255,f(8)*255,f(4)*255];
  }

  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
    if(max===min) return [0,0,l];
    const d=max-min, s=l>.5?d/(2-max-min):d/(max+min);
    const h=max===r?((g-b)/d+(g<b?6:0)):max===g?((b-r)/d+2):((r-g)/d+4);
    return [h/6*360,s,l];
  }

  function srgbToLinear(c){
    c/=255;
    return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  }

  function rgbToOklab(r,g,b){
    const lr=srgbToLinear(r), lg=srgbToLinear(g), lb=srgbToLinear(b);
    const l=0.4122214708*lr+0.5363325363*lg+0.0514459929*lb;
    const m=0.2119034982*lr+0.6806995451*lg+0.1073969566*lb;
    const s=0.0883024619*lr+0.2817188376*lg+0.6299787005*lb;
    const l_=Math.cbrt(l), m_=Math.cbrt(m), s_=Math.cbrt(s);
    return [
      0.2104542553*l_+0.7936177850*m_-0.0040720468*s_,
      1.9779984951*l_-2.4285922050*m_+0.4505937099*s_,
      0.0259040371*l_+0.7827717662*m_-0.8086757660*s_
    ];
  }

  function hexToOklab(hex){
    const [r,g,b]=hexToRgb(hex);
    return rgbToOklab(r,g,b);
  }

  function oklabDistance(a,b){
    const dl=(a[0]-b[0])*1.4;
    const da=a[1]-b[1];
    const db=a[2]-b[2];
    return Math.sqrt(dl*dl+da*da+db*db);
  }

  function relLumFromRgb255(rgb){
    const r=srgbToLinear(rgb[0]);
    const g=srgbToLinear(rgb[1]);
    const b=srgbToLinear(rgb[2]);
    return 0.2126*r+0.7152*g+0.0722*b;
  }

  function hexLum(hex){ return relLumFromRgb255(hexToRgb(hex)); }

  function contrastRatio(a,b){
    const hi=Math.max(a,b), lo=Math.min(a,b);
    return (hi+0.05)/(lo+0.05);
  }

  function readableForegroundForHex(hex){
    const bg=hexLum(hex);
    const darkRatio=contrastRatio(bg,hexLum(DARK_TEXT));
    const lightRatio=contrastRatio(bg,hexLum(LIGHT_TEXT));
    return darkRatio>=lightRatio?DARK_TEXT:LIGHT_TEXT;
  }

  function targetHexFromHsl(h,s,l){
    const [r,g,b]=hslToRgb(h,s,l);
    return rgbToHex(r,g,b);
  }

  function paletteHue(hex){
    const [r,g,b]=hexToRgb(hex);
    return rgbToHsl(r,g,b)[0];
  }

  function hueDistance(a,b){
    const d=Math.abs(a-b)%360;
    return Math.min(d,360-d);
  }

  const preparedPalette=HUME_PALETTE.map(item=>({
    ...item,
    lab:hexToOklab(item.hex),
    hue:paletteHue(item.hex),
    bgContrast:contrastRatio(hexLum(item.hex),hexLum(DARK_BG))
  }));

  function closestPaletteColour(targetHex,used){
    const lab=hexToOklab(targetHex);
    const targetHue=paletteHue(targetHex);
    const ranked=preparedPalette
      .map(item=>{
        const usedPenalty=used.has(item.hex)?0.22:0;
        const huePenalty=hueDistance(item.hue,targetHue)>95?0.08:0;
        const contrastPenalty=item.bgContrast<4.5?0.25:0;
        return {
          item,
          score:oklabDistance(item.lab,lab)+usedPenalty+huePenalty+contrastPenalty
        };
      })
      .sort((a,b)=>a.score-b.score);

    const pick=ranked.find(entry=>!used.has(entry.item.hex))||ranked[0];
    used.add(pick.item.hex);
    return pick.item;
  }

  function contrastSafePaletteTriad(baseHue){
    const used=new Set();
    const targets=[
      targetHexFromHsl(baseHue,96,60),
      targetHexFromHsl((baseHue+120)%360,92,62),
      targetHexFromHsl((baseHue+240)%360,90,64)
    ];

    return {
      main:closestPaletteColour(targets[0],used),
      secondary:closestPaletteColour(targets[1],used),
      accent:closestPaletteColour(targets[2],used)
    };
  }

  function setColourRole(root,name,colour){
    root.style.setProperty(`--${name}-colour`,colour.hex);
    root.style.setProperty(`--${name}-color`,colour.hex);
    root.style.setProperty(`--${name}-colour-name`,`"${colour.name}"`);
    root.style.setProperty(`--${name}-color-name`,`"${colour.name}"`);
  }

  function extractArtworkHue(px){
    const buckets=new Array(36).fill(0);

    for(let i=0;i<px.length;i+=4){
      if(px[i+3]<180) continue;

      const [h,s,l]=rgbToHsl(px[i],px[i+1],px[i+2]);
      if(s>.18&&l>.08&&l<.9){
        const saturationWeight=Math.pow(s,1.25);
        const lightnessWeight=1-Math.abs(l-.52)*.9;
        buckets[Math.floor(h/10)%36]+=saturationWeight*lightnessWeight;
      }
    }

    let best=0,bestN=0;
    buckets.forEach((n,i)=>{ if(n>bestN){ bestN=n; best=i; } });
    return bestN?best*10+5:null;
  }

  function contrastCheckedExtractImgAccent(imgEl,heroEl){
    if(!heroEl||!imgEl) return;
    try{
      const cv=document.createElement("canvas");
      cv.width=cv.height=48;
      const cx=cv.getContext("2d",{willReadFrequently:true});
      cx.drawImage(imgEl,0,0,48,48);
      const px=cx.getImageData(0,0,48,48).data;
      const baseHue=extractArtworkHue(px);
      if(baseHue===null) return;

      const roles=contrastSafePaletteTriad(baseHue);
      const root=heroEl.closest(".dp-wrap")||heroEl;

      setColourRole(root,"main",roles.main);
      setColourRole(root,"secondary",roles.secondary);
      setColourRole(root,"accent",roles.accent);

      root.style.setProperty("--squiggle-color",roles.main.hex);
      root.style.setProperty("--quote-accent",roles.secondary.hex);
      root.style.setProperty("--triad-accent",roles.accent.hex);

      root.style.setProperty("--accent",roles.main.hex);
      root.style.setProperty("--accent2",roles.secondary.hex);
      root.style.setProperty("--accent-glass",roles.secondary.hex);

      root.style.setProperty("--dp-btn",roles.secondary.hex);
      root.style.setProperty("--dp-btn-text",readableForegroundForHex(roles.secondary.hex));

      document.body.style.setProperty("--dp-nav-accent",roles.secondary.hex);
      document.body.style.setProperty("--main-colour",roles.main.hex);
      document.body.style.setProperty("--secondary-colour",roles.secondary.hex);
      document.body.style.setProperty("--accent-colour",roles.accent.hex);
      document.body.style.setProperty("--main-color",roles.main.hex);
      document.body.style.setProperty("--secondary-color",roles.secondary.hex);
      document.body.style.setProperty("--accent-color",roles.accent.hex);
    }catch(_){ }
  }

  window.HUME_PALETTE=HUME_PALETTE.map(item=>({...item}));
  window.extractImgAccent=contrastCheckedExtractImgAccent;
  try{ extractImgAccent=contrastCheckedExtractImgAccent; }catch(_){ }
})();
