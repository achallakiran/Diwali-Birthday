// Screen-space voxel fireworks remain exactly under a fingertip at any camera angle.
export class FireworkSky {
  constructor(canvas,onBurst) {this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onBurst=onBurst;this.particles=[];this.rockets=[];this.flashes=[];this.gentle=false;this.lastBurst=null;}
  resize(width,height) {this.width=width;this.height=height;const ratio=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);this.ratio=ratio;}
  launch(x,y) {if(this.rockets.length<8)this.rockets.push({x,y:this.height*.74,target:y,age:0,duration:.65+Math.random()*.3,start:this.height*.74});}
  burst(x,y) {
    const colours=['#ff3a91','#ff9f24','#fff14f','#68ff5f','#25ffe8','#42aaff','#b56cff','#ff5dea'];
    const count=this.gentle?100:440,radius=Math.min(this.width*.27,this.height*.5),style=Math.floor(Math.random()*3),offset=Math.floor(Math.random()*8);
    for(let i=0;i<count;i++) {
      const angle=Math.random()*Math.PI*2,life=1.9+Math.random()*.95;
      let spread=.35+Math.random()*.65;
      if(style===1)spread=i%3===0?.52:1;
      if(style===2)spread=.55+.45*Math.abs(Math.cos(angle*5));
      const speed=radius*spread/(life*.66),colour=colours[(Math.floor(i/11)+offset)%8];
      this.particles.push({x,y,px:x,py:y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life,max:life,colour,size:2.2+Math.random()*3.5,glitter:i%7===0});
    }
    this.flashes.push({x,y,age:0,colour:colours[offset]});
    if(this.particles.length>6500)this.particles.splice(0,this.particles.length-6500);
    this.lastBurst=[x,y];this.onBurst?.(colours[offset]);
  }
  update(dt) {
    const ctx=this.ctx,W=this.width,H=this.height;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,W,H);ctx.globalCompositeOperation='lighter';
    for(let i=this.rockets.length-1;i>=0;i--){const r=this.rockets[i];r.age+=dt;const t=Math.min(1,r.age/r.duration);r.y=r.start+(r.target-r.start)*t;ctx.globalAlpha=1;ctx.fillStyle='#fff4be';ctx.fillRect(r.x-2,r.y-2,4,5);for(let j=1;j<7;j++){ctx.globalAlpha=(1-j/7)*.65;ctx.fillStyle=j%2?'#ffb34f':'#ff70ba';ctx.fillRect(r.x-1,r.y+j*5,3,4);}if(t===1){this.burst(r.x,r.target);this.rockets.splice(i,1);}}
    for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.age+=dt;if(f.age>.28){this.flashes.splice(i,1);continue;}const r=20+f.age*260,g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);g.addColorStop(0,'#ffffe8');g.addColorStop(.2,f.colour);g.addColorStop(1,'transparent');ctx.globalAlpha=(1-f.age/.28)*.65;ctx.fillStyle=g;ctx.fillRect(f.x-r,f.y-r,r*2,r*2);}
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.px=p.x;p.py=p.y;const drag=Math.exp(-dt*.32);p.vx*=drag;p.vy=p.vy*drag+dt*27;p.x+=p.vx*dt;p.y+=p.vy*dt;const fade=Math.min(1,p.life/.85),size=p.size*(.6+.4*p.life/p.max);ctx.fillStyle=p.glitter&&Math.random()>.7?'#fff8db':p.colour;for(let j=3;j>=1;j--){ctx.globalAlpha=fade*(.19-j*.035);ctx.fillRect(p.x-p.vx*.018*j-size/2,p.y-p.vy*.018*j-size/2,size,size);}ctx.globalAlpha=fade;ctx.fillRect(p.x-size/2,p.y-size/2,size,size);}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
}
