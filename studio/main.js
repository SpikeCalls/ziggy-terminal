import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GW = 1080, GH = 660, GTOP = 96, FOV = 30;
const DUR = 16.5; window.DURATION = DUR;

// ---------- utils ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,k)=>a+(b-a)*k;
const seg=(t,a,b)=>clamp((t-a)/(b-a));
const sm=k=>{k=clamp(k);return k*k*(3-2*k);};
const eio=k=>{k=clamp(k);return k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;};
const eout=k=>{k=clamp(k);return 1-Math.pow(1-k,3);};
const fade=(t,a,b,c,d)=>Math.min(sm(seg(t,a,b)), 1-sm(seg(t,c,d)));
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const hash=(a,b)=>{let h=(a*374761393+b*668265263)>>>0;h=(h^(h>>>13))*1274126177>>>0;return ((h^(h>>>16))>>>0)/4294967296;};
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function hexPath(g,x,y,r){g.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;g.lineTo(x+r*Math.cos(a),y+r*Math.sin(a));}g.closePath();}
const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});
const $=id=>document.getElementById(id);

await document.fonts.load('900 100px Unbounded'); await document.fonts.load('700 30px "JetBrains Mono"'); await document.fonts.ready;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({canvas:$('gl'),antialias:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(1.5); renderer.setSize(GW,GH,false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.38;
const camera = new THREE.PerspectiveCamera(FOV, GW/GH, 0.05, 60);

// background of the fly zone
{ const [c,g]=cnv(GW,GH); g.fillStyle='#050608'; g.fillRect(0,0,GW,GH);
  let gr=g.createRadialGradient(540,300,20,540,300,560); gr.addColorStop(0,'rgba(36,52,70,0.55)'); gr.addColorStop(1,'rgba(5,6,8,0)'); g.fillStyle=gr; g.fillRect(0,0,GW,GH);
  gr=g.createRadialGradient(140,360,0,140,360,420); gr.addColorStop(0,'rgba(40,190,120,0.06)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,GW,GH);
  gr=g.createRadialGradient(960,260,0,960,260,420); gr.addColorStop(0,'rgba(200,70,190,0.10)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,GW,GH);
  g.fillStyle='rgba(255,255,255,0.05)'; for(let y=14;y<GH;y+=30) for(let x=14;x<GW;x+=30) g.fillRect(x,y,1.6,1.6);
  gr=g.createLinearGradient(0,GH-140,0,GH); gr.addColorStop(0,'rgba(5,6,8,0)'); gr.addColorStop(1,'rgba(5,6,8,1)'); g.fillStyle=gr; g.fillRect(0,GH-140,GW,140);
  gr=g.createLinearGradient(0,0,0,60); gr.addColorStop(0,'rgba(5,6,8,1)'); gr.addColorStop(1,'rgba(5,6,8,0)'); g.fillStyle=gr; g.fillRect(0,0,GW,60);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; scene.background=t; }

// ---------- textures ----------
function speckle(g,w,h,n,col,seed,amin=0.04,amax=0.14,smax=3){const r=mulberry32(seed);for(let i=0;i<n;i++){g.fillStyle=col.replace('A',(amin+r()*(amax-amin)).toFixed(3));const s=1+r()*smax;g.fillRect(r()*w,r()*h,s,s);}}
function tex(c,srgb=true){const t=new THREE.CanvasTexture(c); if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;}
function eyeTex(){
  const [c,g]=cnv(2048,1024), [b,gb]=cnv(2048,1024), [e,ge]=cnv(2048,1024);
  g.fillStyle='#250201'; g.fillRect(0,0,2048,1024); gb.fillStyle='#000'; gb.fillRect(0,0,2048,1024); ge.fillStyle='#000'; ge.fillRect(0,0,2048,1024);
  const r=7, dx=r*Math.sqrt(3), dy=r*1.5; const rr=mulberry32(3);
  for(let row=0,y=0;y<1024+r;row++,y+=dy){for(let x=(row%2)*dx/2;x<2048+r;x+=dx){
    const v=0.8+rr()*0.35;
    const gr=g.createRadialGradient(x-1.5,y-1.5,0,x,y,r); gr.addColorStop(0,`rgb(${205*v|0},${58*v|0},${34*v|0})`); gr.addColorStop(0.6,`rgb(${140*v|0},${22*v|0},${12*v|0})`); gr.addColorStop(1,'#220201');
    g.fillStyle=gr; hexPath(g,x,y,r*0.93); g.fill();
    const gg=gb.createRadialGradient(x,y,0,x,y,r); gg.addColorStop(0,'#fff'); gg.addColorStop(1,'#111'); gb.fillStyle=gg; hexPath(gb,x,y,r*0.93); gb.fill();
    if(rr()<0.05){ ge.fillStyle='#ff2a10'; hexPath(ge,x,y,r*0.6); ge.fill(); }
  }}
  return [tex(c),tex(b,false),tex(e)];
}
// armour plating: u = around body axis (0.5 = top), v = along body (top of image = tail)
function plateTex(kind){
  const w=2048,h=1024; const [c,g]=cnv(w,h), [b,gb]=cnv(w,h), [e,ge]=cnv(w,h); const r=mulberry32(kind==='th'?41:42);
  const gr=g.createLinearGradient(0,0,w,0);
  gr.addColorStop(0,'#127a4a'); gr.addColorStop(0.25,'#14a24a'); gr.addColorStop(0.5,'#0e8f3e'); gr.addColorStop(0.75,'#14a24a'); gr.addColorStop(1,'#127a4a');
  g.fillStyle=gr; g.fillRect(0,0,w,h);
  gb.fillStyle='#9a9a9a'; gb.fillRect(0,0,w,h); ge.fillStyle='#000'; ge.fillRect(0,0,w,h);
  // tonal plate patches
  for(let i=0;i<60;i++){ g.fillStyle=`rgba(${r()<0.5?'20,60,120':'200,170,40'},${0.04+r()*0.07})`; g.fillRect(r()*w,r()*h,80+r()*300,40+r()*200); }
  speckle(g,w,h,9000,'rgba(0,30,10,A)',7,0.05,0.18,2); speckle(g,w,h,5000,'rgba(220,255,200,A)',8,0.03,0.1,1.5);
  const seamV = kind==='th' ? [0.2,0.8] : [0.13,0.28,0.43,0.58,0.73,0.88];
  const seamU = kind==='th' ? [0.33,0.67,0.17,0.83] : [0.5];
  const line=(ctxs,x0,y0,x1,y1,wd,col)=>{ for(const [ctx,cl] of ctxs){ ctx.strokeStyle=cl; ctx.lineWidth=wd; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); } };
  for(const v of seamV){ const y=v*h; line([[g,'rgba(4,20,10,0.85)'],[gb,'#000']],0,y,w,y,7);
    for(let x=10;x<w;x+=34){ g.fillStyle='rgba(190,230,210,0.75)'; g.beginPath(); g.arc(x,y+(kind==='th'?14:11),3.2,0,7); g.fill(); gb.fillStyle='#fff'; gb.beginPath(); gb.arc(x,y+(kind==='th'?14:11),4,0,7); gb.fill(); }
    if(kind==='ab'){ ge.strokeStyle='rgba(61,255,160,0.55)'; ge.lineWidth=2.4; ge.beginPath(); ge.moveTo(0.36*w,y+4); ge.lineTo(0.64*w,y+4); ge.stroke(); } }
  for(const u of seamU){ const x=u*w; const y0=(kind==='th'?0.2:0.13)*h, y1=(kind==='th'?0.8:0.88)*h; line([[g,'rgba(4,20,10,0.8)'],[gb,'#000']],x,y0,x,y1,6); }
  if(kind==='th'){
    // dark dorsal stripes like a real blowfly + neon side seams
    for(const u of [0.4,0.6]){ const sg=g.createLinearGradient((u-0.02)*w,0,(u+0.02)*w,0); sg.addColorStop(0,'rgba(5,25,15,0)'); sg.addColorStop(0.5,'rgba(5,25,15,0.45)'); sg.addColorStop(1,'rgba(5,25,15,0)'); g.fillStyle=sg; g.fillRect((u-0.02)*w,0.22*h,0.04*w,0.56*h); }
    for(const u of [0.33,0.67]){ ge.strokeStyle='rgba(61,255,160,0.6)'; ge.lineWidth=2.4; ge.beginPath(); ge.moveTo(u*w+5,0.24*h); ge.lineTo(u*w+5,0.76*h); ge.stroke(); }
    // vents
    for(const u of [0.12,0.88]) for(let k=0;k<6;k++){ const x=u*w-40, y=0.38*h+k*22; g.fillStyle='#03120a'; g.fillRect(x,y,80,9); gb.fillStyle='#000'; gb.fillRect(x,y,80,9); }
    // Z
    const cx=0.5*w, cy=0.5*h;
    for(const [ctx,em] of [[g,0],[ge,1],[gb,2]]){ ctx.save(); ctx.translate(cx,cy); ctx.scale(0.8,1); ctx.font='900 380px Unbounded'; ctx.textAlign='center'; ctx.textBaseline='middle';
      if(em===0){ ctx.lineWidth=24; ctx.lineJoin='round'; ctx.strokeStyle='rgba(2,10,6,0.95)'; ctx.strokeText('Z',0,8); }
      ctx.fillStyle= em===2 ? '#d0d0d0' : (em?'#3dff9a':'#7dffc0'); ctx.fillText('Z',0,8); ctx.restore(); }
  }
  return [tex(c),tex(b,false),tex(e)];
}
function headTex(){
  const w=1024,h=512; const [c,g]=cnv(w,h); const [e,ge]=cnv(w,h);
  const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#b9c2bf'); gr.addColorStop(0.5,'#2d3a34'); gr.addColorStop(1,'#b9c2bf');
  g.fillStyle=gr; g.fillRect(0,0,w,h); speckle(g,w,h,5000,'rgba(10,20,15,A)',12,0.05,0.25,2);
  ge.fillStyle='#000'; ge.fillRect(0,0,w,h);
  const r=mulberry32(44);
  for(let i=0;i<30;i++){ let x=0.5*w+(r()-0.5)*60, y=0.5*h+(r()-0.5)*50; const ang=r()*Math.PI*2;
    for(const ctx of [g,ge]){ ctx.beginPath(); ctx.moveTo(x,y); }
    let px=x,py=y; for(let k=0;k<4;k++){ const L=30+r()*70; const a=ang+(r()-0.5)*1.4; px+=Math.cos(a)*L; py+=Math.sin(a)*L*0.7; g.lineTo(px,py); ge.lineTo(px,py); }
    g.strokeStyle='rgba(20,60,40,0.9)'; g.lineWidth=3; g.stroke(); ge.strokeStyle= i%3? '#1fd47a':'#7dffc4'; ge.lineWidth=2.4; ge.stroke(); }
  return [tex(c),tex(e)];
}
function chipTex(){
  const s=512; const [c,g]=cnv(s,s); const [e,ge]=cnv(s,s);
  g.fillStyle='#0a120e'; g.fillRect(0,0,s,s); ge.fillStyle='#000'; ge.fillRect(0,0,s,s);
  const r=mulberry32(21);
  for(let i=0;i<50;i++){ let x=r()*s,y=r()*s; g.beginPath(); ge.beginPath(); g.moveTo(x,y); ge.moveTo(x,y);
    for(let k=0;k<5;k++){ if(r()<0.5) x+=(r()-0.5)*180; else y+=(r()-0.5)*180; x=clamp(x,24,s-24); y=clamp(y,24,s-24); g.lineTo(x,y); ge.lineTo(x,y);}
    g.strokeStyle='#c9a24a'; g.lineWidth=3; g.stroke(); ge.strokeStyle=r()<0.5?'#3dffa0':'#0c3a25'; ge.lineWidth=3; ge.stroke(); }
  g.fillStyle='#e0bd62'; for(let i=0;i<14;i++){const p=36+i*31; g.fillRect(p,6,12,22); g.fillRect(p,s-28,12,22); g.fillRect(6,p,22,12); g.fillRect(s-28,p,22,12);}
  g.fillStyle='#06080a'; g.fillRect(124,124,264,264);
  for(const [ctx,em] of [[g,0],[ge,1]]){ ctx.strokeStyle='#3dffa0'; ctx.lineWidth=em?6:4; ctx.strokeRect(138,138,236,236);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 120px Unbounded'; ctx.fillStyle=em?'#53ffb0':'#8affc9'; ctx.fillText('Z',256,250); }
  return [tex(c),tex(e)];
}
function wingTex(){
  const w=1024,h=400; const [c,g]=cnv(w,h);
  const gr=g.createLinearGradient(0,0,w,h);
  gr.addColorStop(0,'rgba(170,190,200,0.34)'); gr.addColorStop(0.4,'rgba(150,170,200,0.26)'); gr.addColorStop(0.7,'rgba(200,170,220,0.26)'); gr.addColorStop(1,'rgba(190,200,190,0.24)');
  g.fillStyle=gr; g.fillRect(0,0,w,h);
  // smoky base like the photos
  const bg=g.createLinearGradient(0,0,w*0.35,0); bg.addColorStop(0,'rgba(40,40,45,0.5)'); bg.addColorStop(1,'rgba(40,40,45,0)'); g.fillStyle=bg; g.fillRect(0,0,w,h);
  speckle(g,w,h,7000,'rgba(30,30,30,A)',31,0.05,0.16,1.2);
  g.strokeStyle='rgba(18,20,22,0.95)'; g.lineCap='round';
  const vein=(pts,lw)=>{g.lineWidth=lw;g.beginPath();g.moveTo(pts[0][0]*w,pts[0][1]*h);for(let i=1;i<pts.length;i+=2){g.quadraticCurveTo(pts[i][0]*w,pts[i][1]*h,pts[i+1][0]*w,pts[i+1][1]*h);}g.stroke();};
  vein([[0,0.47],[0.35,0.04],[0.78,0.05]],8); vein([[0,0.48],[0.4,0.14],[0.85,0.15]],4.5); vein([[0,0.49],[0.45,0.30],[0.98,0.36]],4.5);
  vein([[0,0.50],[0.45,0.5],[0.62,0.5],[0.8,0.5],[0.96,0.3]],4.5); vein([[0,0.52],[0.4,0.78],[0.72,0.92]],4.5); vein([[0.4,0.32],[0.42,0.42],[0.44,0.52]],3.5); vein([[0.62,0.5],[0.66,0.62],[0.7,0.75]],3.5);
  return tex(c);
}
function glowTex(inner='rgba(150,255,205,1)', mid='rgba(60,255,160,0.35)'){
  const [c,g]=cnv(256,256); const gr=g.createRadialGradient(128,128,0,128,128,128);
  gr.addColorStop(0,inner); gr.addColorStop(0.25,mid); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,256,256); return tex(c);
}
function padTex(){
  const s=1024; const [c,g]=cnv(s,s); const cx=s/2;
  g.clearRect(0,0,s,s); g.translate(cx,cx);
  for(let i=1;i<=9;i++){ const rr=i*55; g.strokeStyle=`rgba(80,255,190,${i===9?0.9:0.22+0.03*i})`; g.lineWidth=i===9?5:1.6; g.beginPath(); g.arc(0,0,rr,0,7); g.stroke(); }
  for(let k=0;k<72;k++){ const a=k/72*Math.PI*2; const r0=k%6?470:430; g.strokeStyle=`rgba(80,255,190,${k%6?0.35:0.8})`; g.lineWidth=k%6?1.5:3; g.beginPath(); g.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); g.lineTo(Math.cos(a)*495,Math.sin(a)*495); g.stroke(); }
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; g.strokeStyle='rgba(80,255,190,0.12)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(Math.cos(a)*60,Math.sin(a)*60); g.lineTo(Math.cos(a)*430,Math.sin(a)*430); g.stroke(); }
  g.font='600 22px JetBrains Mono'; g.fillStyle='rgba(120,255,200,0.7)'; g.textAlign='center';
  const txt='ZIGGY · SIM-01 · 166,432 NEURONS · PUMP.FUN · '; for(let i=0;i<txt.length*2;i++){ const a=i/(txt.length*2)*Math.PI*2; g.save(); g.rotate(a); g.fillText(txt[i%txt.length],0,-462); g.restore(); }
  return tex(c);
}

// ---------- fly (robotic blowfly) ----------
const clipPlane = new THREE.Plane(V(1,0,0), 10), clipLocal = new THREE.Plane();
function M(mat){ mat.clippingPlanes=[clipPlane]; return mat; }
function ellipsoid(rx,ry,rz,mat,ws=96,hs=64,taper=0){ const g=new THREE.SphereGeometry(1,ws,hs); g.rotateZ(Math.PI/2); g.scale(rx,ry,rz);
  if(taper){ const p=g.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i); if(x<0){ const k=Math.pow(-x/rx,1.7); const f=1-taper*k; p.setY(i,p.getY(i)*f); p.setZ(i,p.getZ(i)*f);} } g.computeVertexNormals(); }
  return new THREE.Mesh(g,mat); }
function limb(a,b,r1,r2,mat){ const d=new THREE.Vector3().subVectors(b,a); const L=d.length(); const g=new THREE.CylinderGeometry(r2,r1,L,10,1); g.translate(0,L/2,0);
  const m=new THREE.Mesh(g,mat); m.position.copy(a); m.quaternion.setFromUnitVectors(V(0,1,0), d.clone().normalize()); return m; }
const hairGeo=new THREE.ConeGeometry(1,1,5,1); hairGeo.translate(0,0.5,0);
function hairs(parent, list, mat){ const im=new THREE.InstancedMesh(hairGeo,mat,list.length); const m=new THREE.Matrix4(), q=new THREE.Quaternion();
  list.forEach(([p,d,l,r],i)=>{ q.setFromUnitVectors(V(0,1,0),d.clone().normalize()); m.compose(p,q,V(r,l,r)); im.setMatrixAt(i,m); }); parent.add(im); return im; }
function ellSurf(rx,ry,rz,th,ph,taper=0){ let x=rx*Math.cos(th), y=ry*Math.sin(th)*Math.cos(ph), z=rz*Math.sin(th)*Math.sin(ph);
  if(taper&&x<0){ const f=1-taper*Math.pow(-x/rx,1.7); y*=f; z*=f; } const n=V(x/(rx*rx), y/(ry*ry), z/(rz*rz)).normalize(); return [V(x,y,z), n]; }

const fly = new THREE.Group(); scene.add(fly);
const [eT,eB,eE]=eyeTex(); const [thT,thB,thE]=plateTex('th'); const [abT,abB,abE]=plateTex('ab'); const [hdT,hdE]=headTex(); const [chT,chE]=chipTex(); const wT=wingTex();
const armour=(map,bump,emis)=>M(new THREE.MeshPhysicalMaterial({map,bumpMap:bump,bumpScale:3,emissiveMap:emis,emissive:new THREE.Color('#ffffff'),emissiveIntensity:1,
  metalness:0.88,roughness:0.3,iridescence:0.5,iridescenceIOR:1.6,iridescenceThicknessRange:[300,700],clearcoat:0.22,clearcoatRoughness:0.3}));
const cuticle = armour(thT,thB,thE);
const abMat = armour(abT,abB,abE);
const scutMat = M(new THREE.MeshPhysicalMaterial({color:'#0b6a34',metalness:0.85,roughness:0.28,iridescence:0.5,iridescenceIOR:1.6,iridescenceThicknessRange:[300,700],clearcoat:0.22}));
const headMat = M(new THREE.MeshPhysicalMaterial({map:hdT, emissiveMap:hdE, emissive:new THREE.Color('#ffffff'), emissiveIntensity:1.0, metalness:0.75, roughness:0.32, clearcoat:0.5}));
const eyeMat = M(new THREE.MeshPhysicalMaterial({map:eT, bumpMap:eB, bumpScale:3, emissiveMap:eE, emissive:new THREE.Color('#ffffff'), emissiveIntensity:0.6, roughness:0.35, clearcoat:1, clearcoatRoughness:0.12}));
const legMat = M(new THREE.MeshPhysicalMaterial({color:'#121416', metalness:0.85, roughness:0.32, clearcoat:0.4}));
const chromeMat = M(new THREE.MeshStandardMaterial({color:'#c9d2d6', metalness:1, roughness:0.18}));
const hairMat = M(new THREE.MeshStandardMaterial({color:'#07080a', roughness:0.5, metalness:0.3}));
const chipTop = M(new THREE.MeshStandardMaterial({map:chT, emissiveMap:chE, emissive:new THREE.Color('#ffffff'), emissiveIntensity:1.4, metalness:0.55, roughness:0.32}));
const chipSide = M(new THREE.MeshStandardMaterial({color:'#2a2f2c', metalness:0.85, roughness:0.3}));
const neonMat = M(new THREE.MeshStandardMaterial({color:'#082416', emissive:new THREE.Color('#3dffa0'), emissiveIntensity:2.0}));
const ledMat = M(new THREE.MeshStandardMaterial({color:'#000', emissive:new THREE.Color('#5dffb5'), emissiveIntensity:4}));

const R=mulberry32(1234); const G=-0.98; // ground level (fly local)
// thorax
const TH={rx:0.6,ry:0.52,rz:0.52};
const thorax = ellipsoid(TH.rx,TH.ry,TH.rz,cuticle); thorax.position.set(0.3,0.1,0); fly.add(thorax);
{ const L=[]; for(let i=0;i<260;i++){ const th=0.3+R()*2.5, ph=(R()*2-1)*1.8; const [p,n]=ellSurf(TH.rx,TH.ry,TH.rz,th,ph);
    if(Math.abs(ph)<0.5 && th>0.95 && th<2.2) continue; L.push([p,n.clone().add(V(-0.6,0.15,0)),0.04+R()*0.03,0.004]); }
  for(const th of [0.7,1.05,1.45,1.85,2.2,2.5]) for(const ph of [0.62,1.0,1.35,-0.62,-1.0,-1.35]){ const [p,n]=ellSurf(TH.rx,TH.ry,TH.rz,th,ph);
    L.push([p, n.clone().multiplyScalar(0.7).add(V(-1,0.35,0)), 0.24+R()*0.08, 0.009]); }
  hairs(thorax,L,hairMat); }
const scut = ellipsoid(0.22,0.13,0.26,scutMat,48,32); scut.position.set(-0.24,0.46,0); scut.rotation.z=0.35; fly.add(scut);
{ const L=[]; for(const z of [0.16,0.06,-0.06,-0.16]) L.push([V(-0.14,0.06,z), V(-1,0.45,z), 0.3, 0.01]); hairs(scut,L,hairMat); }
// abdomen
const AB={rx:0.72,ry:0.46,rz:0.56,taper:0.5};
const abd = ellipsoid(AB.rx,AB.ry,AB.rz,abMat,96,64,AB.taper); abd.position.set(-0.68,-0.02,0); abd.rotation.z=0.1; fly.add(abd);
{ const L=[]; for(let i=0;i<220;i++){ const th=0.8+R()*2.2, ph=(R()*2-1)*2.0; const [p,n]=ellSurf(AB.rx,AB.ry,AB.rz,th,ph,AB.taper); L.push([p,n.clone().add(V(-0.8,0,0)),0.04+R()*0.03,0.004]); }
  for(let k=0;k<5;k++) for(let j=0;j<9;j++){ const th=1.25+k*0.36, ph=-1.4+j*0.35; const [p,n]=ellSurf(AB.rx,AB.ry,AB.rz,th,ph,AB.taper); L.push([p,n.clone().multiplyScalar(0.8).add(V(-1,0.1,0)),0.12+R()*0.05,0.006]); }
  hairs(abd,L,hairMat); }
// head
const head = new THREE.Group(); head.position.set(1.07,0.16,0); head.rotation.z=-0.08; fly.add(head);
const HD={rx:0.27,ry:0.43,rz:0.5};
const headShell = ellipsoid(HD.rx,HD.ry,HD.rz,headMat); head.add(headShell);
for(const s of [1,-1]){ const eye = ellipsoid(0.28,0.39,0.25,eyeMat); eye.position.set(0.07,0.05,s*0.25); eye.rotation.y=s*0.42; head.add(eye); }
{ const L=[]; for(let i=0;i<120;i++){ const th=0.6+R()*2.2, ph=(R()*2-1)*1.0; const [p,n]=ellSurf(HD.rx,HD.ry,HD.rz,th,ph); if(Math.abs(ph)<0.5&&th>1.1&&th<2.1) continue; L.push([p,n.clone().add(V(0.3,0.4,0)),0.04,0.004]); }
  for(const s of [1,-1]) for(const k of [0,1,2]){ const [p,n]=ellSurf(HD.rx,HD.ry,HD.rz,1.75+k*0.3,s*0.55); L.push([p,n.clone().add(V(-0.5,0.6,0)),0.18,0.007]); }
  hairs(headShell,L,hairMat); }
const neck = ellipsoid(0.15,0.18,0.18,legMat,32,24); neck.position.set(0.82,0.13,0); fly.add(neck);
// proboscis
head.add(limb(V(0.12,-0.3,0),V(0.2,-0.52,0),0.055,0.045,legMat));
for(const s of [1,-1]){ const lb=ellipsoid(0.07,0.05,0.06,chromeMat,24,16); lb.position.set(0.22,-0.55,s*0.04); head.add(lb); }
// antennae
for(const s of [1,-1]){
  const a1=new THREE.Mesh(new THREE.SphereGeometry(0.04,16,12),chromeMat); a1.position.set(0.25,0.06,s*0.07); head.add(a1);
  const a2=ellipsoid(0.05,0.11,0.05,legMat,24,18); a2.position.set(0.29,-0.04,s*0.08); a2.rotation.z=-0.25; head.add(a2);
  const curve=new THREE.CatmullRomCurve3([V(0.32,-0.05,s*0.1),V(0.4,0.02,s*0.17),V(0.47,0.12,s*0.22),V(0.5,0.24,s*0.25)]);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,0.006,5,false),hairMat));
  const L=[]; for(let i=1;i<10;i++){ const p=curve.getPoint(i/10.5), tg=curve.getTangent(i/10.5); const side=V(-tg.y,tg.x,0).normalize(); const l=0.055*(1-i/12);
    L.push([p,side,l,0.0025]); L.push([p,side.clone().negate(),l*0.8,0.0025]); } hairs(head,L,hairMat);
}
// chip implant
const chip = new THREE.Group(); chip.position.set(-0.03,0.415,0); chip.rotation.z=-0.08; chip.scale.setScalar(1.55); head.add(chip);
chip.add(new THREE.Mesh(new THREE.BoxGeometry(0.24,0.04,0.22), [chipSide,chipSide,chipTop,chipSide,chipSide,chipSide]));
const chipBase=new THREE.Mesh(new THREE.BoxGeometry(0.27,0.03,0.25),neonMat); chipBase.position.y=-0.028; chip.add(chipBase);
chip.add(limb(V(-0.08,0.02,0.08),V(-0.15,0.24,0.1),0.007,0.004,chromeMat));
const led=new THREE.Mesh(new THREE.SphereGeometry(0.02,16,12),ledMat); led.position.set(-0.152,0.25,0.1); chip.add(led);
for(const s of [1,-1]){ const c=new THREE.CatmullRomCurve3([V(-0.1,0.37,s*0.07),V(-0.22,0.3,s*0.12),V(-0.3,0.1,s*0.11),V(-0.42,0.0,s*0.08)]);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(c,20,0.012,8,false),neonMat)); }
const chipGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));
chipGlow.scale.set(0.8,0.8,1); chipGlow.position.set(0,0.05,0); chip.add(chipGlow);
const ledGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.8}));
ledGlow.scale.set(0.2,0.2,1); led.add(ledGlow);
// halteres
for(const s of [1,-1]){ const a=V(-0.14,0.2,s*0.42), b=V(-0.28,0.14,s*0.5); fly.add(limb(a,b,0.014,0.01,chromeMat)); const k=new THREE.Mesh(new THREE.SphereGeometry(0.045,14,10),chromeMat); k.position.copy(b); fly.add(k); }
// legs: standing on the pad, robotic joints + pistons
for(const s of [1,-1]){
  const hx=[0.56,0.32,0.08], fx=[0.32,0.02,-0.34], ax=[0.2,0.0,-0.22], tx=[0.2,0.04,-0.22];
  for(let i=0;i<3;i++){
    const hip=V(hx[i],-0.3,s*0.13);
    const knee=hip.clone().add(V(fx[i],0.06,s*0.48));
    const ank=V(knee.x+ax[i], G+0.12, knee.z+s*0.22);
    const toe=V(ank.x+tx[i], G+0.005, ank.z+s*0.14);
    fly.add(limb(hip,knee,0.045,0.035,legMat)); fly.add(limb(knee,ank,0.03,0.022,legMat));
    // piston alongside femur
    const off=V(0,0.05,0); fly.add(limb(hip.clone().lerp(knee,0.15).add(off),hip.clone().lerp(knee,0.75).add(off),0.012,0.012,chromeMat));
    const tars=[ank]; for(let k=1;k<=4;k++) tars.push(ank.clone().lerp(toe,k/4).add(V(0,0.02*Math.sin(k/4*Math.PI),0)));
    for(let k=0;k<4;k++) fly.add(limb(tars[k],tars[k+1],0.016-k*0.002,0.014-k*0.002,legMat));
    for(const [q,r] of [[hip,0.05],[knee,0.038],[ank,0.028]]){ const j=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),chromeMat); j.position.copy(q); fly.add(j); }
    for(const z of [1,-1]) fly.add(limb(toe,toe.clone().add(V(Math.sign(tx[i]||1)*0.04,-0.003,z*0.03)),0.006,0.002,chromeMat));
    const L=[]; for(let k=0;k<24;k++){ const a=k<10?hip:knee, b=k<10?knee:ank; const q=a.clone().lerp(b,R()); L.push([q,V(-0.2+R()*0.4,0.4,s*(0.6+R()*0.4)),0.04+R()*0.03,0.004]); }
    for(let k=0;k<5;k++){ const q=knee.clone().lerp(ank,0.15+k*0.17); L.push([q,V(0.1,0.1,s),0.08,0.005]); }
    hairs(fly,L,hairMat);
  }
}
// wings: folded back over the abdomen like a resting fly
function wingGeo(mirror){ const L=1.75; const sh=new THREE.Shape(); sh.moveTo(0,0.02);
  sh.splineThru([[0.25,0.15],[0.55,0.25],[0.82,0.27],[0.97,0.19],[1,0.05],[0.95,-0.11],[0.8,-0.22],[0.5,-0.27],[0.22,-0.18],[0.05,-0.06],[0,-0.02]].map(([x,y])=>new THREE.Vector2(x*L,y)));
  const g=new THREE.ShapeGeometry(sh,48); const pos=g.attributes.position, uv=g.attributes.uv;
  for(let i=0;i<pos.count;i++) uv.setXY(i,pos.getX(i)/L,(pos.getY(i)+0.36)/0.72);
  g.rotateX(mirror?Math.PI/2:-Math.PI/2); return g; }
