import * as THREE from 'three';
import nipplejs from 'nipplejs';

export class InputController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // State
        this.isMobile = /Mobi|Android/i.test(navigator.userAgent) || ('ontouchstart' in window);
        this.moveVector = new THREE.Vector2(0, 0);
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Pitch, Yaw, Roll
        
        // Config
        this.lookSensitivity = this.isMobile ? 0.005 : 0.002;
        this.minPolarAngle = -Math.PI / 2 + 0.1; // Don't look past straight up
        this.maxPolarAngle = Math.PI / 2 - 0.1;  // Don't look past straight down
        
        this.isLocked = false; // For desktop pointer lock
        this.keys = { forward: false, backward: false, left: false, right: false };

        this.init();
    }

    init() {
        if (this.isMobile) {
            this.initMobileControls();
        } else {
            this.initDesktopControls();
        }
    }

    initDesktopControls() {
        const startBtn = document.getElementById('start-btn');
        const startScreen = document.getElementById('start-screen');

        startBtn.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.domElement) {
                this.isLocked = true;
                startScreen.style.display = 'none';
            } else {
                this.isLocked = false;
                startScreen.style.display = 'flex';
            }
        });

        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousedown', (e) => {
            if (this.isLocked && this.onInteract) {
                this.onInteract(0, 0); // Raycast from center on desktop
            }
        });
    }

    initMobileControls() {
        document.getElementById('mobile-ui').style.display = 'block';
        
        // Hide start screen immediately on tap
        const startBtn = document.getElementById('start-btn');
        const startScreen = document.getElementById('start-screen');
        startBtn.addEventListener('click', () => {
            startScreen.style.display = 'none';
            this.isLocked = true; // functionally 'active'
        });

        // 1. Joystick for movement
        const joystickZone = document.getElementById('joystick-zone');
        this.joystickManager = nipplejs.create({
            zone: joystickZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
            size: 100
        });

        this.joystickManager.on('move', (evt, data) => {
            if (!this.isLocked) return;
            // Mapping joystick angle and force to WASD style vector
            const forward = Math.sin(data.angle.radian) * data.force;
            const right = Math.cos(data.angle.radian) * data.force;
            
            // Normalize force to max 1
            const clampedForce = Math.min(data.force, 1.0);
            
            // Vector pointing in direction relative to camera
            this.moveVector.set(right, -forward).normalize().multiplyScalar(clampedForce);
        });

        this.joystickManager.on('end', () => {
            this.moveVector.set(0, 0);
        });

        // 2. Touch drag for looking
        const lookZone = document.getElementById('touch-look-zone');
        let lastTouchX = 0;
        let lastTouchY = 0;

        let touchMoved = false;

        lookZone.addEventListener('touchstart', (e) => {
            if (e.targetTouches.length > 0) {
                const touch = e.targetTouches[0];
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
                touchMoved = false;
            }
        }, { passive: false });

        lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (!this.isLocked) return;

            if (e.targetTouches.length > 0) {
                const touch = e.targetTouches[0];
                const movementX = touch.clientX - lastTouchX;
                const movementY = touch.clientY - lastTouchY;
                
                if (Math.abs(movementX) > 2 || Math.abs(movementY) > 2) touchMoved = true;

                this.updateLook(movementX, movementY);

                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
            }
        }, { passive: false });

        lookZone.addEventListener('touchend', (e) => {
            if (!touchMoved && this.onInteract) {
                const rect = lookZone.getBoundingClientRect();
                const x = ((lastTouchX - rect.left) / rect.width) * 2 - 1;
                const y = -((lastTouchY - rect.top) / rect.height) * 2 + 1;
                this.onInteract(x, y);
            }
        });
    }

    onMouseMove(event) {
        if (!this.isLocked) return;
        this.updateLook(event.movementX, event.movementY);
    }

    updateLook(movementX, movementY) {
        this.euler.setFromQuaternion(this.camera.quaternion);

        this.euler.y -= movementX * this.lookSensitivity;
        this.euler.x -= movementY * this.lookSensitivity;

        // Clamp vertical rotation
        this.euler.x = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.euler.x));

        this.camera.quaternion.setFromEuler(this.euler);
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.keys.forward = true; break;
            case 'ArrowLeft':
            case 'KeyA': this.keys.left = true; break;
            case 'ArrowDown':
            case 'KeyS': this.keys.backward = true; break;
            case 'ArrowRight':
            case 'KeyD': this.keys.right = true; break;
        }
        this.updateKeyboardVector();
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.keys.forward = false; break;
            case 'ArrowLeft':
            case 'KeyA': this.keys.left = false; break;
            case 'ArrowDown':
            case 'KeyS': this.keys.backward = false; break;
            case 'ArrowRight':
            case 'KeyD': this.keys.right = false; break;
        }
        this.updateKeyboardVector();
    }

    updateKeyboardVector() {
        this.moveVector.set(0, 0);
        if (this.keys.forward) this.moveVector.y -= 1;
        if (this.backward) this.moveVector.y += 1; // Handled below
        if (this.keys.backward) this.moveVector.y += 1;
        if (this.keys.left) this.moveVector.x -= 1;
        if (this.keys.right) this.moveVector.x += 1;
        
        if (this.moveVector.lengthSq() > 0) {
            this.moveVector.normalize();
        }
    }

    // Returns a vector indicating movement intent relative to the camera's yaw
    getMovementDirection() {
        // Extract yaw from camera
        this.euler.setFromQuaternion(this.camera.quaternion);
        const yaw = this.euler.y;
        
        const dir = new THREE.Vector3(this.moveVector.x, 0, this.moveVector.y);
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        
        return dir;
    }
}