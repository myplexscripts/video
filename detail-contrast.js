"use strict";

/* Detail-page dynamic colour system
   Loaded after app.js and tmdb-backdrop-dedupe.js.
   Handles detail layout fixes, TMDB first-backdrop display skip, and artwork
   colour roles: main, secondary, accent. */
(function(){
  const style=document.createElement("style");
  style.id="detail-layout-fix";
  style.textContent=`
    .dp-wrap .rate-stars button .svgi.filled{color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--accent))))!important}
    .dp-wrap .rate-stars button:hover{color:var(--accent-colour,var(--accent-color,var(--triad-accent,var(--accent2))))!important}

    .dp-summary-body{align-items:stretch!important}
    .dp-squiggle{
      align-self:stretch!important;width:24px!important;min-height:100%!important;height:auto!important;
      overflow:hidden!important;position:relative!important;
      color:var(--main-colour,var(--main-color,var(--squiggle-color,var(--accent))))!important;
    }
    .dp-squiggle svg{display:none!important}
    .dp-squiggle::before{
      content:"";position:absolute;inset:0;width:24px;min-height:100%;background:currentColor;
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='96' viewBox='0 0 24 96'%3E%3Cpath d='M12 0 C2 8 2 16 12 24 C22 32 22 40 12 48 C2 56 2 64 12 72 C22 80 22 88 12 96' fill='none' stroke='black' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='96' viewBox='0 0 24 96'%3E%3Cpath d='M12 0 C2 8 2 16 12 24 C22 32 22 40 12 48 C2 56 2 64 12 72 C22 80 22 88 12 96' fill='none' stroke='black' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      -webkit-mask-repeat:repeat-y;mask-repeat:repeat-y;-webkit-mask-size:24px 96px;mask-size:24px 96px;
      -webkit-mask-position:top center;mask-position:top center;
    }

    .dp-title{letter-spacing:.045em!important;text-shadow:none!important}
    .dp-summary-wrap h2,.dp-wrap .rail-head h3,.dp-wrap .section h3,.dp-prod-section>h3,.dp-story-head h3{letter-spacing:.01em!important}

    @media (max-width:680px){
      .dp-hero--split .dp-fold{display:flex!important;flex-direction:column!important;min-height:100dvh;padding-top:0!important}
      .dp-hero--split .dp-poster{order:1!important;margin-top:0!important;width:100%!important;position:relative;z-index:1}
      .dp-hero--split .dp-poster img{aspect-ratio:1/1!important;object-position:center center}
      .dp-hero--split .dp-head{
        order:2!important;padding:0 var(--edge) 0!important;margin-top:clamp(-72px,-13vw,-42px)!important;
        position:relative!important;z-index:3!important;align-items:center!important;text-align:center!important;width:100%!important;
      }
      .dp-hero--split .dp-title{
        font-size:clamp(48px,14vw,82px)!important;line-height:.88!important;
        width:100%!important;max-width:calc(100vw - 24px)!important;text-shadow:none!important;
      }
      .dp-hero--split .dp-head .wave-wrap{justify-content:center!important;width:100%!important;margin:-2px 0 8px!important;transform:none!important}
      .dp-hero--split .dp-head .wave-wrap svg{max-width:min(260px,72vw)!important}
      .dp-hero--split .dp-rate-row{justify-content:center!important;transform:none!important;max-width:100%!important;margin-top:0!important}
      .dp-hero--split .dp-head .dp-rate{justify-content:center!important}
      .dp-hero--split .dp-meta{order:3!important;margin-top:18px!important}
    }

    @media (min-width:901px){
      .dp-hero.dp-hero--split .dp-head{align-items:flex-start!important;text-align:left!important}
      .dp-hero.dp-hero--split .dp-head .wave-wrap{justify-content:flex-start!important}
      .dp-hero.dp-hero--split .dp-title{font-size:clamp(72px,6.25vw,112px)!important;line-height:.91;max-width:min(74vw,920px)!important}
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-head{margin-top:clamp(34px,6vh,64px);min-height:126px;padding:0 var(--edge) 24px 0!important}
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-title{right:auto!important;left:clamp(-176px,-9vw,-84px);bottom:100%}
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-head .wave-wrap{justify-content:flex-start!important;transform:translate(clamp(-176px,-9vw,-84px),-14px)!important}
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-rate-row{justify-content:flex-start!important;transform:translateX(clamp(-176px,-9vw,-84px));max-width:calc(100% + 176px)}
      .dp-hero.dp-hero--split:has(.dp-backdrop) .dp-head .dp-rate{justify-content:flex-start!important}

      .dp-story{
        max-width:min(1180px,calc(100vw - 96px))!important;margin:0 auto!important;
        padding:110px var(--edge) 48px!important;display:grid!important;
        grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr)!important;
        gap:34px 54px!important;align-items:center!important;
      }
      .dp-story-head{grid-column:1/-1!important;border-top:1px solid var(--line);padding-top:34px!important;margin-bottom:6px!important}
      .dp-story-head h3{font-size:clamp(58px,7vw,112px)!important;line-height:.9!important;margin:0!important;color:var(--main-colour,var(--squiggle-color,var(--text)))!important}
      .dp-story-fig{margin:0!important;position:relative!important;overflow:hidden!important;background:var(--bg2)!important;border:1px solid var(--line)!important}
      .dp-story-fig img{width:100%!important;aspect-ratio:16/9!important;object-fit:cover!important;display:block!important;filter:saturate(1.05) contrast(1.03)!important}
      .dp-story-p{
        margin:0!important;color:var(--dim)!important;font-size:clamp(17px,1.35vw,21px)!important;line-height:1.72!important;
        padding:28px 0 28px 34px!important;border-left:3px solid var(--secondary-colour,var(--quote-accent,var(--line)))!important;
        max-width:46ch!important;
      }
      .dp-story-fig:nth-of-type(even){grid-column:2!important}
      .dp-story-fig:nth-of-type(even)+.dp-story-p{grid-column:1!important;grid-row:auto!important;padding:28px 34px 28px 0!important;border-left:0!important;border-right:3px solid var(--secondary-colour,var(--quote-accent,var(--line)))!important;text-align:right!important;justify-self:end!important}
    }
  `;
  document.head.appendChild(style);

  const existingPickUniqueBackdrops=window.pickUniqueBackdrops;
  if(typeof existingPickUniqueBackdrops==="function"){
    async function pickUniqueBackdropsSkippingFirstTmdb(backdrops,max=3){
      const firstTmdbPath=(backdrops||[]).find(item=>item&&item.file_path)?.file_path||"";
      let picked=[];
      try{ picked=await existingPickUniqueBackdrops(backdrops,Math.max(max+1,4)); }
      catch(err){ console.warn("[tmdb-dedupe] pickUniqueBackdrops failed",err?.message||err); }
      const filtered=(picked||[]).filter(path=>path&&path!==firstTmdbPath);
      if(filtered.length>=max) return filtered.slice(0,max);
      const seen=new Set(filtered);
      const extras=(backdrops||[]).map(item=>item?.file_path).filter(path=>path&&path!==firstTmdbPath&&!seen.has(path));
      return [...filtered,...extras].slice(0,max);
    }
    window.pickUniqueBackdrops=pickUniqueBackdropsSkippingFirstTmdb;
    try{ pickUniqueBackdrops=pickUniqueBackdropsSkippingFirstTmdb; }catch(_){ }
  }

  const DARK_BG="#050505", DARK_TEXT="#141005", LIGHT_TEXT="#ffffff";
  const HUME_PALETTE=[
    {name:"Red",hex:"#FF4D5E"},{name:"Brick",hex:"#D85A43"},{name:"Orange",hex:"#FF8A1C"},{name:"Amber",hex:"#FFC533"},
    {name:"Lime",hex:"#C9F24D"},{name:"Olive",hex:"#B6C84A"},{name:"Green",hex:"#45E56F"},{name:"Mint",hex:"#28E0B0"},
    {name:"Teal",hex:"#2EB8A6"},{name:"Cyan",hex:"#20C8FF"},{name:"Steel",hex:"#579BC7"},{name:"Blue",hex:"#5C8DFF"},
    {name:"Violet",hex:"#B078FF"},{name:"Purple",hex:"#B05CDE"},{name:"Pink",hex:"#FF5EC4"},{name:"Rose",hex:"#E45C8A"}
  ];

  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function hexToRgb(hex){const raw=hex.replace("#","");const full=raw.length===3?raw.split("").map(c=>c+c).join(""):raw;return [parseInt(full.slice(0,2),16),parseInt(full.slice(2,4),16),parseInt(full.slice(4,6),16)];}
  function rgbToHex(r,g,b){return "#"+[r,g,b].map(v=>{const s=Math.round(clamp(v,0,255)).toString(16).toUpperCase();return s.length===1?"0"+s:s;}).join("");}
  function hslToRgb(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return l-a*Math.max(Math.min(k-3,9-k,1),-1);};return [f(0)*255,f(8)*255,f(4)*255];}
  function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;if(max===min)return[0,0,l];const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);const h=max===r?((g-b)/d+(g<b?6:0)):max===g?((b-r)/d+2):((r-g)/d+4);return[h/6*360,s,l];}
  function srgbToLinear(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function rgbToOklab(r,g,b){const lr=srgbToLinear(r),lg=srgbToLinear(g),lb=srgbToLinear(b);const l=0.4122214708*lr+0.5363325363*lg+0.0514459929*lb;const m=0.2119034982*lr+0.6806995451*lg+0.1073969566*lb;const s=0.0883024619*lr+0.2817188376*lg+0.6299787005*lb;const l_=Math.cbrt(l),m_=Math.cbrt(m),s_=Math.cbrt(s);return[0.2104542553*l_+0.7936177850*m_-0.0040720468*s_,1.9779984951*l_-2.4285922050*m_+0.4505937099*s_,0.0259040371*l_+0.7827717662*m_-0.8086757660*s_];}
  function hexToOklab(hex){const [r,g,b]=hexToRgb(hex);return rgbToOklab(r,g,b);}
  function oklabDistance(a,b){const dl=(a[0]-b[0])*1.4,da=a[1]-b[1],db=a[2]-b[2];return Math.sqrt(dl*dl+da*da+db*db);}
  function relLumFromRgb255(rgb){return 0.2126*srgbToLinear(rgb[0])+0.7152*srgbToLinear(rgb[1])+0.0722*srgbToLinear(rgb[2]);}
  function hexLum(hex){return relLumFromRgb255(hexToRgb(hex));}
  function contrastRatio(a,b){const hi=Math.max(a,b),lo=Math.min(a,b);return(hi+0.05)/(lo+0.05);}
  function readableForegroundForHex(hex){const bg=hexLum(hex);return contrastRatio(bg,hexLum(DARK_TEXT))>=contrastRatio(bg,hexLum(LIGHT_TEXT))?DARK_TEXT:LIGHT_TEXT;}
  function targetHexFromHsl(h,s,l){const [r,g,b]=hslToRgb(h,s,l);return rgbToHex(r,g,b);}
  function paletteHue(hex){const [r,g,b]=hexToRgb(hex);return rgbToHsl(r,g,b)[0];}
  function hueDistance(a,b){const d=Math.abs(a-b)%360;return Math.min(d,360-d);}

  const preparedPalette=HUME_PALETTE.map(item=>({...item,lab:hexToOklab(item.hex),hue:paletteHue(item.hex),bgContrast:contrastRatio(hexLum(item.hex),hexLum(DARK_BG))}));
  function closestPaletteColour(targetHex,used){
    const lab=hexToOklab(targetHex),targetHue=paletteHue(targetHex);
    const ranked=preparedPalette.map(item=>({item,score:oklabDistance(item.lab,lab)+(used.has(item.hex)?0.22:0)+(hueDistance(item.hue,targetHue)>95?0.08:0)+(item.bgContrast<4.5?0.25:0)})).sort((a,b)=>a.score-b.score);
    const pick=ranked.find(entry=>!used.has(entry.item.hex))||ranked[0];used.add(pick.item.hex);return pick.item;
  }
  function contrastSafePaletteTriad(baseHue){const used=new Set();return{main:closestPaletteColour(targetHexFromHsl(baseHue,96,60),used),secondary:closestPaletteColour(targetHexFromHsl((baseHue+120)%360,92,62),used),accent:closestPaletteColour(targetHexFromHsl((baseHue+240)%360,90,64),used)};}
  function setColourRole(root,name,colour){root.style.setProperty(`--${name}-colour`,colour.hex);root.style.setProperty(`--${name}-color`,colour.hex);root.style.setProperty(`--${name}-colour-name`,`"${colour.name}"`);root.style.setProperty(`--${name}-color-name`,`"${colour.name}"`);}
  function extractArtworkHue(px){
    const buckets=new Array(36).fill(0);
    for(let i=0;i<px.length;i+=4){if(px[i+3]<180)continue;const [h,s,l]=rgbToHsl(px[i],px[i+1],px[i+2]);if(s>.18&&l>.08&&l<.9)buckets[Math.floor(h/10)%36]+=Math.pow(s,1.25)*(1-Math.abs(l-.52)*.9);}
    let best=0,bestN=0;buckets.forEach((n,i)=>{if(n>bestN){bestN=n;best=i;}});return bestN?best*10+5:null;
  }
  function contrastCheckedExtractImgAccent(imgEl,heroEl){
    if(!heroEl||!imgEl)return;
    try{
      const cv=document.createElement("canvas");cv.width=cv.height=48;const cx=cv.getContext("2d",{willReadFrequently:true});cx.drawImage(imgEl,0,0,48,48);
      const baseHue=extractArtworkHue(cx.getImageData(0,0,48,48).data);if(baseHue===null)return;
      const roles=contrastSafePaletteTriad(baseHue),root=heroEl.closest(".dp-wrap")||heroEl;
      setColourRole(root,"main",roles.main);setColourRole(root,"secondary",roles.secondary);setColourRole(root,"accent",roles.accent);
      root.style.setProperty("--squiggle-color",roles.main.hex);root.style.setProperty("--quote-accent",roles.secondary.hex);root.style.setProperty("--triad-accent",roles.accent.hex);
      root.style.setProperty("--accent",roles.main.hex);root.style.setProperty("--accent2",roles.secondary.hex);root.style.setProperty("--accent-glass",roles.secondary.hex);
      root.style.setProperty("--dp-btn",roles.secondary.hex);root.style.setProperty("--dp-btn-text",readableForegroundForHex(roles.secondary.hex));
      document.body.style.setProperty("--dp-nav-accent",roles.secondary.hex);
      ["main","secondary","accent"].forEach(name=>{document.body.style.setProperty(`--${name}-colour`,roles[name].hex);document.body.style.setProperty(`--${name}-color`,roles[name].hex);});
    }catch(_){ }
  }

  window.HUME_PALETTE=HUME_PALETTE.map(item=>({...item}));
  window.extractImgAccent=contrastCheckedExtractImgAccent;
  try{extractImgAccent=contrastCheckedExtractImgAccent;}catch(_){ }
})();
