const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createBackup, listBackups, restoreBackup, startAutoBackup } = require('./backup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for local network
    methods: ["GET", "POST"]
  },
  // Optimized for real-time performance
  pingInterval: 5000,    // Heartbeat every 5s for fast disconnect detection
  pingTimeout: 10000,    // 10s timeout
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB max for initial full sync
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Serve frontend build files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

const DATA_FILE = path.join(__dirname, 'database.json');

// ════════════════════════════════════════════════════════════════
// IN-MEMORY DATABASE — read once, keep in RAM, flush periodically
// ════════════════════════════════════════════════════════════════
let dbInMemory = null;
let dbDirty = false; // True if memory has changes not yet flushed to disk
let flushTimer = null;

// Operations history for replay (clients joining late)
const opsHistory = [];
const MAX_OPS_HISTORY = 2000;

// Connected clients tracking
const connectedClients = new Map(); // socketId -> { deviceId, connectedAt, lastSeen }

function loadDbFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      dbInMemory = JSON.parse(data);
      console.log(`📦 Base de données chargée en mémoire (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
      return true;
    }
  } catch (error) {
    console.error("❌ Erreur de lecture de database.json:", error);
  }
  dbInMemory = null;
  return false;
}

function flushDbToDisk() {
  if (!dbInMemory || !dbDirty) return false;
  try {
    const data = JSON.stringify(dbInMemory);
    // Write to temp file first, then rename (atomic write to prevent corruption)
    const tmpFile = DATA_FILE + '.tmp';
    fs.writeFileSync(tmpFile, data, 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
    dbDirty = false;
    console.log(`💾 Base de données synchronisée sur disque (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
    return true;
  } catch (error) {
    console.error("❌ Erreur d'écriture database.json:", error);
    return false;
  }
}

// Periodic flush every 3 seconds (if dirty)
function startPeriodicFlush() {
  flushTimer = setInterval(() => {
    if (dbDirty) flushDbToDisk();
  }, 3000);
}

// Flush on exit
function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('\n🛑 Arrêt du serveur...');
    if (dbDirty) {
      console.log('💾 Sauvegarde finale...');
      flushDbToDisk();
    }
    createBackup(DATA_FILE);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (err) => {
    console.error('💥 Erreur non capturée:', err);
    if (dbDirty) flushDbToDisk();
  });
}

// ════════════════════════════════════════════════════════════════
// OPERATION ENGINE — apply ops to in-memory database
// ════════════════════════════════════════════════════════════════

const TRACKABLE_COLLECTIONS = [
  'clients', 'quotes', 'orders', 'compositions', 'glass', 'colors',
  'options', 'accessories', 'profiles', 'joints', 'reinforcements', 'hardwareSets',
  'ranges', 'categories', 'traverses',
  'shutterComponents.caissons', 'shutterComponents.lames',
  'shutterComponents.lamesFinales', 'shutterComponents.glissieres',
  'shutterComponents.axes', 'shutterComponents.kits'
];

function getPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  target[last] = value;
  return obj;
}

