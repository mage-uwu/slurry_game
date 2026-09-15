require('../assets/showcase-shared.js');
const F=globalThis.SlurryProject;
module.exports=function world(n=2){
  const state=new Float32Array(n*4),attributes=new Uint32Array(n),ids=new Uint32Array(n),anchors=new Float32Array(n*4),bonds=new Uint32Array(n*8).fill(0xffffffff);
  for(let i=0;i<n;i++){state.set([20+i%100,30,20+i%100,30],i*4);anchors.set([20+i%100,30,0,0],i*4);attributes[i]=1;ids[i]=i+1;}
  return {version:1,width:160,height:100,count:n,nextId:n+1,frame:1,clock:0,
    ...Object.fromEntries(Object.entries({state,attributes,ids,bonds,anchors,walls:new Uint8Array(64000),wires:new Uint8Array(16000)}).map(([k,a])=>[k,F.encode(a)])),
    settings:{grav:0,speed:1,view:0,edge:true},machines:{rotors:Array(64).fill(null),lights:Array(64).fill(null),gates:[],signals:[],clock:0},
    player:{name:'Player',active:true,x:80,y:20,vx:0,vy:0,face:1,ground:false,wet:false,wasUp:false,phase:0}};
};