const wings=[];
for(const s of [1,-1]){ const hinge=new THREE.Group(); hinge.position.set(0.12,0.5+(s>0?0.012:0),s*0.2); fly.add(hinge);
  const mat=M(new THREE.MeshPhysicalMaterial({map:wT,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false,roughness:0.15,metalness:0.1,iridescence:1,iridescenceIOR:1.35,iridescenceThicknessRange:[220,700],clearcoat:1,clearcoatRoughness:0.1}));
  const m=new THREE.Mesh(wingGeo(s<0),mat); m.rotation.y=Math.atan2(-s*0.36,-0.93); m.renderOrder=20; hinge.add(m);
  hinge.add(limb(V(0,0,0),V(-0.1,0.02,s*0.05),0.03,0.02,chromeMat));
  wings.push({s,hinge,m}); }

// scan plane for materialisation
const scan=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),new THREE.MeshBasicMaterial({map:glowTex('rgba(180,255,220,1)','rgba(60,255,170,0.22)'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,opacity:0}));
scan.rotation.y=Math.PI/2; fly.add(scan);

// holographic turntable pad
const pad=new THREE.Group(); pad.position.y=G; scene.add(pad);
const padDisc=new THREE.Mesh(new THREE.CircleGeometry(2.05,128),new THREE.MeshBasicMaterial({map:padTex(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.85}));
padDisc.rotation.x=-Math.PI/2; pad.add(padDisc);
const padGlow=new THREE.Mesh(new THREE.CircleGeometry(2.4,64),new THREE.MeshBasicMaterial({map:glowTex('rgba(80,255,180,0.5)','rgba(40,200,140,0.18)'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.6}));
padGlow.rotation.x=-Math.PI/2; padGlow.position.y=-0.01; pad.add(padGlow);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.25,64),new THREE.MeshBasicMaterial({map:glowTex('rgba(0,0,0,0.85)','rgba(0,0,0,0.5)'),transparent:true,depthWrite:false}));
shadow.rotation.x=-Math.PI/2; shadow.position.y=0.004; shadow.scale.set(1.5,1,1); pad.add(shadow);
const rings=[]; for(let i=0;i<2;i++){ const r=new THREE.Mesh(new THREE.RingGeometry(1.97,2.0,128),new THREE.MeshBasicMaterial({color:'#5dffbf',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,opacity:0}));
  r.rotation.x=-Math.PI/2; pad.add(r); rings.push(r); }

