/**
 * PokéStop / Gym / Power Spot — the game's own map props (GLB) with their
 * animations and FX, for the 3D simulation.
 *
 * Ported from pogodpu-web (src/utils/poi3d.ts, poiParticles.ts,
 * powerSpotVortex.ts) to three.js r128 globals. The look is fixed to:
 *   PokéStop  — blue (not spun)
 *   Gym       — neutral team, no raid, tier 2 in-range loop
 *   Power Spot — Max Battle active (vortex + Max Particle), no icon / timer
 *
 * Materials are the game's Niantic BRDF shader, transcribed from the
 * decompiled GLSL, working in the game's gamma space (the renderer's output
 * is linear in r128, so nothing converts the colour again):
 *
 *   ramp  = Ramp2D(N·V, (N·L·0.5 + 0.5)·0.9)
 *   base  = clamp(mix(Ambient, Diffuse, ramp.g) + ramp.a·RimBottom·2·RimBottom.a)
 *   spec  = ramp.b·Spec·2·Spec.a + ramp.r·RimTop·2·RimTop.a
 *   color = (spec·RimLightAmount + base) · MainTex · (N·L·wrap + 1 − wrap) · Blend
 *
 * Each prop is loaded and dressed once as a template; every spot on the map
 * is a SkeletonUtils clone sharing its geometry, materials and FX buffers, so
 * the particles are simulated once per template no matter how many spots.
 */
const CA_PoiModels = (() => {
    const BASE = 'models/poi/';
    const TEX = BASE + 'tex/';
    // Off by request: the gym's topper spotlights and the Power Spot's Max
    // Particle (orbs, sparkles, trails). The vortex disc stays on.
    const SHOW_GYM_LIGHTS = false;
    const SHOW_POWERSPOT_PARTICLES = false;

    const MODELS = {
        pokestop:  { file: 'pokestop.glb',  clip: 'PokestopIdle' },
        gym:       { file: 'gym.glb',       clip: 'Tier 2 (In Range)' },
        powerspot: { file: 'powerspot.glb', clip: 'Power Spot Idle' },
    };

    // View-space key light, as the pogodpu viewer's VIEW_KEY_LIGHT.
    const keyLight = () => ({
        dir:  { value: new THREE.Vector3(0.45, 0.6, 0.66).normalize() },
        tint: { value: new THREE.Color(1, 1, 1) },
    });

    // ── Shaders ──────────────────────────────────────────────────────────────
    const BRDF_VERTEX = `
#include <common>
#include <skinning_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vUv = uv;
  vNormalView = normalize(transformedNormal);
  vViewDir = normalize(-mvPosition.xyz);
}`;

    const BRDF_FRAGMENT = `
uniform sampler2D uRamp;
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uDiff, uAmbn, uSpec, uRimt, uRimb, uColorShift;
uniform float uSpecW, uRimtW, uRimbW, uBlend, uRimLt, uWrap, uRimColorBoost;
uniform vec3 uKeyDir;
uniform vec3 uKeyTint;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  vec3 n = normalize(vNormalView);
  if (!gl_FrontFacing) n = -n;
  float ndv = clamp(dot(n, normalize(vViewDir)), 0.0, 1.0);
  float ndl = dot(n, normalize(uKeyDir));
  vec4 r = texture2D(uRamp, vec2(ndv, (ndl * 0.5 + 0.5) * 0.9));
  vec3 specColor = uSpec * (vec3(1.0) + uSpec * uRimColorBoost);
  vec3 rimTop = uRimt * (vec3(1.0) + uRimt * uRimColorBoost);
  vec3 rimBottom = uRimb * (vec3(1.0) + uRimb * uRimColorBoost);
  vec3 spec = r.b * specColor * (2.0 * uSpecW) + r.r * rimTop * (2.0 * uRimtW);
  vec3 base = clamp(mix(uAmbn, uDiff, r.g) + r.a * rimBottom * (2.0 * uRimbW), 0.0, 1.0);
  vec3 c = spec * uRimLt + base;
  if (uHasMap > 0.5) c *= texture2D(uMap, vUv).rgb;
  c *= (ndl * uWrap + 1.0 - uWrap) * uBlend * uColorShift * uKeyTint;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

    const POWERSPOT_FX_VERTEX = `
#include <common>
uniform vec3 uHeightAxis;
varying vec2 vUv;
varying vec4 vFxColor;
varying float vLocalHeight;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  vUv = uv;
  vLocalHeight = dot(position, uHeightAxis);
  vFxColor = vec4(1.0);
}`;

    /** Add light without letting overlapping cards accumulate opaque dark halos. */
    const ADDITIVE_FX_OUTPUT = `
void additiveFxOutput(vec3 rgb, float opacity) {
  vec3 light = max(rgb, vec3(0.0)) * clamp(opacity, 0.0, 1.0);
  gl_FragColor = vec4(light, clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0));
}
`;
    const additiveFxBlending = () => ({
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquationAlpha: THREE.MaxEquation,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
    });

    /** NianticCustom/FX/Stencil/Additive: the black areas of the sheet add no light. */
    const POWERSPOT_GLOW_FRAGMENT = ADDITIVE_FX_OUTPUT + `
uniform sampler2D uMap;
uniform float uTint, uAddPower;
varying vec2 vUv;
varying vec4 vFxColor;
void main() {
  vec4 t = texture2D(uMap, vUv) * vFxColor;
  additiveFxOutput(t.rgb * uTint * uAddPower, t.a);
}`;

    /** UnlitTransparentPanningColorMask: Unity UVs scroll down, with a bottom fade. */
    const PANNING_FRAGMENT = `