function applyOpToDb(op) {
  if (!dbInMemory || !op) return false;

  const { op: opType, collection, id, data, timestamp } = op;

  // Reject operations created before the database import time
  if (dbInMemory._importTime && timestamp) {
    const opTime = new Date(timestamp).getTime();
    const importTime = new Date(dbInMemory._importTime).getTime();
    if (opTime < importTime) {
      return false;
    }
  }

  // Handle non-collection key replacements
  if (opType === 'replace_key') {
    setPath(dbInMemory, collection, data);
    dbDirty = true;
    return true;
  }

  if (!TRACKABLE_COLLECTIONS.includes(collection)) return false;

  let arr = getPath(dbInMemory, collection);
  if (!Array.isArray(arr)) {
    arr = [];
    setPath(dbInMemory, collection, arr);
  }

  switch (opType) {
    case 'add': {
      const existingIdx = arr.findIndex(item => item && item.id === id);
      if (existingIdx >= 0) {
        const existing = arr[existingIdx];
        if (existing._lastModified && timestamp < existing._lastModified) {
          return false; // Incoming is older
        }
        arr[existingIdx] = data;
      } else {
        arr.push(data);
      }
      dbDirty = true;
      return true;
    }

    case 'update': {
      const idx = arr.findIndex(item => item && item.id === id);
      if (idx < 0) {
        arr.push(data);
        dbDirty = true;
        return true;
      }
      const existing = arr[idx];
      if (existing._lastModified && timestamp < existing._lastModified) {
        return false; // Incoming is older
      }
      arr[idx] = data;
      dbDirty = true;
      return true;
    }

    case 'delete': {
      const deleteIdx = arr.findIndex(item => item && item.id === id);
      if (deleteIdx < 0) return false;
      const existingItem = arr[deleteIdx];
      if (existingItem._lastModified && timestamp < existingItem._lastModified) {
        return false;
      }
      arr.splice(deleteIdx, 1);
      dbDirty = true;
      return true;
    }

    default:
      return false;
  }
}

function addToHistory(ops) {
  for (const op of ops) {
    opsHistory.push({ ...op, _serverTime: new Date().toISOString() });
  }
  // Trim old ops
  while (opsHistory.length > MAX_OPS_HISTORY) {
    opsHistory.shift();
  }
}

// ════════════════════════════════════════════════════════════════
// REST API ROUTES
// ════════════════════════════════════════════════════════════════

// Get the full database (for initial sync)
app.get('/api/data', (req, res) => {
  if (dbInMemory) {
    res.json(dbInMemory);
  } else {
    res.status(404).json({ message: "No data found" });
  }
});

// Full replace (legacy, kept for compatibility but discouraged)
app.post('/api/data', (req, res) => {
  const body = req.body;
  if (!body) return res.status(400).json({ error: "Empty payload" });
  
  dbInMemory = body;
  dbDirty = true;

  io.emit('full_refresh', { timestamp: new Date().toISOString() });
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Get server IP
app.get('/api/ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
      }
    }
  }
  res.json({ ip: localIp });
});

// Get server status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    connectedClients: connectedClients.size,
    opsHistorySize: opsHistory.length,
    dbLoaded: dbInMemory !== null,
    dbDirty,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// List backups
app.get('/api/backups', (req, res) => {
  res.json(listBackups());
});

// Restore a backup
app.post('/api/backups/restore', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Missing backup name" });
  
  const restoredData = restoreBackup(name, DATA_FILE);
  if (restoredData) {
    dbInMemory = restoredData;
    dbDirty = false;
    // Tell all clients to do a full refresh
    io.emit('full_refresh', { timestamp: new Date().toISOString(), reason: 'backup_restored' });
    res.json({ success: true, message: `Backup ${name} restauré` });
  } else {
    res.status(500).json({ error: "Restore failed" });
  }
});

// Force create a backup
app.post('/api/backups/create', (req, res) => {
  if (dbDirty) flushDbToDisk();
  const backupPath = createBackup(DATA_FILE);
  if (backupPath) {
    res.json({ success: true, path: backupPath });
  } else {
    res.json({ success: false, message: "No changes to backup" });
  }
});

// SPA fallback — serve index.html for all non-API routes
app.get(/^(.*)$/, (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run npm run build first.');
  }
});