// lights
const key=new THREE.DirectionalLight('#fff4e8',1.6); key.position.set(-3,7,4); scene.add(key);
const key2=new THREE.DirectionalLight('#ffffff',0.7); key2.position.set(4,5,-3); scene.add(key2);
const rimG=new THREE.DirectionalLight('#3cf0a8',1.0); rimG.position.set(5,1.5,5); scene.add(rimG);
const rimP=new THREE.DirectionalLight('#ff5fd8',1.1); rimP.position.set(-4,2,-5); scene.add(rimP);
const padLight=new THREE.PointLight('#4dffb0',1.5,4,2); padLight.position.set(0,G+0.2,0); scene.add(padLight);
scene.add(new THREE.HemisphereLight('#a9bbff','#20140a',0.45));
// post
const rt=new THREE.WebGLRenderTarget(GW,GH,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,rt); composer.setPixelRatio(1.5); composer.setSize(GW,GH);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(GW,GH),0.36,0.4,0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- brain panel ----------
const BRAIN=await loadImg('assets/brain.png');
const bc=$('brain').getContext('2d'); const BW=1080, BH=470, BTOP=744;
const IMW=790, IMH=IMW*BRAIN.height/BRAIN.width, IMX=(BW-IMW)/2, IMY=40;   // image rect inside panel (unzoomed)
const [offC,off]=cnv(BW,BH);
// sparkle candidates
const SPK=[]; { const [c,g]=cnv(BRAIN.width,BRAIN.height); g.drawImage(BRAIN,0,0); const d=g.getImageData(0,0,BRAIN.width,BRAIN.height).data; const r=mulberry32(5);
  for(let i=0;i<60000&&SPK.length<5000;i++){ const x=(r()*BRAIN.width)|0,y=(r()*BRAIN.height)|0,o=(y*BRAIN.width+x)*4; if(d[o+3]>230){ const mx=Math.max(d[o],d[o+1],d[o+2]); if(mx>150) SPK.push([x,y,d[o],d[o+1],d[o+2]]); } } }
