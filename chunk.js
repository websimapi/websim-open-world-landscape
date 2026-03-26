import * as THREE from 'three';
import { getHeightAt, getChunkRng } from './utils.js';
import { StoneGiant } from './giant.js';
import { Radio } from './radio.js';
import { audioListener } from './audio.js';
import { CHUNK_SIZE } from './constants.js';
import { 
    chunkGeoTemplate, terrainMaterial, 
    trunkGeo, leavesGeo, rockGeo, 
    trunkMat, leavesMat, rockMat 
} from './assets.js';

export class Chunk {
    constructor(chunkX, chunkZ, scene, world) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        this.world = world;
        this.mesh = null;
        this.propsGroup = new THREE.Group();
        this.offsetX = chunkX * CHUNK_SIZE;
        this.offsetZ = chunkZ * CHUNK_SIZE;
        
        this.generate();
    }

    generate() {
        // 1. Generate Terrain Mesh
        const geometry = chunkGeoTemplate.clone();
        const positions = geometry.attributes.position.array;
        const colors = [];
        const color = new THREE.Color();

        // Used for prop placement distribution
        const validPropPositions = [];

        for (let i = 0; i < positions.length; i += 3) {
            const worldX = positions[i] + this.offsetX;
            const worldZ = positions[i + 2] + this.offsetZ;
            const y = getHeightAt(worldX, worldZ);
            
            positions[i + 1] = y;

            // Vertex Colors based on height
            if (y < 2) {
                color.setHex(0xd2b48c); // Sand/Dirt near water level
            } else if (y < 12) {
                color.setHex(0x4CAF50); // Grass
                // Collect potential spots for trees/rocks
                if (Math.random() < 0.1) validPropPositions.push({x: worldX, y: y, z: worldZ});
            } else if (y < 18) {
                color.setHex(0x8B4513); // Dirt mountain side
                if (Math.random() < 0.05) validPropPositions.push({x: worldX, y: y, z: worldZ});
            } else {
                color.setHex(0xDDDDDD); // Snow peak
            }
            colors.push(color.r, color.g, color.b);
        }

        geometry.computeVertexNormals();
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        // Use a material that supports vertex colors for the terrain
        const terrainMatWithColors = terrainMaterial.clone();
        terrainMatWithColors.vertexColors = true;
        terrainMatWithColors.color.setHex(0xffffff); // reset base color to let vertex colors show

        this.mesh = new THREE.Mesh(geometry, terrainMatWithColors);
        this.mesh.position.set(this.offsetX, 0, this.offsetZ);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // 2. Generate Props (Trees and Rocks) deterministically
        this.giants = [];
        this.generateProps();
    }

    generateProps() {
        const rng = getChunkRng(this.chunkX, this.chunkZ);
        
        // Determine prop counts based on seed
        const numTrees = Math.floor(rng() * 15) + 5; // 5 to 20 trees per chunk
        const numRocks = Math.floor(rng() * 10) + 2;  // 2 to 12 rocks per chunk

        // We'll use InstancedMesh for performance
        if (numTrees > 0) {
            const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, numTrees);
            const leaves = new THREE.InstancedMesh(leavesGeo, leavesMat, numTrees);
            trunks.castShadow = true; leaves.castShadow = true;

            const dummy = new THREE.Object3D();
            for(let i=0; i<numTrees; i++) {
                // Pick random local position within chunk based on seed
                const localX = (rng() - 0.5) * CHUNK_SIZE;
                const localZ = (rng() - 0.5) * CHUNK_SIZE;
                const worldX = this.offsetX + localX;
                const worldZ = this.offsetZ + localZ;
                const y = getHeightAt(worldX, worldZ);

                // Only place trees if not too steep and not in water/snow
                if (y > 2 && y < 14) {
                    const scale = 0.8 + rng() * 0.6;
                    dummy.position.set(localX, y, localZ);
                    dummy.rotation.y = rng() * Math.PI * 2;
                    dummy.scale.set(scale, scale, scale);
                    dummy.updateMatrix();
                    trunks.setMatrixAt(i, dummy.matrix);
                    leaves.setMatrixAt(i, dummy.matrix);
                } else {
                    // Hide if invalid
                    dummy.position.set(0, -1000, 0);
                    dummy.updateMatrix();
                    trunks.setMatrixAt(i, dummy.matrix);
                    leaves.setMatrixAt(i, dummy.matrix);
                }
            }
            this.propsGroup.add(trunks);
            this.propsGroup.add(leaves);
        }

        if (numRocks > 0) {
            const rocks = new THREE.InstancedMesh(rockGeo, rockMat, numRocks);
            rocks.castShadow = true;
            const dummy = new THREE.Object3D();

            for(let i=0; i<numRocks; i++) {
                const localX = (rng() - 0.5) * CHUNK_SIZE;
                const localZ = (rng() - 0.5) * CHUNK_SIZE;
                const worldX = this.offsetX + localX;
                const worldZ = this.offsetZ + localZ;
                const y = getHeightAt(worldX, worldZ);

                if (y > 1) {
                    const scale = 0.5 + rng() * 1.5;
                    dummy.position.set(localX, y - 0.5, localZ); // Sink slightly into ground
                    dummy.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
                    dummy.scale.set(scale, scale, scale);
                    dummy.updateMatrix();
                    rocks.setMatrixAt(i, dummy.matrix);
                } else {
                     dummy.position.set(0, -1000, 0);
                     dummy.updateMatrix();
                     rocks.setMatrixAt(i, dummy.matrix);
                }
            }
            this.propsGroup.add(rocks);
        }

        this.propsGroup.position.set(this.offsetX, 0, this.offsetZ);
        this.scene.add(this.propsGroup);

        // Spawn Radios
        this.radios = [];
        if (rng() < 0.6) { // 60% chance for a radio
            const numRadios = Math.floor(rng() * 2) + 1; // 1 to 2
            for(let i=0; i<numRadios; i++) {
                const localX = (rng() - 0.5) * CHUNK_SIZE;
                const localZ = (rng() - 0.5) * CHUNK_SIZE;
                const worldX = this.offsetX + localX;
                const worldZ = this.offsetZ + localZ;
                const y = getHeightAt(worldX, worldZ);
                if (y > 2) { 
                    const radioID = `${this.chunkX},${this.chunkZ}-${i}`;
                    if (this.world && !this.world.removedRadioIDs.has(radioID)) {
                        const radio = new Radio(this.scene, audioListener, worldX, y, worldZ, rng);
                        radio.id = radioID;
                        radio.group.rotation.y = rng() * Math.PI * 2;
                        this.radios.push(radio);
                    }
                }
            }
        }

        // Spawn Stone Giants
        if (rng() < 0.4) { // 40% chance per chunk
            const numGiants = Math.floor(rng() * 2) + 1; // 1 to 2 giants
            for (let i = 0; i < numGiants; i++) {
                const localX = (rng() - 0.5) * CHUNK_SIZE;
                const localZ = (rng() - 0.5) * CHUNK_SIZE;
                const worldX = this.offsetX + localX;
                const worldZ = this.offsetZ + localZ;
                const giantID = `giant-${this.chunkX},${this.chunkZ}-${i}`;
                const giant = new StoneGiant(this.scene, rng, worldX, worldZ, giantID);
                this.giants.push(giant);
            }
        }
    }

    update(delta) {
        for (const giant of this.giants) {
            giant.update(delta);
        }
    }

    dispose() {
        // Clean up memory
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            // Don't dispose shared materials
        }
        if (this.propsGroup) {
            this.scene.remove(this.propsGroup);
            this.propsGroup.children.forEach(child => {
                if(child.isInstancedMesh) child.dispose();
            });
        }
        for (const giant of this.giants) {
            giant.dispose();
        }
        for (const radio of this.radios) {
            radio.dispose();
        }
    }
}