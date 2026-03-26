import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_RESOLUTION } from './constants.js';

// Terrain
export const chunkGeoTemplate = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RESOLUTION, CHUNK_RESOLUTION);
chunkGeoTemplate.rotateX(-Math.PI / 2);

export const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x4CAF50,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: true
});

// Props
export const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 5).translate(0, 1.5, 0);
export const leavesGeo = new THREE.IcosahedronGeometry(2.5, 0).translate(0, 3.5, 0);
export const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);

export const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, flatShading: true });
export const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, flatShading: true });
export const rockMat = new THREE.MeshStandardMaterial({ color: 0x7F8C8D, flatShading: true });

// Giant
export const giantGeos = {
    torso: new THREE.BoxGeometry(2, 3, 1.5),
    head: new THREE.BoxGeometry(1.2, 1.2, 1.2).translate(0, 0.6, 0),
    upperArm: new THREE.BoxGeometry(0.8, 2, 0.8).translate(0, -1, 0),
    lowerArm: new THREE.BoxGeometry(0.7, 2, 0.7).translate(0, -1, 0),
    thigh: new THREE.BoxGeometry(1, 2.5, 1).translate(0, -1.25, 0),
    calf: new THREE.BoxGeometry(0.9, 2.5, 0.9).translate(0, -1.25, 0),
    eye: new THREE.BoxGeometry(0.2, 0.2, 0.1)
};
export const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8, flatShading: true });