// regions in image px
const REG={ optL:[235,330], optR:[972,330], ant:[600,410], mbL:[470,175], mbR:[735,175], cx:[603,215], sez:[603,575], mid:[603,300] };
const RTAG={nose:{p:'ant',n:'ANTENNAL LOBE',d:'smells the narrative',c:'#ff9f43'}, eyes:{p:'optR',n:'OPTIC LOBE',d:'reads the candles',c:'#5b8cff'},
  risk:{p:'cx',n:'CENTRAL COMPLEX',d:'navigation · decisions',c:'#ff5ec8'}, mem:{p:'mbL',n:'MUSHROOM BODY',d:'memory · learning',c:'#4fe0c0'},
  exec:{p:'sez',n:'DESCENDING NEURONS',d:'motor → execute',c:'#a77bff'}, pnl:{p:'mid',n:'WHOLE BRAIN',d:'reward signal',c:'#3dff9a'}};
const rtagsEl=$('rtags'); for(const k in RTAG){ const r=RTAG[k]; const el=document.createElement('div'); el.className='rtag abs'; el.style.setProperty('--c',r.c); el.innerHTML=`<i>${r.n}</i>${r.d}`; el.style.opacity=0; rtagsEl.appendChild(el); r.el=el; }

// ---------- terminal script ----------
const P='ziggy@pump.fun:~$ ';
const LINES=[
  {t:0.35,cps:46,s:[[P,'c-g'],['./trade --brain connectome --mode degen','c-w']]},
  {t:1.35,s:[['[boot] ','c-d'],['connectome loaded ......... ',''],['166,432 neurons','c-c']]},
  {t:1.75,s:[['[boot] ','c-d'],['synapses wired ............ ',''],['125,000,000','c-c']]},
  {t:2.15,s:[['[boot] ','c-d'],['head chip handshake ....... ',''],['OK','c-g'],['  0.4ms','c-d']]},
  {t:2.55,s:[['[feed] ','c-d'],['pump.fun · charts · on-chain → ',''],['streaming','c-g']]},
  {t:3.45,tag:'nose',s:[['[nose] ','c-o'],['new pair smells sweet → ',''],['$OVERRIPE','c-w']]},
  {t:4.15,tag:'exec',s:[['[exec] ','c-p'],['BUY  ','c-g'],['$OVERRIPE   0.10 SOL   ',''],['✓','c-g']]},
  {t:4.95,tag:'eyes',s:[['[eyes] ','c-b'],['3 green candles · volume ↑','']]},
  {t:5.6,tag:'exec',pnl:0.064,s:[['[exec] ','c-p'],['SELL ','c-b'],['$OVERRIPE   ',''],['+64%  +0.064 SOL','c-g']]},
  {t:6.4,tag:'nose',s:[['[nose] ','c-o'],['CT hype detected → ',''],['$MANGOWIF','c-w']]},
  {t:6.95,tag:'exec',s:[['[exec] ','c-p'],['BUY  ','c-g'],['$MANGOWIF   0.15 SOL   ',''],['✓','c-g']]},
  {t:7.7,tag:'risk',s:[['[risk] ','c-y'],['dev wallet moving… ',''],['⚠','c-y']]},
  {t:8.25,tag:'exec',pnl:-0.018,s:[['[exec] ','c-p'],['STOP ','c-r'],['$MANGOWIF   ',''],['-12%  -0.018 SOL','c-r']]},
  {t:8.95,tag:'mem',s:[['[mem ] ','c-c'],['saved: "dev sells = rug"  ',''],['LEARNED','c-g']]},
  {t:9.85,tag:'nose',s:[['[nose] ','c-o'],['fermented fruit smell → ',''],['$VINEGAR','c-w']]},
  {t:10.4,tag:'exec',s:[['[exec] ','c-p'],['BUY  ','c-g'],['$VINEGAR    0.20 SOL   ',''],['✓','c-g']]},
  {t:11.25,tag:'eyes',s:[['[eyes] ','c-b'],['breakout · holding…','']]},
  {t:11.9,tag:'exec',pnl:0.236,s:[['[exec] ','c-p'],['SELL ','c-b'],['$VINEGAR    ',''],['+118%  +0.236 SOL','c-g']]},
  {t:12.7,tag:'mem',s:[['[mem ] ','c-c'],['$PEELZ looks like $MANGOWIF → ',''],['SKIP','c-y']]},
  {t:13.45,tag:'pnl',s:[['[pnl ] ','c-g'],['total ',''],['+3.20 SOL','c-g'],['  (+320%) · still learning','']]},
  {t:14.2,cps:0,prompt:true,s:[[P,'c-g']]},
];
LINES.forEach(l=>{ l.len=l.s.reduce((a,x)=>a+x[0].length,0); const el=document.createElement('div'); el.className='ln'; $('lines').appendChild(el); l.el=el; l.shown=-1; });
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function lineHTML(l,n){ let out='',left=n; for(const [txt,cls] of l.s){ if(left<=0) break; const part=txt.slice(0,left); left-=part.length; out+=cls?`<span class="${cls}">${esc(part)}</span>`:esc(part);} return out; }

