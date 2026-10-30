// Ground-plane navigation around the cake table and room furnishings.
export const floorBounds={minX:-7.25,maxX:7.25,minZ:-3.1,maxZ:5.6};
const obstacles=[
  [-2.05,2.05,.63,2.97], // cake table
  [-6.55,-2.85,-3.4,-2.05], // bench
  [4.85,6.85,-2.45,-.95], // rear gift stack
  [5.25,6.65,-.95,-.15],
  [5.35,6.65,1.35,2.65],
  [-6.3,-5.3,.9,1.9],
  [-6.9,-5.85,-2.6,-1.4], // flower vases
  [5.9,7,-2.6,-1.4]
];
export function walkable(x,z,radius=.42) {
  if(x<floorBounds.minX+radius||x>floorBounds.maxX-radius||z<floorBounds.minZ+radius||z>floorBounds.maxZ-radius)return false;
  return !obstacles.some(([a,b,c,d])=>x>a-radius&&x<b+radius&&z>c-radius&&z<d+radius);
}
export function clearSegment(a,b,radius=.42) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1));
  for(let i=0;i<=steps;i++){const t=i/steps;if(!walkable(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,radius))return false;}return true;
}
export function findPath(start,goal,radius=.42) {
  if(!walkable(...goal,radius))return null;
  if(clearSegment(start,goal,radius))return [goal];
  const step=.32,cols=Math.ceil((floorBounds.maxX-floorBounds.minX)/step)+1,rows=Math.ceil((floorBounds.maxZ-floorBounds.minZ)/step)+1;
  const point=(x,z)=>[floorBounds.minX+x*step,floorBounds.minZ+z*step];
  const grid=p=>[Math.round((p[0]-floorBounds.minX)/step),Math.round((p[1]-floorBounds.minZ)/step)];
  const [sx,sz]=grid(start),[gx,gz]=grid(goal),key=(x,z)=>z*cols+x;
  const open=[{x:sx,z:sz,g:0,f:0}],cost=new Map([[key(sx,sz),0]]),parents=new Map(),closed=new Set();
  while(open.length) {
    open.sort((a,b)=>b.f-a.f);const node=open.pop(),id=key(node.x,node.z);if(closed.has(id))continue;closed.add(id);
    const here=id===key(sx,sz)?start:point(node.x,node.z);
    if(Math.hypot(node.x-gx,node.z-gz)<=2&&clearSegment(here,goal,radius)) {
      const path=[goal,here];let k=id;
      while(parents.has(k)){k=parents.get(k);path.push(k===key(sx,sz)?start:point(k%cols,Math.floor(k/cols)));}
      path.reverse();const result=[];let anchor=start;
      for(let i=1;i<path.length;i++){if(i+1<path.length&&clearSegment(anchor,path[i+1],radius))continue;result.push(path[i]);anchor=path[i];}
      return result;
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x=node.x+dx,z=node.z+dz;if(x<0||x>=cols||z<0||z>=rows)continue;
      const next=point(x,z),nid=key(x,z);if(closed.has(nid)||!clearSegment(here,next,radius))continue;
      const g=node.g+Math.hypot(dx,dz);if(g>=(cost.get(nid)??Infinity))continue;
      cost.set(nid,g);parents.set(nid,id);open.push({x,z,g,f:g+Math.hypot(x-gx,z-gz)});
    }
  }
  return null;
}
