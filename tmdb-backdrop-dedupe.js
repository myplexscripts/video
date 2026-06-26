"use strict";

/* TMDB backdrop dedupe for detail pages
   Filters to textless 16:9-ish TMDB backdrops, analyzes semantic regions,
   groups visually similar key-art variants, and returns one best image per group.

   Loaded after app.js so it can replace pickUniqueBackdrops() without touching
   the rest of the detail-page enrichment pipeline. */
(function(){
  const DEFAULT_DEDUPE_OPTIONS={
    threshold:72,
    semanticRegions:3,
    analysisSize:"w500",
    maxImages:24,
    tmdbImageBase:"https://image.tmdb.org/t/p"
  };

  const CLIP_CDN="https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
  const CLIP_MODEL="Xenova/clip-vit-base-patch32";
  const EMBED_SIZE=224;
  const ANALYSIS_W=96;
  const ANALYSIS_H=54;

  let clipModelPromise=null;

  async function dedupeTmdbBackdrops(backdrops,options={}){
    const opts={...DEFAULT_DEDUPE_OPTIONS,...options};

    const seen=new Set();
    const usable=(backdrops||[])
      .filter(isUsableNoLanguageBackdrop)
      .filter(item=>!seen.has(item.file_path)&&seen.add(item.file_path))
      .sort((a,b)=>scoreBackdrop(b)-scoreBackdrop(a))
      .slice(0,opts.maxImages);

    if(!usable.length){
      return {deduped:[],groups:[],analyzed:[]};
    }

    const analyzed=await analyzeBackdrops(usable,opts);
    const groups=await groupSimilar(analyzed,opts.threshold);

    return {
      deduped:groups.map(group=>group.representative),
      groups,
      analyzed
    };
  }

  function isUsableNoLanguageBackdrop(backdrop){
    const width=Number(backdrop?.width||0);
    const height=Number(backdrop?.height||0);
    if(!backdrop?.file_path||!width||!height) return false;
    if(backdrop.iso_639_1!==null) return false;
    const ratio=width/height;
    return ratio>=1.55&&ratio<=1.95;
  }

  function scoreBackdrop(backdrop){
    const voteAverage=Number(backdrop?.vote_average||0);
    const voteCount=Number(backdrop?.vote_count||0);
    const pixels=Number(backdrop?.width||0)*Number(backdrop?.height||0);
    return voteAverage*1000+Math.log10(voteCount+1)*300+Math.log10(pixels+1)*40;
  }

  async function analyzeBackdrops(backdrops,opts){
    const model=await getClipModel();
    const results=[];

    for(const backdrop of backdrops){
      try{
        const img=await loadImage(tmdbImageUrl(backdrop.file_path,opts.analysisSize,opts.tmdbImageBase));
        const pixel=buildPixelSignature(img);
        const regions=createSemanticRegions(img.naturalWidth,img.naturalHeight,pixel.contentBoxNorm,opts.semanticRegions);
        const embeddings=[];

        for(const region of regions){
          const vector=await embedRegion(model,img,region);
          embeddings.push({name:region.name,vector});
        }

        results.push({
          ...backdrop,
          qualityScore:scoreBackdrop(backdrop),
          hist:pixel.hist,
          hashes:pixel.hashes,
          contentBoxNorm:pixel.contentBoxNorm,
          focalX:pixel.focal.x,
          focalY:pixel.focal.y,
          embeddings
        });
      }catch(err){
        // One broken image should not kill the entire detail page.
        console.warn("[tmdb-dedupe] skipped backdrop",backdrop?.file_path,err?.message||err);
      }

      await yieldFrame();
    }

    return results;
  }

  async function getClipModel(){
    if(clipModelPromise) return clipModelPromise;

    clipModelPromise=(async()=>{
      const {pipeline,env}=await import(CLIP_CDN);
      env.allowLocalModels=false;
      env.useBrowserCache=true;
      return pipeline("image-feature-extraction",CLIP_MODEL,{quantized:true});
    })();

    return clipModelPromise;
  }

  async function embedRegion(extractor,img,region){
    const canvas=document.createElement("canvas");
    canvas.width=EMBED_SIZE;
    canvas.height=EMBED_SIZE;

    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#111";
    ctx.fillRect(0,0,EMBED_SIZE,EMBED_SIZE);
    ctx.drawImage(img,region.x,region.y,region.w,region.h,0,0,EMBED_SIZE,EMBED_SIZE);

    const output=await extractor(canvas,{pooling:"mean",normalize:true});
    const data=output?.data||output?.tensor?.data||output?.[0]?.data;

    if(!data){
      throw new Error("CLIP embedding output was not readable.");
    }

    return normalizeUnit(Float32Array.from(data));
  }

  function createSemanticRegions(width,height,contentBoxNorm,count=3){
    const regions=[];

    const add=(name,x,y,w,h)=>{
      x=clamp(Math.round(x),0,width-1);
      y=clamp(Math.round(y),0,height-1);
      w=clamp(Math.round(w),1,width-x);
      h=clamp(Math.round(h),1,height-y);
      regions.push({name,x,y,w,h});
    };

    add("full",0,0,width,height);
    if(count<=1) return regions;

    const box=contentBoxNorm||{x:0,y:0,w:1,h:1};
    add("content-box",box.x*width,box.y*height,box.w*width,box.h*height);
    if(count<=2) return regions;

    add("upper-keyart",width*0.06,height*0,width*0.88,height*0.68);
    if(count<=3) return regions;

    add("center-keyart",width*0.10,height*0.14,width*0.80,height*0.72);
    if(count<=4) return regions;

    add("lower-keyart",width*0.06,height*0.28,width*0.88,height*0.70);
    return regions;
  }

  async function groupSimilar(items,threshold=72){
    const parent=items.map((_,index)=>index);
    const bestMatch=items.map(()=>null);

    function find(index){
      while(parent[index]!==index){
        parent[index]=parent[parent[index]];
        index=parent[index];
      }
      return index;
    }

    function unite(a,b){
      const rootA=find(a);
      const rootB=find(b);
      if(rootA!==rootB) parent[rootB]=rootA;
    }

    for(let i=0;i<items.length;i++){
      for(let j=i+1;j<items.length;j++){
        const comparison=compareKeyArtVariant(items[i],items[j]);

        if(comparison.score>=threshold){
          unite(i,j);

          if(!bestMatch[i]||comparison.score>bestMatch[i].score){
            bestMatch[i]=comparison;
          }

          if(!bestMatch[j]||comparison.score>bestMatch[j].score){
            bestMatch[j]=comparison;
          }
        }
      }

      await yieldFrame();
    }

    const map=new Map();

    for(let i=0;i<items.length;i++){
      const root=find(i);
      if(!map.has(root)) map.set(root,[]);
      map.get(root).push({
        ...items[i],
        matchedScore:bestMatch[i]?.score||0,
        matchedVia:bestMatch[i]?.via||""
      });
    }

    return [...map.values()]
      .map(groupItems=>{
        const sorted=[...groupItems].sort((a,b)=>b.qualityScore-a.qualityScore);
        return {
          representative:sorted[0],
          items:sorted,
          hiddenSimilar:sorted.slice(1)
        };
      })
      .sort((a,b)=>b.representative.qualityScore-a.representative.qualityScore);
  }

  function compareKeyArtVariant(a,b){
    const semanticData=bestEmbeddingScore(a.embeddings,b.embeddings);
    const pixel=bestHashScore(a.hashes,b.hashes);
    const color=Math.max(0,100*(1-histogramDistance(a.hist,b.hist)));

    const focal=100*(1-Math.min(1,Math.hypot((a.focalX||0.5)-(b.focalX||0.5),(a.focalY||0.5)-(b.focalY||0.5))/0.72));

    let score=semanticData.variantScore*0.54+pixel*0.28+color*0.10+focal*0.08;

    if(semanticData.sameSupport>=2&&pixel>52) score+=3;
    if(semanticData.fullScore>58&&semanticData.topSameScore>60) score+=3;
    if(semanticData.sameSupport>=3&&semanticData.namedBestScore>68) score+=2;

    if(semanticData.bestIsCrossOnly&&semanticData.namedBestScore<58){
      score=Math.min(score,68);
    }

    if(semanticData.fullScore<42&&semanticData.sameAvgScore<50){
      score=Math.min(score,70);
    }

    if(pixel<45&&semanticData.fullScore<56){
      score=Math.min(score,69);
    }

    return {
      score:clamp(score,0,100),
      via:[
        `variant ${semanticData.variantScore.toFixed(1)}`,
        `full ${semanticData.fullScore.toFixed(1)}`,
        `same ${semanticData.sameAvgScore.toFixed(1)}`,
        `crop ${pixel.toFixed(1)}`,
        `color ${color.toFixed(1)}`,
        `focal ${focal.toFixed(1)}`
      ].join(", ")
    };
  }

  function bestEmbeddingScore(aEmbeddings,bEmbeddings){
    let bestRaw=-1;
    let bestVia="";
    let bestIsCrossOnly=false;
    const sameScores=[];
    let namedBestScore=0;
    let fullScore=0;

    for(const a of aEmbeddings||[]){
      for(const b of bEmbeddings||[]){
        const raw=dot(a.vector,b.vector);
        const calibrated=calibrateClipScore(raw);

        if(raw>bestRaw){
          bestRaw=raw;
          bestVia=`${a.name} to ${b.name}`;
          bestIsCrossOnly=a.name!==b.name;
        }

        if(a.name===b.name){
          sameScores.push({name:a.name,score:calibrated,raw});
          if(calibrated>namedBestScore) namedBestScore=calibrated;
          if(a.name==="full") fullScore=Math.max(fullScore,calibrated);
        }
      }
    }

    if(bestRaw<0){
      return {
        bestScore:0,
        variantScore:0,
        fullScore:0,
        namedBestScore:0,
        sameAvgScore:0,
        topSameScore:0,
        sameSupport:0,
        bestIsCrossOnly:false,
        bestVia:""
      };
    }

    const bestScore=calibrateClipScore(bestRaw);
    sameScores.sort((a,b)=>b.score-a.score);

    const sameAvgScore=sameScores.length?sameScores.reduce((sum,item)=>sum+item.score,0)/sameScores.length:0;
    const topSameScore=sameScores.length?sameScores.slice(0,Math.min(2,sameScores.length)).reduce((sum,item)=>sum+item.score,0)/Math.min(2,sameScores.length):0;
    const sameSupport=sameScores.filter(item=>item.score>=58).length;

    let variantScore=fullScore*0.34+sameAvgScore*0.28+topSameScore*0.26+namedBestScore*0.12;

    if(sameSupport<2){
      variantScore=Math.min(variantScore,66+Math.max(0,namedBestScore-70)*0.25);
    }

    if(bestIsCrossOnly&&bestScore-namedBestScore>14){
      variantScore=Math.min(variantScore,68);
    }

    return {
      bestScore,
      variantScore:clamp(variantScore,0,100),
      fullScore,
      namedBestScore,
      sameAvgScore,
      topSameScore,
      sameSupport,
      bestIsCrossOnly,
      bestVia
    };
  }

  function calibrateClipScore(raw){
    return clamp((raw-0.58)/0.30*100,0,100);
  }

  function buildPixelSignature(img){
    const canvas=document.createElement("canvas");
    canvas.width=ANALYSIS_W;
    canvas.height=ANALYSIS_H;

    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(img,0,0,ANALYSIS_W,ANALYSIS_H);

    const {data}=ctx.getImageData(0,0,ANALYSIS_W,ANALYSIS_H);
    const total=ANALYSIS_W*ANALYSIS_H;
    const luma=new Float32Array(total);
    const sat=new Float32Array(total);
    const edge=new Float32Array(total);
    const hist=new Float32Array(64);

    let borderSum=0;
    let borderCount=0;

    for(let y=0;y<ANALYSIS_H;y++){
      for(let x=0;x<ANALYSIS_W;x++){
        const i=y*ANALYSIS_W+x;
        const s=i*4;
        const r=data[s]/255;
        const g=data[s+1]/255;
        const b=data[s+2]/255;
        const max=Math.max(r,g,b);
        const min=Math.min(r,g,b);
        const lum=r*0.2126+g*0.7152+b*0.0722;
        const saturation=max===0?0:(max-min)/max;

        luma[i]=lum;
        sat[i]=saturation;

        const rb=Math.min(3,Math.floor(r*4));
        const gb=Math.min(3,Math.floor(g*4));
        const bb=Math.min(3,Math.floor(b*4));
        hist[rb*16+gb*4+bb]++;

        if(x===0||y===0||x===ANALYSIS_W-1||y===ANALYSIS_H-1){
          borderSum+=lum;
          borderCount++;
        }
      }
    }

    for(let y=1;y<ANALYSIS_H-1;y++){
      for(let x=1;x<ANALYSIS_W-1;x++){
        const i=y*ANALYSIS_W+x;
        const gx=Math.abs(luma[i+1]-luma[i-1]);
        const gy=Math.abs(luma[i+ANALYSIS_W]-luma[i-ANALYSIS_W]);
        edge[i]=Math.min(1,(gx+gy)*2.6);
      }
    }

    normalizeInPlace(hist);

    const contentBox=detectContentBox(luma,sat,edge,borderSum/Math.max(1,borderCount));

    return {
      hist,
      focal:estimateFocal(luma,sat,edge),
      contentBoxNorm:{
        x:contentBox.x/ANALYSIS_W,
        y:contentBox.y/ANALYSIS_H,
        w:contentBox.w/ANALYSIS_W,
        h:contentBox.h/ANALYSIS_H
      },
      hashes:buildHashes(luma,contentBox)
    };
  }

  function detectContentBox(luma,sat,edge,borderLum){
    const rowScore=new Float32Array(ANALYSIS_H);
    const colScore=new Float32Array(ANALYSIS_W);

    for(let y=0;y<ANALYSIS_H;y++){
      for(let x=0;x<ANALYSIS_W;x++){
        const i=y*ANALYSIS_W+x;
        const value=Math.abs(luma[i]-borderLum)*0.72+sat[i]*0.20+edge[i]*0.55;
        rowScore[y]+=value;
        colScore[x]+=value;
      }
    }

    const rowThreshold=maxValue(rowScore)*0.10;
    const colThreshold=maxValue(colScore)*0.10;

    let top=0;
    let bottom=ANALYSIS_H-1;
    let left=0;
    let right=ANALYSIS_W-1;

    while(top<bottom&&rowScore[top]<rowThreshold) top++;
    while(bottom>top&&rowScore[bottom]<rowThreshold) bottom--;
    while(left<right&&colScore[left]<colThreshold) left++;
    while(right>left&&colScore[right]<colThreshold) right--;

    if(right-left<ANALYSIS_W*0.35||bottom-top<ANALYSIS_H*0.35){
      return {x:0,y:0,w:ANALYSIS_W,h:ANALYSIS_H};
    }

    const padX=Math.round(ANALYSIS_W*0.04);
    const padY=Math.round(ANALYSIS_H*0.04);

    left=clamp(left-padX,0,ANALYSIS_W-1);
    right=clamp(right+padX,0,ANALYSIS_W-1);
    top=clamp(top-padY,0,ANALYSIS_H-1);
    bottom=clamp(bottom+padY,0,ANALYSIS_H-1);

    return {x:left,y:top,w:right-left+1,h:bottom-top+1};
  }

  function estimateFocal(luma,sat,edge){
    let sum=0;
    let sx=0;
    let sy=0;

    for(let y=0;y<ANALYSIS_H;y++){
      for(let x=0;x<ANALYSIS_W;x++){
        const i=y*ANALYSIS_W+x;
        const centerBias=1-Math.min(1,Math.hypot(x/(ANALYSIS_W-1)-0.5,y/(ANALYSIS_H-1)-0.5)/0.72);
        const weight=edge[i]*0.60+sat[i]*0.24+Math.abs(luma[i]-0.5)*0.12+centerBias*0.18;
        sum+=weight;
        sx+=weight*(x/(ANALYSIS_W-1));
        sy+=weight*(y/(ANALYSIS_H-1));
      }
    }

    if(!sum) return {x:0.5,y:0.5};
    return {x:clamp(sx/sum,0,1),y:clamp(sy/sum,0,1)};
  }

  function buildHashes(luma,contentBox){
    const regions=[
      {name:"full",x:0,y:0,w:ANALYSIS_W,h:ANALYSIS_H},
      {name:"content",...contentBox},
      {name:"center",x:Math.round(ANALYSIS_W*0.15),y:Math.round(ANALYSIS_H*0.10),w:Math.round(ANALYSIS_W*0.70),h:Math.round(ANALYSIS_H*0.80)},
      {name:"left-square",x:0,y:0,w:Math.round(ANALYSIS_H),h:ANALYSIS_H},
      {name:"center-square",x:Math.round((ANALYSIS_W-ANALYSIS_H)/2),y:0,w:ANALYSIS_H,h:ANALYSIS_H},
      {name:"right-square",x:ANALYSIS_W-ANALYSIS_H,y:0,w:ANALYSIS_H,h:ANALYSIS_H},
      {name:"upper-keyart",x:Math.round(ANALYSIS_W*0.06),y:0,w:Math.round(ANALYSIS_W*0.88),h:Math.round(ANALYSIS_H*0.68)}
    ];

    return regions.map(region=>({
      name:region.name,
      dHash:dHashRegion(luma,region,9,8),
      aHash:aHashRegion(luma,region,8,8)
    }));
  }

  function dHashRegion(luma,region,cols=9,rows=8){
    const values=sampleRegion(luma,region,cols,rows);
    const bits=[];

    for(let y=0;y<rows;y++){
      for(let x=0;x<cols-1;x++){
        const a=values[y*cols+x];
        const b=values[y*cols+x+1];
        bits.push(a>b?1:0);
      }
    }

    return bits;
  }

  function aHashRegion(luma,region,cols=8,rows=8){
    const values=sampleRegion(luma,region,cols,rows);
    const avg=values.reduce((sum,value)=>sum+value,0)/values.length;
    return Array.from(values,value=>value>=avg?1:0);
  }

  function sampleRegion(luma,region,cols,rows){
    const values=new Float32Array(cols*rows);
    const x0=clamp(region.x,0,ANALYSIS_W-1);
    const y0=clamp(region.y,0,ANALYSIS_H-1);
    const w=clamp(region.w,1,ANALYSIS_W-x0);
    const h=clamp(region.h,1,ANALYSIS_H-y0);

    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        const sx=clamp(Math.round(x0+(x+0.5)*w/cols),0,ANALYSIS_W-1);
        const sy=clamp(Math.round(y0+(y+0.5)*h/rows),0,ANALYSIS_H-1);
        values[y*cols+x]=luma[sy*ANALYSIS_W+sx];
      }
    }

    return values;
  }

  function bestHashScore(aHashes,bHashes){
    let best=0;

    for(const a of aHashes||[]){
      for(const b of bHashes||[]){
        const dHashScore=bitSimilarity(a.dHash,b.dHash);
        const aHashScore=bitSimilarity(a.aHash,b.aHash);
        const sameRegionBonus=a.name===b.name?4:0;
        const score=dHashScore*0.66+aHashScore*0.34+sameRegionBonus;
        if(score>best) best=score;
      }
    }

    return clamp(best,0,100);
  }

  function bitSimilarity(a,b){
    const length=Math.min(a?.length||0,b?.length||0);
    if(!length) return 0;

    let same=0;
    for(let i=0;i<length;i++){
      if(a[i]===b[i]) same++;
    }

    return same/length*100;
  }

  function histogramDistance(a,b){
    const length=Math.min(a?.length||0,b?.length||0);
    if(!length) return 1;

    let sum=0;
    for(let i=0;i<length;i++){
      sum+=Math.abs(a[i]-b[i]);
    }

    return clamp(sum/2,0,1);
  }

  function tmdbImageUrl(filePath,size="w500",base="https://image.tmdb.org/t/p"){
    return `${base}/${size}${filePath}`;
  }

  function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.crossOrigin="anonymous";
      img.decoding="async";
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error(`Could not load image: ${src}`));
      img.src=src;
    });
  }

  function yieldFrame(){
    return new Promise(resolve=>requestAnimationFrame(resolve));
  }

  function clamp(value,min,max){
    return Math.min(max,Math.max(min,value));
  }

  function maxValue(values){
    let max=0;
    for(const value of values){
      if(value>max) max=value;
    }
    return max;
  }

  function normalizeUnit(vector){
    let sum=0;
    for(let i=0;i<vector.length;i++){
      sum+=vector[i]*vector[i];
    }

    const length=Math.sqrt(sum)||1;
    const out=new Float32Array(vector.length);

    for(let i=0;i<vector.length;i++){
      out[i]=vector[i]/length;
    }

    return out;
  }

  function normalizeInPlace(vector){
    let sum=0;
    for(let i=0;i<vector.length;i++){
      sum+=vector[i];
    }

    if(!sum) return vector;

    for(let i=0;i<vector.length;i++){
      vector[i]=vector[i]/sum;
    }

    return vector;
  }

  function dot(a,b){
    const length=Math.min(a?.length||0,b?.length||0);
    let sum=0;

    for(let i=0;i<length;i++){
      sum+=a[i]*b[i];
    }

    return sum;
  }

  async function fallbackPickUniqueBackdrops(backdrops,max){
    const seen=new Set();
    const usable=(backdrops||[])
      .filter(isUsableNoLanguageBackdrop)
      .filter(item=>!seen.has(item.file_path)&&seen.add(item.file_path))
      .sort((a,b)=>scoreBackdrop(b)-scoreBackdrop(a))
      .slice(0,Math.max(8,max*3));

    const loaded=await Promise.all(usable.map(async item=>{
      try{
        const im=await loadImage(tmdbImageUrl(item.file_path,"w300"));
        const pixel=buildPixelSignature(im);
        return {...item,qualityScore:scoreBackdrop(item),hist:pixel.hist,hashes:pixel.hashes};
      }catch(_){
        return {...item,qualityScore:scoreBackdrop(item),hist:null,hashes:null};
      }
    }));

    const accepted=[];
    for(const item of loaded){
      if(accepted.length>=max) break;
      const duplicate=accepted.some(prev=>{
        const pixel=bestHashScore(item.hashes,prev.hashes);
        const color=item.hist&&prev.hist?Math.max(0,100*(1-histogramDistance(item.hist,prev.hist))):0;
        return pixel*0.78+color*0.22>=74;
      });
      if(!duplicate) accepted.push(item);
    }

    return accepted.map(item=>item.file_path);
  }

  async function pickUniqueBackdropsForDetail(backdrops,max=3){
    try{
      const result=await dedupeTmdbBackdrops(backdrops,{
        threshold:72,
        semanticRegions:3,
        analysisSize:"w500",
        maxImages:24
      });

      const paths=(result.deduped||[])
        .map(item=>item.file_path)
        .filter(Boolean)
        .slice(0,max);

      if(paths.length) return paths;
    }catch(err){
      console.warn("[tmdb-dedupe] CLIP dedupe failed, using pixel fallback",err?.message||err);
    }

    return fallbackPickUniqueBackdrops(backdrops,max);
  }

  window.dedupeTmdbBackdrops=dedupeTmdbBackdrops;
  window.pickUniqueBackdrops=pickUniqueBackdropsForDetail;
  try{ pickUniqueBackdrops=pickUniqueBackdropsForDetail; }catch(_){ }
})();