// agents
const AG=[{img:'ai_1',role:'ANALYST',c:'#ff8a5b'},{img:'ai_2',role:'RISK',c:'#e8eef5'},{img:'ai_3',role:'SENTIMENT',c:'#9fb0ff'},{img:'ai_4',role:'EXECUTOR',c:'#f2f2f2'}];
const AGX=[180,420,660,900], AGY=1282;
AG.forEach((a,i)=>{ const el=document.createElement('div'); el.className='agent'; el.style.left=AGX[i]+'px'; el.style.top=AGY+'px'; el.style.setProperty('--c',a.c);
  el.innerHTML=`<img src="assets/${a.img}.png"><div class="ring"></div>`; $('agents').appendChild(el); a.el=el; a.ring=el.querySelector('.ring');
  const lb=document.createElement('div'); lb.className='alabel'; lb.style.left=AGX[i]+'px'; lb.style.top=(AGY+47)+'px'; lb.style.setProperty('--c',a.c); lb.innerHTML=`<small style="margin:0;font-size:13px;letter-spacing:.2em">${a.role}</small>`; $('agents').appendChild(lb); a.lb=lb; });
const TAG2AG={nose:2,eyes:0,risk:1,mem:0,exec:3,pnl:0};
const EVS=LINES.filter(l=>l.tag);

const CAPS=[
  [0.25,2.9,'this fruit fly has<br><em>166,000 neurons</em>'],
  [2.9,5.45,'and it trades memecoins<br>on <em>pump.fun</em>'],
  [5.45,8.05,'it <span class="pk">smells</span> the narrative<br>before CT does'],
  [8.05,10.85,'got <span class="rd">rugged</span> once.<br>remembered it <em>forever</em>'],
  [10.85,13.75,'no emotions. no sleep.<br>just <em>neurons</em>'],
];
const BAL0=3.918;
const hist=(()=>{const r=mulberry32(55);const a=[];let v=1;for(let i=0;i<48;i++){const k=i/47;const target=1+2.918*Math.pow(k,1.35);v=lerp(v,target,0.35)+(r()-0.45)*0.16*(0.4+k);if(i==47)v=BAL0;a.push(Math.max(0.8,v));}return a;})();
const sp=$('spark').getContext('2d');
const fx=$('fx').getContext('2d');

// helpers
function bez(P,k){const [p0,p1,p2,p3]=P,u=1-k;return [u*u*u*p0[0]+3*u*u*k*p1[0]+3*u*k*k*p2[0]+k*k*k*p3[0],u*u*u*p0[1]+3*u*u*k*p1[1]+3*u*k*k*p2[1]+k*k*k*p3[1]];}
function strokeBez(P,k0,k1,n=50){fx.beginPath();for(let i=0;i<=n;i++){const p=bez(P,lerp(k0,k1,i/n));i?fx.lineTo(p[0],p[1]):fx.moveTo(p[0],p[1]);}fx.stroke();}
function comet(P,k,col,size=6){ if(k<=0||k>=1) return; fx.save(); fx.shadowColor=col; fx.shadowBlur=20;
  for(let j=0;j<16;j++){ const kk=k-j*0.016; if(kk<0) break; const p=bez(P,kk); fx.globalAlpha=(1-j/16); fx.fillStyle=j?col:'#fff'; fx.beginPath(); fx.arc(p[0],p[1],j?Math.max(1,size-1-j*0.3):size,0,7); fx.fill(); } fx.restore(); }
function projectPage(obj,local=V(0,0,0)){ const v=obj.localToWorld(local.clone()).project(camera); return [(v.x+1)/2*GW,(1-v.y)/2*GH+GTOP]; }
let ZOOM=1, ZX=0, ZY=0;
function imgToPage(ix,iy){ const sx=IMW/BRAIN.width; const x=IMX+ix*sx, y=IMY+iy*sx; const cx=BW/2, cy=IMY+IMH/2; return [cx+(x-cx)*ZOOM+ZX, BTOP+cy+(y-cy)*ZOOM+ZY]; }
const FIB=[[430,60],[520,35],[603,28],[690,35],[780,60],[603,120]];
const FIBB=[[470,560],[560,610],[650,610],[740,560]];
const FIBCOL=['#3d7bf5','#38c4ec','#5ed6a0','#e57be6','#f39a3a','#f2d45c'];


