import * as THREE from 'three';

// Canvas fallback for environments that disable WebGL. It renders the same voxel
// geometry and animation, rather than replacing the celebration with a still image.
export class SoftwareRenderer {
  constructor() {
    this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');
    if(!this.ctx)throw new Error('Canvas is unavailable');
    this.domElement.dataset.renderer='canvas';this.shadowMap={};this.cache=new WeakMap();this.colorCache=new Map();this.previous=0;this.width=1;this.height=1;this.ratio=1;
    this.vp=new THREE.Matrix4();this.mvp=new THREE.Matrix4();this.mv=new THREE.Matrix4();this.nm=new THREE.Matrix3();
  }
  setClearColor() {}
  setPixelRatio(r) {this.ratio=Math.min(r,1.25);this.setSize(this.width,this.height);}
  setSize(w,h) {this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=`${w}px`;this.domElement.style.height=`${h}px`;}
  color(r,g,b,shade=1) {
    const convert=v=>Math.round(Math.min(255,Math.max(0,(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055)*255*shade)));
    const rr=convert(r),gg=convert(g),bb=convert(b);return `rgb(${rr},${gg},${bb})`;
  }
  project(pos,i,e) {
    const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],w=e[3]*x+e[7]*y+e[11]*z+e[15];
    return [(e[0]*x+e[4]*y+e[8]*z+e[12])/w,(e[1]*x+e[5]*y+e[9]*z+e[13])/w,(e[2]*x+e[6]*y+e[10]*z+e[14])/w];
  }
  render(scene,camera) {
    const now=performance.now();if(now-this.previous<85)return;this.previous=now;
    scene.updateMatrixWorld();camera.updateMatrixWorld();this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const draw=[],ctx=this.ctx,W=this.width,H=this.height;
    const collect=obj=>{
      if(!obj.visible)return;
      if(obj.isMesh&&obj.material.visible!==false) {
        const geo=obj.geometry,mat=obj.material,p=geo.attributes.position?.array,indices=geo.index?.array,n=geo.attributes.normal?.array,c=geo.attributes.color?.array;
        if(p&&indices) {
          this.mvp.multiplyMatrices(this.vp,obj.matrixWorld);this.mv.multiplyMatrices(camera.matrixWorldInverse,obj.matrixWorld);this.nm.getNormalMatrix(this.mv);
          const e=this.mvp.elements,ne=this.nm.elements;
          if(mat.map?.image) {
            const a=this.project(p,0,e),b=this.project(p,1,e),d=this.project(p,2,e);
            draw.push({depth:a[2],image:mat.map.image,pts:[a,b,d]});
          } else {
            for(let i=0;i<indices.length;i+=6) {
              const ia=indices[i],ib=indices[i+1],ic=indices[i+4],id=indices[i+2];
              if(n) {const k=ia*3,nz=ne[2]*n[k]+ne[5]*n[k+1]+ne[8]*n[k+2];if(nz<=.015)continue;}
              const a=this.project(p,ia,e),b=this.project(p,ib,e),cc=this.project(p,ic,e),d=this.project(p,id,e);
              if([a,b,cc,d].every(pt=>pt[0]<-1.1)||[a,b,cc,d].every(pt=>pt[0]>1.1)||[a,b,cc,d].every(pt=>pt[1]<-1.1)||[a,b,cc,d].every(pt=>pt[1]>1.1))continue;
              const k=ia*3;
              const shade=mat.emissiveIntensity>.1?1.15:n?(.67+Math.max(0,n[k]*-.4+n[k+1]*.8+n[k+2]*.6)*.33):1;
              const col=c?this.color(c[k],c[k+1],c[k+2],shade):'#cba782';
              // Subdivide broad room faces so a painter's algorithm cannot paint
              // an entire floor over the feet of people standing on its far side.
              const dist=(ii,jj)=>Math.hypot(p[ii*3]-p[jj*3],p[ii*3+1]-p[jj*3+1],p[ii*3+2]-p[jj*3+2]);
              const cols=Math.max(1,Math.ceil(dist(ia,ib)/.65)),rows=Math.max(1,Math.ceil(dist(ia,id)/.65));
              if(cols===1&&rows===1)draw.push({depth:(a[2]+b[2]+cc[2]+d[2])/4,pts:[a,b,cc,d],col});
              else {
                const lerp=(u,v)=>[0,1,2].map(k=>a[k]*(1-u)*(1-v)+b[k]*u*(1-v)+cc[k]*u*v+d[k]*(1-u)*v);
                for(let xx=0;xx<cols;xx++)for(let yy=0;yy<rows;yy++) {
                  const aa=lerp(xx/cols,yy/rows),bb=lerp((xx+1)/cols,yy/rows),ccc=lerp((xx+1)/cols,(yy+1)/rows),dd=lerp(xx/cols,(yy+1)/rows);
                  draw.push({depth:(aa[2]+bb[2]+ccc[2]+dd[2])/4,pts:[aa,bb,ccc,dd],col});
                }
              }
            }
          }
        }
      } else if(obj.isPoints) {
        const geo=obj.geometry,p=geo.attributes.position.array,c=geo.attributes.color?.array;
        this.mvp.multiplyMatrices(this.vp,obj.matrixWorld);const e=this.mvp.elements,count=Math.min(geo.drawRange.count,p.length/3),size=Math.max(1.3,obj.material.size*H/(camera.top-camera.bottom));
        for(let i=0;i<count;i++){const a=this.project(p,i,e);if(a[0]<-1||a[0]>1||a[1]<-1||a[1]>1)continue;const k=i*3;draw.push({depth:a[2],point:a,size,col:c?this.color(c[k],c[k+1],c[k+2],1.1):'#ffe4b5'});}
      }
      for(const child of obj.children)collect(child);
    };
    collect(scene);draw.sort((a,b)=>b.depth-a.depth);ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,W,H);
    const xy=p=>[(p[0]*.5+.5)*W,(-p[1]*.5+.5)*H];
    for(const face of draw) {
      if(face.point){const [x,y]=xy(face.point);ctx.fillStyle=face.col;ctx.fillRect(x,y,face.size,face.size);continue;}
      if(face.image) {
        const [a,b,d]=face.pts.map(xy),img=face.image;
        ctx.save();ctx.transform((b[0]-a[0])/img.width,(b[1]-a[1])/img.width,(d[0]-a[0])/img.height,(d[1]-a[1])/img.height,a[0],a[1]);ctx.drawImage(img,0,0);ctx.restore();continue;
      }
      ctx.fillStyle=face.col;ctx.beginPath();face.pts.forEach((p,i)=>{const [x,y]=xy(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.fill();
    }
    this.domElement.dataset.renderMs=String(Math.round(performance.now()-now));
  }
}
