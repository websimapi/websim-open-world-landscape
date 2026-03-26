import * as THREE from 'three';
import { getHeightAt } from './utils.js';
import { giantGeos, stoneMat } from './assets.js';

export class StoneGiant {
    constructor(scene, rng, worldX, worldZ) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.position.set(worldX, 0, worldZ);
        
        this.scale = 0.5 + rng() * 1.5;
        this.group.scale.set(this.scale, this.scale, this.scale);
        
        this.eyeColor = new THREE.Color().setHSL(rng(), 1.0, 0.5);
        this.eyeMat = new THREE.MeshBasicMaterial({ color: this.eyeColor });
        
        this.direction = rng() * Math.PI * 2;
        this.speed = (2.0 + rng() * 2.0) * this.scale;
        this.walkCycle = rng() * Math.PI * 2;
        
        this.buildModel();
        
        this.scene.add(this.group);
    }
    
    buildModel() {
        this.torso = new THREE.Mesh(giantGeos.torso, stoneMat);
        this.torso.castShadow = true;
        this.group.add(this.torso);
        
        this.head = new THREE.Mesh(giantGeos.head, stoneMat);
        this.head.position.y = 1.5;
        this.head.castShadow = true;
        this.torso.add(this.head);
        
        const leftEye = new THREE.Mesh(giantGeos.eye, this.eyeMat);
        leftEye.position.set(-0.3, 0.6, 0.61);
        this.head.add(leftEye);
        
        const rightEye = new THREE.Mesh(giantGeos.eye, this.eyeMat);
        rightEye.position.set(0.3, 0.6, 0.61);
        this.head.add(rightEye);
        
        // Small point light to illuminate the giant's face
        const eyeLight = new THREE.PointLight(this.eyeColor, 2, 6 * this.scale);
        eyeLight.position.set(0, 0.6, 1.0);
        this.head.add(eyeLight);
        
        this.leftUpperArm = new THREE.Mesh(giantGeos.upperArm, stoneMat);
        this.leftUpperArm.position.set(-1.4, 1.5, 0);
        this.leftUpperArm.castShadow = true;
        this.torso.add(this.leftUpperArm);
        
        this.leftLowerArm = new THREE.Mesh(giantGeos.lowerArm, stoneMat);
        this.leftLowerArm.position.set(0, -2, 0);
        this.leftLowerArm.castShadow = true;
        this.leftUpperArm.add(this.leftLowerArm);
        
        this.rightUpperArm = new THREE.Mesh(giantGeos.upperArm, stoneMat);
        this.rightUpperArm.position.set(1.4, 1.5, 0);
        this.rightUpperArm.castShadow = true;
        this.torso.add(this.rightUpperArm);
        
        this.rightLowerArm = new THREE.Mesh(giantGeos.lowerArm, stoneMat);
        this.rightLowerArm.position.set(0, -2, 0);
        this.rightLowerArm.castShadow = true;
        this.rightUpperArm.add(this.rightLowerArm);
        
        this.leftThigh = new THREE.Mesh(giantGeos.thigh, stoneMat);
        this.leftThigh.position.set(-0.6, -1.5, 0);
        this.leftThigh.castShadow = true;
        this.torso.add(this.leftThigh);
        
        this.leftCalf = new THREE.Mesh(giantGeos.calf, stoneMat);
        this.leftCalf.position.set(0, -2.5, 0);
        this.leftCalf.castShadow = true;
        this.leftThigh.add(this.leftCalf);
        
        this.rightThigh = new THREE.Mesh(giantGeos.thigh, stoneMat);
        this.rightThigh.position.set(0.6, -1.5, 0);
        this.rightThigh.castShadow = true;
        this.torso.add(this.rightThigh);
        
        this.rightCalf = new THREE.Mesh(giantGeos.calf, stoneMat);
        this.rightCalf.position.set(0, -2.5, 0);
        this.rightCalf.castShadow = true;
        this.rightThigh.add(this.rightCalf);
    }
    
    update(delta) {
        this.direction += (Math.random() - 0.5) * delta;
        
        const moveDist = this.speed * delta;
        this.group.position.x += Math.sin(this.direction) * moveDist;
        this.group.position.z += Math.cos(this.direction) * moveDist;
        
        const y = getHeightAt(this.group.position.x, this.group.position.z);
        
        const pivotYOffset = 6.5 * this.scale;
        const bobbing = Math.abs(Math.sin(this.walkCycle)) * 0.3 * this.scale;
        this.group.position.y = y + pivotYOffset + bobbing;
        
        this.group.rotation.y = this.direction;
        
        this.walkCycle += (this.speed / this.scale) * delta * 0.8;
        
        this.leftThigh.rotation.x = Math.sin(this.walkCycle) * 0.8;
        this.rightThigh.rotation.x = Math.sin(this.walkCycle + Math.PI) * 0.8;
        
        this.leftCalf.rotation.x = Math.max(0, -Math.sin(this.walkCycle)) * 1.2;
        this.rightCalf.rotation.x = Math.max(0, -Math.sin(this.walkCycle + Math.PI)) * 1.2;
        
        this.leftUpperArm.rotation.x = Math.sin(this.walkCycle + Math.PI) * 0.8;
        this.rightUpperArm.rotation.x = Math.sin(this.walkCycle) * 0.8;
        
        this.leftLowerArm.rotation.x = -Math.max(0, -Math.sin(this.walkCycle + Math.PI)) * 1.2;
        this.rightLowerArm.rotation.x = -Math.max(0, -Math.sin(this.walkCycle)) * 1.2;
        
        this.torso.rotation.y = Math.sin(this.walkCycle) * 0.2;
        this.head.rotation.y = -Math.sin(this.walkCycle) * 0.2;
    }
    
    dispose() {
        this.scene.remove(this.group);
        this.eyeMat.dispose();
    }
}