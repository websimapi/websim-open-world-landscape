import { Chunk } from './chunk.js';
import { getHeightAt } from './utils.js';
import { CHUNK_SIZE, RENDER_DISTANCE } from './constants.js';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.activeChunks = new Map(); // Key: 'x,z', Value: Chunk instance
        this.lastChunkX = null;
        this.lastChunkZ = null;
        this.placedRadios = [];
        this.removedRadioIDs = new Set();
    }

    update(playerX, playerZ, delta = 0) {
        // Update all active chunks (for animations like giants)
        for (const chunk of this.activeChunks.values()) {
            if (chunk.update) chunk.update(delta);
        }

        // Determine which chunk the player is currently in
        const currentChunkX = Math.floor((playerX + CHUNK_SIZE/2) / CHUNK_SIZE);
        const currentChunkZ = Math.floor((playerZ + CHUNK_SIZE/2) / CHUNK_SIZE);

        // Only update if player moved to a new chunk
        if (this.lastChunkX !== currentChunkX || this.lastChunkZ !== currentChunkZ) {
            this.lastChunkX = currentChunkX;
            this.lastChunkZ = currentChunkZ;
            this.updateChunks(currentChunkX, currentChunkZ);
        }
    }

    updateChunks(centerX, centerZ) {
        const chunksToKeep = new Set();

        // 1. Identify chunks that should be active within render distance
        for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
            for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
                // Optional: circular render distance
                if (x*x + z*z <= RENDER_DISTANCE * RENDER_DISTANCE) {
                    const cx = centerX + x;
                    const cz = centerZ + z;
                    const key = `${cx},${cz}`;
                    chunksToKeep.add(key);

                    // 2. Create if it doesn't exist
                    if (!this.activeChunks.has(key)) {
                        this.activeChunks.set(key, new Chunk(cx, cz, this.scene, this));
                    }
                }
            }
        }

        // 3. Remove chunks outside render distance
        for (const [key, chunk] of this.activeChunks.entries()) {
            if (!chunksToKeep.has(key)) {
                chunk.dispose();
                this.activeChunks.delete(key);
            }
        }
    }
    
    getInteractables() {
        const interactables = [];
        for (const chunk of this.activeChunks.values()) {
            if (chunk.radios) {
                for (const radio of chunk.radios) {
                    interactables.push(radio.group);
                }
            }
        }
        for (const radio of this.placedRadios) {
            interactables.push(radio.group);
        }
        return interactables;
    }

    addPlacedRadio(radio, saveToDB = false) {
        this.placedRadios.push(radio);
        if (saveToDB) {
            import('./network.js').then(net => {
                if(net.addPlacedRadioToDB) net.addPlacedRadioToDB(radio.serialize());
            });
        }
    }

    removeRadio(radio, saveToDB = false) {
        if (radio.id) {
            this.removedRadioIDs.add(radio.id);
            if (saveToDB) import('./network.js').then(net => {
                if(net.addRemovedRadioToDB) net.addRemovedRadioToDB(radio.id);
            });
        }
        
        for (const chunk of this.activeChunks.values()) {
            if (chunk.radios) {
                const index = chunk.radios.indexOf(radio);
                if (index > -1) {
                    chunk.radios.splice(index, 1);
                    radio.dispose();
                    return;
                }
            }
        }
        const index = this.placedRadios.indexOf(radio);
        if (index > -1) {
            this.placedRadios.splice(index, 1);
            radio.dispose();
        }
    }
    
    // Load synced world modifications from the database layer
    loadSyncedState(worldData) {
        if (worldData.removedRadioIDs) {
            worldData.removedRadioIDs.forEach(id => this.removedRadioIDs.add(id));
        }
        if (worldData.placedRadios) {
            // Import dynamically to avoid circular dependencies in constructors if any
            import('./radio.js').then(m => {
                const RadioClass = m.Radio;
                import('./audio.js').then(a => {
                    worldData.placedRadios.forEach(rData => {
                        const r = new RadioClass(this.scene, a.audioListener, rData.x, rData.y, rData.z, Math.random, rData);
                        this.addPlacedRadio(r, false); // false = already in DB, don't resave
                    });
                });
            });
        }
    }

    // Provide collision surface for player
    getGroundHeight(x, z) {
        return getHeightAt(x, z);
    }
}