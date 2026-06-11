// Headless physics-testharnas voor de dobbelsteen-physics van duizenden-3d.
//
// Repliceert de cannon-es wereld + worp-pipeline uit index.html 1-op-1 (zonder
// rendering) en meet over duizenden gesimuleerde worpen:
//   - natCocked    : % stenen dat bij eerste natuurlijke rust scheef/leunend ligt
//   - rerollThrows : % worpen waarin een topple/hop-correctie nodig was
//   - snap         : % stenen dat uiteindelijk de settle-tween (eind-garantie) nodig had
//   - dead         : % stenen met < 2,5 rad totale rotatie vóór rust ("dode" worp)
//   - settle-tijden, en een chi²-toets over de zes uitkomsten (eerlijkheid)
//
// Gebruik:
//   npm install cannon-es@0.20.0          # eenmalig, in deze map of hoger
//   node tools/physics-harness.mjs 2000   # aantal worpen (default 1000)
//
// LET OP: de DEFAULTS hieronder spiegelen de constanten in index.html.
// Wijzig je daar physics-parameters, werk ze dan ook hier bij — anders
// valideert de harnas een andere wereld dan het spel.
import * as CANNON from 'cannon-es';

export const DEFAULTS = {
  DICE_SIZE: 0.36,
  FELT_TOP_Y: 0.04,
  RAIL_R: 2.05,
  FRONT_Z: 0.55,
  RAIL_SEGMENTS: 24,
  DICE_COUNT: 6,
  DICE_CHAMFER: 0.94,

  gravity: 9.82,
  solverIterations: 14,
  defStiffness: 1e8,
  defRelaxation: 3,
  defRestitution: 0.35,
  defFriction: 0.35,

  feltFriction: 0.40,  feltRestitution: 0.28,
  diceFriction: 0.28,  diceRestitution: 0.45,
  wallFriction: 0.40,  wallRestitution: 0.65,

  mass: 0.18,
  linearDamping: 0.14,
  angularDamping: 0.28,
  sleepSpeedLimit: 0.15,
  sleepTimeLimit: 0.3,

  // worp-spawn (zie Renderer3D.rollDice)
  spawnSlotDx: 0.60,
  spawnYBase: 1.00,
  spawnYStagger: 0.20,
  spawnYJitter: 0.18,
  spawnZ: 0.02,
  spawnZJitter: 0.43,
  velXSpread: 1.8,
  velYBase: -0.3, velYJitter: 0.2,
  velZBase: -0.5, velZJitter: 0.3,
  spinBase: 8, spinJitter: 6,

  // stabilizing torque
  STABILIZE_KP: 0.07,
  STABILIZE_SKIP_TILT: 0.995,
  stabilizeMaxY: null, // = FELT_TOP_Y + DICE_SIZE*1.2 indien null

  // settle-pipeline
  TILT_THRESHOLD: 0.82,
  FLAT_THRESHOLD: 0.985,
  MAX_REROLLS: 3,
  REST_DELAY_S: 0.05,
  ROLL_BUDGET_S: 8.0,

  // correcties: eerst natuurlijke topple, op de laatste poging een hop
  rerollInward: 0.55,
  rerollNeighborPush: 1.2,
  rerollUpVel: 1.0,
  rerollSpin: 22,
  rerollToppleSpin: 8.0,
  rerollToppleShove: 0.7,
  rerollToppleLift: 0.35,
};

const faceNormals = [
  { n: [ 1, 0, 0], v: 1 },
  { n: [-1, 0, 0], v: 6 },
  { n: [ 0, 1, 0], v: 2 },
  { n: [ 0,-1, 0], v: 5 },
  { n: [ 0, 0, 1], v: 3 },
  { n: [ 0, 0,-1], v: 4 },
].map(f => ({ n: new CANNON.Vec3(...f.n), v: f.v }));