uniform sampler2D uMap;
uniform float uTime, uSpeed;
varying vec2 vUv;
varying vec4 vFxColor;
varying float vLocalHeight;
void main() {
  vec4 t = texture2D(uMap, vUv + vec2(0.0, uTime * uSpeed));
  t *= vFxColor;
  t.a *= smoothstep(0.0, 3.0, vLocalHeight);
  gl_FragColor = t;
}`;

    // ── Materials ────────────────────────────────────────────────────────────
    // Gamma RGB of the game's materials (Gym: APK `Gym`; PokéStop: MapPokestop
    // colour table, blue; Power Spot: GO Data Map/Bread/Battle materials).
    const GYM_BRDF = {
        diffuse: [1, 1, 1], ambient: [0.478, 0.749, 0.882], spec: [0, 0, 0], specW: 0.5,
        rimTop: [1, 0.886, 0.647], rimTopW: 0.282, rimBottom: [1, 0.886, 0.647], rimBottomW: 0.282, blend: 1.4, rimLight: 2,
    };
    const POKESTOP_BODY = {
        diffuse: [0.078, 0.765, 0.992], ambient: [0.102, 0.196, 0.576], spec: [1, 1, 1], specW: 0.502,
        rimTop: [1, 1, 1], rimTopW: 0.502, rimBottom: [0, 0, 0], rimBottomW: 0.502, blend: 1.31, rimLight: 1,
    };
    const POKESTOP_ALT = {
        diffuse: [0.078, 0.765, 0.992], ambient: [0.102, 0.196, 0.576], spec: [1, 1, 1], specW: 0.502,
        rimTop: [1, 1, 1], rimTopW: 0.502, blend: 1.31, rimLight: 1,
    };
    const POWERSPOT_BRDF = {
        breadStationPOUMat: {
            texture: 'breadStation256Tex.png', diffuse: [1, 1, 1], ambient: [0.8, 0.44, 0.93], spec: [0, 0, 0], specW: 0.5,
            rimTop: [0.68, 1, 0.93], rimTopW: 1, rimBottom: [0.07, 0, 0.47], rimBottomW: 1, blend: 1.54, rimLight: 0.94, rimColorBoost: true,
        },
        breadPOUGrassFieldMat: {
            texture: 'breadStationPOUGrassTex.png', diffuse: [1, 1, 1], ambient: [0.62, 0.62, 0.62], spec: [0, 0, 0], specW: 0.5,
            rimTop: [0.4, 0.4, 0.4], rimTopW: 1, rimBottom: [0.09, 0.19, 0.17], rimBottomW: 1, blend: 0.737, rimLight: 0.5, rimColorBoost: true,
        },
    };

    /** Gym team sheets (APK T_Gym_1–3); `ca` is the neutral sheet with its
     *  team bands recoloured pink, for Community Ambassador gyms. */
    const GYM_THEME_SHEETS = { mystic: 'T_Gym_1.png', valor: 'T_Gym_2.png', instinct: 'T_Gym_3.png', ca: 'T_Gym_CA.png' };

    /** Gym parts the map prop never shows (battle stadium, team lobby decals). */
    const GYM_HIDDEN = /^(GymStadiumArena|teamFloorDesigns_|lobbyScreen)/;

    const v3 = (c) => new THREE.Vector3(c[0], c[1], c[2]);

    function brdfMaterial(ramp, light, name, p, map, skinning) {
        const uniforms = {
            uRamp: { value: ramp }, uMap: { value: map }, uHasMap: { value: map ? 1 : 0 },
            uDiff: { value: v3(p.diffuse) }, uAmbn: { value: v3(p.ambient) }, uSpec: { value: v3(p.spec || [0, 0, 0]) },
            uRimt: { value: v3(p.rimTop) }, uRimb: { value: v3(p.rimBottom || [0, 0, 0]) }, uColorShift: { value: v3([1, 1, 1]) },
            uSpecW: { value: p.specW || 0 }, uRimtW: { value: p.rimTopW }, uRimbW: { value: p.rimBottomW || 0 },
            uBlend: { value: p.blend }, uRimLt: { value: p.rimLight }, uWrap: { value: p.wrap || 0 },
            uRimColorBoost: { value: p.rimColorBoost ? 1 : 0 },
            uKeyDir: light.dir, uKeyTint: light.tint,
        };
        const material = new THREE.ShaderMaterial({ name, uniforms, vertexShader: BRDF_VERTEX, fragmentShader: BRDF_FRAGMENT });
        material.skinning = !!skinning; // r128: skinned meshes need the flag on the material
        return material;
    }

    // ── Particles (Shuriken FX lifted from the game's prefabs) ───────────────
    // Stateless: every frame each live particle is re-simulated from its birth
    // with a seeded random stream, so a frame depends only on the clock.
    function hash(a, b) {
        let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35);
        h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
        return h >>> 0;
    }
    function rng(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const sampleArr = (k, t) => {
        const f = Math.min(1, Math.max(0, t)) * (k.length - 1);
        const i = Math.floor(f);
        const j = Math.min(k.length - 1, i + 1);
        return k[i] + (k[j] - k[i]) * (f - i);
    };
    function curve(c, t, r, fallback = 0) {
        if (!c) return fallback;
        if ('c' in c) return c.c;
        if ('r' in c) return c.r[0] + (c.r[1] - c.r[0]) * r;
        const a = sampleArr(c.k, t);
        return c.k2 ? sampleArr(c.k2, t) + (a - sampleArr(c.k2, t)) * r : a;
    }
    const curveMax = (c) => ('c' in c ? c.c : 'r' in c ? Math.max(...c.r) : Math.max(...c.k, ...(c.k2 || [])));
    const curveMean = (c) => ('c' in c ? c.c : 'r' in c ? (c.r[0] + c.r[1]) / 2 : c.k.reduce((a, b) => a + b, 0) / c.k.length);
    function sampleGrad(g, t) {
        const f = Math.min(1, Math.max(0, t)) * (g.length - 1);
        const i = Math.floor(f);
        const j = Math.min(g.length - 1, i + 1);
        const u = f - i;
        return [0, 1, 2, 3].map((n) => g[i][n] + (g[j][n] - g[i][n]) * u);
    }
    function color(c, t, r) {
        if (!c) return [1, 1, 1, 1];
        if ('c' in c) return c.c;
        if ('r' in c) return [0, 1, 2, 3].map((n) => c.r[0][n] + (c.r[1][n] - c.r[0][n]) * r);
        if ('gr' in c) return sampleGrad(c.gr, r);
        return sampleGrad(c.g, t);
    }
    const qrot = (q, v) => {
        const [x, y, z, w] = q;
        const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2];
        const iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
        return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    };
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

    /** Spawn point + direction in the system's space (Unity shape types). */
    function spawn(s, R) {
        const sh = s.shape;
        if (!sh) return { p: [0, 0, 0], d: [0, 0, 1] };
        const arc = (sh.arc / 360) * Math.PI * 2;
        const shell = (r) => r * (1 - sh.thickness * (1 - R()));
        let p = [0, 0, 0];
        let d = [0, 0, 1];
        switch (sh.type) {
            case 0: case 1: case 2: case 3: { // sphere / hemisphere (+Z half)
                const u = R() * 2 - 1, phi = R() * Math.PI * 2, k = Math.sqrt(1 - u * u);
                d = [k * Math.cos(phi), k * Math.sin(phi), sh.type >= 2 ? Math.abs(u) : u];
                const r = shell(sh.radius) * (sh.thickness > 0 ? Math.cbrt(R()) : 1);
                p = [d[0] * r, d[1] * r, d[2] * r];
                break;
            }
            case 4: case 7: case 8: case 9: { // cone along +Z
                const phi = R() * arc, f = sh.thickness > 0 ? 1 - sh.thickness * (1 - Math.sqrt(R())) : 1;
                const a = (sh.angle * Math.PI / 180) * f;
                p = [Math.cos(phi) * sh.radius * f, Math.sin(phi) * sh.radius * f, 0];
                d = [Math.cos(phi) * Math.sin(a), Math.sin(phi) * Math.sin(a), Math.cos(a)];
                break;
            }
            case 10: case 11: { // circle in XY, outward
                const phi = R() * arc, f = sh.type === 10 && sh.thickness > 0 ? 1 - sh.thickness * (1 - Math.sqrt(R())) : 1;
                d = [Math.cos(phi), Math.sin(phi), 0];
                p = [d[0] * sh.radius * f, d[1] * sh.radius * f, 0];
                break;
            }
            case 5: case 15: case 16:
                p = [R() - 0.5, R() - 0.5, R() - 0.5];
                break;
            case 12: // single-sided edge: a line across X emitting along +Z
                p = [(R() * 2 - 1) * sh.radius, 0, 0];
                break;
            case 17: { // donut: Power Spot's Max Particle ring, in XY
                const phi = R() * arc, theta = R() * Math.PI * 2;
                const minor = (sh.donutRadius != null ? sh.donutRadius : 0.05) * Math.sqrt(R());
                const radius = sh.radius + minor * Math.cos(theta);
                p = [Math.cos(phi) * radius, Math.sin(phi) * radius, minor * Math.sin(theta)];
                d = [Math.cos(phi), Math.sin(phi), 0];
                break;
            }
            default:
        }
        p = [p[0] * sh.scale[0], p[1] * sh.scale[1], p[2] * sh.scale[2]];
        p = qrot(sh.rotation, p);
        d = norm(qrot(sh.rotation, [d[0] * Math.sign(sh.scale[0] || 1), d[1] * Math.sign(sh.scale[1] || 1), d[2] * Math.sign(sh.scale[2] || 1)]));
        return { p: [p[0] + sh.position[0], p[1] + sh.position[1], p[2] + sh.position[2]], d };
    }

    const STEP = 1 / 30;

    /** One particle at `age`: its pose plus (optionally) its path for trails. */
    function sampleParticle(s, id, age, origin, keepPath) {
        const R = rng(hash(id, 0x51ed));
        const life = curve(s.life, 0, R());
        if (age < 0 || age >= life) return null;
        const { p: p0, d } = spawn(s, R);
        const p = origin ? [p0[0] + origin[0], p0[1] + origin[1], p0[2] + origin[2]] : p0;
        const speed = curve(s.speed, 0, R());
        const v0 = [d[0] * speed, d[1] * speed, d[2] * speed];
        const vel = s.velocity;
        const rv = [R(), R(), R(), R(), R(), R(), R(), R()];
        const grav = curve(s.gravity, 0, R()) * 9.81;
        const rColor = R(), rSize = R(), rSizeY = R(), rRot = R(), rSpin = R(), rFrame = R(), rLifeC = R(), rWidth = R();
        const rSizeZ = R(), rRotY = R();
        const rDrag = R();
        const steps = Math.ceil(age / STEP);
        const dt = steps ? age / steps : 0;
        const path = keepPath ? [[...p]] : null;
        const damp = s.damp ? Math.pow(1 - s.damp.dampen, dt * 30) : 1;
        for (let i = 0; i < steps; i++) {
            const at = ((i + 0.5) * dt) / life;
            const lin = vel ? [curve(vel.x, at, rv[0]), curve(vel.y, at, rv[1]), curve(vel.z, at, rv[2])] : [0, 0, 0];
            const orb = vel ? [curve(vel.orbitalX, at, rv[3]), curve(vel.orbitalY, at, rv[4]), curve(vel.orbitalZ, at, rv[5])] : [0, 0, 0];
            const radial = vel ? curve(vel.radial, at, rv[6]) : 0;
            const mod = vel ? curve(vel.modifier, at, rv[7], 1) : 1;
            const down = s.gravityDirection || [0, -1, 0];
            for (let axis = 0; axis < 3; axis++) v0[axis] += down[axis] * grav * dt;
            if (s.damp && s.damp.drag) {
                let drag = curve(s.damp.drag, (i * dt) / life, rDrag);
                if (s.damp.dragBySize) drag *= curve(s.size, 0, rSize) * curve(s.sizeOverLife, (i * dt) / life, rSize, 1);
                if (s.damp.dragBySpeed) drag *= Math.hypot(...v0);
                const attenuation = 1 / (1 + Math.max(0, drag) * dt);
                v0[0] *= attenuation; v0[1] *= attenuation; v0[2] *= attenuation;
            }
            if (s.damp) {
                const speedNow = Math.hypot(...v0);
                if (speedNow > s.damp.limit) {
                    const factor = (s.damp.limit + (speedNow - s.damp.limit) * damp) / speedNow;
                    v0[0] *= factor; v0[1] *= factor; v0[2] *= factor;
                }
            }
            p[0] += (v0[0] + lin[0]) * mod * dt; p[1] += (v0[1] + lin[1]) * mod * dt; p[2] += (v0[2] + lin[2]) * mod * dt;
            if (orb[0] || orb[1] || orb[2]) {
                const ax = orb[0] * mod * dt, ay = orb[1] * mod * dt, az = orb[2] * mod * dt;
                let [x, y, z] = p;
                if (ax) { const c = Math.cos(ax), sn = Math.sin(ax); [y, z] = [y * c - z * sn, y * sn + z * c]; }
                if (ay) { const c = Math.cos(ay), sn = Math.sin(ay); [x, z] = [x * c + z * sn, -x * sn + z * c]; }
                if (az) { const c = Math.cos(az), sn = Math.sin(az); [x, y] = [x * c - y * sn, x * sn + y * c]; }
                p[0] = x; p[1] = y; p[2] = z;
            }
            if (radial) { const n = norm(p); p[0] += n[0] * radial * dt; p[1] += n[1] * radial * dt; p[2] += n[2] * radial * dt; }
            if (s.directionalNoise) {
                const noise = s.directionalNoise;
                const variation = 1 + 0.18 * Math.sin(id * 0.31 + (i + 0.5) * dt * noise.frequency * Math.PI * 2);
                for (let axis = 0; axis < 3; axis++) p[axis] += noise.strength[axis] * noise.scroll * noise.amount * 0.25 * variation * dt;
            }
            if (path) path.push([...p]);
        }
        const t = age / life;
        const sizeMul = curve(s.sizeOverLife, t, rSize, 1);
        const size = curve(s.size, 0, rSize) * sizeMul;
        const sizeY = s.sizeY ? curve(s.sizeY, 0, rSizeY) * sizeMul : size;
        const sizeZ = s.sizeZ ? curve(s.sizeZ, 0, rSizeZ) * sizeMul : size;
        const spin = s.spin ? curve(s.spin, t, rSpin) * age : 0;
        const c0 = color(s.color, 0, rColor), c1 = color(s.colorOverLife, t, rColor);
        const frame = s.sheet ? Math.floor(curve(s.sheet.frame, t, rFrame) * s.sheet.tiles[0] * s.sheet.tiles[1] * s.sheet.cycles) : 0;
        const live = {
            direction: d,
            p, size, sizeY, sizeZ, rot: curve(s.rotation, 0, rRot) + spin, rotY: curve(s.rotationY, 0, rRotY), frame,
            color: [c0[0] * c1[0], c0[1] * c1[1], c0[2] * c1[2], c0[3] * c1[3]],
        };
        if (s.trail && path && hash(id, 0x74726169) / 4294967296 < s.trail.ratio) {
            const span = Math.min(age, curve(s.trail.life, 0, rLifeC, 1) * life);
            const from = Math.max(0, Math.floor((age - span) / (dt || STEP)));
            live.trail = path.slice(from);
            live.trailWidth = curve(s.trail.width, 0, rWidth);
            live.trailColor = color(s.trail.colorOverLife, t, rColor);
        }
        return { live, life, path };
    }

    /** Birth times (+ ids) of a system's particles that could be alive at `t`. */
    function births(s, t, sysSeed) {
        const out = [];
        const delay = curve(s.delay, 0, 0.5);
        const maxLife = curveMax(s.life);
        const from = t - maxLife;
        const end = s.loop ? Infinity : delay + s.duration;
        const earliest = s.prewarm ? -Infinity : delay;
        const rate = curveMean(s.rate);
        if (rate > 0) {
            const k0 = Math.ceil((Math.max(from, earliest) - delay) * rate);
            const k1 = Math.floor((Math.min(t, end) - delay) * rate);
            for (let k = k0; k <= k1; k++) out.push([delay + k / rate, hash(sysSeed, k)]);
        }
        s.bursts.forEach((b, bi) => {
            const l0 = s.loop ? Math.floor((from - delay) / s.duration) - 1 : 0;
            const l1 = s.loop ? Math.floor((t - delay) / s.duration) : 0;
            for (let L = l0; L <= l1; L++) {
                for (let c = 0; c < Math.max(1, b.cycles); c++) {
                    const bt = delay + L * s.duration + b.time + c * b.interval;
                    if (bt < from || bt > t || bt < earliest) continue;
                    for (let j = 0; j < b.count; j++) out.push([bt, hash(hash(sysSeed, 0x7f000 + bi), hash(L * 97 + c, j))]);
                }
            }
        });
        return out;
    }

    const MAX_PARTICLES = 600;
    const MAX_TRAIL_VERTS = 4000;

    const OUT_MACRO = `
