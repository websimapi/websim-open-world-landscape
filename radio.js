import * as THREE from 'three';

// Live internet radio streams (SomaFM - highly reliable and CORS friendly)
const SONGS = [
    { url: 'https://ice1.somafm.com/groovesalad-128-mp3', name: 'Groove Salad' },
    { url: 'https://ice1.somafm.com/secretagent-128-mp3', name: 'Secret Agent' },
    { url: 'https://ice1.somafm.com/spacestation-128-mp3', name: 'Space Station' },
    { url: 'https://ice1.somafm.com/defcon-128-mp3', name: 'DEF CON Radio' },
    { url: 'https://ice1.somafm.com/poptron-128-mp3', name: 'PopTron' },
    { url: 'https://ice1.somafm.com/dubstep-128-mp3', name: 'Dubstep Beyond' }
];

// Dynamically generate an L.E.D Screen texture
function createLEDScreen(text, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#' + new THREE.Color(colorHex).getHexString();
    ctx.font = 'bold 50px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Grid scanline overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for(let i=0; i<canvas.height; i+=4) {
        ctx.fillRect(0, i, canvas.width, 1);
    }
    for(let i=0; i<canvas.width; i+=4) {
        ctx.fillRect(i, 0, 1, canvas.height);
    }
    
    return new THREE.CanvasTexture(canvas);
}

export class Radio {
    constructor(scene, listener, x, y, z, rng = Math.random, savedData = null) {
        this.scene = scene;
        this.listener = listener;
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        
        if (savedData) {
            this.color = savedData.color;
            this.scale = savedData.scale;
            this.song = savedData.song;
        } else {
            this.color = new THREE.Color().setHSL(rng(), 1.0, 0.5).getHex();
            this.scale = 0.5 + rng() * 1.5;
            this.song = SONGS[Math.floor(rng() * SONGS.length)];
        }
        
        this.group.scale.set(this.scale, this.scale, this.scale);
        this.group.userData = { isRadio: true, radioInstance: this };
        
        this.buildModel();
        this.setupAudio();
        
        this.scene.add(this.group);
    }
    
    buildModel() {
        const bodyGeo = new THREE.BoxGeometry(1.5, 1, 0.5).translate(0, 0.5, 0);
        const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.6, metalness: 0.2 });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.castShadow = true;
        this.body.userData = { isRadio: true, radioInstance: this };
        this.group.add(this.body);
        
        const screenGeo = new THREE.PlaneGeometry(1.2, 0.4);
        const screenTex = createLEDScreen(this.song.name, this.color);
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
        this.screen = new THREE.Mesh(screenGeo, screenMat);
        this.screen.position.set(0, 0.5, 0.251);
        this.screen.userData = { isRadio: true, radioInstance: this };
        this.group.add(this.screen);
        
        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 1).translate(0, 0.5, 0);
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(-0.6, 1, 0);
        antenna.rotation.z = 0.2;
        this.group.add(antenna);
    }
    
    setupAudio() {
        this.sound = new THREE.PositionalAudio(this.listener);
        // Linear distance model strictly cuts off audio beyond maxDistance (no far range bleed)
        this.sound.setDistanceModel('linear');
        this.sound.setRefDistance(2);
        this.sound.setMaxDistance(25);
        this.sound.setRolloffFactor(1);
        
        // Use HTMLAudioElement to support continuous live streaming URLs
        this.audioElement = document.createElement('audio');
        this.audioElement.src = this.song.url;
        this.audioElement.crossOrigin = 'anonymous';
        this.audioElement.loop = true;
        this.audioElement.volume = 1.0;
        
        // Try to play immediately; handle browser autoplay restrictions gracefully
        this.audioElement.play().catch(e => {
            const playOnInteract = () => {
                if (this.audioElement) this.audioElement.play();
                window.removeEventListener('click', playOnInteract);
                window.removeEventListener('touchstart', playOnInteract);
            };
            window.addEventListener('click', playOnInteract);
            window.addEventListener('touchstart', playOnInteract);
        });
        
        this.sound.setMediaElementSource(this.audioElement);
        this.group.add(this.sound);
    }
    
    serialize() {
        return {
            x: this.group.position.x,
            y: this.group.position.y,
            z: this.group.position.z,
            color: this.color,
            scale: this.scale,
            song: this.song
        };
    }
    
    dispose() {
        this.scene.remove(this.group);
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.removeAttribute('src');
            this.audioElement.load();
            this.audioElement = null;
        }
        if (this.sound) {
            if (this.sound.isPlaying) this.sound.stop();
            this.sound.disconnect();
        }
        
        this.body.geometry.dispose();
        this.body.material.dispose();
        this.screen.geometry.dispose();
        this.screen.material.map.dispose();
        this.screen.material.dispose();
    }
}