// ---------- token chart + position ----------
const TOK=[
 {tk:'$OVERRIPE',t0:2.4,t1:6.2,buy:4.15,sell:5.6,kind:'win',mult:1.64,mc0:38.4,size:'0.10 SOL',pnl:'+0.064 SOL'},
 {tk:'$MANGOWIF',t0:6.2,t1:9.6,buy:6.95,sell:8.25,kind:'stop',mult:0.88,mc0:112.0,size:'0.15 SOL',pnl:'-0.018 SOL'},
 {tk:'$VINEGAR',t0:9.6,t1:12.45,buy:10.4,sell:11.9,kind:'win',mult:2.18,mc0:27.9,size:'0.20 SOL',pnl:'+0.236 SOL'},
 {tk:'$PEELZ',t0:12.45,t1:99,skip:12.7,kind:'skip',mc0:64.0},
];
const CR=7, PRE=34;
TOK.forEach((k,ti)=>{ const r=mulberry32(300+ti); const n=Math.ceil((Math.min(k.t1,DUR+1)-k.t0)*CR)+PRE+3; const cl=[]; let p=1;
  const target=tau=>{
    if(k.kind==='skip'){ if(tau<13.3) return 1+0.55*sm(seg(tau,k.t0-1.5,13.25)); return lerp(1.55,0.12,eout(seg(tau,13.3,14.3))); }
    if(tau<k.buy) return 1+0.035*Math.sin(tau*3.3)+0.02*Math.sin(tau*7.1);
    if(tau<k.sell){ const q=seg(tau,k.buy,k.sell); if(k.kind==='stop') return lerp(1.04,k.mult,sm(q))+0.06*Math.sin(q*7)*(1-q); return lerp(1,k.mult,Math.pow(q,1.25)); }
    if(k.kind==='stop') return lerp(k.mult,0.3,eout(seg(tau,k.sell,k.sell+1.1)));
    return k.mult*(1+0.05*Math.sin((tau-k.sell)*4))-0.1*seg(tau,k.sell,k.sell+1.6)*k.mult; };
  for(let i=0;i<n;i++){ const tau=k.t0-PRE/CR+i/CR; const tg=target(tau); const o=p; const c=Math.max(0.05,tg*(1+(r()-0.5)*0.06));
    cl.push({tau,o,c,hi:Math.max(o,c)*(1+r()*0.035),lo:Math.min(o,c)*(1-r()*0.035)}); p=c; }
  k.cl=cl; });
const chc=$('chart').getContext('2d'); const CW=660, CHH=172;
const fmtMC=v=>v>=1000?'$'+(v/1000).toFixed(2)+'M':'$'+v.toFixed(1)+'K';
const PILL={SCANNING:['rgba(255,210,74,.16)','#ffd24a'],'IN POSITION':['#3dff9a','#03140b'],'CLOSED ✓':['rgba(91,140,255,.22)','#a9c1ff'],'STOPPED OUT':['rgba(255,77,109,.2)','#ff7088'],'SKIPPED':['rgba(255,210,74,.2)','#ffd24a']};
function setPill(name,blink){ const el=$('pstat'); if(el.textContent!==name) el.textContent=name; const [b,c]=PILL[name]; el.style.background=b; el.style.color=c; el.style.opacity=blink?1:1; }
function drawChart(t){
  const k=[...TOK].reverse().find(k=>t>=k.t0)||TOK[0];
  const base=k.t0-PRE/CR; const nowIdx=Math.max(0,(t-base)*CR); const last=Math.min(k.cl.length-1,Math.floor(nowIdx)); const frac=nowIdx-Math.floor(nowIdx);
  const VIS=44; const from=Math.max(0,last-VIS+1);
  const vis=k.cl.slice(from,last+1).map(c=>({...c}));
  const cur=vis[vis.length-1]; { const c=lerp(cur.o,cur.c,frac); cur.c=c; cur.hi=Math.max(cur.o,c,lerp(cur.o,cur.hi,frac)); cur.lo=Math.min(cur.o,c,lerp(cur.o,cur.lo,frac)); }
  const inPos=k.buy!==undefined && t>=k.buy;
  let mn=Math.min(...vis.map(c=>c.lo)), mx=Math.max(...vis.map(c=>c.hi)); if(inPos){ mn=Math.min(mn,1); mx=Math.max(mx,1); }
  const pad=(mx-mn)*0.14+0.02; mn-=pad; mx+=pad;
  const X0=12, X1=578, cw=(X1-X0)/VIS; const Y=v=>12+(1-(v-mn)/(mx-mn))*(CHH-30);
  chc.clearRect(0,0,CW,CHH);
  // grid + axis labels
  chc.font='600 12px JetBrains Mono'; chc.textAlign='left';
  for(let g=0;g<4;g++){ const v=mn+(mx-mn)*(0.15+g*0.24); const y=Y(v); chc.strokeStyle='rgba(255,255,255,0.06)'; chc.lineWidth=1; chc.beginPath(); chc.moveTo(X0,y); chc.lineTo(X1,y); chc.stroke();
    chc.fillStyle='#5d656e'; chc.fillText(fmtMC(v*k.mc0),X1+8,y+4); }
  // area glow under closes
  const gx=i=>X0+(i+0.5)*cw;
  const ag=chc.createLinearGradient(0,0,0,CHH); const up=cur.c>=1; ag.addColorStop(0,up?'rgba(20,241,149,0.18)':'rgba(255,77,109,0.16)'); ag.addColorStop(1,'rgba(0,0,0,0)');
  chc.beginPath(); vis.forEach((c,i)=>i?chc.lineTo(gx(i),Y(c.c)):chc.moveTo(gx(i),Y(c.c))); chc.lineTo(gx(vis.length-1),CHH); chc.lineTo(gx(0),CHH); chc.fillStyle=ag; chc.fill();
  // entry line
  if(inPos){ chc.setLineDash([5,5]); chc.strokeStyle='rgba(61,255,154,0.7)'; chc.lineWidth=1.4; chc.beginPath(); chc.moveTo(X0,Y(1)); chc.lineTo(X1,Y(1)); chc.stroke(); chc.setLineDash([]);
    chc.fillStyle='#3dff9a'; chc.font='700 11px JetBrains Mono'; chc.fillText('ENTRY',X0+4,Y(1)-6); }
  // candles
  vis.forEach((c,i)=>{ const x=gx(i); const g=c.c>=c.o; const col=g?'#14f195':'#ff4d6d'; chc.strokeStyle=col; chc.fillStyle=col; chc.lineWidth=1.4;
    chc.beginPath(); chc.moveTo(x,Y(c.hi)); chc.lineTo(x,Y(c.lo)); chc.stroke();
    const yt=Y(Math.max(c.o,c.c)), yb=Y(Math.min(c.o,c.c)); chc.fillRect(x-cw*0.32,yt,cw*0.64,Math.max(1.5,yb-yt)); });
  // markers
  const mark=(tau,above,col,label)=>{ const i=Math.round((tau-base)*CR)-from; if(i<0||i>=vis.length) return; const c=vis[i]; const x=gx(i); const y=above?Y(c.hi)-8:Y(c.lo)+8;
    chc.save(); chc.shadowColor=col; chc.shadowBlur=12; chc.fillStyle=col; chc.beginPath();
    if(above){ chc.moveTo(x,y); chc.lineTo(x-7,y-11); chc.lineTo(x+7,y-11); } else { chc.moveTo(x,y); chc.lineTo(x-7,y+11); chc.lineTo(x+7,y+11); } chc.fill(); chc.restore();
    chc.font='800 12px JetBrains Mono'; const w=chc.measureText(label).width+12; const ly=above?y-34:y+15; const lx=Math.min(X1-w,Math.max(X0,x-w/2));
    chc.fillStyle=col; chc.beginPath(); chc.roundRect(lx,ly,w,19,5); chc.fill(); chc.fillStyle='#05070a'; chc.fillText(label,lx+6,ly+14); };
  if(k.buy!==undefined && t>=k.buy) mark(k.buy,false,'#3dff9a','BUY');
  if(k.sell!==undefined && t>=k.sell) mark(k.sell,true,k.kind==='stop'?'#ff4d6d':'#7fa6ff',k.kind==='stop'?'STOP -12%':(k.mult>2?'SELL +118%':'SELL +64%'));
  if(k.kind==='skip' && t>=k.skip) mark(k.skip,true,'#ffd24a','SKIP');
  // current price tag
  { const y=Y(cur.c); const col=cur.c>=cur.o?'#14f195':'#ff4d6d'; chc.setLineDash([2,4]); chc.strokeStyle=col; chc.beginPath(); chc.moveTo(X0,y); chc.lineTo(X1,y); chc.stroke(); chc.setLineDash([]);
    chc.fillStyle=col; chc.beginPath(); chc.roundRect(X1+2,y-10,78,20,5); chc.fill(); chc.fillStyle='#05070a'; chc.font='800 12px JetBrains Mono'; chc.fillText(fmtMC(cur.c*k.mc0),X1+7,y+4); }
  // rug banner
  const rugK = k.kind==='skip'? sm(seg(t,13.75,14.0)) : (k.kind==='stop'? sm(seg(t,k.sell+0.9,k.sell+1.1))*(t<k.t1?1:0) : 0);
  if(rugK>0){ chc.globalAlpha=rugK; chc.font='900 15px Unbounded'; const txt=k.kind==='skip'?'RUG -88% · DODGED ✓':'RUGGED -70% · ZIGGY WAS OUT ✓'; const w=chc.measureText(txt).width+22;
    chc.fillStyle='#1c0910'; chc.strokeStyle='#ff4d6d'; chc.lineWidth=1.5; chc.beginPath(); chc.roundRect(CW/2-w/2-40,CHH/2-30,w,34,8); chc.fill(); chc.stroke();
    chc.fillStyle='#ff6d86'; chc.fillText(txt,CW/2-w/2-29,CHH/2-7); chc.globalAlpha=1; }
  // header
  $('tkn').textContent=k.tk; $('mc').textContent='MC '+fmtMC(cur.c*k.mc0);
  const ref = inPos? 1 : k.cl[Math.max(0,PRE-1)].c; const chg=(cur.c/ref-1)*100; const ce=$('chg'); ce.textContent=(chg>=0?'+':'')+chg.toFixed(1)+'%'; ce.style.color=chg>=0?'#14f195':'#ff4d6d';
  // position panel
  const pp=$('ppnl'), p2=$('ppnl2');
  const setP=(txt,col,sub,subcol)=>{ pp.textContent=txt; pp.style.color=col; p2.textContent=sub; p2.style.color=subcol||'#8d96a0'; };
  if(k.kind==='skip'){ if(t<k.skip){ setPill('SCANNING'); setP('—','#5d656e','sniffing new pair…'); } else { setPill('SKIPPED'); if(t<13.75) setP('SKIP','#ffd24a','smells like a rug'); else setP('-88%','#ff4d6d','rug dodged ✓','#3dff9a'); } $('psize').textContent='—'; $('pentry').textContent='—'; }
  else if(t<k.buy){ setPill('SCANNING'); setP('—','#5d656e','sniffing new pair…'); $('psize').textContent='—'; $('pentry').textContent='—'; }
  else if(t<k.sell){ setPill('IN POSITION'); const pc=(cur.c-1)*100; const sz=parseFloat(k.size); setP((pc>=0?'+':'')+pc.toFixed(1)+'%', pc>=0?'#3dff9a':'#ff4d6d', (pc>=0?'+':'')+(sz*pc/100).toFixed(3)+' SOL unrealized', pc>=0?'#8fe9bd':'#ff8a9c');
    $('pstat').style.opacity=(Math.floor(t*3)%2)?0.7:1; $('psize').textContent=k.size; $('pentry').textContent='MC '+fmtMC(k.mc0); }
  else { $('pstat').style.opacity=1; if(k.kind==='stop'){ setPill('STOPPED OUT'); setP('-12%','#ff4d6d',k.pnl+' · saved by memory','#ff8a9c'); } else { setPill('CLOSED ✓'); setP(k.mult>2?'+118%':'+64%','#3dff9a',k.pnl+' realized','#8fe9bd'); }
    $('psize').textContent=k.size; $('pentry').textContent='MC '+fmtMC(k.mc0); }
  const vimgs=$('votes').children; AG.forEach((a,i)=>{ vimgs[i].style.opacity=0.3+0.7*Math.max(a.act||0, (k.buy!==undefined&&t>=k.buy&&t<k.sell)?0.55:0); });
}

