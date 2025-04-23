import "./style.scss";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ParticlePool } from "./components/ParticleShooter.js";

const canvas = document.querySelector("#experience-canvas");
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// ---------- Scene Setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color("#000000"); // background black

// ---------- Camera Setup ----------
const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  1000
);
camera.position.set(
  0.013239460022738632,
  1.0859551518084662,
  -1.1079787280385118
);
// camera.rotation.set(0, THREE.MathUtils.degToRad(180), 0);

// ---------- Renderer Setup ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ---------- Orbit Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();
controls.target.set(
  -0.03324244894524819,
  0.9459077944037454,
  0.23670880088171709
);

// ---------- Loaders ----------
const textureLoader = new THREE.TextureLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Toggle between old and new texture sets
const useNewTextures = false;

// ---------- Texture Map Setup ----------
const textureMap = useNewTextures
  ? {
    First: { texturePath: "/textures/cockpit/New/Texture_Set_One.webp" },
    Second: { texturePath: "/textures/cockpit/New/Texture_Set_Two.webp" },
    Third: { texturePath: "/textures/cockpit/New/Texture_Set_Three.webp" },
  }
  : {
    First: { texturePath: "/textures/cockpit/TextureSetOne.webp" },
    Second: { texturePath: "/textures/cockpit/TextureSetTwo.webp" },
    Third: { texturePath: "/textures/cockpit/TextureSetThree.webp" },
  };

const loadedTextures = {
  loadedIntoTextures: {},
};

// Load all textures
Object.entries(textureMap).forEach(([key, paths]) => {
  const finalTexture = textureLoader.load(paths.texturePath);
  finalTexture.flipY = false;
  finalTexture.colorSpace = THREE.SRGBColorSpace;
  loadedTextures.loadedIntoTextures[key] = finalTexture;
});

// ---------- GLB Model Load ----------
let loadedModel = null;
let glassMesh = null;
const modelBoundingBox = new THREE.Box3();

// Video Texture
const videoElement = document.createElement("video");
videoElement.src = "/textures/video/screen.webm";
videoElement.loop = true;
videoElement.muted = true;
videoElement.playsInline = true;
videoElement.autoplay = true;
videoElement.play();
videoElement.play();

const videoTextureLeftScreen = new THREE.VideoTexture(videoElement);
videoTextureLeftScreen.colorSpace = THREE.SRGBColorSpace;
videoTextureLeftScreen.repeat.set(5, 5); // scaling
videoTextureLeftScreen.offset.set(0, 0); // positioning

// Load the GLB model
loader.load("/models/Space_Portfolio.glb", (glb) => {
  loadedModel = glb.scene;

  glb.scene.traverse((child) => {
    if (child.isMesh) {
      Object.keys(textureMap).forEach((key) => {
        if (child.name.includes(key)) {
          const material = new THREE.MeshBasicMaterial({
            map: loadedTextures.loadedIntoTextures[key],
          });
          child.material = material;
        }
      });

      if (child.name.includes("Glass")) {
        const glassOutside = new THREE.MeshPhysicalMaterial({
          transmission: 1,
          transparent: true,
          opacity: 1,
          metalness: 0,
          roughness: 0,
          ior: 1.5,
          thickness: 0.01,
          side: THREE.DoubleSide,
          specularIntensity: 1,
          envMapIntensity: 1,
          depthWrite: false,
          depthTest: true,
        });

        const glassInside = new THREE.MeshPhysicalMaterial({
          transparent: true,
          opacity: 0.2,
          color: 0xaaaaaa,
          side: THREE.DoubleSide,
        });

        child.material = glassOutside;
        glassMesh = child;
        glassMesh.materials = { outside: glassOutside, inside: glassInside };
      } else if (child.name.includes("Main")) {
        child.material = new THREE.MeshBasicMaterial({
          map: videoTextureLeftScreen,
        });
      }
    }
  });

  loadedModel.rotation.set(
    THREE.MathUtils.degToRad(0),
    THREE.MathUtils.degToRad(90),
    THREE.MathUtils.degToRad(0)
  );

  scene.add(loadedModel);

  // Set bounding box after adding to scene
  modelBoundingBox.setFromObject(loadedModel);

  // Hook model to particles
  particlePool.setTargetMesh(loadedModel);
});

// ---------- Particle Setup ----------
const boxSize = new THREE.Vector3(20, 20, 50);
const particleSpeed = 100;

// Debug bounding box
let isVisible = true;
const boxHelper = new THREE.Box3Helper(
  new THREE.Box3(
    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2)
  ),
  0x00ffff
);

if (isVisible) {
  scene.add(boxHelper);
}

// Create particle pool
const particlePool = new ParticlePool(scene, 3000, boxSize, particleSpeed);

// ---------- Handle window resizing ----------
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ---------- Animation loop ----------
let lastTime = performance.now();
let spawnTimer = 0;
const particlesPerSecond = 100;

let wasInside = false; // 🌟 Track previous camera state

const animate = () => {
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  controls.update();

  // Spawn particles
  spawnTimer += delta;
  const toSpawn = Math.floor(spawnTimer * particlesPerSecond);
  if (toSpawn > 0) {
    for (let i = 0; i < toSpawn; i++) {
      particlePool.spawnFromFace();
    }
    spawnTimer -= toSpawn / particlesPerSecond;
  }

  // Update particles
  particlePool.update(delta);

  // 🔥 Glass material switching + logging when camera enters/exits
  if (glassMesh) {
    const isInside = modelBoundingBox.containsPoint(camera.position);
    if (isInside !== wasInside) {
      console.log(
        `Camera is now ${isInside ? "INSIDE" : "OUTSIDE"} the model.`
      );
      wasInside = isInside;
    }

    glassMesh.material = isInside
      ? glassMesh.materials.inside
      : glassMesh.materials.outside;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();
