/*
 * ==============================================================================
 * [PRODUCTION HOTSWAP GUIDE]
 * ==============================================================================
 * This file contains the entire network and persistence layer, abstracted via
 * WebsimSocket. 
 * 
 * WHEN MIGRATING TO A DEDICATED STABLE SERVER (Node.js/Socket.io + Database):
 * 
 * 1. REALTIME PRESENCE (Player Movement):
 *    - Replace `room.updatePresence` with `socket.emit('playerMoved', state)`
 *    - Replace `room.subscribePresence` with `socket.on('peersUpdate', ...)`
 *    - Ensure you interpolate movement on the client to handle network latency.
 * 
 * 2. DATABASE PERSISTENCE:
 *    - Currently, we use the constraint: "Each user has 1 row in the DB". 
 *    - We fetch ALL rows, merge the `worldData` JSON (chunks), and rewrite 
 *      the merged state back to the local user's row to ensure everyone is synced.
 *    - IN PRODUCTION: The *server* should handle this merging in memory/DB, and 
 *      simply send a single consolidated WorldState payload to the client upon login.
 *      Replace `collection('collab_state_v1')` calls with standard REST/GraphQL calls.
 * ==============================================================================
 */

export const room = new WebsimSocket();
export let dbRecord = null;
export let networkWorldData = {
    removedRadioIDs: [],
    placedRadios: []
};
export let collabNotes = "";

// Initialize network and handle the unique 1-row-per-user DB syncing requirement
export async function initNetwork() {
    await room.initialize();
    
    // Fetch all user rows in the database
    const records = await room.collection('collab_state_v1').getList();
    
    let mergedWorldData = { removedRadioIDs: [], placedRadios: [] };
    let mergedNotesArray = [];
    let myRecord = null;
    
    // Iterate over all users' data rows and merge their chunk/world data into ours
    for (const rec of records) {
        if (rec.username === room.peers[room.clientId]?.username) {
            myRecord = rec;
        }
        
        // Merge World Data JSON (Column 1 equivalent)
        if (rec.worldData) {
            try {
                const wd = JSON.parse(rec.worldData);
                if (wd.removedRadioIDs) mergedWorldData.removedRadioIDs.push(...wd.removedRadioIDs);
                if (wd.placedRadios) mergedWorldData.placedRadios.push(...wd.placedRadios);
            } catch (e) {
                console.error("Failed to parse world data from row", rec.id);
            }
        }
        
        // Merge notes (Column 2 equivalent)
        if (rec.notes) {
            mergedNotesArray.push(`--- Note by ${rec.username} ---\n${rec.notes}`);
        }
    }
    
    // Deduplicate merged chunk data
    networkWorldData.removedRadioIDs = [...new Set(mergedWorldData.removedRadioIDs)];
    
    // For placed radios, we use a basic position-based deduplication to prevent overlaying
    const uniquePlaced = new Map();
    mergedWorldData.placedRadios.forEach(radio => {
        const key = `${radio.x.toFixed(2)},${radio.y.toFixed(2)},${radio.z.toFixed(2)}`;
        uniquePlaced.set(key, radio);
    });
    networkWorldData.placedRadios = Array.from(uniquePlaced.values());
    
    // Keep notes history
    collabNotes = myRecord ? myRecord.notes : "Welcome to the collab project!\n";
    
    // Overwrite OUR single row with the synced global state (per user instructions)
    const payload = {
        worldData: JSON.stringify(networkWorldData),
        notes: collabNotes
    };
    
    if (myRecord) {
        await room.collection('collab_state_v1').update(myRecord.id, payload);
        dbRecord = { ...myRecord, ...payload };
    } else {
        dbRecord = await room.collection('collab_state_v1').create(payload);
    }
}

// Function to save modifications dynamically to our row
export async function updateNetworkWorldData() {
    if (!dbRecord) return;
    try {
        await room.collection('collab_state_v1').update(dbRecord.id, {
            worldData: JSON.stringify(networkWorldData)
        });
    } catch (e) {
        console.error("Failed to sync chunk update to DB", e);
    }
}

export async function addRemovedRadioToDB(id) {
    if (!networkWorldData.removedRadioIDs.includes(id)) {
        networkWorldData.removedRadioIDs.push(id);
        await updateNetworkWorldData();
    }
}

export async function addPlacedRadioToDB(radioData) {
    networkWorldData.placedRadios.push(radioData);
    await updateNetworkWorldData();
}

export async function saveCollabNotes(notesStr) {
    collabNotes = notesStr;
    if (dbRecord) {
        await room.collection('collab_state_v1').update(dbRecord.id, {
            notes: collabNotes
        });
    }
}