// ---------- render ----------
window.renderAt=function(t){
  // turntable spin
  const spin=window.HERO&&window.HERO.spin!==undefined?window.HERO.spin:0.9-t*(Math.PI*2/9.0);
  fly.position.set(0,0,0); fly.rotation.set(0,spin,0);
  let buzz=0; for(const e of EVS){ if(e.tag==='exec') buzz=Math.max(buzz,fade(t,e.t-0.25,e.t-0.12,e.t+0.25,e.t+0.45)); }
  for(const w of wings){ const j=buzz*(0.22+0.18*Math.sin(t*97+w.s*1.3)); w.hinge.rotation.set(w.s*0.05-w.s*j,0,-0.05-j*0.4); }
  fly.updateMatrixWorld(true);
  // materialise
  const cc = t<0.15?5:(t>1.6?-10:lerp(1.75,-1.75,eio(seg(t,0.15,1.6))));
  clipLocal.set(V(1,0,0),-cc); clipPlane.copy(clipLocal).applyMatrix4(fly.matrixWorld);
  scan.position.set(cc,0.0,0); scan.material.opacity=(t>0.15&&t<1.6)?0.8*Math.sin(Math.PI*seg(t,0.15,1.6)):0;
  // pad
  const padIn=sm(seg(t,0,0.5)); padDisc.rotation.z=t*0.22; padDisc.material.opacity=0.8*padIn; padGlow.material.opacity=0.35*padIn; shadow.material.opacity=sm(seg(t,0.8,1.6));
  rings.forEach((r,i)=>{ const k=((t*0.36+i/2)%1); r.position.y=k*1.7; r.scale.setScalar(1-0.15*k); r.material.opacity=0.28*(1-k)*(1-k)*padIn; });
  // chip activity
  let flash=0; for(const e of EVS){ const x=t-(e.t-0.8); if(x>-0.05&&x<0.6) flash=Math.max(flash,Math.exp(-x*5)); }
  const on=sm(seg(t,1.2,2.0));
  chipTop.emissiveIntensity=0.6+1.2*on+2.4*flash; neonMat.emissiveIntensity=0.6+1.6*on+2*flash; headMat.emissiveIntensity=0.5+0.9*on+1.5*flash;
  chipGlow.material.opacity=on*(0.08+0.35*flash); chipGlow.scale.setScalar(0.35+0.3*flash);
  const blink=(Math.floor(t*2.5)%2===0)?1:0.25; ledMat.emissiveIntensity=2+4*blink; ledGlow.material.opacity=0.3+0.6*blink;
  cuticle.emissiveIntensity=0.7+0.5*on+0.8*flash; abMat.emissiveIntensity=0.35+0.3*on+0.8*flash; eyeMat.emissiveIntensity=0.4+0.6*flash;
  padLight.intensity=1.2+3*flash;
  // camera: fixed 3/4, the fly spins on the pad
  const tg=V(0,-0.3,0);
  const yaw=0.55, el=0.5+0.03*Math.sin(t*0.4);
  const d=lerp(8.6,10.4,eout(seg(t,0,2.4))) - 0.5*sm(seg(t,13.8,16));
  const HX=window.HERO; const _d=HX?HX.d:d, _yaw=HX?HX.yaw:yaw, _el=HX?HX.el:el; const _tg=HX?V(...HX.tg):tg;
  camera.position.set(_tg.x+_d*Math.cos(_el)*Math.cos(_yaw), _tg.y+_d*Math.sin(_el), _tg.z+_d*Math.cos(_el)*Math.sin(_yaw));
  camera.lookAt(_tg); camera.setViewOffset(GW,GH,0,HX?HX.oy:70,GW,GH); camera.updateMatrixWorld(true);
  composer.render();

  // ---------- brain panel ----------
  ZOOM=1.0+0.05*eio(t/DUR)+0.012*Math.sin(t*1.9); ZX=0; ZY=-6*eio(t/DUR);
  const bIn=sm(seg(t,0.6,1.6));
  bc.clearRect(0,0,BW,BH);
  const cx=BW/2, cy=IMY+IMH/2; const dw=IMW*ZOOM, dh=IMH*ZOOM, dx=cx-dw/2+ZX, dy=cy-dh/2+ZY;
  bc.globalAlpha=bIn; bc.drawImage(BRAIN,dx,dy,dw,dh);
  // breathing glow
  bc.globalCompositeOperation='lighter'; bc.globalAlpha=bIn*(0.05+0.05*Math.sin(t*3.3)); bc.drawImage(BRAIN,dx,dy,dw,dh);
  // waves (events + ambient)
  const waves=[]; for(const e of EVS){ const rp=REG[RTAG[e.tag].p]; waves.push([e.t-0.6,rp,1.0,RTAG[e.tag].c]); }
  for(let i=0;i<14;i++){ const t0=0.9+i*1.15; const r=mulberry32(900+i); const keys=Object.keys(REG); waves.push([t0,REG[keys[(r()*keys.length)|0]],0.5,null]); }
  for(const [t0,rp,str] of waves){ const x=t-t0; if(x<0||x>1.0) continue;
    const [px,py]=[dx+rp[0]/BRAIN.width*dw, dy+rp[1]/BRAIN.height*dh]; const rad=20+x*520;
    off.globalCompositeOperation='source-over'; off.clearRect(0,0,BW,BH);
    const g=off.createRadialGradient(px,py,Math.max(0,rad-90),px,py,rad); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.6,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
    off.fillStyle=g; off.fillRect(0,0,BW,BH); off.globalCompositeOperation='destination-in'; off.drawImage(BRAIN,dx,dy,dw,dh);
    bc.globalAlpha=bIn*str*(1-x)*0.8; bc.drawImage(offC,0,0); }
  // scan line
  { const per=3.2, x=((t+0.5)%per)/per; const sy=dy+x*dh; off.globalCompositeOperation='source-over'; off.clearRect(0,0,BW,BH);
    const g=off.createLinearGradient(0,sy-40,0,sy+6); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.9,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
    off.fillStyle=g; off.fillRect(0,sy-40,BW,46); off.globalCompositeOperation='destination-in'; off.drawImage(BRAIN,dx,dy,dw,dh); bc.globalAlpha=0.35*bIn; bc.drawImage(offC,0,0); }
  // spikes
  const fr=Math.floor(t*30); const nS=70+Math.floor(160*flash);
  for(let i=0;i<nS;i++){ const s=SPK[Math.floor(hash(fr,i)*SPK.length)]; const x=dx+s[0]/BRAIN.width*dw, y=dy+s[1]/BRAIN.height*dh; const a=hash(i,fr+7);
    const rr=1.5+a*3.5; const g=bc.createRadialGradient(x,y,0,x,y,rr*3); g.addColorStop(0,`rgba(255,255,255,${0.7*bIn})`); g.addColorStop(0.3,`rgba(${s[2]},${s[3]},${s[4]},${0.5*bIn})`); g.addColorStop(1,'rgba(0,0,0,0)');
    bc.globalAlpha=1; bc.fillStyle=g; bc.fillRect(x-rr*3,y-rr*3,rr*6,rr*6); }
  bc.globalCompositeOperation='source-over'; bc.globalAlpha=1;

  // ---------- threads & pulses ----------
  fx.clearRect(0,0,1080,1920); fx.lineCap='round';
  const chipP=projectPage(chip,V(0,0.03,0));
  const thrA=sm(seg(t,1.4,2.4));
  const SDS=[-1,-1,1,-1,1,1];
  const P1=FIB.map((f,i)=>{ const b=imgToPage(...f); const sd=SDS[i]; return [chipP,[chipP[0]+sd*(120+i*12),Math.max(100,chipP[1]-190-i*8)],[sd>0?1010-i*6:70+i*6,600+i*6],b]; });
  P1.forEach((P,i)=>{ if(i===2){ fx.save(); fx.shadowColor='#3dff9a'; fx.shadowBlur=22; fx.strokeStyle='#8affc9'; fx.globalAlpha=0.95*thrA; fx.lineWidth=3.4; strokeBez(P,0,thrA); fx.restore(); } fx.strokeStyle=FIBCOL[i]; for(let k=0;k<3;k++){ fx.globalAlpha=(k==1?0.55:0.2)*thrA; fx.lineWidth=k==1?1.8:1; const o=(k-1)*5; const Q=P.map(p=>[p[0]+o,p[1]]); Q[0]=P[0]; strokeBez(Q,0,thrA); }
    fx.globalAlpha=0.85*thrA; fx.fillStyle='#fff'; for(let q=0;q<2;q++){ const kk=((t*0.45+q/2+i*0.17)%1); const p=bez(P,kk); fx.beginPath(); fx.arc(p[0],p[1],2.2,0,7); fx.fill(); } });
  fx.globalAlpha=1;
  // chip halo
  if(thrA>0){ fx.save(); const g=fx.createRadialGradient(chipP[0],chipP[1],0,chipP[0],chipP[1],60+40*flash); g.addColorStop(0,`rgba(120,255,190,${0.35*thrA+0.4*flash})`); g.addColorStop(1,'rgba(0,0,0,0)'); fx.fillStyle=g; fx.fillRect(chipP[0]-120,chipP[1]-120,240,240); fx.restore(); }
  const thrB=sm(seg(t,2.2,3.0));
  const P2=AG.map((a,i)=>{ const b=imgToPage(...FIBB[i]); const e=[AGX[i],AGY-44]; return [b,[b[0],b[1]+60],[e[0],e[1]-50],e]; });
  P2.forEach((P,i)=>{ fx.strokeStyle=AG[i].c; for(let k=0;k<2;k++){ fx.globalAlpha=(k?0.5:0.18)*thrB; fx.lineWidth=k?1.6:4; strokeBez(P,0,thrB); }
    fx.globalAlpha=0.8*thrB; fx.fillStyle='#fff'; const kk=((t*0.6+i*0.25)%1); const p=bez(P,kk); fx.beginPath(); fx.arc(p[0],p[1],2,0,7); fx.fill(); });
  fx.globalAlpha=1;
  // event pulses
  for(const e of EVS){ const ag=TAG2AG[e.tag]; const fi=(EVS.indexOf(e)*2)%FIB.length;
    comet(P1[fi], eout(seg(t,e.t-1.15,e.t-0.75)), FIBCOL[fi], 7);
    comet(P2[ag], eio(seg(t,e.t-0.55,e.t-0.12)), AG[ag].c, 6);
    const x=t-(e.t-0.75); if(x>0&&x<0.6){ fx.strokeStyle=FIBCOL[fi]; fx.globalAlpha=(1-x/0.6); fx.lineWidth=2.5; fx.beginPath(); fx.arc(chipP[0],chipP[1],14+x*140,0,7); fx.stroke(); fx.globalAlpha=1; } }

  // ---------- DOM ----------
  // region tags
  for(const k in RTAG){ const r=RTAG[k]; let a=0; for(const e of EVS) if(e.tag===k) a=Math.max(a,fade(t,e.t-0.7,e.t-0.55,e.t+0.25,e.t+0.55));
    const [px,py]=imgToPage(...REG[r.p]); r.el.style.left=px+'px'; r.el.style.top=py+'px'; r.el.style.opacity=a; r.el.style.transform=`translate(-50%,-50%) scale(${0.9+0.1*eout(a)})`; }
  // agents
  AG.forEach((a,i)=>{ const k=eout(seg(t,2.0+i*0.12,2.6+i*0.12)); a.el.style.opacity=k; a.lb.style.opacity=k; a.el.style.transform=`translateY(${(1-k)*30}px)`;
    let act=0; for(const e of EVS) if(TAG2AG[e.tag]===i) act=Math.max(act,fade(t,e.t-0.15,e.t-0.05,e.t+0.25,e.t+0.6));
    a.ring.style.opacity=act; a.act=act; a.el.style.scale=String(1+0.1*act); });
  // terminal
  const shownLines=LINES.filter(l=>t>=l.t);
  LINES.forEach(l=>{ if(t<l.t){ l.el.style.display='none'; return; } l.el.style.display='block';
    let n = l.cps===0? l.len : Math.min(l.len, Math.floor((t-l.t)*(l.cps||150)));
    let html=lineHTML(l,n); const last=l===shownLines[shownLines.length-1];
    if(last && (n<l.len || l.prompt) && (Math.floor(t*2.4)%2===0 || n<l.len)) html+='<span class="cur"></span>';
    if(n!==l.shown || last || l.prompt){ l.el.innerHTML=html; l.shown=n; } });
  $('term').style.opacity=sm(seg(t,0.0,0.3));
  drawChart(t);
  // stats
  let bal=BAL0, ntr=134; for(const l of LINES){ if(l.pnl) bal+=l.pnl*eout(seg(t,l.t,l.t+0.6)); if(l.tag==='exec'&&t>=l.t) ntr++; }
  $('bal').firstChild.nodeValue=bal.toFixed(3); $('roi').textContent='+'+Math.round((bal-1)*100)+'%'; $('ntr').textContent=ntr;
  sp.clearRect(0,0,560,88); const pts=[...hist,bal]; const mn=0.6,mx=4.5; const X=i=>i/(pts.length-1)*556+2, Y=v=>86-(v-mn)/(mx-mn)*80;
  const gr=sp.createLinearGradient(0,0,0,88); gr.addColorStop(0,'rgba(61,255,154,0.28)'); gr.addColorStop(1,'rgba(61,255,154,0)');
  sp.beginPath(); pts.forEach((v,i)=>i?sp.lineTo(X(i),Y(v)):sp.moveTo(X(i),Y(v))); sp.lineTo(558,88); sp.lineTo(2,88); sp.fillStyle=gr; sp.fill();
  sp.beginPath(); pts.forEach((v,i)=>i?sp.lineTo(X(i),Y(v)):sp.moveTo(X(i),Y(v))); sp.strokeStyle='#3dff9a'; sp.lineWidth=3; sp.stroke();
  $('spk').textContent=(1180+Math.floor(70*Math.sin(t*3.1))+Math.floor(1400*flash)).toLocaleString('en-US');
  $('dot').style.opacity=(Math.floor(t*1.6)%2)?0.35:1;
  $('sync').style.opacity=sm(seg(t,2.0,2.4))*((Math.floor(t*1.2)%2)?0.6:1);
  $('idc').style.opacity=sm(seg(t,1.4,2.0)); $('lbl1').style.opacity=sm(seg(t,0.3,0.8));
  $('bstats').style.opacity=sm(seg(t,1.2,1.8)); $('bstats2').style.opacity=sm(seg(t,1.4,2.0));
  // captions
  const cap=CAPS.find(c=>t>=c[0]&&t<c[1]); const ce=$('cap');
  if(cap){ if(ce.dataset.k!==String(cap[0])){ ce.innerHTML=cap[2]; ce.dataset.k=String(cap[0]); }
    ce.style.opacity=fade(t,cap[0],cap[0]+0.18,cap[1]-0.2,cap[1]); ce.style.transform=`scale(${lerp(0.92,1,eout(seg(t,cap[0],cap[0]+0.25)))})`; } else ce.style.opacity=0;
  // end card
  const ek=0; $('end').style.opacity=ek; $('end').style.transform=`translateY(${(1-eout(seg(t,13.85,14.6)))*30}px)`;
  const lt='still learning'; const nL=Math.floor(lerp(0,lt.length,seg(t,14.6,15.5))); $('learn').textContent=lt.slice(0,nL)+((Math.floor(t*2.4)%2)?'_':' ');
  return true;
};
window.renderAt(new URLSearchParams(location.search).has('t')?parseFloat(new URLSearchParams(location.search).get('t')):6);
window.READY=true;
