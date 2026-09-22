import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeDieGeometry,restoreSphereNormals} from '../die-geometry.mjs';

for(const mobile of [false,true]) test(`afgesneden bol: zes gelijke cirkels met gescheiden randen (${mobile?'touch':'desktop'})`,()=>{
  const geometry=makeDieGeometry(0.36,mobile);
  const {radius,cutDistance:h,faceRadius}=geometry.userData.cutSphere;
  assert.ok(radius>h && radius<Math.SQRT2*h);
  assert.ok(Math.abs(faceRadius**2+h**2-radius**2)<1e-12);
  assert.ok(Math.PI/2-2*Math.acos(h/radius)>0, 'aangrenzende cirkelvlakken raken elkaar niet');
  assert.equal(geometry.groups.length,6);
  assert.ok(geometry.groups.every(g=>g.count===geometry.groups[0].count));
  const curved=new Set(geometry.userData.sphereVertices);
  const p=geometry.attributes.position;
  const capCounts=[0,0,0,0,0,0];
  for(let i=0;i<p.count;i++) {
    const xyz=[p.getX(i),p.getY(i),p.getZ(i)];
    const length=Math.hypot(...xyz);
    assert.ok(Math.max(...xyz.map(Math.abs))<=h+2e-8);
    if(curved.has(i)) assert.ok(Math.abs(length-radius)<2e-8,'alle gebogen vertices liggen op dezelfde bol');
    else {
      const axis=xyz.findIndex(x=>Math.abs(Math.abs(x)-h)<2e-8);
      assert.notEqual(axis,-1,'ieder vlakpunt ligt op een van de zes snijvlakken');
      capCounts[axis*2+(xyz[axis]<0?1:0)]++;
      assert.ok(Math.sqrt(Math.max(0,length**2-h*h))<=faceRadius+2e-8);
    }
  }
  assert.ok(capCounts.every(count=>count===capCounts[0] && count>0));
  const index=geometry.index.array;
  for(let i=0;i<index.length;i+=3) {
    const points=Array.from(index.slice(i,i+3),j=>[p.getX(j),p.getY(j),p.getZ(j)]);
    const [a,b,c]=points;
    const u=b.map((x,k)=>x-a[k]), v=c.map((x,k)=>x-a[k]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(normal.reduce((sum,x,k)=>sum+x*a[k],0)>0,'iedere driehoek is niet-ontaard en naar buiten gericht');
  }
  geometry.computeVertexNormals();restoreSphereNormals(geometry);
  for(const i of curved) assert.ok(Math.abs(geometry.attributes.normal.getX(i)-p.getX(i)/radius)<1e-7);
  geometry.dispose();
});
