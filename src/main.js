import * as THREE from 'three';
import { SoftwareRenderer } from './software-renderer.js';
import { findPath } from './navigation.js';

// Everything drawn here is local geometry. There are no remote models, textures or fonts.
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
let seed = 1969;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const pick = (a) => a[Math.floor(random() * a.length)];
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const state = { gentle: reducedQuery.matches, candles: true, wishing: false, wishUntil: 0, now: 0, sound: true, audioUnlocked:false, landscape:true, selected:null, lastAuto: 0, lastBurst:null, tuneCount:0, explosionCount:0 };
const people = [], flames = [], bulbs = [], balloons = [], floaters = [], effects = [];
const actionTimes = new Map();
let renderer, scene, camera, firelight;
let selectionRing,destinationRing;
let lastTime = 0, elapsed = 0, toastUntil = 0, visible = true;
const target = new THREE.Vector2(), current = new THREE.Vector2();
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
const interactive = [];
const diagnostics=new URLSearchParams(location.search).has('qa');
const temp = new THREE.Object3D();
const skin = ['#c38b63', '#d39a70', '#bd805a', '#ce946b'];
const palette = { gold:'#e9b85f', goldLight:'#ffe1a0', plum:'#66384f', pink:'#ee8e9d', wood:'#663d45', cream:'#fff0cc', teal:'#318e8c', dark:'#291e31' };