// ════════════════════════════════════════════════════════════════
// WEBSOCKET — Real-time delta sync
// ════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  const deviceId = socket.handshake.query.deviceId || socket.id;
  
  connectedClients.set(socket.id, {
    deviceId,
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  });

  console.log(`✅ Client connecté: ${deviceId} (${connectedClients.size} total)`);

  // ─── Initial full sync request ─────────────────────────────
  socket.on('request_full_sync', (callback) => {
    console.log(`📤 Full sync demandé par ${deviceId}`);
    if (typeof callback === 'function') {
      callback({
        data: dbInMemory,
        timestamp: new Date().toISOString(),
        opsHistorySize: opsHistory.length
      });
    } else {
      socket.emit('full_sync_response', {
        data: dbInMemory,
        timestamp: new Date().toISOString()
      });
    }
  });

  // ─── Receive delta operations from a client ─────────────────
  socket.on('push_ops', (payload, ackCallback) => {
    const { ops, deviceId: senderDeviceId } = payload;
    
    if (!Array.isArray(ops) || ops.length === 0) {
      if (typeof ackCallback === 'function') ackCallback({ success: true, applied: 0 });
      return;
    }

    let appliedCount = 0;
    const appliedOps = [];

    for (const op of ops) {
      const applied = applyOpToDb(op);
      if (applied) {
        appliedCount++;
        appliedOps.push(op);
      }
    }

    // Store in history for late joiners
    if (appliedOps.length > 0) {
      addToHistory(appliedOps);
      
      // Broadcast ONLY the applied ops to all OTHER clients
      socket.broadcast.emit('ops_broadcast', {
        ops: appliedOps,
        sourceDeviceId: senderDeviceId || deviceId,
        serverTimestamp: new Date().toISOString()
      });
    }

    // Update client tracking
    const clientInfo = connectedClients.get(socket.id);
    if (clientInfo) clientInfo.lastSeen = new Date().toISOString();

    // Acknowledge to sender
    if (typeof ackCallback === 'function') {
      ackCallback({
        success: true,
        applied: appliedCount,
        total: ops.length,
        serverTimestamp: new Date().toISOString()
      });
    }

    if (appliedOps.length > 0) {
      console.log(`🔄 ${appliedCount}/${ops.length} ops appliquées de ${senderDeviceId || deviceId} → broadcast à ${connectedClients.size - 1} clients`);
    }
  });

  // ─── Legacy: receive full data push (backward compatibility) ─
  socket.on('push_data', (payload) => {
    console.log(`📥 Push complet reçu de ${deviceId} (mode legacy)`);
    dbInMemory = payload;
    dbDirty = true;
    socket.broadcast.emit('full_refresh', { timestamp: new Date().toISOString() });
  });

  // ─── Get ops history since a timestamp ────────────────────────
  socket.on('get_ops_since', (timestamp, callback) => {
    const since = new Date(timestamp).getTime();
    const relevantOps = opsHistory.filter(op => {
      const opTime = new Date(op._serverTime || op.timestamp).getTime();
      return opTime > since;
    });
    
    if (typeof callback === 'function') {
      callback({ ops: relevantOps, serverTimestamp: new Date().toISOString() });
    }
  });

  // ─── Heartbeat ────────────────────────────────────────────────
  socket.on('heartbeat', (callback) => {
    const clientInfo = connectedClients.get(socket.id);
    if (clientInfo) clientInfo.lastSeen = new Date().toISOString();
    if (typeof callback === 'function') {
      callback({ 
        ok: true, 
        connectedClients: connectedClients.size,
        serverTime: new Date().toISOString()
      });
    }
  });

  // ─── Disconnect ───────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    connectedClients.delete(socket.id);
    console.log(`❌ Client déconnecté: ${deviceId} (${reason}) — ${connectedClients.size} restants`);
  });
});

// ════════════════════════════════════════════════════════════════
// STARTUP
// ════════════════════════════════════════════════════════════════

const PORT = 3001;

// Load database into memory
loadDbFromDisk();

// Start periodic disk flush
startPeriodicFlush();

// Start automatic backups
startAutoBackup(DATA_FILE);

// Graceful shutdown
setupGracefulShutdown();

server.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
      }
    }
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  CalculDevis PRO — Serveur Local Temps Réel');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  🌐 Adresse réseau: http://${localIp}:${PORT}`);
  console.log(`  💻 Adresse locale: http://localhost:${PORT}`);
  console.log(`  📊 Status:         http://${localIp}:${PORT}/api/status`);
  console.log(`  💾 Sauvegardes:    http://${localIp}:${PORT}/api/backups`);
  console.log(`  👥 Max clients:    5`);
  console.log('══════════════════════════════════════════════════════');
  console.log('');
});