function buildChamferedBoxShape(halfSize, chamferFactor) {
  const h = halfSize, c = chamferFactor;
  const C = [
    [-h,-h,-h],[+h,-h,-h],[-h,+h,-h],[+h,+h,-h],
    [-h,-h,+h],[+h,-h,+h],[-h,+h,+h],[+h,+h,+h],
  ];
  const FACES = [
    { axis:0, sign:-1, corners:[0,4,6,2] },
    { axis:0, sign:+1, corners:[1,3,7,5] },
    { axis:1, sign:-1, corners:[0,1,5,4] },
    { axis:1, sign:+1, corners:[2,6,7,3] },
    { axis:2, sign:-1, corners:[0,2,3,1] },
    { axis:2, sign:+1, corners:[4,5,7,6] },
  ];
  const verts = [];
  const cornerToVert = new Array(8).fill(null).map(() => ({}));
  FACES.forEach((face, fIdx) => {
    const cx = face.axis===0 ? face.sign*h : 0;
    const cy = face.axis===1 ? face.sign*h : 0;
    const cz = face.axis===2 ? face.sign*h : 0;
    face.corners.forEach(cIdx => {
      const o = C[cIdx];
      verts.push(new CANNON.Vec3(cx+(o[0]-cx)*c, cy+(o[1]-cy)*c, cz+(o[2]-cz)*c));
      cornerToVert[cIdx][fIdx] = verts.length-1;
    });
  });
  const faceLists = [];
  FACES.forEach((face, fIdx) => faceLists.push(face.corners.map(ci => cornerToVert[ci][fIdx])));
  for (let fA=0; fA<6; fA++) for (let fB=fA+1; fB<6; fB++) {
    if (FACES[fA].axis === FACES[fB].axis) continue;
    const shared = FACES[fA].corners.filter(ci => FACES[fB].corners.includes(ci));
    if (shared.length !== 2) continue;
    faceLists.push([cornerToVert[shared[0]][fA], cornerToVert[shared[1]][fA],
                    cornerToVert[shared[1]][fB], cornerToVert[shared[0]][fB]]);
  }
  for (let cIdx=0; cIdx<8; cIdx++) {
    const fs = Object.keys(cornerToVert[cIdx]).map(Number);
    if (fs.length === 3) faceLists.push(fs.map(fi => cornerToVert[cIdx][fi]));
  }
  const fixed = faceLists.map(face => {
    const v0=verts[face[0]], v1=verts[face[1]], v2=verts[face[2]];
    const ex=v1.x-v0.x, ey=v1.y-v0.y, ez=v1.z-v0.z;
    const fx=v2.x-v0.x, fy=v2.y-v0.y, fz=v2.z-v0.z;
    const nx=ey*fz-ez*fy, ny=ez*fx-ex*fz, nz=ex*fy-ey*fx;
    let cx=0,cy=0,cz=0;
    for (const i of face){ cx+=verts[i].x; cy+=verts[i].y; cz+=verts[i].z; }
    cx/=face.length; cy/=face.length; cz/=face.length;
    return (nx*cx+ny*cy+nz*cz)<0 ? face.slice().reverse() : face;
  });
  return new CANNON.ConvexPolyhedron({ vertices: verts, faces: fixed });
}

