import * as THREE from 'three';
import { WorldManager } from './world.js';
import { RENDER_DISTANCE, CHUNK_SIZE } from './constants.js';
import { InputController } from './controls.js';
import { Radio } from './radio.js';
import { audioListener } from './audio.js';
import { initNetwork, room, networkWorldData, saveCollabNotes, collabNotes, dbRecord, playerState, updateNetworkData } from './network.js';

// Wait for database sync before starting application completely
await initNetwork();

// Application State
const state = {
    moveSpeed: 15.0,
    playerHeight: 2.0,
    money: playerState.money || 0,
    inventory: playerState.inventory || [],
    buildMode: false,
    selectedRadioData: null,
    hologram: null
};

// Periodic save for player state
setInterval(() => {
    savePlayerState();
}, 5000);

function savePlayerState() {
    playerState.money = state.money;
    playerState.inventory = state.inventory;
    playerState.position = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        rotY: camera.rotation.y
    };
    updateNetworkData();
}

// Hologram material
const hologramMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.5 });

// 1. Setup Three.js Scene
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const skyColor = 0x87CEEB;
scene.background = new THREE.Color(skyColor);

// Fog setup tied to render distance to smoothly fade out chunks
const fogDistance = (RENDER_DISTANCE * CHUNK_SIZE) - (CHUNK_SIZE/2);
scene.fog = new THREE.Fog(skyColor, fogDistance * 0.5, fogDistance);

// 2. Camera Setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.add(audioListener);
// Start position
const startX = 0;
const startZ = 0;

// 3. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 50);
dirLight.castShadow = true;
// Optimize shadow map
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -200;
dirLight.shadow.camera.right = 200;
dirLight.shadow.camera.top = 200;
dirLight.shadow.camera.bottom = -200;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// 4. Initialization
const world = new WorldManager(scene);
// Load persistent world modifications from our synced DB row
world.loadSyncedState(networkWorldData);

const controls = new InputController(camera, canvas);

// UI Elements & Flow
const radioMenu = document.getElementById('radio-menu');
const invPanel = document.getElementById('inventory-panel');
const buildUI = document.getElementById('build-ui');
const moneyDisplay = document.getElementById('money-display');
const invList = document.getElementById('inventory-list');
const btnInventory = document.getElementById('btn-inventory');
let currentRadio = null;

document.getElementById('start-btn').addEventListener('click', () => {
    if (audioListener.context.state === 'suspended') audioListener.context.resume();
    btnInventory.style.display = 'block';
});

// Interaction
const raycaster = new THREE.Raycaster();
controls.onInteract = (nx, ny) => {
    if (state.buildMode) {
        document.getElementById('btn-place').click();
        return;
    }
    
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const intersects = raycaster.intersectObjects(world.getInteractables(), true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while(obj && !obj.userData.isRadio) obj = obj.parent;
        if (obj && obj.userData.isRadio) openRadioMenu(obj.userData.radioInstance);
    }
};

function unlockControls() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    controls.isLocked = false;
}

function lockControls() {
    if (!controls.isMobile) canvas.requestPointerLock();
    else controls.isLocked = true;
}

function openRadioMenu(radio) {
    currentRadio = radio;
    document.getElementById('radio-song-name').innerText = "Playing: " + radio.song.name;
    radioMenu.style.display = 'block';
    unlockControls();
}

document.getElementById('btn-close-radio').addEventListener('click', () => {
    radioMenu.style.display = 'none';
    currentRadio = null;
    lockControls();
});

document.getElementById('btn-sell').addEventListener('click', () => {
    if (currentRadio) {
        state.money += 50;
        moneyDisplay.innerText = state.money;
        world.removeRadio(currentRadio, true);
        savePlayerState();
    }
    radioMenu.style.display = 'none';
    currentRadio = null;
    lockControls();
});

document.getElementById('btn-collect').addEventListener('click', () => {
    if (currentRadio) {
        state.inventory.push(currentRadio.serialize());
        world.removeRadio(currentRadio, true);
        updateInventoryUI();
        savePlayerState();
    }
    radioMenu.style.display = 'none';
    currentRadio = null;
    lockControls();
});