#ifdef ADDITIVE
${ADDITIVE_FX_OUTPUT}
#define ADDITIVE_OUT(rgb, a) additiveFxOutput(rgb, a)
#else
#define ADDITIVE_OUT(rgb, a) gl_FragColor = vec4(rgb, a)
#endif
`;

    const SPRITE_VERTEX = `
attribute vec3 iPos;
attribute vec2 iSize;
attribute float iRot;
attribute vec4 iColor;
attribute float iFrame;
#ifdef STRETCHED
attribute vec3 iDirection;
uniform float uLengthScale;
#endif
uniform float uScale;
uniform float uHorizontal;
uniform vec2 uTiles;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float c = cos(iRot), s = sin(iRot);
  vec2 q = vec2(position.x * iSize.x, position.y * iSize.y);
  q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  vec4 mv;
#ifdef STRETCHED
  mv = modelViewMatrix * vec4(iPos, 1.0);
#ifdef FREEFORM_STRETCH
  q = vec2(position.x * iSize.x, position.y * iSize.y * abs(uLengthScale));
  q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  mv.xy += q * uScale;
#else
  vec3 along = normalize(mat3(modelViewMatrix) * iDirection);
  vec2 projected = along.xy;
  vec2 across = length(projected) > 0.0001 ? normalize(vec2(-projected.y, projected.x)) : vec2(1.0, 0.0);
  mv.xyz += along * (position.x + 0.5) * iSize.x * abs(uLengthScale) * uScale;
  mv.xy += across * position.y * iSize.y * uScale;