export function makeWorld(cfg = {}) {
  const C = { ...DEFAULTS, ...cfg };
  if (C.stabilizeMaxY == null) C.stabilizeMaxY = C.FELT_TOP_Y + C.DICE_SIZE*1.2;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -C.gravity, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = C.solverIterations;
  world.defaultContactMaterial.contactEquationStiffness = C.defStiffness;
  world.defaultContactMaterial.contactEquationRelaxation = C.defRelaxation;
  world.defaultContactMaterial.restitution = C.defRestitution;
  world.defaultContactMaterial.friction = C.defFriction;

  const feltCMat = new CANNON.Material('felt');
  const diceCMat = new CANNON.Material('dice');
  const wallCMat = new CANNON.Material('wall');
  world.addContactMaterial(new CANNON.ContactMaterial(feltCMat, diceCMat, {
    friction: C.feltFriction, restitution: C.feltRestitution,
    contactEquationStiffness: C.defStiffness, contactEquationRelaxation: C.defRelaxation }));
  world.addContactMaterial(new CANNON.ContactMaterial(diceCMat, diceCMat, {
    friction: C.diceFriction, restitution: C.diceRestitution,
    contactEquationStiffness: C.defStiffness, contactEquationRelaxation: C.defRelaxation }));
  world.addContactMaterial(new CANNON.ContactMaterial(wallCMat, diceCMat, {
    friction: C.wallFriction, restitution: C.wallRestitution,
    contactEquationStiffness: C.defStiffness, contactEquationRelaxation: C.defRelaxation }));

  const ground = new CANNON.Body({ mass:0, material:feltCMat, shape:new CANNON.Plane() });
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
  ground.position.set(0, C.FELT_TOP_Y, 0);
  world.addBody(ground);

  const front = new CANNON.Body({ mass:0, material:wallCMat, shape:new CANNON.Plane() });
  front.position.set(0, C.FELT_TOP_Y, C.FRONT_Z);
  front.quaternion.setFromVectors(new CANNON.Vec3(0,0,1), new CANNON.Vec3(0,0,-1));
  world.addBody(front);

  for (let i=0;i<C.RAIL_SEGMENTS;i++){
    const a = (i/C.RAIL_SEGMENTS)*Math.PI*2;
    const x = Math.cos(a)*C.RAIL_R, z = Math.sin(a)*C.RAIL_R;
    const b = new CANNON.Body({ mass:0, material:wallCMat, shape:new CANNON.Plane() });
    b.position.set(x, C.FELT_TOP_Y, z);
    b.quaternion.setFromVectors(new CANNON.Vec3(0,0,1), new CANNON.Vec3(-Math.cos(a),0,-Math.sin(a)));
    world.addBody(b);
  }

  const diceBodies = [];
  const shape = buildChamferedBoxShape(C.DICE_SIZE/2, C.DICE_CHAMFER);
  for (let i=0;i<C.DICE_COUNT;i++){
    const b = new CANNON.Body({
      mass: C.mass, material: diceCMat, shape,
      linearDamping: C.linearDamping, angularDamping: C.angularDamping,
      allowSleep: true, sleepSpeedLimit: C.sleepSpeedLimit, sleepTimeLimit: C.sleepTimeLimit,
    });
    b.position.set(0, -20-i, 0);
    b.type = CANNON.Body.STATIC;
    world.addBody(b);
    diceBodies.push(b);
  }
  return { world, diceBodies, C };
}

const _up = new CANNON.Vec3(0,1,0);
function topFaceTilt(body){
  let best=-Infinity;
  for (const f of faceNormals){ const d = body.quaternion.vmult(f.n).dot(_up); if (d>best) best=d; }
  return best;
}
function topFaceValue(body){
  let best=-Infinity, val=0;
  for (const f of faceNormals){ const d = body.quaternion.vmult(f.n).dot(_up); if (d>best){best=d; val=f.v;} }
  return val;
}
const _cl = new CANNON.Vec3(), _cw = new CANNON.Vec3();
function lowestCornerY(body, DICE_SIZE){
  const half = DICE_SIZE/2; let minY=Infinity;
  for (let sx=-1;sx<=1;sx+=2) for (let sy=-1;sy<=1;sy+=2) for (let sz=-1;sz<=1;sz+=2){
    _cl.set(sx*half, sy*half, sz*half);
    body.quaternion.vmult(_cl, _cw);
    const wy = body.position.y + _cw.y;
    if (wy<minY) minY=wy;
  }
  return minY;
}

export function makeClassifiers(C){
  const isOnFloor = b => lowestCornerY(b, C.DICE_SIZE) < C.FELT_TOP_Y + C.DICE_SIZE*0.12;
  const isFullyStacked = b => topFaceTilt(b) >= C.TILT_THRESHOLD && lowestCornerY(b, C.DICE_SIZE) > C.FELT_TOP_Y + C.DICE_SIZE*0.5;
  const isFullyFlat = b => isOnFloor(b) && topFaceTilt(b) >= C.FLAT_THRESHOLD;
  return { isOnFloor, isFullyStacked, isFullyFlat, topFaceTilt, topFaceValue };
}