btnInventory.addEventListener('click', () => {
    invPanel.style.display = 'block';
    unlockControls();
});

document.getElementById('btn-close-inv').addEventListener('click', () => {
    invPanel.style.display = 'none';
    lockControls();
});

function updateInventoryUI() {
    invList.innerHTML = '';
    state.inventory.forEach((radioData, index) => {
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.margin = '5px 0';
        div.style.background = '#222';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        
        const colorBox = document.createElement('span');
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = '#' + new THREE.Color(radioData.color).getHexString();
        colorBox.style.marginRight = '10px';
        
        const text = document.createElement('span');
        text.innerText = radioData.song.name;
        
        div.appendChild(colorBox);
        div.appendChild(text);
        
        div.addEventListener('click', () => enterBuildMode(index));
        invList.appendChild(div);
    });
}

function enterBuildMode(invIndex) {
    invPanel.style.display = 'none';
    state.buildMode = true;
    state.selectedRadioData = state.inventory[invIndex];
    state.inventory.splice(invIndex, 1);
    updateInventoryUI();
    
    const geo = new THREE.BoxGeometry(1.5, 1, 0.5).translate(0, 0.5, 0);
    state.hologram = new THREE.Mesh(geo, hologramMat);
    const s = state.selectedRadioData.scale;
    state.hologram.scale.set(s, s, s);
    scene.add(state.hologram);
    
    buildUI.style.display = 'block';
    lockControls();
}

document.getElementById('btn-cancel-build').addEventListener('click', () => {
    state.inventory.push(state.selectedRadioData);
    updateInventoryUI();
    exitBuildMode();
});

document.getElementById('btn-place').addEventListener('click', () => {
    if (state.hologram) {
        state.selectedRadioData.x = state.hologram.position.x;
        state.selectedRadioData.y = state.hologram.position.y;
        state.selectedRadioData.z = state.hologram.position.z;
        const placed = new Radio(scene, audioListener, state.hologram.position.x, state.hologram.position.y, state.hologram.position.z, Math.random, state.selectedRadioData);
        placed.group.rotation.y = state.hologram.rotation.y;
        world.addPlacedRadio(placed, true);
        savePlayerState();
    }
    exitBuildMode();
});

function exitBuildMode() {
    state.buildMode = false;
    state.selectedRadioData = null;
    if (state.hologram) {
        scene.remove(state.hologram);
        state.hologram.geometry.dispose();
        state.hologram = null;
    }
    buildUI.style.display = 'none';
}

// Dev Panel Setup
const devPanel = document.getElementById('dev-panel');
const devNotes = document.getElementById('dev-notes');
const btnDevToggle = document.getElementById('btn-dev-toggle');

// Populate DB info
if (dbRecord) document.getElementById('dev-db-id').innerText = dbRecord.id;
document.getElementById('dev-removed-count').innerText = networkWorldData.removedRadioIDs.length;
document.getElementById('dev-placed-count').innerText = networkWorldData.placedRadios.length;
devNotes.value = collabNotes;

function toggleDevPanel() {
    if (devPanel.style.display === 'none') {
        devPanel.style.display = 'block';
        unlockControls();
    } else {
        devPanel.style.display = 'none';
        lockControls();
    }
}

btnDevToggle.addEventListener('click', toggleDevPanel);
document.getElementById('btn-close-dev').addEventListener('click', toggleDevPanel);
document.getElementById('btn-save-notes').addEventListener('click', () => {
    saveCollabNotes(devNotes.value);
    document.getElementById('btn-save-notes').innerText = "Saved!";
    setTimeout(() => document.getElementById('btn-save-notes').innerText = "Save Notes", 2000);
});

// Tilde key listener for fast dev panel access
document.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '~') {
        toggleDevPanel();
    }
});