#endif
#else
  if (uHorizontal > 0.5) {
    mv = modelViewMatrix * vec4(iPos + vec3(q.x, 0.0, q.y), 1.0);
  } else {
    mv = modelViewMatrix * vec4(iPos, 1.0);
    mv.xy += q * uScale;
  }
#endif
  gl_Position = projectionMatrix * mv;
  float fx = mod(iFrame, uTiles.x);
  float fy = uTiles.y - 1.0 - floor(iFrame / uTiles.x);
  vUv = (uv + vec2(fx, fy)) / uTiles;
  vColor = iColor;
}`;

    const SPRITE_FRAGMENT = OUT_MACRO + `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec4 uTint;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = uHasMap > 0.5 ? texture2D(uMap, vUv) : vec4(1.0);
  vec4 c = t * vColor * uTint;
  if (c.a <= 0.002) discard;
  float excess = max(max(c.r, max(c.g, c.b)) - 1.0, 0.0);
  vec3 rgb = min(min(c.rgb, 1.0) + excess * 0.6, 1.0);
  ADDITIVE_OUT(rgb, clamp(c.a, 0.0, 1.0));
}`;

    const RIBBON_VERTEX = `
attribute vec3 next;
attribute float side;
attribute float width;
attribute vec4 rgba;
uniform float uScale;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0);
  vec4 b = modelViewMatrix * vec4(next, 1.0);
  vec2 dir = b.xy - a.xy;
  dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
  a.xy += vec2(-dir.y, dir.x) * side * width * 0.75 * uScale;
  gl_Position = projectionMatrix * a;
  vUv = uv;
  vColor = rgba;
}`;

    /**
     * Build one effect from its JSON spec; `textureBase` is where its sheets
     * live. Sprite / ribbon particles only — the specs used here carry no
     * mesh particles or panning meshes.
     */
    async function createFx(spec, textureBase, seed, loadTex) {
        const group = new THREE.Group();
        const texCache = new Map();
        const tex = (file) => {
            if (!texCache.has(file)) texCache.set(file, loadTex(textureBase + file, {}));
            return texCache.get(file);
        };
        const additive = Object.assign(additiveFxBlending(), { defines: { ADDITIVE: '' } });
        const blendProps = (m, preserveTint = false) => {
            if (m.blend !== 'add') return { blending: THREE.NormalBlending, defines: {} };
            if (m.name === 'fx_circle_addsoft' || preserveTint) {
                // Pink discs and Max Particle orbs keep their tint: composite
                // their coverage instead of adding into white.
                return Object.assign({}, additive, {
                    blendDst: THREE.OneMinusSrcAlphaFactor,
                    blendEquationAlpha: THREE.AddEquation,
                    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
                });
            }
            return additive;
        };
        const scaleOf = (o) => {
            const e = o.matrixWorld.elements;
            return (Math.hypot(e[0], e[1], e[2]) + Math.hypot(e[4], e[5], e[6]) + Math.hypot(e[8], e[9], e[10])) / 3;
        };

        const drawn = [];
        const makeSprites = async (s, node) => {
            const m = s.material;
            const geo = new THREE.InstancedBufferGeometry();
            const quad = new THREE.PlaneGeometry(1, 1);
            geo.index = quad.index;
            geo.setAttribute('position', quad.getAttribute('position'));
            geo.setAttribute('uv', quad.getAttribute('uv'));
            const attr = (n) => new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * n), n).setUsage(THREE.DynamicDrawUsage);
            const attrs = { iPos: attr(3), iSize: attr(2), iRot: attr(1), iColor: attr(4), iFrame: attr(1), iDirection: attr(3) };
            for (const [k, a] of Object.entries(attrs)) geo.setAttribute(k, a);
            geo.instanceCount = 0;
            const blend = blendProps(m, ['breadMPGlow', 'breadMPCenterRing', 'breadMPRisingMpSprites'].includes(s.name));
            const mat = new THREE.ShaderMaterial(Object.assign({}, blend, {
                name: m.name, transparent: true, depthWrite: false,
                depthTest: !m.overlay,
                defines: Object.assign({}, blendProps(m).defines,
                    s.render.mode === 1 ? Object.assign({ STRETCHED: '' }, s.render.freeform ? { FREEFORM_STRETCH: '' } : {}) : {}),
                side: THREE.DoubleSide,
                uniforms: {
                    uLengthScale: { value: s.render.lengthScale },
                    uMap: { value: m.tex ? await tex(m.tex) : null }, uHasMap: { value: m.tex ? 1 : 0 }, uTint: { value: new THREE.Vector4(...m.tint) },
                    uScale: { value: 1 }, uHorizontal: { value: s.render.mode === 2 ? 1 : 0 },
                    uTiles: { value: new THREE.Vector2(...((s.sheet && s.sheet.tiles) || [1, 1])) },
                },
                vertexShader: SPRITE_VERTEX, fragmentShader: SPRITE_FRAGMENT,
            }));
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            mesh.renderOrder = 6;
            node.add(mesh);
            return { geo, attrs, mat };
        };
        const makeRibbon = async (s, node) => {
            const m = s.trail.material;
            const geo = new THREE.BufferGeometry();
            const a = (n) => new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_VERTS * n), n).setUsage(THREE.DynamicDrawUsage);
            const attrs = { position: a(3), next: a(3), side: a(1), width: a(1), rgba: a(4), uv: a(2) };
            for (const [k, v] of Object.entries(attrs)) geo.setAttribute(k, v);
            geo.setDrawRange(0, 0);
            const mat = new THREE.ShaderMaterial(Object.assign({}, blendProps(m), {
                name: m.name, transparent: true, depthWrite: false, side: THREE.DoubleSide,
                uniforms: {
                    uMap: { value: m.tex ? await tex(m.tex) : null }, uHasMap: { value: m.tex ? 1 : 0 }, uTint: { value: new THREE.Vector4(...m.tint) },
                    uScale: { value: 1 },
                },
                vertexShader: RIBBON_VERTEX, fragmentShader: SPRITE_FRAGMENT,
            }));
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            mesh.renderOrder = 6;
            node.add(mesh);
            return { geo, mat, attrs };
        };
        for (const [index, s] of spec.systems.entries()) {
            if (s.subOnly) continue;
            const node = new THREE.Group();
            node.name = s.name;
            node.matrixAutoUpdate = false;
            node.matrix.fromArray(s.matrix);
            group.add(node);
            const d = { s, index, node, subs: [] };
            if (s.material && s.render.mode !== 5 && s.render.mode !== 4) d.sprites = await makeSprites(s, node);
            if (s.trail) d.ribbon = await makeRibbon(s, node);
            drawn.push(d);
            for (const sub of s.subEmitters || []) {
                const child = spec.systems[sub];
                const cd = { s: child, index: sub, node };
                if (child.material && child.render.mode !== 5 && child.render.mode !== 4) cd.sprites = await makeSprites(child, node);
                if (child.trail) cd.ribbon = await makeRibbon(child, node);
                d.subs.push(cd);
            }
        }

        const writeSprites = (d, list) => {
            if (!d.sprites) return;
            const { attrs, geo, mat } = d.sprites;
            const n = Math.min(list.length, MAX_PARTICLES);
            for (let i = 0; i < n; i++) {
                const l = list[i];
                attrs.iPos.setXYZ(i, l.p[0], l.p[1], l.p[2]);
                attrs.iDirection.setXYZ(i, l.direction[0], l.direction[1], l.direction[2]);
                attrs.iSize.setXY(i, l.size, l.sizeY);
                attrs.iRot.setX(i, l.rot);
                attrs.iColor.setXYZW(i, l.color[0], l.color[1], l.color[2], l.color[3]);
                attrs.iFrame.setX(i, l.frame);
            }
            Object.values(attrs).forEach((a) => { a.needsUpdate = true; });
            geo.instanceCount = n;
            mat.uniforms.uScale.value = scaleOf(d.node);
        };
        const writeRibbon = (d, list) => {
            if (!d.ribbon) return;
            const { attrs, geo, mat } = d.ribbon;
            let v = 0;
            const idx = [];
            for (const l of list) {
                const pts = l.trail;
                if (!pts || pts.length < 2) continue;
                const stride = Math.max(1, Math.floor(pts.length / 16));
                const sel = pts.filter((_, i) => i % stride === 0 || i === pts.length - 1);
                if (v + sel.length * 2 > MAX_TRAIL_VERTS) break;
                const base = v;
                sel.forEach((p, i) => {
                    const q = sel[Math.min(sel.length - 1, i + 1)];
                    const prev = sel[Math.max(0, i - 1)];
                    const nx = i === sel.length - 1 ? [2 * p[0] - prev[0], 2 * p[1] - prev[1], 2 * p[2] - prev[2]] : q;
                    const u = 1 - i / (sel.length - 1);
                    for (const side of [-1, 1]) {
                        attrs.position.setXYZ(v, p[0], p[1], p[2]);
                        attrs.next.setXYZ(v, nx[0], nx[1], nx[2]);
                        attrs.side.setX(v, side);
                        attrs.width.setX(v, l.trailWidth != null ? l.trailWidth : 0.1);
                        const inherited = d.s.trail.inheritColor ? l.color : [1, 1, 1, 1];
                        const lifetime = l.trailColor || [1, 1, 1, 1];
                        const along = color(d.s.trail.colorOverTrail, u, 0.5);
                        const c = inherited.map((value, channel) => value * lifetime[channel] * along[channel]);
                        attrs.rgba.setXYZW(v, c[0], c[1], c[2], c[3]);
                        attrs.uv.setXY(v, u, side < 0 ? 0 : 1);
                        v++;
                    }
                    if (i < sel.length - 1) {
                        const a = base + i * 2;
                        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
                    }
                });
            }
            Object.values(attrs).forEach((a) => { a.needsUpdate = true; });
            geo.setIndex(idx);
            geo.setDrawRange(0, idx.length);
            mat.uniforms.uScale.value = scaleOf(d.node);
        };

        const update = (t) => {
            group.updateMatrixWorld(true);
            for (const d of drawn) {
                const s = d.s;
                const sysSeed = hash(seed, d.index + 1);
                const own = [];
                const subLists = new Map();
                for (const [b, id] of births(s, t, sysSeed)) {
                    const needPath = !!s.trail || d.subs.length > 0;
                    const res = sampleParticle(s, id, t - b, null, needPath);
                    if (!res) continue;
                    own.push(res.live);
                    for (const sd of d.subs) {
                        const c = sd.s;
                        const rate = curveMean(c.rate);
                        if (!rate || !res.path) continue;
                        const list = subLists.get(sd) || [];
                        const age = t - b;
                        const cMax = curveMax(c.life);
                        const k0 = Math.max(0, Math.ceil((age - cMax) * rate));
                        const k1 = Math.floor(age * rate);
                        const steps = res.path.length - 1;
                        for (let k = k0; k <= k1; k++) {
                            const at = k / rate;
                            const origin = res.path[Math.min(steps, Math.round((at / (age || 1)) * steps))];
                            const cr = sampleParticle(c, hash(id, k + 1), age - at, origin, !!c.trail);
                            if (cr) list.push(cr.live);
                        }
                        subLists.set(sd, list);
                    }
                }
                writeSprites(d, own);
                writeRibbon(d, own);
                for (const sd of d.subs) {
                    writeSprites(sd, subLists.get(sd) || []);
                    writeRibbon(sd, subLists.get(sd) || []);
                }
            }
        };

        return { group, update };
    }

    // ── Power Spot vortex (BreadPOUVortex, TripleLayerRotatingBlend) ─────────
    async function createVortex(loadTex, time) {
        const textures = await Promise.all([0, 1, 2].map((i) =>
            loadTex(`${BASE}powerspot-fx/POU_vortex_layer${i}.png`, { clamp: true })));
        const geometry = new THREE.PlaneGeometry(8.6215314865 * 1.1000000238, 8.6215314865 * 1.1000000238);
        const material = new THREE.ShaderMaterial({
            name: 'breadVortexGlobalMap', transparent: true, depthWrite: false, side: THREE.DoubleSide,
            uniforms: { uBase: { value: textures[0] }, uMiddle: { value: textures[1] }, uTop: { value: textures[2] }, uTime: time },
            vertexShader: `
      uniform float uTime;
      varying vec2 vBase, vMiddle, vTop;
      vec2 rotatedUv(float speed, float tiling) {
        float a = uTime * speed;
        vec2 p = uv - 0.5;
        return vec2(dot(p, vec2(cos(a), sin(a))), dot(p, vec2(-sin(a), cos(a)))) * tiling + 0.5;
      }
      void main() {
        vBase = rotatedUv(-0.15, 1.0);
        vMiddle = rotatedUv(-1.2, 1.0);
        vTop = rotatedUv(-2.0, 1.3);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
            fragmentShader: `
      uniform sampler2D uBase, uMiddle, uTop;
      varying vec2 vBase, vMiddle, vTop;
      void main() {
        vec4 base = texture2D(uBase, vBase);
        vec4 middle = texture2D(uMiddle, vMiddle);
        vec4 top = texture2D(uTop, vTop);
        gl_FragColor = vec4(mix(mix(base.rgb, middle.rgb, middle.a), top.rgb, top.a),
          clamp(base.a + middle.a + top.a, 0.0, 1.0));
      }`,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'BreadPOUVortex';
        mesh.position.y = 8.6999998093;
        mesh.rotation.x = Math.PI / 2;
        return mesh;
    }

    // ── Templates ────────────────────────────────────────────────────────────
    let templates = null;   // Promise<{ pokestop, gym, powerspot }>
    let fxUpdates = [];     // (elapsed) => void, run once per frame per template
    let ownedTextures = [];
    const fxTime = { value: 0 };

    function makeTextureLoader() {
        const loader = new THREE.TextureLoader();
        const cache = new Map();
        return (url, opts) => {
            const key = url + JSON.stringify(opts);
            if (!cache.has(key)) {
                cache.set(key, loader.loadAsync(url).then((tex) => {
                    // Raw gamma values: the shaders work in the game's space.
                    tex.encoding = THREE.LinearEncoding;
                    tex.flipY = !!opts.flipY;
                    if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    if (opts.clamp || opts.ramp) tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
                    if (opts.ramp) tex.minFilter = tex.magFilter = THREE.LinearFilter;
                    tex.needsUpdate = true;
                    ownedTextures.push(tex);
                    return tex;
                }));
            }
            return cache.get(key);
        };
    }

    function loadGltf(url) {
        return new Promise((resolve, reject) => new THREE.GLTFLoader().load(url, resolve, undefined, reject));
    }

    function meshesOf(root) {
        const out = [];
        root.traverse((o) => { if (o.isMesh) out.push(o); });
        return out;
    }
    const materialNames = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.name);
    function swapMaterials(mesh, make) {
        const next = materialNames(mesh).map(make);
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
        mesh.material = next.length === 1 ? next[0] : next;
    }

    async function dressPokestop(root, loadTex, light) {
        // The ramp is sampled with Unity's v (0 = bottom row), so it keeps
        // flipY; the GLB UVs are already flipped, so the rig's sheets don't.
        const ramp = await loadTex(TEX + 'poi_brdf_ramp.png', { flipY: true, ramp: true });
        for (const mesh of meshesOf(root)) {
            swapMaterials(mesh, (name) => brdfMaterial(ramp, light, name,
                name === 'pokestop_alt_tr' ? POKESTOP_ALT : POKESTOP_BODY, null, mesh.isSkinnedMesh));
        }
    }

    async function dressGym(root, loadTex, light) {
        const ramp = await loadTex(TEX + 'poi_brdf_ramp.png', { flipY: true, ramp: true });
        const sheet = await loadTex(TEX + 'T_Gym_0.png', { flipY: false, repeat: true });
        for (const mesh of meshesOf(root)) {
            if (GYM_HIDDEN.test(mesh.name) || GYM_HIDDEN.test((mesh.parent && mesh.parent.name) || '')) {
                mesh.visible = false;
                continue;
            }
            swapMaterials(mesh, (name) => brdfMaterial(ramp, light, name, GYM_BRDF, sheet, mesh.isSkinnedMesh));
        }
    }

    /** The gym's four topper spotlights: Shuriken renderers aren't geometry, so
     *  they're rebuilt on the GLB's animated emitter transforms. */
    async function addGymFx(root, loadTex) {
        const emitters = [];
        root.traverse((node) => { if (/^GymTopperLightVFX(?:_\d+)?$/.test(node.name)) emitters.push(node); });
        if (!emitters.length) return;
        const spec = await (await fetch(BASE + 'gym-fx/spotlights.json')).json();
        for (const [index, emitter] of emitters.entries()) {
            const fx = await createFx(spec, BASE + 'gym-fx/', 7919 * (index + 1), loadTex);
            fx.group.name = 'PoiFx';
            emitter.add(fx.group);
            fxUpdates.push(fx.update);
        }
    }

    async function dressPowerSpot(root, loadTex, light) {
        const ramp = await loadTex(TEX + 'poi_brdf_gloss_v2.png', { flipY: true, ramp: true });
        const grassRamp = await loadTex(TEX + 'poi_brdf_soft_v2.png', { flipY: true, ramp: true });
        const sheet = (file) => loadTex(TEX + file, { flipY: false, repeat: true });
        const unitySpace = !!root.userData.powerspotUnitySpace;
        const heightAxis = new THREE.Vector3(0, unitySpace ? 1 : 0, unitySpace ? 0 : -1);
        for (const mesh of meshesOf(root)) {
            const made = await Promise.all(materialNames(mesh).map(async (name) => {
                if (name === 'breadEnergyMat') {
                    // GLB V is inverted from Unity, hence the positive panning speed.
                    return new THREE.ShaderMaterial({
                        name, transparent: true, depthWrite: false, side: THREE.DoubleSide,
                        uniforms: { uMap: { value: await sheet('breadPOIEnergyTex.png') }, uTime: fxTime, uSpeed: { value: 0.19 }, uHeightAxis: { value: heightAxis } },
                        vertexShader: POWERSPOT_FX_VERTEX, fragmentShader: PANNING_FRAGMENT,
                    });
                }
                if (name === 'breadStationGlowRimMat' || name === 'breadStationGlowSoftRimMat') {
                    const soft = name === 'breadStationGlowSoftRimMat';
                    return new THREE.ShaderMaterial(Object.assign({}, additiveFxBlending(), {
                        name, transparent: true, depthWrite: false,
                        uniforms: { uMap: { value: await sheet('breadStation256Tex.png') },
                            uTint: { value: soft ? 1 : 1.304119 }, uAddPower: { value: soft ? 1.5 : 1 }, uHeightAxis: { value: heightAxis } },
                        vertexShader: POWERSPOT_FX_VERTEX, fragmentShader: POWERSPOT_GLOW_FRAGMENT,
                    }));
                }
                const p = POWERSPOT_BRDF[name] || POWERSPOT_BRDF.breadStationPOUMat;
                return brdfMaterial(name === 'breadPOUGrassFieldMat' ? grassRamp : ramp, light, name, p, await sheet(p.texture), mesh.isSkinnedMesh);
            }));
            (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
            mesh.material = made.length === 1 ? made[0] : made;
            // Unity's vacant pole is a half-cylinder billboard, not a closed tube.
            if (unitySpace && /^breadPOUStationPoleGeo(?:_idle)?$/.test(mesh.name)) made.forEach((m) => { m.side = THREE.DoubleSide; });
        }
        // Max Battle active: the boss station, vortex and Max Particle on,
        // the vacant station's holo panels off.
        const active = root.getObjectByName('breadPOUActiveBoss');
        const idle = root.getObjectByName('breadPOUStationed');
        const holoPanels = root.getObjectByName('breadPOUHoloPanelsRoot');
        if (active) active.visible = true;
        if (idle) idle.visible = false;
        if (holoPanels) holoPanels.visible = false;

        const vortex = await createVortex(loadTex, fxTime);
        if (!unitySpace) {
            vortex.position.set(0, 0, -8.6999998093);
            vortex.rotation.x = 0;
        }
        root.add(vortex);

        // The GLB holds the solid prop only: restore the prefab's Max Particle
        // glow, sparkles, rising circles and orbiting pink trails.
        if (!SHOW_POWERSPOT_PARTICLES) return;
        const spec = await (await fetch(BASE + 'powerspot-fx/max-particles.json')).json();
        const particles = await createFx(spec, BASE + 'powerspot-fx/', 0x504f55, loadTex);
        particles.group.name = 'PoiFx';
        root.add(particles.group);
        fxUpdates.push(particles.update);
    }

    /** Bounds of the visible solid prop (FX excluded), in the root's space. */
    function propBounds(root) {
        root.updateMatrixWorld(true);
        const box = new THREE.Box3();
        const tmp = new THREE.Box3();
        root.traverse((o) => {
            if (!o.isMesh) return;
            for (let p = o; p; p = p.parent) if (!p.visible) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            box.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
        });
        return box;
    }

    async function buildTemplate(type, loadTex, light) {
        const def = MODELS[type];
        const gltf = await loadGltf(BASE + def.file);
        const root = gltf.scene;
        if (type === 'pokestop') await dressPokestop(root, loadTex, light);
        else if (type === 'gym') await dressGym(root, loadTex, light);
        else await dressPowerSpot(root, loadTex, light);
        const bounds = propBounds(root);
        let themeSheets = null;
        if (type === 'gym') {
            if (SHOW_GYM_LIGHTS) await addGymFx(root, loadTex);
            themeSheets = {};
            await Promise.all(Object.entries(GYM_THEME_SHEETS).map(async ([theme, file]) => {
                themeSheets[theme] = await loadTex(TEX + file, { flipY: false, repeat: true });
            }));
        }
        root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
        return {
            root, bounds, themeSheets, themeMaterials: {},
            // createInstance rescales the template for FX sizing; clones start from this.
            rootScale: root.scale.clone(),
            clip: gltf.animations.find((c) => c.name === def.clip) || gltf.animations[0] || null,
        };
    }

    /** Load and dress all three props once; resolves to the templates. */
    function load() {
        if (!templates) {
            const loadTex = makeTextureLoader();
            const light = keyLight();
            templates = Promise.all(['pokestop', 'gym', 'powerspot'].map((t) => buildTemplate(t, loadTex, light)))
                .then(([pokestop, gym, powerspot]) => ({ pokestop, gym, powerspot }));
            templates.catch(() => { templates = null; });
        }
        return templates;
    }

    /** Billboard a mesh round its parent's Y axis toward the camera, as the
     *  Power Spot prefab's energy beam and vacant pole do. */
    function billboardY(mesh, offset) {
        const cam = new THREE.Vector3();
        mesh.onBeforeRender = (_renderer, _scene, camera) => {
            if (!mesh.parent) return;
            camera.getWorldPosition(cam);
            mesh.parent.worldToLocal(cam);
            cam.sub(mesh.position);
            mesh.rotation.set(0, Math.atan2(cam.x, cam.z) + offset, 0);
            mesh.updateMatrixWorld(true);
        };
    }

    /** PokéStop colour sets beyond the default blue, as pogodpu's "custom"
     *  preset builds them: the picked colour as diffuse, and an ambient of the
     *  same hue darkened and nudged blue (the game pairs #14C3FD with #1A3293).
     *  Body and inner rings (`pokestop_alt_tr`) both take them. */
    const POKESTOP_THEMES = { ca: [0.18, 0.86, 0.33] }; // green, CA PokéStops
    function pokestopThemeUniforms(rgb) {
        const ambient = [rgb[0] * 0.4 + 0.02, rgb[1] * 0.35 + 0.03, rgb[2] * 0.45 + 0.12];
        return { uDiff: { value: v3(rgb) }, uAmbn: { value: v3(ambient) } };
    }

    /** A template's BRDF material recoloured for `theme` (a gym team sheet or
     *  a PokéStop colour set), one per theme and source material, shared by
     *  every spot of that theme. */
    function themedMaterial(tpl, type, theme, material) {
        const cache = tpl.themeMaterials[theme] || (tpl.themeMaterials[theme] = new Map());
        if (!cache.has(material)) {
            const overrides = type === 'gym'
                ? { uMap: { value: tpl.themeSheets[theme] }, uHasMap: { value: 1 } }
                : pokestopThemeUniforms(POKESTOP_THEMES[theme]);
            const themed = new THREE.ShaderMaterial({
                name: material.name,
                uniforms: Object.assign({}, material.uniforms, overrides),
                vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
            });
            themed.skinning = material.skinning;
            cache.set(material, themed);
        }
        return cache.get(material);
    }

    /**
     * A new spot of `type` ('pokestop' | 'gym' | 'powerspot'), `height` metres
     * tall with its base on y = 0. The clone shares the template's FX buffers,
     * which `update` fills once per frame for every spot of that type.
     * `theme` recolours it: a gym takes 'mystic' | 'valor' | 'instinct' | 'ca'
     * (pink), a PokéStop 'ca' (green); left out, the gym stays neutral and the
     * PokéStop blue.
     */
    function createInstance(tpls, type, height, theme) {
        const tpl = tpls[type];
        const spot = THREE.SkeletonUtils.clone(tpl.root);
        const themed = (type === 'gym' && tpl.themeSheets && tpl.themeSheets[theme])
            || (type === 'pokestop' && POKESTOP_THEMES[theme]);
        if (themed) {
            spot.traverse((o) => {
                if (!o.isMesh || !o.material || !o.material.uniforms || !o.material.uniforms.uRamp) return;
                o.material = Array.isArray(o.material)
                    ? o.material.map((m) => themedMaterial(tpl, type, theme, m))
                    : themedMaterial(tpl, type, theme, o.material);
            });
        }
        const size = tpl.bounds.getSize(new THREE.Vector3());
        const scale = height / (size.y || 1);
        const group = new THREE.Group();
        spot.scale.copy(tpl.rootScale).multiplyScalar(scale);
        spot.position.y = -tpl.bounds.min.y * scale;
        group.add(spot);

        if (type === 'powerspot' && tpl.root.userData.powerspotUnitySpace) {
            spot.traverse((o) => {
                if (!o.isMesh) return;
                const names = materialNames(o);
                if (names.includes('breadEnergyMat')) billboardY(o, 0);
                else if (/^breadPOUStationPoleGeo(?:_idle)?$/.test(o.name)) billboardY(o, Math.PI);
            });
        }
        // The template keeps the FX's world scale right for sprite sizing.
        tpl.root.scale.copy(tpl.rootScale).multiplyScalar(scale);
        tpl.root.updateMatrixWorld(true);

        let mixer = null;
        if (tpl.clip) {
            mixer = new THREE.AnimationMixer(spot);
            const action = mixer.clipAction(tpl.clip);
            action.play();
            // Spots shouldn't all pulse in lockstep.
            action.time = Math.random() * tpl.clip.duration;
        }
        return { group, mixer };
    }

    /** Advance the shared FX clock; `elapsed` is seconds since the scene opened. */
    function update(elapsed) {
        fxTime.value = elapsed;
        for (let i = 0; i < fxUpdates.length; i++) fxUpdates[i](elapsed);
    }

    /** Drop the templates (the scene's own dispose frees cloned geometry/materials). */
    function dispose() {
        if (templates) {
            templates.then((t) => Object.values(t).forEach(({ root }) => root.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
            }))).catch(() => {});
        }
        ownedTextures.forEach((t) => t.dispose());
        ownedTextures = [];
        fxUpdates = [];
        templates = null;
    }

    return { load, createInstance, update, dispose };
})();
