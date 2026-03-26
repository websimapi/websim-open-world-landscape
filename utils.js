import { createNoise2D } from 'simplex-noise';

// Seeded random number generator (Mulberry32)
export function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

import { WORLD_SEED } from './constants.js';

const globalRng = mulberry32(WORLD_SEED);

// Initialize Simplex Noise with our seeded RNG
const noise2D = createNoise2D(globalRng);

// Terrain configuration
const TERRAIN_CONFIG = {
    scale: 0.01,
    octaves: 3,
    persistence: 0.5,
    lacunarity: 2,
    amplitude: 25,
    exponent: 1.5 // Adds valleys/peaks shaping
};

// Calculate height at any given x, z coordinate using Fractal Brownian Motion
export function getHeightAt(x, z) {
    let total = 0;
    let frequency = TERRAIN_CONFIG.scale;
    let amplitude = 1;
    let maxValue = 0;  // Used for normalizing result to 0.0 - 1.0
    
    for(let i=0;i<TERRAIN_CONFIG.octaves;i++) {
        // noise2D returns -1 to 1. 
        total += noise2D(x * frequency, z * frequency) * amplitude;
        
        maxValue += amplitude;
        
        amplitude *= TERRAIN_CONFIG.persistence;
        frequency *= TERRAIN_CONFIG.lacunarity;
    }
    
    // Normalize to -1 to 1, then map to 0 to 1
    let normalized = (total / maxValue);
    
    // Apply exponent to make valleys flatter and peaks sharper
    let height = Math.pow((normalized + 1) * 0.5, TERRAIN_CONFIG.exponent);
    
    return (height * TERRAIN_CONFIG.amplitude) - (TERRAIN_CONFIG.amplitude * 0.2); // offset so sea level is slightly > 0
}

// Helper to create a seeded RNG for a specific chunk to ensure deterministic prop placement
export function getChunkRng(chunkX, chunkZ) {
    // Combine chunk coords and global seed to create a unique seed for this chunk
    // Cantor pairing function modified for negatives
    const a = chunkX >= 0 ? 2 * chunkX : -2 * chunkX - 1;
    const b = chunkZ >= 0 ? 2 * chunkZ : -2 * chunkZ - 1;
    const chunkSeed = WORLD_SEED + (0.5 * (a + b) * (a + b + 1) + b);
    return mulberry32(chunkSeed);
}