function randomUniformQuaternion(out){
  const u1=Math.random(),u2=Math.random(),u3=Math.random();
  const s1=Math.sqrt(1-u1), s2=Math.sqrt(u1);
  out.set(s1*Math.sin(2*Math.PI*u2), s1*Math.cos(2*Math.PI*u2),
          s2*Math.sin(2*Math.PI*u3), s2*Math.cos(2*Math.PI*u3));
  return out;
}
function randomUnitVec3(){
  let x1,x2,s;
  do { x1=Math.random()*2-1; x2=Math.random()*2-1; s=x1*x1+x2*x2; } while (s>=1);
  const f=2*Math.sqrt(1-s);
  return [x1*f, x2*f, 1-2*s];
}

export function makeStabilizer(C){
  return function applyStabilizingTorque(body){
    if (body.type !== CANNON.Body.DYNAMIC) return;
    if (body.sleepState !== CANNON.Body.AWAKE) return;
    if (body.position.y > C.stabilizeMaxY) return;
    let bestDot=-Infinity, bx=0,bz=0;
    for (const f of faceNormals){
      const wn = body.quaternion.vmult(f.n);
      const d = wn.dot(_up);
      if (d>bestDot){ bestDot=d; bx=wn.x; bz=wn.z; }
    }
    if (bestDot >= C.STABILIZE_SKIP_TILT) return;
    const axX=-bz, axZ=bx;
    const sinLen=Math.hypot(axX,axZ);
    if (sinLen<1e-4) return;
    const angleErr=Math.acos(Math.max(-1,Math.min(1,bestDot)));
    const T=C.STABILIZE_KP*angleErr/sinLen;
    body.torque.x += axX*T;
    body.torque.z += axZ*T;
  };
}

