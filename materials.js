import * as THREE from 'three';

// Fixed texture seed: visual changes never consume the random stream of a throw.
function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function texture(canvas, color = false, repeat = [1, 1]) {
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(...repeat);
  map.anisotropy = 8;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function makeSurface(kind) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const height = canvas.cloneNode();
  const hctx = height.getContext('2d');
  const colorData = ctx.createImageData(size, size);
  const heightData = hctx.createImageData(size, size);
  const rand = randomGenerator(kind === 'felt' ? 41 : 137);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const noise = rand() - 0.5;
      let rgb, relief;
      if (kind === 'felt') {
        const weave = Math.sin(x * Math.PI / 2) * Math.cos(y * Math.PI / 2);
        const value = noise * 6 + weave;
        rgb = [19 + value * 0.35, 62 + value, 47 + value * 0.7];
        relief = 128 + noise * 65 + weave * 15;
      } else {
        const bend = Math.sin(x * Math.PI * 4 / size) * 5 + Math.sin(x * Math.PI * 12 / size) * 1.5;
        const grain = Math.sin(y * Math.PI * 48 / size + bend);
        const fine = Math.sin(y * Math.PI * 192 / size + bend * 3);
        const value = grain * 5 + fine * 2 + noise * 3;
        rgb = [74 + value, 40 + value * 0.65, 23 + value * 0.4];
        relief = 128 + grain * 20 + fine * 8 + noise * 10;
      }
      colorData.data.set([...rgb, 255], i);
      heightData.data.set([relief, relief, relief, 255], i);
    }
  }
  ctx.putImageData(colorData, 0, 0);
  hctx.putImageData(heightData, 0, 0);
  const repeat = kind === 'felt' ? [7, 7] : [8, 1];
  return { map: texture(canvas, true, repeat), bumpMap: texture(height, false, repeat) };
}

export function addTableDetails(group) {
  const brass = new THREE.MeshStandardMaterial({ color: 0x9c7740, metalness: 0.82, roughness: 0.32 });
  for (const radius of [2.065, 2.285]) {
    const trim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 8, 128), brass);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.068;
    group.add(trim);
  }
  // Fine stitched border in the baize, below the physical rolling area.
  const stitchMaterial = new THREE.MeshStandardMaterial({ color: 0x829381, roughness: 1 });
  const stitchGeometry = new THREE.CylinderGeometry(0.0015, 0.0015, 0.012, 4);
  const stitches = new THREE.InstancedMesh(stitchGeometry, stitchMaterial, 320);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 320; i++) {
    const angle = i * Math.PI * 2 / 320;
    dummy.position.set(Math.cos(angle) * 2.025, 0.042, Math.sin(angle) * 2.025);
    dummy.rotation.set(Math.PI / 2, 0, -angle);
    dummy.updateMatrix();
    stitches.setMatrixAt(i, dummy.matrix);
  }
  group.add(stitches);
  // The original simulation has a front stop at z=.55. Make it visible,
  // so a collision no longer looks like a bounce against empty space.
  const front = new THREE.Mesh(new THREE.BoxGeometry(4.12, 0.13, 0.08),
    new THREE.MeshPhysicalMaterial({ ...makeSurface('wood'), roughness: 0.38,
      bumpScale: 0.001, clearcoat: 0.35, clearcoatRoughness: 0.3 }));
  front.position.set(0, 0.045, 0.59);
  front.castShadow = front.receiveShadow = true;
  group.add(front);
}
