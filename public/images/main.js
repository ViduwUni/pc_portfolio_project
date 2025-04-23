import './style.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ParticlePool } from './components/ParticleShooter.js';

const canvas = document.querySelector("#experience-canvas");

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

// ---------- Scene Setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color("#000000");

// ---------- Camera Setup ----------
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 1000);
camera.position.z = 15;

// ---------- Renderer Setup ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ---------- Orbit Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---------- Loaders ----------
const textureLoader = new THREE.TextureLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// ---------- Texture Map Setup ----------
const textureMap = {
  First: { texturePath: "/textures/cockpit/TextureSetOne.webp" },
  Second: { texturePath: "/textures/cockpit/TextureSetTwo.webp" },
  Third: { texturePath: "/textures/cockpit/TextureSetThree.webp" }
};

const loadedTextures = {
  loadedIntoTextures: {}
};

Object.entries(textureMap).forEach(([key, paths]) => {
  const finalTexture = textureLoader.load(paths.texturePath);
  finalTexture.flipY = false;
  finalTexture.colorSpace = THREE.SRGBColorSpace;
  loadedTextures.loadedIntoTextures[key] = finalTexture;
});

// ---------- GLB Model Load ----------
let loadedModel = null;

loader.load("/models/Space_Portfolio.glb", (glb) => {
  loadedModel = glb.scene;

  glb.scene.traverse(child => {
    if (child.isMesh) {
      Object.keys(textureMap).forEach(key => {
        if (child.name.includes(key)) {
          const material = new THREE.MeshBasicMaterial({
            map: loadedTextures.loadedIntoTextures[key],
          });
          child.material = material;
        }

        if (child.name.includes("Glass")) {
          // 🔧 Make glass transparent and visible from inside
          child.material = new THREE.MeshPhysicalMaterial({
            transmission: 1,
            opacity: 1,
            metalness: 0,
            roughness: 0,
            ior: 1.5,
            thickness: 0.01,
            specularIntensity: 1,
            envMapIntensity: 1,
            lightIntensity: 1,
            exposure: 1,
            transparent: true,        // 🔧 needed for transparency
            depthWrite: false,        // 🔧 makes particles visible behind glass
            side: THREE.DoubleSide    // 🔧 render inside and outside of glass
          });

          child.renderOrder = 1;      // 🔧 force glass to render first
        }
      });
    }
  });

  // Rotate model
  loadedModel.rotation.set(
    THREE.MathUtils.degToRad(0),
    THREE.MathUtils.degToRad(90),
    THREE.MathUtils.degToRad(0)
  );

  scene.add(loadedModel);
});

// ---------- Particle Setup ----------
const boxSize = new THREE.Vector3(5, 5, 10);
const particleSpeed = 20;

const boxHelper = new THREE.Box3Helper(new THREE.Box3(
  new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
  new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2)
), 0x00ffff);
scene.add(boxHelper);

const particlePool = new ParticlePool(scene, 2000, boxSize, particleSpeed);

// OPTIONAL: set renderOrder for all particles if you expose them
// particlePool.particles.forEach(p => { p.renderOrder = 2; }); // Uncomment if needed

// ---------- Resize Handling ----------
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ---------- Animation Loop ----------
let lastTime = performance.now();
let spawnTimer = 0;
const particlesPerSecond = 100;

const animate = () => {
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  controls.update();

  spawnTimer += delta;
  const toSpawn = Math.floor(spawnTimer * particlesPerSecond);
  if (toSpawn > 0) {
    for (let i = 0; i < toSpawn; i++) {
      particlePool.spawnFromFace();
    }
    spawnTimer -= toSpawn / particlesPerSecond;
  }

  particlePool.update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();