// Eén volledige 6-stenen-worp; geeft metrics terug.
export function runThrow(ctx){
  const { world, diceBodies, C } = ctx;
  const cl = makeClassifiers(C);
  const stabilize = ctx._stabilize || (ctx._stabilize = makeStabilizer(C));
  const indices = diceBodies.map((_,i)=>i);

  if (!ctx._preStepAttached){
    ctx._rollActive = { v:false };
    world.addEventListener('preStep', () => {
      if (!ctx._rollActive.v) return;
      for (const b of diceBodies) stabilize(b);
    });
    ctx._preStepAttached = true;
  }

  diceBodies.forEach((b,k)=>{
    b.type = CANNON.Body.DYNAMIC;
    b.wakeUp();
    const slotX = (k-(indices.length-1)/2)*C.spawnSlotDx;
    b.position.set(
      slotX+(Math.random()-0.5)*0.06,
      C.FELT_TOP_Y + C.spawnYBase + k*C.spawnYStagger + Math.random()*C.spawnYJitter,
      C.spawnZ + (Math.random()-0.5)*C.spawnZJitter);
    randomUniformQuaternion(b.quaternion);
    b.velocity.set((Math.random()-0.5)*C.velXSpread,
                   C.velYBase - Math.random()*C.velYJitter,
                   C.velZBase - Math.random()*C.velZJitter);
    const [ax,ay,az]=randomUnitVec3();
    const spin = C.spinBase + Math.random()*C.spinJitter;
    b.angularVelocity.set(ax*spin, ay*spin, az*spin);
  });
  ctx._rollActive.v = true;

  const dt = 1/60;
  let simTime = 0, restTimer = 0;
  const rerollAttempts = new Map();
  let naturalState = null;
  let rerollEvents = 0;
  const rotAccum = new Array(C.DICE_COUNT).fill(0);
  const firstSleepSeen = new Array(C.DICE_COUNT).fill(false);

  function rerollDice(body, attempts){
    body.type = CANNON.Body.DYNAMIC;
    let dx=-body.position.x, dz=-body.position.z;
    let nd2=Infinity, nearest=null;
    for (const j of indices){
      const o=diceBodies[j]; if (o===body) continue;
      const ox=body.position.x-o.position.x, oz=body.position.z-o.position.z;
      const d2=ox*ox+oz*oz;
      if (d2<nd2){ nd2=d2; nearest=o; }
    }
    const NEAR_R = C.DICE_SIZE*1.6;
    if (nearest && nd2 < NEAR_R*NEAR_R){
      const d=Math.sqrt(nd2)||1e-3;
      dx += ((body.position.x-nearest.position.x)/d)*C.rerollNeighborPush;
      dz += ((body.position.z-nearest.position.z)/d)*C.rerollNeighborPush;
    }
    const len=Math.hypot(dx,dz)||1e-3; dx/=len; dz/=len;

    if (attempts < C.MAX_REROLLS - 1){
      // natuurlijke topple (zie rerollDice in index.html)
      let bestDot=-Infinity, bx=0,bz=0;
      for (const f of faceNormals){
        const wn = body.quaternion.vmult(f.n);
        if (wn.y>bestDot){ bestDot=wn.y; bx=wn.x; bz=wn.z; }
      }
      let axX=-bz, axZ=bx;
      const al=Math.hypot(axX,axZ)||1e-3; axX/=al; axZ/=al;
      const W=C.rerollToppleSpin;
      body.velocity.set(dx*C.rerollToppleShove+(Math.random()-0.5)*0.12,
                        C.rerollToppleLift,
                        dz*C.rerollToppleShove+(Math.random()-0.5)*0.12);
      body.angularVelocity.set(axX*W+(Math.random()-0.5)*1.5,
                               (Math.random()-0.5)*1.5,
                               axZ*W+(Math.random()-0.5)*1.5);
      body.wakeUp();
      return;
    }
    body.velocity.set(dx*C.rerollInward+(Math.random()-0.5)*0.35,
                      C.rerollUpVel+Math.random()*0.3,
                      dz*C.rerollInward+(Math.random()-0.5)*0.35);
    body.angularVelocity.set((Math.random()-0.5)*C.rerollSpin,
                             (Math.random()-0.5)*C.rerollSpin,
                             (Math.random()-0.5)*C.rerollSpin);
    body.wakeUp();
  }

  let finalized=false;
  while (!finalized){
    for (let i=0;i<C.DICE_COUNT;i++){
      if (!firstSleepSeen[i]){
        rotAccum[i] += diceBodies[i].angularVelocity.length()*dt;
        if (diceBodies[i].sleepState === CANNON.Body.SLEEPING) firstSleepSeen[i]=true;
      }
    }
    world.step(dt);
    simTime += dt;

    if (simTime > C.ROLL_BUDGET_S){ finalized=true; break; }
    let allRest=true;
    for (const i of indices) if (diceBodies[i].sleepState !== CANNON.Body.SLEEPING){ allRest=false; break; }
    if (allRest){
      restTimer += dt;
      if (restTimer > C.REST_DELAY_S){
        if (!naturalState){
          naturalState = indices.map(i=>{
            const b=diceBodies[i];
            return { i, flat: cl.isFullyFlat(b), stacked: cl.isFullyStacked(b) };
          });
        }
        let anyReroll=false;
        for (const i of indices){
          const b=diceBodies[i];
          if (cl.isFullyFlat(b)) continue;
          if (cl.isFullyStacked(b)) continue;
          const at = rerollAttempts.get(i)||0;
          if (at >= C.MAX_REROLLS) continue;
          rerollDice(b, at); rerollAttempts.set(i, at+1); anyReroll=true; rerollEvents++;
        }
        if (anyReroll){ restTimer=0; }
        else { finalized=true; }
      }
    } else restTimer=0;
  }

  let snapApplied=0;
  for (const i of indices){
    const b=diceBodies[i];
    if (cl.isFullyStacked(b)) continue;
    if (cl.isFullyFlat(b)) continue;
    snapApplied++;
  }
  const results = indices.map(i=>({
    i, value: cl.topFaceValue(diceBodies[i]),
    flat: cl.isFullyFlat(diceBodies[i]), stacked: cl.isFullyStacked(diceBodies[i]),
  }));

  ctx._rollActive.v = false;
  for (const b of diceBodies){ b.type=CANNON.Body.STATIC; b.velocity.setZero(); b.angularVelocity.setZero(); b.position.set(0,-50,0); }

  const natCocked = naturalState ? naturalState.filter(s=>!s.flat && !s.stacked).length : results.filter(r=>!r.flat&&!r.stacked).length;
  const natStacked = naturalState ? naturalState.filter(s=>s.stacked).length : results.filter(r=>r.stacked).length;
  const deadLandings = rotAccum.filter(r=>r<2.5).length;

  return {
    simTime, rerollEvents, snapApplied, natCocked, natStacked,
    values: results.map(r=>r.value),
    finalStacked: results.filter(r=>r.stacked).length,
    deadLandings,
  };
}