// One mesh per articulated part, with vertex colours: detailed voxels without one draw per cube.
const cube = new THREE.BoxGeometry(1, 1, 1);
const basePos = cube.attributes.position.array, baseNorm = cube.attributes.normal.array, baseIndex = cube.index.array;
const materials = {};
function material(kind = 'normal') {
  if (!materials[kind]) materials[kind] = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.87, metalness:0, ...(kind === 'glow' ? {emissive:0xffffff,emissiveIntensity:.65} : {}) });
  return materials[kind];
}
class Blocks {
  constructor() { this.items = []; }
  box(x,y,z,w,h,d,color) { this.items.push([x,y,z,w,h,d,color]); return this; }
  build(parent, kind='normal') {
    const count = this.items.length;
    const positions = new Float32Array(count * 72), normals = new Float32Array(count * 72), colors = new Float32Array(count * 72);
    // Omit matching internal cube faces, especially inside sculpted voxel heads.
    const hidden=new Set(),faceMap=new Map(),indices=[],c = new THREE.Color();
    const q=v=>Math.round(v*100);
    this.items.forEach((item,i)=>{
      const center=item.slice(0,3),size=item.slice(3,6);
      for(let face=0;face<6;face++) {
        const axis=Math.floor(face/2),sign=face%2===0?1:-1,other=[0,1,2].filter(a=>a!==axis);
        const key=[axis,q(center[axis]+sign*size[axis]/2),...other.map(a=>q(center[a])),...other.map(a=>q(size[a]))].join(',');
        const match=faceMap.get(key);
        if(match&&match.sign!==sign){hidden.add(match.index);hidden.add(i*6+face);faceMap.delete(key);}else faceMap.set(key,{sign,index:i*6+face});
      }
    });
    this.items.forEach(([x,y,z,w,h,d,col], i) => {
      c.set(col);
      for (let j=0; j<24; j++) {
        const k = i*72+j*3;
        positions[k]=basePos[j*3]*w+x; positions[k+1]=basePos[j*3+1]*h+y; positions[k+2]=basePos[j*3+2]*d+z;
        normals[k]=baseNorm[j*3]; normals[k+1]=baseNorm[j*3+1]; normals[k+2]=baseNorm[j*3+2];
        colors[k]=c.r; colors[k+1]=c.g; colors[k+2]=c.b;
      }
      for(let face=0;face<6;face++)if(!hidden.has(i*6+face))for(let j=0;j<6;j++)indices.push(baseIndex[face*6+j]+i*24);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.setIndex(indices); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry,material(kind)); mesh.castShadow=kind!=='glow'; mesh.receiveShadow=kind!=='glow'; parent.add(mesh); return mesh;
  }
}
function group(parent,x=0,y=0,z=0) { const g=new THREE.Group();g.position.set(x,y,z); parent.add(g);return g; }
function block(parent,x,y,z,w,h,d,color,kind) {return new Blocks().box(x,y,z,w,h,d,color).build(parent,kind);}
function textPlane(parent,text,x,y,z,width,color='#fff0c7',size=90,font='Georgia',height=.45) {
  const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=192;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,1024,192);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size}px ${font}`;ctx.fillText(text,512,96,990);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function register(obj,kind,name) { obj.userData={kind,name};interactive.push(obj); }
function hitBox(parent,x,y,z,w,h,d,kind,name) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({visible:false}));mesh.position.set(x,y,z);parent.add(mesh);register(mesh,kind,name);return mesh;
}

function makeRoom() {
  const b=new Blocks();
  // A warm, open-front room, with a broad balcony to the night sky.
  b.box(0,-.3,.7,17.6,.65,11.3,'#392a43').box(0,-.02,.7,17.4,.12,11.1,'#a16b64');
  b.box(0,-.28,6.37,17.6,.22,.12,palette.gold).box(0,-.49,6.38,17.6,.11,.15,'#7d4855');
  for(let x=-8.4;x<8.5;x+=.7) for(let z=-4.5;z<6.2;z+=.7) {
    const alt=(Math.round((x+8.4)/.7)+Math.round((z+4.5)/.7))%2;
    b.box(x,.047,z,.685,.035,.685,alt?'#986562':'#8b5c5e');
  }
  for(const side of [-1,1]) {
    const x=side*8.25;
    b.box(x,3.2,-.1,.4,6.5,8.6,'#6c4355').box(x-side*.06,1.35,-.1,.42,2.7,8.7,'#81455c');
    b.box(x,6.5,-.1,.65,.25,8.8,palette.gold).box(x,0.3,-.1,.53,.3,8.8,palette.gold);
    b.box(side*7.85,3.2,-3.7,1.1,6.4,.5,'#733d55').box(side*7.85,3.2,-3.39,.94,5.9,.09,'#a56670');
    // Repeating wall inlay.
    for(let y=.8;y<6.1;y+=.65) for(let z=-2.9;z<3.7;z+=.65) {
      b.box(x-side*.23,y,z,.035,.08,.32,'#c99783'); b.box(x-side*.25,y,z,.045,.32,.08,'#c99783');
    }
  }
  for(const x of [-6.9,6.9]) {
    b.box(x,3.55,-3.7,.44,7.1,.62,'#b67b70').box(x,.4,-3.7,.72,.6,.85,palette.gold).box(x,6.8,-3.7,.74,.4,.85,palette.gold);
    b.box(x,3.6,-3.33,.14,5.6,.06,'#e7b98b');
  }
  b.box(0,7.05,-3.7,14.3,.48,.65,'#a96e69').box(0,6.77,-3.35,14.4,.1,.12,palette.gold);
  // The balcony's low parapet lets both the skyline and family remain visible.
  b.box(0,.55,-4.25,13.5,1.15,.25,'#6d5267').box(0,1.22,-4.25,13.7,.18,.4,palette.gold);
  for(let x=-6.3;x<=6.3;x+=.58) b.box(x,.55,-4.08,.1,1.1,.08,'#d3a180');
  b.build(scene);
  // Pixel rangoli. Repeated colour bands with a petal silhouette.
  const r=new Blocks();
  for(let x=-2.65;x<=2.65;x+=.14) for(let z=-2;z<=2;z+=.14) {
    const dist=Math.hypot(x,z), a=Math.atan2(z,x), edge=2.05+.27*Math.cos(a*8);
    if(dist>edge) continue;
    const band=Math.floor(dist/.23);
    const cols=['#ffce64','#d75b90','#f8dec1','#b04573','#ffc668','#398d88','#f5a47f','#efd6ad','#cc517e','#ffb948'];
    r.box(x,.092,z+3.75,.13,.018,.13,cols[band%cols.length]);
  }
  r.build(scene);
  // Cushioned bench along the back; room details sit around the family.
  const furnishings=new Blocks();
  furnishings.box(-4.7,.47,-2.7,3.5,.75,1.2,'#693b50').box(-4.7,.95,-3.15,3.5,.7,.3,'#8e4e65').box(-4.7,.9,-2.65,3.4,.25,1.1,'#ae6477');
  for(let x=-5.8;x<-3.2;x+=1.1) furnishings.box(x,1.27,-2.85,.8,.6,.25,pick(['#e1aa58','#2e827d','#d98c8c']));
  furnishings.build(scene);
  for(const [x,z,s,col] of [[5.4,-1.8,1.1,'#ba5a81'],[6.3,-1.3,.85,'#348b88'],[5.6,-.6,.65,'#d8a348'],[-5.8,1.4,.6,'#ba5a81'],[6,2,.8,'#d98c8c']]) makeGift(x,z,s,col);
  // Decorative brass vases with tiny block flowers.
  for(const x of [-6.4,6.45]) {
    const vase=new Blocks();vase.box(x,.55,-2, .6,1,.6,palette.gold).box(x,1.1,-2,.78,.15,.78,'#f2cc7e');
    for(let i=0;i<12;i++) {const a=random()*Math.PI*2,rad=random()*.46,y=1.65+random()*.65;
      vase.box(x+Math.cos(a)*rad,(y+1.1)/2,-2+Math.sin(a)*rad,.055,y-1.1,.055,'#698861');
      for(let j=0;j<6;j++) vase.box(x+Math.cos(a)*rad+(random()-.5)*.23,y+(random()-.5)*.2,-2+Math.sin(a)*rad+(random()-.5)*.23,.17,.16,.17,pick(['#f9bb47','#e57937','#f5a441']));
    }vase.build(scene);
  }
}
function makeGift(x,z,s,col) {
  const b=new Blocks();b.box(x,s*.5+.1,z,s,s,s,col).box(x,s+.13,z,s*1.07,.16,s*1.07,col);
  b.box(x,s*.5+.12,z+s*.505,s*.16,s,.025,palette.goldLight).box(x,s*.5+.12,z,s*.16,s*1.03,s*1.02,palette.goldLight);
  b.box(x,s+.23,z,s*1.06,.035,s*.14,palette.goldLight);
  b.box(x-.17*s,s+.35,z,.3*s,.16,.12,palette.goldLight).box(x+.17*s,s+.35,z,.3*s,.16,.12,palette.goldLight);b.build(scene);
}

function makeDecorations() {
  // Marigold toran across the open room.
  const flowers=new Blocks(), wire=new Blocks(), lights=new Blocks();
  for(let i=0;i<=110;i++) {
    const x=-7.3+i/110*14.6, y=7.45-.45*Math.abs(Math.sin(i/110*Math.PI*4));
    flowers.box(x,y,-2.9,.17,.18,.18,pick(['#e39a30','#ffbd49','#e98329','#f2ae32']));
    if(i%4===0) flowers.box(x,y-.16,-2.9,.15,.2,.14,'#d9902f');
    if(i%12===0) for(let j=0;j<4;j++) flowers.box(x,y-.3-j*.13,-2.9,.14-j*.02,.15,.12,j===3?'#488b62':'#ed9b32');
  }
  for(let i=0;i<85;i++) {
    const x=-7.9+i*.188,y=6.6-.7*Math.sin((x+7.9)/15.8*Math.PI);
    wire.box(x,y,-1.3,.2,.025,.025,'#bc9864');
    if(i%3===0) {lights.box(x,y-.12,-1.3,.08,.15,.08,pick(['#ffd890','#ffd4a0','#ffb485']));bulbs.push({x,y:y-.12,z:-1.3});}
  }
  flowers.build(scene);wire.build(scene);lights.build(scene,'glow');
  // Hanging voxel lanterns at different depths.
  for(const [x,y,z,col] of [[-6,5.9,.6,'#cf6b74'],[6,6.1,.2,'#e1a448'],[-7.1,7.15,2.5,'#d8aa59'],[7.2,7.3,3,'#bd6683']]) {
    const g=group(scene,x,y,z), b=new Blocks();
    b.box(0,.6,0,.025,1.2,.025,palette.gold).box(0,0,0,.65,.65,.65,col).box(0,0,0,.85,.35,.85,col).box(0,.4,0,.5,.12,.5,palette.gold).box(0,-.4,0,.45,.12,.45,palette.gold);
    for(let i=-1;i<=1;i++) b.box(i*.19,-.7,0,.045,.5,.045,palette.goldLight);
    for(const side of [-1,1]) b.box(side*.29,0,.44,.045,.5,.035,palette.goldLight);
    b.build(g);block(g,0,0,.432,.3,.25,.025,'#ffdb91','glow');floaters.push({group:g,y,phase:random()*6});
  }
  // Balloon bouquets.
  for(const [x,z] of [[-5,0.4],[5,0]]) for(let n=0;n<3;n++) {
    const y=4.2+n*.5, g=group(scene,x+(n-1)*.47,y,z-.15*n),b=new Blocks(),col=pick(['#d68099','#dfb563','#659d9b','#b085b7']);
    for(let i=-3;i<=3;i++) for(let j=-4;j<=4;j++) for(let k=-2;k<=2;k++) if((i/3.3)**2+(j/4.3)**2+(k/2.5)**2<1) b.box(i*.12,j*.12,k*.12,.12,.12,.12,col);
    b.box(-.16,.21,.25,.13,.2,.06,'#ffe2c0');b.box(0,-.54,0,.12,.15,.12,col);b.build(g);
    const cord=new Blocks();cord.box(0,-1.6,0,.018,2.1,.018,'#e0b2a2');cord.build(g);balloons.push({group:g,x:g.position.x,y,phase:random()*6});hitBox(g,0,0,0,.85,1.1,.7,'balloon');
  }
  for(const [x,z] of [[-7,4.9],[-5,5.7],[-3.25,5.8],[3.25,5.8],[5,5.7],[7,4.9],[-6.6,-3],[6.6,-3]]) makeDiya(x,.13,z);
}
function makeDiya(x,y,z) {
  const g=group(scene,x,y,z),b=new Blocks();
  b.box(0,.08,0,.55,.12,.4,'#b96640').box(0,.16,0,.65,.08,.48,'#e6ab66').box(0,.19,0,.45,.02,.29,'#8b4f38');b.build(g);
  const flame=group(g,0,.41,0);new Blocks().box(0,0,0,.12,.25,.12,'#ffcb65').box(0,.13,0,.075,.13,.075,'#fff0be').build(flame,'glow');
  flames.push({group:flame,candle:false,phase:random()*6});hitBox(g,0,.2,0,.8,.8,.8,'diya');
}

function makeSky() {
  const positions=[],colors=[],c=new THREE.Color();
  for(let i=0;i<420;i++) {positions.push((random()-.5)*70,2+random()*40,-18-random()*12);c.set(pick(['#d9bdab','#fff1cf','#c3add7']));colors.push(c.r,c.g,c.b);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.065,vertexColors:true,transparent:true,opacity:.75,depthWrite:false})));
  const moon=group(scene,8.8,10.2,-15),b=new Blocks();
  for(let x=-6;x<=6;x++)for(let y=-6;y<=6;y++)if(x*x+y*y<38 && (x-2.8)**2+(y-1.1)**2>27) b.box(x*.11,y*.11,0,.11,.11,.1,'#ffe7b5');b.build(moon,'glow');
  // Distant silhouettes remain deliberately quiet behind the colourful room.
  const city=new Blocks();
  for(let x=-30;x<30;x+=1.4) {
    const h=.7+random()*2.2;city.box(x,h/2-1,-12,1.25,h,1,'#30233e');city.box(x,h-1,-12,1.4,.12,1.2,'#493049');
    for(let y=-.5;y<h-1.2;y+=.5)for(let dx=-.35;dx<.5;dx+=.4)if(random()>.3)city.box(x+dx,y,-11.49,.13,.2,.02,pick(['#c18b56','#89616a','#bd9c70']));
  }city.build(scene);
  for(let i=0;i<12;i++) {
    const x=(random()-.5)*36,y=4+random()*10,g=group(scene,x,y,-14-random()*4),b=new Blocks();
    b.box(0,0,0,.22,.33,.18,'#e3a772').box(0,-.2,0,.15,.07,.15,'#ffe9a6');b.build(g,'glow');floaters.push({group:g,y,phase:random()*6,sky:true});
  }
}

function makeHead(parent,type,skinColor) {
  const h=group(parent),b=new Blocks(),hair=type==='Ravi'?'#29222b':'#33212b';
  // Sculpted, rounded block heads with stepped cheeks, ears, brows and smiles.
  for(let x=-4;x<=4;x++)for(let y=-5;y<=5;y++)for(let z=-3;z<=3;z++) {
    if((x/4.7)**2+(y/5.8)**2+(z/4.1)**2>1.28)continue;
    let col=skinColor;
    if(y>=4 || z<=-2 || (Math.abs(x)>=4&&y>=1))col=hair;
    if(z===3&&Math.abs(x)>=3&&y<0)col='#bd805d';
    b.box(x*.12,y*.12,z*.12,.122,.122,.122,col);
  }
  for(const s of [-1,1]) {
    b.box(s*.58,-.03,0,.16,.28,.22,skinColor).box(s*.62,-.03,.12,.08,.14,.06,'#b2765a');
    b.box(s*.23,.08,.452,.24,.13,.045,'#fff1de').box(s*.22,.075,.483,.095,.12,.04,'#30252b').box(s*.2,.11,.508,.025,.035,.02,'#fff8e7');
    b.box(s*.23,.24,.452,.25,.055,.06,hair);
    b.box(s*.3,-.17,.447,.18,.08,.025,'#d99879');
  }
  b.box(0,-.07,.49,.12,.18,.12,skinColor).box(0,-.17,.5,.14,.065,.1,'#ac7050');
  b.box(0,-.32,.45,.28,.065,.035,'#7b4144').box(0,-.355,.45,.18,.055,.035,'#7b4144').box(0,-.31,.475,.16,.025,.025,'#fff0d3');
  if(type==='Ravi') {
    // Clearly readable dark spectacles and a small soul patch.
    for(const s of [-1,1]) {
      const cx=s*.25;
      b.box(cx,.23,.52,.43,.055,.055,'#211b29').box(cx,-.06,.52,.43,.055,.055,'#211b29');
      b.box(cx-.19,.085,.52,.05,.28,.055,'#211b29').box(cx+.19,.085,.52,.05,.28,.055,'#211b29');
    }
    b.box(0,.1,.54,.12,.04,.06,'#211b29');b.box(0,-.45,.46,.11,.1,.04,'#35242d');
    for(let i=0;i<62;i++) {
      const x=(random()-.5)*1.03,y=.54+random()*.24,z=(random()-.5)*.8;
      b.box(x,y,z,.18,.17,.18,pick(['#211d28','#3d3033','#493731','#30242b']));
    }
  } else if(type==='Divya') {
    // Open hair falls over both shoulders, with a side part and gold earrings.
    for(const s of [-1,1])for(let y=-11;y<=3;y++)for(let z=-3;z<=2;z++) {
      const x=s*(.54+(Math.sin(y*.8)*.05));b.box(x,y*.12,z*.12,.22,.13,.14,pick([hair,'#42303a','#38252e']));
    }
    for(let i=0;i<7;i++) b.box(-.4+i*.12,.52-Math.sin(i*.42)*.1,.42,.14,.15,.13,hair);
    for(const s of [-1,1]) b.box(s*.61,-.27,.17,.08,.18,.08,palette.gold).box(s*.61,-.4,.17,.16,.12,.13,palette.goldLight);
    b.box(0,.31,.46,.055,.065,.03,'#bc375e');
  } else if(type==='Kaushiki') {
    for(let i=0;i<8;i++) b.box(-.44+i*.125,.46,.38,.14,.17-(i%3)*.025,.16,hair);
    for(const s of [-1,1]) {
      for(let y=0;y<7;y++) b.box(s*(.62+Math.sin(y*.5)*.12),.17-y*.14,-.12,.25,.21,.29,pick([hair,'#49303b']));
      b.box(s*.62,.18,.05,.32,.13,.23,'#f4b24f');
    }
    b.box(0,.29,.46,.04,.04,.025,'#cf5276');
  } else {
    for(let i=0;i<15;i++) b.box((random()-.5)*.95,.5+random()*.16,(random()-.5)*.7,.23,.17,.24,pick([hair,'#473039']));
    b.box(-.15,.43,.43,.35,.19,.16,hair);
  }
  b.build(h);return h;
}
function makePerson(name,x,z,scale) {
  const root=group(scene,x,.12,z),actor=group(root), torso=group(actor,0,1.65,0);
  const isWoman=name==='Divya',isGirl=name==='Kaushiki',isDad=name==='Ravi';
  const base=isDad?'#288480':isWoman?'#aa3166':isGirl?'#705bb5':'#dba447';
  const highlight=isDad?'#3f9c94':isWoman?'#cd4f7f':isGirl?'#a08bd3':'#f1c168';
  const body=new Blocks();
  if(isWoman||isGirl) {
    // A stepped sari / lehenga silhouette, using many small blocks in the embroidery.
    for(let row=0;row<14;row++) {
      const y=-1.34+row*.13,w=.99+(13-row)*.048;
      body.box(0,y,0,w,.14,.7+(13-row)*.019,row<2?palette.gold:row%5===0?highlight:base);
      for(const side of [-1,1]) body.box(side*(w/2-.08),y,.4+(13-row)*.008,.06,.07,.025,palette.gold);
      if(row%3===0)for(let i=-2;i<=2;i++)body.box(i*.22,y,.49-(row)*.006,.045,.055,.025,palette.goldLight);
    }
    body.box(0,.35,0,1.02,.8,.65,base).box(0,.77,0,.3,.21,.3,skin[1]);
    if(isWoman) {
      for(let i=0;i<12;i++) {const xx=-.48+i*.075,yy=.63-i*.085;body.box(xx,yy,.38,.24,.16,.08,'#e29568').box(xx,yy+.075,.43,.24,.035,.035,palette.goldLight);}
      for(let i=0;i<7;i++)body.box(-.36+i*.12,.59-Math.sin(i/6*Math.PI)*.18,.37,.065,.065,.05,palette.gold);
      body.box(.4,-.2,.42,.18,1.6,.12,'#d98869');
    } else body.box(0,.2,.36,.14,.9,.06,palette.gold).box(0,.64,.37,.7,.12,.06,palette.gold);
  } else {
    const w=isDad?1.3:1.1;
    body.box(0,.1,0,w,1.52,.75,base).box(0,-.56,0,w+.08,.25,.78,highlight).box(0,.76,0,.34,.24,.32,skin[0]);
    body.box(0,.37,.395,.13,.67,.04,palette.gold);
    for(let i=0;i<4;i++)body.box(0,.62-i*.18,.43,.055,.055,.04,palette.goldLight);
    if(isDad) {body.box(-.48,.1,.43,.14,1.25,.08,'#dfad69'); for(let i=0;i<10;i++)body.box(-.48,-.46+i*.13,.48,.16,.025,.03,'#f6d69c');}
  }
  body.build(torso);
  const legs=[];
  for(const side of [-1,1]) {
    const leg=group(actor,side*.29,.97,0),b=new Blocks();
    b.box(0,-.45,0,.4,.9,.4,isWoman||isGirl?base:'#efe0bb').box(0,-.93,.13,.44,.16,.62,isWoman||isGirl?palette.gold:'#4f3440');
    b.build(leg);legs.push(leg);
  }
  const head=makeHead(actor,name,skin[isWoman?1:isGirl?3:0]);head.position.y=3.05;
  const arms=[];
  for(const side of [-1,1]) {
    const arm=group(actor,side*(isDad?.79:.65),2.12,0),b=new Blocks();
    b.box(0,-.29,0,.32,.75,.4,base).box(0,-.72,.015,.28,.3,.3,skin[1]).box(0,-.95,.05,.32,.22,.33,skin[1]);
    b.box(0,-.66,.015,.34,.085,.35,palette.gold);
    if(isWoman) {b.box(0,-.74,.015,.34,.04,.35,'#a52f5f').box(0,-.81,.02,.34,.045,.35,palette.goldLight);}
    b.build(arm);arm.rotation.z=side*.1;arms.push(arm);
  }
  // Individualised finishing details.
  if(isGirl) {const crown=new Blocks();crown.box(0,3.72,0,.65,.08,.4,palette.gold);for(let i=-2;i<=2;i++)crown.box(i*.14,3.82+(i===0?.1:0),0,.09,.2,.15,palette.goldLight);crown.build(actor);}
  root.scale.setScalar(scale);
  const routes={Ravi:[[-3.65,-.05],[-4.4,.25],[-4.6,-.9],[-3.65,-.05]],Divya:[[-1.25,-.6],[-1.9,-1.05],[-1,-1.3],[-1.25,-.6]],Kaushiki:[[1.45,-.1],[2.8,-1.4],[4.35,-1.3],[4.5,1.15],[2.8,.6],[1.45,-.1]],Kaustubh:[[3.65,.4],[4.9,1.5],[4.6,3.25],[2.8,3.6],[4.4,2.3],[3.65,.4]]};
  const person={name,root,actor,head,arms,legs,x,z,scale,phase:random()*6,route:routes[name],routeIndex:1,wait:1.5+random()*2,walking:false,idleSince:0};people.push(person);
  hitBox(root,0,2,0,1.75,4,1.3,'person',name);
  // Small brass name plaques sit in front of each family member.
  const label=group(root,0,.34/scale,.84/scale),b=new Blocks();b.box(0,0,0,1.28/scale,.27/scale,.08,'#513449').box(0,-.14/scale,0,1.36/scale,.035,.09,palette.gold);b.build(label);
  textPlane(label,name,0,.01,.05,1.06/scale,'#ffe1a5',110,'Georgia',.22);
}

let cakeGroup, cakeHit;
function makeCake() {
  const table=new Blocks();
  // The table is below waist height so every face remains visible.
  for(const x of [-1.5,1.5])for(const z of [1.1,2.35])table.box(x,.65,z,.14,1.2,.14,palette.gold);
  table.box(0,1.31,1.75,3.8,.18,2.1,'#744353').box(0,1.43,1.75,3.95,.09,2.18,'#ead1b3');
  table.box(0,1.25,2.82,3.96,.38,.065,'#d89a9c').box(0,1.04,2.82,3.96,.06,.08,palette.gold);
  for(let x=-1.8;x<1.9;x+=.24)table.box(x,1.21,2.87,.045,.18,.025,palette.goldLight);
  table.build(scene);
  cakeGroup=group(scene,0,1.53,1.76);const b=new Blocks();
  // Pixel-round cake tiers, cream piping, berries, candles, and a birthday topper.
  for(let x=-9;x<=9;x++)for(let z=-7;z<=7;z++) {
    const d=Math.hypot(x/9,z/7);if(d>1)continue;
    b.box(x*.125,.025,z*.125,.126,.07,.126,palette.gold);
    if(d<.88) {b.box(x*.125,.23,z*.125,.126,.38,.126,'#d47a95');b.box(x*.125,.46,z*.125,.126,.1,.126,'#fff0d2');}
    if(d<.59) {b.box(x*.125,.69,z*.125,.126,.39,.126,'#edd6c5');b.box(x*.125,.91,z*.125,.126,.1,.126,'#ffecca');}
    if(d>.7&&d<.87&&z>0&&x%3===0) b.box(x*.125,.36,z*.125,.11,.19,.12,'#fff0d2');
  }
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;b.box(Math.cos(a)*.91,.53,Math.sin(a)*.7,.14,.12,.14,'#fff3db');}
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;b.box(Math.cos(a)*.6,.99,Math.sin(a)*.43,.13,.12,.13,i%2?'#c94e71':'#f8b16e');}
  b.build(cakeGroup);
  textPlane(cakeGroup,'HAPPY BIRTHDAY',0,.74,.57,1.1,'#ad426d',99,'Georgia',.19);
  textPlane(cakeGroup,'Divya & Kaushiki',0,.27,.84,1.65,'#fff1c8',88,'Georgia',.2);
  const topper=new Blocks();topper.box(0,1.29,-.15,.025,.64,.025,palette.gold).box(0,1.59,-.15,1.56,.36,.05,'#9c4b71');topper.build(cakeGroup);
  textPlane(cakeGroup,'Make a wish',0,1.59,-.115,1.35,'#ffe1a5',105,'Georgia',.25);
  // A number nine candle for Kaushiki, with ordinary candles for Divya.
  const nine=new Blocks(),pattern=['111','101','111','001','111'];
  pattern.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')nine.box(.3+(x-1)*.085,1.36-y*.085,.12,.08,.08,.1,'#f2b255');}));nine.build(cakeGroup);
  for(const [x,z,y] of [[-.43,.05,1.22],[0,.34,1.22],[.3,.12,1.48]]) {
    if(x!==.3)block(cakeGroup,x,y-.12,z,.065,.32,.065,x===0?'#b081c5':'#6faaa5');
    const f=group(cakeGroup,x,y+.09,z);new Blocks().box(0,0,0,.065,.15,.065,'#ffd77e').box(0,.09,0,.04,.07,.04,'#fff3c4').build(f,'glow');flames.push({group:f,candle:true,phase:random()*6});
  }
  cakeHit=hitBox(scene,0,2.15,1.76,2.5,1.7,1.9,'cake');
  // Two sweet dishes beside the cake.
  const sweets=new Blocks();
  for(const side of [-1,1]){sweets.box(side*1.55,1.56,1.8,.62,.08,.7,palette.gold);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)sweets.box(side*1.55+x*.17,1.68,1.8+z*.18,.14,.16,.14,pick(['#d7a052','#e3b469','#f1cc82']));}sweets.build(scene);
}

const maxParticles=6000;
const particlePositions=new Float32Array(maxParticles*3),particleColors=new Float32Array(maxParticles*3);
const particles=[];
let particleGeo,particlePoints;
function initParticles() {
  particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3).setUsage(THREE.DynamicDrawUsage));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3).setUsage(THREE.DynamicDrawUsage));particleGeo.setDrawRange(0,0);
  particlePoints=new THREE.Points(particleGeo,new THREE.PointsMaterial({size:.14,vertexColors:true,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));particlePoints.frustumCulled=false;scene.add(particlePoints);
}
function addParticle(x,y,z,vx,vy,vz,col,life=1.7,gravity=.8) {
  if(particles.length>=maxParticles)particles.shift();const c=new THREE.Color(col);
  particles.push({x,y,z,vx,vy,vz,r:c.r,g:c.g,b:c.b,life,max:life,gravity});
}
const fireworkColors=['#ff4098','#ffda47','#38fff0','#a66bff','#ff853d','#8eff57','#ff67ef','#64b3ff'];
function burst(x,y,z,col,style=0) {
  const count=state.gentle?70:260,offset=Math.floor(random()*fireworkColors.length);
  for(let i=0;i<count;i++) {
    const a=random()*Math.PI*2,u=random()*2-1,s=Math.sqrt(1-u*u),speed=1.6+random()*2.4;
    let vx=Math.cos(a)*s*speed,vy=u*speed,vz=Math.sin(a)*s*speed*.4;
    if(style===1) {vx=Math.cos(i/count*Math.PI*2)*3;vy=Math.sin(i/count*Math.PI*2)*3;vz=(random()-.5)*.3;}
    const rainbow=i%8===0?'#fffbd6':fireworkColors[(Math.floor(i/13)+offset)%fireworkColors.length];
    addParticle(x,y,z,vx,vy,vz,rainbow,1.5+random()*1.3,.55);
    if(i%5===0)addParticle(x,y,z,vx*.47,vy*.47,vz*.3,col,1+random(),.2);
  }
  firelight.color.set(col);firelight.position.set(x*.25,6,0);firelight.intensity=18;playExplosion();
  state.lastBurst={x,y,z};
}
function launch(x=(random()-.5)*19,y=4.5+random()*3.5,z=-11) {
  if(effects.length>12) return;
  effects.push({kind:'rocket',x,y:2,z,tx:x,ty:y,age:0,duration:.65+random()*.35,col:pick(fireworkColors),style:random()>.6?1:0});
  playWhistle();
  people.forEach(p=>{if(!actionTimes.has(p.name))p.lookUntil=state.now+2.4;});
}
function confetti(x,y,z) {
  for(let i=0;i<(state.gentle?25:100);i++)addParticle(x,y,z,(random()-.5)*5,2+random()*3,(random()-.5)*3,pick(fireworkColors),1.5+random()*1.5,2);
}
function sparkle(x,y,z) {for(let i=0;i<25;i++)addParticle(x,y,z,(random()-.5)*1.3,random()*1.8,(random()-.5)*1.3,'#ffe0a0',.6+random(),.4);}
function showToast(message,duration=2600) {$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+duration;}
const personMessages={Ravi:'Ravi brings the dad dance!',Divya:'A little twirl for the birthday queen ✧',Kaushiki:'Nine years of sparkle! Happy birthday, Kaushiki!',Kaustubh:'Kaustubh says: let’s celebrate!'};
function activatePerson(name) {
  actionTimes.set(name,state.now);showToast(personMessages[name]);
  const p=people.find(p=>p.name===name);if(p)sparkle(p.root.position.x,2.2*p.scale,p.root.position.z);
  playTone(name==='Kaustubh'?660:523,.16,'sine',.05);
}
function selectPerson(name) {
  if(state.selected===name){activatePerson(name);return;}
  if(state.selected){const previous=people.find(p=>p.name===state.selected);previous.manualPath=null;previous.wait=4;}
  state.selected=name;const p=people.find(p=>p.name===name);p.manualPath=null;p.walking=false;actionTimes.delete(name);
  $('deselect').hidden=false;updateHint();showToast(`${name} selected · Tap an open spot on the floor to walk`,3200);playTone(659,.12);
}
function deselectPerson() {
  const p=people.find(p=>p.name===state.selected);if(p){p.manualPath=null;p.wait=3;p.walking=false;}
  state.selected=null;selectionRing.visible=false;destinationRing.visible=false;$('deselect').hidden=true;updateHint();
}
function updateHint() {
  $('hint').textContent=state.selected?`${state.selected} selected · Tap the floor to walk · Tap them again to dance`:'Tap the sky for fireworks · Select a person, then tap the floor to walk';
}
function makeMarkers() {
  function ring(color,radius) {
    const g=group(scene),b=new Blocks();for(let i=0;i<32;i++){const a=i/32*Math.PI*2;b.box(Math.cos(a)*radius,.11,Math.sin(a)*radius,.12,.04,.12,color);}b.build(g,'glow');g.visible=false;return g;
  }
  selectionRing=ring('#70ffe5',.72);destinationRing=ring('#ffe68b',.37);
  hitBox(scene,0,.055,.9,15.6,.06,9.7,'floor');
}
function moveSelected(point) {
  if(!state.selected){showToast('Tap a family member first, then tap the floor to walk.');return;}
  const p=people.find(p=>p.name===state.selected),radius=p.name==='Ravi'?.57:p.name==='Divya'?.5:.38;
  const path=findPath([p.root.position.x,p.root.position.z],[point.x,point.z],radius);
  if(!path){showToast('Choose an open spot on the floor, away from the table and gifts.');return;}
  p.manualPath=path;p.walking=true;actionTimes.delete(p.name);
  destinationRing.position.set(point.x,0,point.z);destinationRing.visible=true;
  showToast(`${p.name} is on the way ✧`,1600);
}
function makeWish() {
  if(state.wishing)return;
  if(!state.candles){state.candles=true;showToast('Another wish? The candles are glowing again.');playTone(880,.2);return;}
  state.wishing=true;state.wishUntil=state.now+2.3;showToast('Make a wish, Divya & Kaushiki…',2300);
  for(const name of ['Divya','Kaushiki'])actionTimes.set(name,state.now);
  $('wish').disabled=true;
}
function celebrate() {
  showToast('A sky full of wishes for Divya & Kaushiki ✧',3500);
  [-7,-3.5,0,3.5,7].forEach((x,i)=>effects.push({kind:'scheduled',at:state.now+i*.33,x,y:5.1+(i%3)*.9}));
  people.forEach(p=>actionTimes.set(p.name,state.now));
  confetti(0,5,1);
}
let audioContext,masterGain,tuneUntil=0;
function unlockAudio() {
  if(!state.sound||!state.landscape)return false;
  try {
    if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();masterGain=audioContext.createGain();masterGain.gain.value=.65;masterGain.connect(audioContext.destination);}
    if(audioContext.state==='suspended')audioContext.resume();state.audioUnlocked=true;return true;
  }catch{return false;}
}
function playExplosion() {
  if(!state.sound||!state.audioUnlocked||!audioContext)return;
  const ctx=audioContext,t=ctx.currentTime,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.7),ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(random()*2-1)*(i<ctx.sampleRate*.09?1:.5);
  const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(1800,t);filter.frequency.exponentialRampToValueAtTime(180,t+.65);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.23,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.7);
  noise.connect(filter);filter.connect(gain);gain.connect(masterGain);noise.start(t);noise.stop(t+.7);
  const thump=ctx.createOscillator(),thumpGain=ctx.createGain();thump.frequency.setValueAtTime(105,t);thump.frequency.exponentialRampToValueAtTime(35,t+.35);thumpGain.gain.setValueAtTime(.15,t);thumpGain.gain.exponentialRampToValueAtTime(.0001,t+.4);thump.connect(thumpGain);thumpGain.connect(masterGain);thump.start(t);thump.stop(t+.4);state.explosionCount++;
}
function playWhistle() {
  if(!state.sound||!state.audioUnlocked||!audioContext)return;
  const ctx=audioContext,t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(430,t);osc.frequency.exponentialRampToValueAtTime(1600,t+.45);gain.gain.setValueAtTime(.012,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.5);osc.connect(gain);gain.connect(masterGain);osc.start(t);osc.stop(t+.5);
}
function playBirthdayTune() {
  if(!state.sound){showToast('Tap ♫ to turn sound on, then play the birthday tune.');return;}
  if(!unlockAudio()){showToast('Tap the scene once to enable sound.');return;}
  if(audioContext.currentTime<tuneUntil)return;
  const notes=[[60,1],[60,.5],[62,1.5],[60,1.5],[65,1.5],[64,3],[60,1],[60,.5],[62,1.5],[60,1.5],[67,1.5],[65,3],[60,1],[60,.5],[72,1.5],[69,1.5],[65,1.5],[64,1.5],[62,3],[70,1],[70,.5],[69,1.5],[65,1.5],[67,1.5],[65,3]];
  let time=audioContext.currentTime+.06;const beat=.32;
  for(const [midi,beats] of notes){const duration=beats*beat;
    for(const [harmonic,level] of [[1,.075],[2,.015]]){
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=440*Math.pow(2,(midi-69)/12)*harmonic;
      gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(level,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+duration*.94);osc.connect(gain);gain.connect(masterGain);osc.start(time);osc.stop(time+duration);
    }time+=duration;
  }
  tuneUntil=time;state.tuneCount++;showToast('Happy birthday, Divya & Kaushiki! ♫',5500);
}
function playTone(freq,duration=.18,type='sine',volume=.04) {
  if(!state.sound||!state.audioUnlocked)return;
  try {
    const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime;
    osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.55),t+duration);
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(masterGain);osc.start(t);osc.stop(t+duration);
  }catch {state.sound=false;$('sound').setAttribute('aria-pressed','false');showToast('Sound is unavailable in this browser.');}
}

function resize() {
  const width=innerWidth,height=innerHeight,aspect=width/height;
  state.landscape=width>height;$('rotate-prompt').hidden=state.landscape;$('poster').inert=!state.landscape;
  if(masterGain)masterGain.gain.setValueAtTime(state.landscape && state.sound ? .65 : 0,audioContext.currentTime);
  lastTime=0;
  renderer.setSize(width,height);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  const compact=height<550&&aspect>1;
  const viewHeight=compact?Math.max(12.8,21/aspect):Math.max(16.6,12.7/aspect);
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
  camera.userData.aimY=compact?4:4.8;camera.userData.aimX=compact?-3.4:0;camera.userData.distance=22;camera.userData.lift=6.4;
  updateCamera();
  renderer.render(scene,camera);
}
function updateCamera() {
  const aimY=camera.userData.aimY,aimX=camera.userData.aimX;
  camera.position.set(aimX+current.x*1.1,aimY+camera.userData.lift+current.y*.7,camera.userData.distance);
  camera.lookAt(aimX+current.x*.08,aimY+current.y*.08,0);
}
function getHit(event) {
  scene.updateMatrixWorld();camera.updateMatrixWorld();
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(interactive,false)[0];
}
function skyTap(event) {
  getHit(event);
  const plane=new THREE.Plane(new THREE.Vector3(0,0,1),11),point=new THREE.Vector3();
  // No coordinate clamping and no queued rocket: the burst starts at the tap.
  if(raycaster.ray.intersectPlane(plane,point))burst(point.x,point.y,-11,pick(fireworkColors),random()>.55?1:0);
}
function bindInput() {
  const canvas=renderer.domElement;let down=null;
  document.addEventListener('pointerdown',unlockAudio,{passive:true});
  canvas.addEventListener('pointerdown',e=>{if(!state.landscape)return;down={x:e.clientX,y:e.clientY,id:e.pointerId,drag:false,tx:target.x,ty:target.y};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(down) {
      const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.hypot(dx,dy)>8)down.drag=true;
      if(down.drag&&!state.gentle){target.set(clamp(down.tx+dx/130,-1,1),clamp(down.ty+dy/180,-1,1));}
    }else if(e.pointerType==='mouse'&&!state.gentle)target.set((e.clientX/innerWidth-.5)*1.5,(e.clientY/innerHeight-.5)*1.3);
    if(e.pointerType==='mouse'){const hit=getHit(e);canvas.style.cursor=hit?'pointer':'crosshair';}
  });
  canvas.addEventListener('pointerup',e=>{
    if(!down||e.pointerId!==down.id||!state.landscape)return;const isDrag=down.drag;down=null;if(isDrag)return;
    const hit=getHit(e);
    if(!hit)skyTap(e);
    else if(hit.object.userData.kind==='person')selectPerson(hit.object.userData.name);
    else if(hit.object.userData.kind==='floor') {
      const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.12),point))moveSelected(point);
    }
    else if(hit.object.userData.kind==='cake')makeWish();
    else if(hit.object.userData.kind==='balloon'){const g=hit.object.parent;actionTimes.set(g.uuid,state.now);sparkle(g.position.x,g.position.y,g.position.z);playTone(440,.12);}
    else if(hit.object.userData.kind==='diya'){const g=hit.object.parent;sparkle(g.position.x,g.position.y+.5,g.position.z);showToast('A little more light. A little more love.');playTone(1046,.18);}
  });
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerleave',()=>{if(!down)target.set(0,0);});
  $('wish').addEventListener('click',makeWish);$('celebrate').addEventListener('click',celebrate);
  $('sound').addEventListener('click',()=>{state.sound=!state.sound;if(state.sound)unlockAudio();if(masterGain)masterGain.gain.setValueAtTime(state.sound ? .65 : 0,audioContext.currentTime);$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').setAttribute('aria-label',state.sound?'Mute sound':'Enable sound');showToast(state.sound?'Sound on · Fireworks & birthday music':'Sound off');});
  $('birthday-song').addEventListener('click',playBirthdayTune);$('deselect').addEventListener('click',deselectPerson);
  $('help').addEventListener('click',()=>{const open=$('help-panel').hidden;$('help-panel').hidden=!open;$('help').setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('[data-person]').forEach(btn=>btn.addEventListener('click',()=>selectPerson(btn.dataset.person)));
  $('gentle').addEventListener('click',()=>{state.gentle=!state.gentle;setGentleUI();target.set(0,0);});
  reducedQuery.addEventListener('change',e=>{state.gentle=e.matches;setGentleUI();target.set(0,0);});setGentleUI();
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;lastTime=0;if(!visible&&audioContext)audioContext.suspend();if(visible&&audioContext&&state.sound&&state.landscape)audioContext.resume();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showToast('The celebration is resting. Restoring the scene…',8000);});
  canvas.addEventListener('webglcontextrestored',()=>showToast('The lights are back!'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('help-panel').hidden=true;$('help').setAttribute('aria-expanded','false');deselectPerson();target.set(0,0);}});
}
function setGentleUI() {$('gentle').textContent=`Gentle motion: ${state.gentle?'on':'off'}`;$('gentle').setAttribute('aria-pressed',String(state.gentle));}

function updatePeople(t,dt) {
  for(const p of people) {
    const action=actionTimes.get(p.name),a=action===undefined?99:t-action;
    const motion=state.gentle?.15:1;
    p.actor.position.y=Math.sin(t*1.6+p.phase)*.022*motion;p.actor.rotation.set(0,0,0);p.head.rotation.set(0,Math.sin(t*.5+p.phase)*.045*motion,0);
    p.legs.forEach(l=>l.rotation.x=0);
    const manual=state.selected===p.name;
    const canWalk=!state.wishing&&a>=3.4&&(manual?!!p.manualPath?.length:!state.gentle);
    p.walking=false;
    if(canWalk) {
      if(!manual)p.wait-=dt;
      if(manual||p.wait<=0) {
        const destination=manual?p.manualPath[0]:p.route[p.routeIndex],dx=destination[0]-p.root.position.x,dz=destination[1]-p.root.position.z,dist=Math.hypot(dx,dz);
        const speed=manual?1.7:p.name==='Kaustubh'?1.1:p.name==='Kaushiki'?.9:.4;
        if(dist>.045) {
          p.walking=true;const step=Math.min(dist,speed*dt);p.root.position.x+=dx/dist*step;p.root.position.z+=dz/dist*step;
          const gait=Math.sin(t*(p.name==='Kaustubh'?10:7));
          p.legs[0].rotation.x=gait*.4;p.legs[1].rotation.x=-gait*.4;p.actor.position.y+=Math.abs(gait)*.045;
          p.actor.rotation.y=clamp(Math.atan2(dx,dz),-.65,.65);p.arms[0].rotation.x=-gait*.22;p.arms[1].rotation.x=gait*.22;
        } else {
          p.walking=false;
          if(manual){p.manualPath.shift();if(!p.manualPath.length){p.manualPath=null;destinationRing.visible=false;showToast(`${p.name} has arrived · Tap another spot to keep exploring`,2200);}}
          else {p.routeIndex=(p.routeIndex+1)%p.route.length;p.wait=p.name==='Ravi'||p.name==='Divya'?6+random()*5:1.4+random()*2;p.idleSince=t;}
        }
      }
    }
    const gait=p.walking&&canWalk?Math.sin(t*7)*.22:0;p.arms[0].rotation.set(-gait,0,-.1);p.arms[1].rotation.set(gait,0,.1);
    if(a>=3.4&&!p.walking&&!state.wishing&&!state.gentle) {
      const wave=(t+p.phase)%13;
      if(wave<2) {p.arms[1].rotation.z=1.3+Math.sin(t*8)*.2;p.head.rotation.z=Math.sin(t*2)*.035;}
    }
    if(p.lookUntil>t)p.head.rotation.x=-.15;
    if(state.wishing&&(p.name==='Divya'||p.name==='Kaushiki')) {p.actor.rotation.x=.14*Math.sin(Math.min(1,(t-(state.wishUntil-2.3))/.7)*Math.PI/2);p.head.rotation.x=.1;}
    else if(a<3.4) {
      const env=Math.min(1,a*4)*Math.min(1,(3.4-a)*3)*motion;
      if(p.name==='Divya') {p.actor.rotation.y=Math.sin(a*Math.PI*.8)*.65*env;p.arms[0].rotation.z=-.5*env;p.arms[1].rotation.z=.65*env;}
      else if(p.name==='Kaushiki') {p.actor.position.y+=Math.abs(Math.sin(a*6))*.24*env;p.actor.rotation.y=Math.sin(a*3)*.3*env;p.arms[1].rotation.z=1.6*env;}
      else if(p.name==='Kaustubh') {p.actor.position.y+=Math.abs(Math.sin(a*7))*.3*env;p.arms[0].rotation.z=-1.4*env;p.arms[1].rotation.z=1.4*env;}
      else {p.actor.rotation.z=Math.sin(a*6)*.08*env;p.arms[1].rotation.z=(1.4+Math.sin(a*10)*.3)*env;p.arms[0].rotation.z=-.6*env;}
    }
    if(a>=3.4&&action!==undefined)actionTimes.delete(p.name);
  }
}
function updateEffects(dt,t) {
  for(let i=effects.length-1;i>=0;i--) {
    const e=effects[i];
    if(e.kind==='scheduled'){if(t>=e.at){launch(e.x,e.y,-11);effects.splice(i,1);}continue;}
    e.age+=dt;const f=Math.min(1,e.age/e.duration),y=2+(e.ty-2)*f;
    for(let j=0;j<3;j++)addParticle(e.x,y-j*.16,e.z,(random()-.5)*.12,-.3,(random()-.5)*.1,'#ffe4b0',.25,.1);
    if(f>=1){burst(e.x,e.ty,e.z,e.col,e.style);effects.splice(i,1);}
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.vy-=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;}
  particles.forEach((p,i)=>{const k=i*3,f=Math.min(1,p.life/.55);particlePositions[k]=p.x;particlePositions[k+1]=p.y;particlePositions[k+2]=p.z;particleColors[k]=p.r*f;particleColors[k+1]=p.g*f;particleColors[k+2]=p.b*f;});
  particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.color.needsUpdate=true;particleGeo.setDrawRange(0,particles.length);
  firelight.intensity=Math.max(0,firelight.intensity-dt*12);
}
function frame(ms) {
  requestAnimationFrame(frame);if(!visible||!state.landscape){lastTime=0;return;}
  const realDelta=lastTime?Math.min(1,(ms-lastTime)/1000):0;
  const dt=Math.min(.25,realDelta);lastTime=ms;elapsed+=realDelta;state.now=elapsed;
  const t=elapsed;
  current.lerp(state.gentle?new THREE.Vector2():target,1-Math.exp(-dt*4));updateCamera();
  $('sky-glow').style.transform=`translate(${current.x*-15}px,${current.y*-10}px)`;
  updatePeople(t,dt);updateEffects(dt,t);
  const selected=people.find(p=>p.name===state.selected);selectionRing.visible=!!selected;
  if(selected){selectionRing.position.set(selected.root.position.x,0,selected.root.position.z);selectionRing.scale.setScalar(1+Math.sin(t*3)*.035);}
  for(const f of flames) {f.group.visible=f.candle?state.candles:true;const s=state.gentle?1:1+Math.sin(t*7+f.phase)*.12;f.group.scale.set(1,s,1);}
  for(const b of balloons) {
    const a=actionTimes.get(b.group.uuid),wiggle=a===undefined?0:Math.max(0,1-(t-a)/1.6)*Math.sin((t-a)*18)*.2;
    b.group.rotation.z=(state.gentle?0:Math.sin(t*.8+b.phase)*.035)+wiggle;
    if(a!==undefined&&t-a>1.6)actionTimes.delete(b.group.uuid);
  }
  for(const f of floaters){f.group.position.y=f.y+(state.gentle?0:Math.sin(t*.5+f.phase)*.08);f.group.rotation.z=state.gentle?0:Math.sin(t*.4+f.phase)*.025;}
  if(state.wishing&&t>=state.wishUntil) {
    state.wishing=false;state.candles=false;$('wish').disabled=false;$('wish').innerHTML='<span aria-hidden="true">✧</span> Wish again';
    showToast('Happy birthday, Divya & Kaushiki! ✧',5000);confetti(0,4.5,1.7);launch(-5,6);launch(5,7);if(state.sound)playBirthdayTune();
    for(const name of ['Divya','Kaushiki'])actionTimes.set(name,t);
  }
  if(t>3&&t-state.lastAuto>(state.gentle?18:3.8)) {state.lastAuto=t;launch((random()>.5?-1:1)*(5+random()*6),4.6+random()*3.4);}
  if(performance.now()>toastUntil)$('toast').classList.remove('visible');
  renderer.render(scene,camera);
  if(diagnostics){
    const screen=state.lastBurst?new THREE.Vector3(state.lastBurst.x,state.lastBurst.y,state.lastBurst.z).project(camera):null;
    renderer.domElement.dataset.snapshot=JSON.stringify({seconds:+t.toFixed(2),candles:state.candles,selected:state.selected,people:people.map(p=>({name:p.name,x:+p.root.position.x.toFixed(2),z:+p.root.position.z.toFixed(2),walking:p.walking,path:p.manualPath})),parallax:[+current.x.toFixed(2),+current.y.toFixed(2)],particles:particles.length,lastBurstScreen:screen?[(screen.x*.5+.5)*innerWidth,(-screen.y*.5+.5)*innerHeight]:null,tunes:state.tuneCount,explosions:state.explosionCount,audio:audioContext?.state});
  }
}
function boot() {
  try {
    try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.domElement.dataset.renderer='webgl';}
    catch {renderer=new SoftwareRenderer();}
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    $('world').appendChild(renderer.domElement);scene=new THREE.Scene();
    camera=new THREE.OrthographicCamera(-9,9,6,-6,.1,100);
    scene.add(new THREE.HemisphereLight('#f7daee','#70455c',2.1));
    const key=new THREE.DirectionalLight('#ffe3b0',3.2);key.position.set(-5,12,10);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-11;key.shadow.camera.right=11;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;key.shadow.normalBias=.06;key.shadow.bias=-.0004;scene.add(key);
    const fill=new THREE.DirectionalLight('#c7b3ff',1.7);fill.position.set(8,7,-6);scene.add(fill);
    const warm=new THREE.PointLight('#ffb26d',24,17,2);warm.position.set(0,4,3);scene.add(warm);
    firelight=new THREE.PointLight('#ff99b7',0,35,1);scene.add(firelight);
    makeSky();makeRoom();makeDecorations();
    makePerson('Ravi',-3.65,-.05,1.12);makePerson('Divya',-1.25,-.6,1.02);makePerson('Kaushiki',1.45,-.1,.8);makePerson('Kaustubh',3.65,.4,.65);
    makeCake();makeMarkers();initParticles();resize();bindInput();renderer.render(scene,camera);
    $('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,750);
    requestAnimationFrame(frame);
    // A small opening flourish, leaving the sky available for visitors' own fireworks.
    effects.push({kind:'scheduled',at:1,x:-8,y:6.3},{kind:'scheduled',at:1.7,x:8,y:7});
  }catch(error) {console.error(error);$('loading').hidden=true;$('fallback').hidden=false;}
}
boot();
