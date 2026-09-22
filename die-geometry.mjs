import * as THREE from 'three';

// Intersection of one sphere with six planes at equal distance from its centre.
// R < sqrt(2)*h keeps adjacent circular cuts apart; 1.395 leaves a narrow bridge.
export function makeDieGeometry(size, mobile = false) {
  const h = size / 2;
  const radius = h * 1.395;
  const faceRadius = Math.sqrt(radius * radius - h * h);
  const angles = mobile ? 96 : 128;
  const diskRings = mobile ? 24 : 32;
  const sphereRings = mobile ? 6 : 8;
  const positions = [], normals = [], uvs = [], indices = [], sphereVertices = [];
  // Material order and texture orientation match the existing values: 1,6,2,5,3,4.
  const faces = [
    [[1,0,0],[0,0,-1],[0,-1,0]], [[-1,0,0],[0,0,1],[0,-1,0]],
    [[0,1,0],[1,0,0],[0,0,1]], [[0,-1,0],[1,0,0],[0,0,-1]],
    [[0,0,1],[1,0,0],[0,-1,0]], [[0,0,-1],[-1,0,0],[0,-1,0]],
  ];
  const geometry = new THREE.BufferGeometry();
  faces.forEach(([normal, u, v], material) => {
    const start = indices.length;
    function vertex(a, b, depth, spherical) {
      const index = positions.length / 3;
      const point = normal.map((n,k) => n*depth + u[k]*a + v[k]*b);
      positions.push(...point);
      normals.push(...(spherical ? point.map(x=>x/radius) : normal));
      uvs.push(0.5+a/size, 0.5-b/size);
      if (spherical) sphereVertices.push(index);
      return index;
    }
    function ring(r, depth, spherical) {
      return Array.from({length:angles}, (_,j)=>{
        const angle=j*Math.PI*2/angles;
        return vertex(Math.cos(angle)*r, Math.sin(angle)*r, depth, spherical);
      });
    }
    function join(inner, outer) {
      for(let j=0;j<angles;j++) {
        const next=(j+1)%angles;
        indices.push(inner[j],inner[next],outer[j],inner[next],outer[next],outer[j]);
      }
    }
    const center=vertex(0,0,h,false);
    let previous;
    for(let row=1;row<=diskRings;row++) {
      const current=ring(faceRadius*row/diskRings,h,false);
      if(previous) join(previous,current);
      else for(let j=0;j<angles;j++) indices.push(center,current[(j+1)%angles],current[j]);
      previous=current;
    }
    // Separate normals at the circular cut: the face stays flat, the remaining
    // surface has true radial sphere normals, including across material seams.
    const cutAngle=Math.acos(h/radius);
    for(let row=0;row<=sphereRings;row++) {
      const current=Array.from({length:angles},(_,j)=>{
        const angle=j*Math.PI*2/angles, c=Math.cos(angle), s=Math.sin(angle);
        const edgeAngle=Math.atan(1/Math.max(Math.abs(c),Math.abs(s)));
        const polar=cutAngle+(edgeAngle-cutAngle)*row/sphereRings;
        return vertex(radius*Math.sin(polar)*c,radius*Math.sin(polar)*s,radius*Math.cos(polar),true);
      });
      if(row>0) join(previous,current);
      previous=current;
    }
    geometry.addGroup(start,indices.length-start,material);
  });
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.userData.cutSphere={radius,cutDistance:h,faceRadius};
  geometry.userData.sphereVertices=sphereVertices;
  geometry.computeBoundingSphere();
  return geometry;
}

// Pip carving recalculates normals. Restore exact radial normals only on the
// curved patches; leave the carved circular faces and their indentation intact.
export function restoreSphereNormals(geometry) {
  const p=geometry.attributes.position, n=geometry.attributes.normal;
  const radius=geometry.userData.cutSphere.radius;
  for(const i of geometry.userData.sphereVertices) n.setXYZ(i,p.getX(i)/radius,p.getY(i)/radius,p.getZ(i)/radius);
  n.needsUpdate=true;
}
