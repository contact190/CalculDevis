/**
 * LocalSync — Real-time Delta Sync Client for CalculDevis PRO
 * 
 * Connects to the local server via WebSocket and syncs only
 * the changes (deltas/operations), not the full 20MB database.
 * 
 * Flow:
 * 1. Connect to server → request full sync (once)
 * 2. On local change → generate ops → send via WebSocket
 * 3. On remote change → receive ops → apply locally
 * 4. On disconnect → queue ops → replay on reconnect
 */

import { io } from 'socket.io-client';
import { generateOps, applyOps, getDeviceId } from './patchEngine';

let socket = null;
let isConnected = false;
let serverUrl = null;

const PENDING_OPS_KEY = 'calculDevis_pendingOps';

function loadPendingOps() {
  try {
    const saved = localStorage.getItem(PENDING_OPS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

function savePendingOps(queue) {
  try {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Failed to save pending ops queue:", e);
  }
}

// Queue for ops generated while disconnected
let pendingOpsQueue = loadPendingOps();

// Snapshot of last known state (for diffing)
let lastKnownDbSnapshot = null;

// Callbacks
let onOpsReceived = null;      // Called when remote ops arrive: (ops) => void
let onFullRefresh = null;      // Called when full refresh needed: () => void
let onConnectionChange = null; // Called on connect/disconnect: (connected) => void
let onSyncAck = null;          // Called when ops are acknowledged: ({applied, total}) => void

function isLocalEnvironment() {
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname.endsWith('.local')
  );
}

function getServerUrl() {
  if (serverUrl) return serverUrl;
  
  let url = window.location.origin;
  // If running in Vite dev server (port 5173), point to 3001
  if (window.location.port === '5173') {
    url = `http://${window.location.hostname}:3001`;
  }
  serverUrl = url;
  return url;
}

export const localSync = {
  /**
   * Connect to the local server WebSocket
   * 
   * @param {Object} callbacks
   * @param {Function} callbacks.onOpsReceived - (ops: Array) => void — apply these ops to local db
   * @param {Function} callbacks.onFullRefresh - () => void — full db refresh needed (fetch from server)
   * @param {Function} callbacks.onConnectionChange - (connected: boolean) => void
   * @param {Function} callbacks.onSyncAck - ({applied, total}) => void
   */
  connect(callbacks = {}) {
    onOpsReceived = callbacks.onOpsReceived || null;
    onFullRefresh = callbacks.onFullRefresh || null;
    onConnectionChange = callbacks.onConnectionChange || null;
    onSyncAck = callbacks.onSyncAck || null;

    // Avoid connecting to local socket server if we are on a public HTTPS production domain (e.g. GitHub Pages)
    if (window.location.protocol === 'https:' && !isLocalEnvironment()) {
      console.log('ℹ️ LocalSync: Connexion au serveur local ignorée en production HTTPS.');
      return null;
    }

    const url = getServerUrl();
    const deviceId = getDeviceId();

    if (socket) {
      socket.disconnect();
    }

    socket = io(url, {
      reconnection: true,
      reconnectionDelay: 500,       // Faster reconnect
      reconnectionDelayMax: 3000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
      query: { deviceId }
    });

    socket.on('connect', () => {
      isConnected = true;
      console.log('✅ Connecté au Serveur Local (temps réel)');
      if (onConnectionChange) onConnectionChange(true);

      // Replay queued ops on reconnect
      if (pendingOpsQueue.length > 0) {
        console.log(`📤 Envoi de ${pendingOpsQueue.length} opérations en attente...`);
        socket.emit('push_ops', {
          ops: pendingOpsQueue,
          deviceId
        }, (ack) => {
          if (ack && ack.success) {
            console.log(`✅ ${ack.applied}/${ack.total} opérations en attente appliquées`);
            pendingOpsQueue = [];
            savePendingOps(pendingOpsQueue);
          }
        });
      }
    });

    // ─── Receive delta ops from other clients ────────────────────
    socket.on('ops_broadcast', (payload) => {
      const { ops, sourceDeviceId } = payload;
      
      // Ignore our own ops (shouldn't happen since server uses broadcast, but safety)
      if (sourceDeviceId === deviceId) return;
      
      console.log(`📥 ${ops.length} ops reçues de ${sourceDeviceId}`);
      
      if (onOpsReceived && Array.isArray(ops)) {
        onOpsReceived(ops);
      }
    });

    // ─── Full refresh signal (backup restored, legacy push, etc.) ─
    socket.on('full_refresh', (payload) => {
      console.log('🔄 Refresh complet demandé par le serveur:', payload.reason || 'data_updated');
      if (onFullRefresh) onFullRefresh();
    });

    // ─── Legacy compatibility: old data_updated signal ───────────
    socket.on('data_updated', () => {
      console.log('🔄 Signal data_updated (legacy) — refresh complet');
      if (onFullRefresh) onFullRefresh();
    });

    socket.on('disconnect', (reason) => {
      isConnected = false;
      console.warn(`❌ Déconnecté du Serveur Local: ${reason}`);
      if (onConnectionChange) onConnectionChange(false);
    });

    socket.on('connect_error', (error) => {
      isConnected = false;
      // Don't spam console, just log once
    });

    return socket;
  },

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    isConnected = false;
    lastKnownDbSnapshot = null;
  },

  /**
   * Check if connected to server
   */
  isConnected() {
    return isConnected && socket && socket.connected;
  },

  /**
   * Request full database from server (used on initial load)
   * @returns {Promise<Object|null>} Full database or null
   */
  async fetchData() {
    if (window.location.protocol === 'https:' && !isLocalEnvironment()) {
      return null;
    }
    try {
      const url = getServerUrl();
      const res = await fetch(`${url}/api/data`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      lastKnownDbSnapshot = data;
      return data;
    } catch (e) {
      console.error("Failed to fetch from local server:", e);
      return null;
    }
  },

  /**
   * Send delta operations to the server.
   * Computes the diff between the previous known state and the new state,
   * then sends only the changes.
   * 
   * @param {Object} newDb - The new full database state
   * @param {Object} oldDb - The previous database state (optional, uses snapshot if not provided)
   * @returns {Promise<{success: boolean, applied: number, total: number}|null>}
   */
  async pushOps(newDb, oldDb = null) {
    const previousDb = oldDb || lastKnownDbSnapshot;
    
    if (!previousDb) {
      // No previous state — do a full push (first time only)
      return this.pushDataFull(newDb);
    }

    // Generate delta ops
    const ops = generateOps(previousDb, newDb);
    
    if (ops.length === 0) {
      // No changes detected
      return { success: true, applied: 0, total: 0 };
    }

    // Update our snapshot to the new state
    lastKnownDbSnapshot = newDb;

    if (!this.isConnected()) {
      // Queue ops for later
      pendingOpsQueue.push(...ops);
      savePendingOps(pendingOpsQueue);
      console.log(`📦 ${ops.length} ops mises en file d'attente (hors-ligne, total: ${pendingOpsQueue.length})`);
      return { success: false, applied: 0, total: ops.length, queued: true };
    }

    // Send via WebSocket with acknowledgement
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // If no ack within 5s, consider it failed and queue
        pendingOpsQueue.push(...ops);
        savePendingOps(pendingOpsQueue);
        resolve({ success: false, applied: 0, total: ops.length, timeout: true });
      }, 5000);

      socket.emit('push_ops', {
        ops,
        deviceId: getDeviceId()
      }, (ack) => {
        clearTimeout(timeout);
        if (ack && ack.success) {
          if (onSyncAck) onSyncAck(ack);
          resolve({
            success: true,
            applied: ack.applied,
            total: ack.total,
            serverTimestamp: ack.serverTimestamp
          });
        } else {
          pendingOpsQueue.push(...ops);
          savePendingOps(pendingOpsQueue);
          resolve({ success: false, applied: 0, total: ops.length });
        }
      });
    });
  },

  /**
   * Full data push (legacy fallback, used when no previous state exists)
   * @param {Object} data - Full database
   * @returns {Promise<Object|null>}
   */
  async pushDataFull(data) {
    try {
      const url = getServerUrl();
      const res = await fetch(`${url}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Network response was not ok');
      lastKnownDbSnapshot = data;
      return await res.json();
    } catch (e) {
      console.error("Failed to full push to local server:", e);
      return null;
    }
  },

  /**
   * Legacy pushData method (kept for backward compatibility)
   * Now routes through the delta system when possible
   */
  async pushData(data) {
    return this.pushOps(data);
  },

  /**
   * Update the internal snapshot (call after applying remote ops)
   * This prevents re-sending ops we just received
   */
  updateSnapshot(db) {
    lastKnownDbSnapshot = db;
  },

  /**
   * Get the number of pending ops in the queue
   */
  getPendingCount() {
    return pendingOpsQueue.length;
  },

  /**
   * Get server status
   */
  async getStatus() {
    if (window.location.protocol === 'https:' && !isLocalEnvironment()) {
      return null;
    }
    try {
      const url = getServerUrl();
      const res = await fetch(`${url}/api/status`);
      if (!res.ok) throw new Error('Not ok');
      return await res.json();
    } catch (e) {
      return null;
    }
  }
};
