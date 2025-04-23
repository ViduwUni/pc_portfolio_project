import * as THREE from 'three';

export class ParticlePool {
    constructor(scene, count = 50000, boxSize = new THREE.Vector3(5, 5, 5), speed = 1.5, targetMesh = null) {
        this.count = count;
        this.scene = scene;
        this.boxSize = boxSize;
        this.speed = speed;
        this.targetMesh = targetMesh;

        // Use InstancedBufferGeometry for better performance with large numbers of particles
        this.geometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1);
        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.mesh);
        this.mesh.frustumCulled = false;

        this.positions = new Float32Array(count * 3); // Storing positions in a flat array for GPU efficiency
        this.velocities = new Float32Array(count * 3); // Storing velocities in a flat array for GPU efficiency
        this.actives = new Array(count).fill(false);
        this.collided = new Array(count).fill(false); // New: to track collisions

        this.dummy = new THREE.Object3D();

        // For collision detection
        this.targetBox = new THREE.Box3();
    }

    setTargetMesh(mesh) {
        this.targetMesh = mesh;
        if (mesh) this.targetBox.setFromObject(mesh);
    }

    spawnFromFace() {
        for (let i = 0; i < this.count; i++) {
            if (!this.actives[i]) {
                const { x: w, y: h, z: d } = this.boxSize;

                const spawnPos = new THREE.Vector3(
                    (Math.random() - 0.5) * w,
                    (Math.random() - 0.5) * h,
                    d / 2
                );

                const dir = new THREE.Vector3(0, 0, -1);

                // Storing positions and velocities in flat arrays
                const index = i * 3;
                this.positions[index] = spawnPos.x;
                this.positions[index + 1] = spawnPos.y;
                this.positions[index + 2] = spawnPos.z;

                const speed = this.speed + Math.random() * 0.5;
                this.velocities[index] = dir.x * speed;
                this.velocities[index + 1] = dir.y * speed;
                this.velocities[index + 2] = dir.z * speed;

                this.actives[i] = true;
                this.collided[i] = false;
                return;
            }
        }
    }

    update(delta) {
        const { z: d } = this.boxSize;

        if (this.targetMesh) {
            this.targetBox.setFromObject(this.targetMesh);
        }

        for (let i = 0; i < this.count; i++) {
            if (!this.actives[i]) continue;

            const index = i * 3;
            const pos = new THREE.Vector3(this.positions[index], this.positions[index + 1], this.positions[index + 2]);
            const vel = new THREE.Vector3(this.velocities[index], this.velocities[index + 1], this.velocities[index + 2]);

            // Update position
            pos.addScaledVector(vel, delta);

            if (pos.z < -d / 2) {
                this.actives[i] = false;
                continue;
            }

            // Update flat array positions
            this.positions[index] = pos.x;
            this.positions[index + 1] = pos.y;
            this.positions[index + 2] = pos.z;

            // Collision check
            if (this.targetMesh) {
                const particleBox = new THREE.Box3().setFromCenterAndSize(
                    pos,
                    new THREE.Vector3(0.01, 0.01, 0.05)
                );

                if (this.targetBox.intersectsBox(particleBox)) {
                    // Reset the particle to emulate respawn
                    const { x: w, y: h, z: d } = this.boxSize;

                    const spawnPos = new THREE.Vector3(
                        (Math.random() - 0.5) * w,
                        (Math.random() - 0.5) * h,
                        d / 2
                    );

                    const dir = new THREE.Vector3(0, 0, -1);

                    // Store new spawn position and velocity
                    this.positions[index] = spawnPos.x;
                    this.positions[index + 1] = spawnPos.y;
                    this.positions[index + 2] = spawnPos.z;
                    this.velocities[index] = dir.x * (this.speed + Math.random() * 0.5);
                    this.velocities[index + 1] = dir.y * (this.speed + Math.random() * 0.5);
                    this.velocities[index + 2] = dir.z * (this.speed + Math.random() * 0.5);
                    this.collided[i] = false;

                    // Optional log
                    // console.log(`Particle ${i} hit target, respawned.`);
                }
            }

            // Update the instanced mesh position
            this.dummy.position.copy(pos);
            this.dummy.rotation.x = Math.PI / 2;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }
}