// Multiplayer System Initialization [PRODUCTION HOTSWAP - Client Interpolation]
const playerMeshes = new Map();
function getPlayerMesh(username, avatarUrl) {
    const group = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(1, 2, 1).translate(0, 1, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    
    // Name Tag Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '24px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(username || "Player", 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 2.5;
    sprite.scale.set(3, 0.75, 1);
    group.add(sprite);
    
    return group;
}


// Get initial ground height
const startX = playerState.position?.x || 0;
const startZ = playerState.position?.z || 0;
world.update(startX, startZ); // Force initial chunk generation

let startY = playerState.position?.y;
if (startY === undefined) {
    startY = world.getGroundHeight(startX, startZ) + state.playerHeight;
}
camera.position.set(startX, startY, startZ);

if (playerState.position?.rotY) {
    camera.rotation.y = playerState.position.rotY;
    controls.euler.setFromQuaternion(camera.quaternion);
}

// Ensure UI matches state on load
document.getElementById('money-display').innerText = state.money;
updateInventoryUI();

// 5. Main Game Loop
const clock = new THREE.Clock();
let networkTickTimer = 0;

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta to prevent huge jumps

    if (controls.isLocked) {
        // Calculate movement
        const moveDir = controls.getMovementDirection();
        
        // Tentative new position
        const newX = camera.position.x + moveDir.x * state.moveSpeed * delta;
        const newZ = camera.position.z + moveDir.z * state.moveSpeed * delta;
        
        // Terrain collision (sample height at new position)
        const groundHeight = world.getGroundHeight(newX, newZ);
        
        // Apply position
        camera.position.x = newX;
        camera.position.z = newZ;
        
        // Smoothly interpolate Y position for stairs/hills effect
        const targetY = groundHeight + state.playerHeight;
        camera.position.y += (targetY - camera.position.y) * 10 * delta; 
        
        // Keep directional light near player for shadows
        dirLight.position.set(camera.position.x + 100, 200, camera.position.z + 50);
        dirLight.target.position.set(camera.position.x, 0, camera.position.z);
        dirLight.target.updateMatrixWorld();
    }

    if (state.buildMode && state.hologram) {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        dir.y = 0; dir.normalize();
        
        const dist = 5.0;
        const hx = camera.position.x + dir.x * dist;
        const hz = camera.position.z + dir.z * dist;
        const hy = world.getGroundHeight(hx, hz);
        
        state.hologram.position.set(hx, hy, hz);
        state.hologram.lookAt(camera.position.x, hy, camera.position.z);
    }

    // Multiplayer Logic: Update Presence & Render Peers
    networkTickTimer += delta;
    if (networkTickTimer > 0.1) { // 10Hz network tick
        networkTickTimer = 0;
        room.updatePresence({
            x: camera.position.x,
            y: camera.position.y - state.playerHeight, // send ground position
            z: camera.position.z,
            rotY: camera.rotation.y
        });
    }

    // Process Presence Data from other players
    let activePeers = 1;
    for (const [peerId, peerState] of Object.entries(room.presence)) {
        if (peerId === room.clientId) continue; // Skip ourselves
        activePeers++;
        
        let mesh = playerMeshes.get(peerId);
        if (!mesh) {
            mesh = getPlayerMesh(room.peers[peerId]?.username);
            scene.add(mesh);
            playerMeshes.set(peerId, mesh);
        }
        
        // Linear interpolation for smooth remote player movement
        mesh.position.lerp(new THREE.Vector3(peerState.x, peerState.y, peerState.z), 0.2);
        
        // Quick rotation snap (could be slerped in production)
        mesh.rotation.y = peerState.rotY || 0;
    }
    
    // Cleanup disconnected players
    for (const [peerId, mesh] of playerMeshes.entries()) {
        if (!room.presence[peerId]) {
            scene.remove(mesh);
            playerMeshes.delete(peerId);
        }
    }
    document.getElementById('dev-peers').innerText = activePeers;

    // Update world manager to handle chunks and animations unconditionally
    world.update(camera.position.x, camera.position.z, delta);

    renderer.render(scene, camera);
}

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start loop
animate();