export function runBatch(cfg = {}, n = 1000){
  const ctx = makeWorld(cfg);
  const agg = {
    throws:0, sumSim:0, maxSim:0,
    rerollThrows:0, sumReroll:0,
    snapDice:0, natCockedDice:0, natStackedDice:0,
    deadDice:0, finalStackedDice:0,
    faceCounts:[0,0,0,0,0,0,0],
    slowThrows:0,
  };
  for (let t=0;t<n;t++){
    const r = runThrow(ctx);
    agg.throws++;
    agg.sumSim += r.simTime; if (r.simTime>agg.maxSim) agg.maxSim=r.simTime;
    if (r.simTime>4.0) agg.slowThrows++;
    if (r.rerollEvents>0) agg.rerollThrows++;
    agg.sumReroll += r.rerollEvents;
    agg.snapDice += r.snapApplied;
    agg.natCockedDice += r.natCocked;
    agg.natStackedDice += r.natStacked;
    agg.deadDice += r.deadLandings;
    agg.finalStackedDice += r.finalStacked;
    for (const v of r.values) agg.faceCounts[v]++;
  }
  const totalFaces = agg.throws*6;
  const exp = totalFaces/6;
  let chi2=0;
  for (let v=1;v<=6;v++){ const o=agg.faceCounts[v]; chi2 += (o-exp)*(o-exp)/exp; }
  agg.chi2 = chi2;
  agg.meanSim = agg.sumSim/agg.throws;
  agg.natCockedPct = 100*agg.natCockedDice/totalFaces;
  agg.natStackedPct = 100*agg.natStackedDice/totalFaces;
  agg.snapPct = 100*agg.snapDice/totalFaces;
  agg.deadPct = 100*agg.deadDice/totalFaces;
  agg.finalStackedPct = 100*agg.finalStackedDice/totalFaces;
  agg.rerollThrowPct = 100*agg.rerollThrows/agg.throws;
  agg.slowThrowPct = 100*agg.slowThrows/agg.throws;
  return agg;
}

export function fmt(label, agg){
  return [
    `${label}`,
    `  throws=${agg.throws}  meanSettle=${agg.meanSim.toFixed(2)}s  maxSettle=${agg.maxSim.toFixed(2)}s  slow(>4s)=${agg.slowThrowPct.toFixed(1)}%`,
    `  natCocked=${agg.natCockedPct.toFixed(2)}%  natStacked=${agg.natStackedPct.toFixed(2)}%  (per steen, bij eerste natuurlijke rust)`,
    `  rerollThrows=${agg.rerollThrowPct.toFixed(1)}%  snap(tween)=${agg.snapPct.toFixed(2)}%  dead(<2.5rad)=${agg.deadPct.toFixed(2)}%`,
    `  finalStacked=${agg.finalStackedPct.toFixed(2)}%`,
    `  eerlijkheid chi²=${agg.chi2.toFixed(1)} (kritiek 11.07 @ df5, p=.05)  faces=[${agg.faceCounts.slice(1).join(',')}]`,
  ].join('\n');
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = parseInt(process.argv[2] || '1000', 10);
  console.log(`Simuleer ${n} worpen met de huidige spel-parameters...`);
  const t0 = Date.now();
  console.log(fmt(`Resultaat (n=${n})`, runBatch({}, n)));
  console.log(`(${((Date.now()-t0)/1000).toFixed(1)}s)`);
}
