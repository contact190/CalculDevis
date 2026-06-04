/**
 * Backup Manager for CalculDevis PRO Local Server
 * 
 * Creates versioned backups of database.json every N minutes.
 * Rotates old backups to prevent disk space issues.
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 100; // Keep last 100 backups (~8 hours at 5min interval)
const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let backupTimer = null;
let lastBackupHash = null;

/**
 * Ensure the backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Dossier de sauvegardes créé: ${BACKUP_DIR}`);
  }
}

/**
 * Simple hash for change detection (avoids backing up identical data)
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Create a timestamped backup of the database
 * @param {string} dataFilePath - Path to the main database.json
 * @returns {string|null} Path to the created backup, or null if skipped
 */
function createBackup(dataFilePath) {
  try {
    if (!fs.existsSync(dataFilePath)) {
      console.warn('⚠️ Rien à sauvegarder: database.json introuvable');
      return null;
    }

    const data = fs.readFileSync(dataFilePath, 'utf8');
    
    // Skip if data hasn't changed since last backup
    const hash = simpleHash(data);
    if (hash === lastBackupHash) {
      return null; // No changes, skip backup
    }

    ensureBackupDir();

    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/:/g, '-')
      .replace(/\.\d+Z$/, '');
    const backupFile = path.join(BACKUP_DIR, `database_${timestamp}.json`);

    fs.writeFileSync(backupFile, data, 'utf8');
    lastBackupHash = hash;

    console.log(`💾 Sauvegarde créée: ${path.basename(backupFile)} (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
    
    // Rotate old backups
    rotateBackups();

    return backupFile;
  } catch (error) {
    console.error('❌ Erreur de sauvegarde:', error.message);
    return null;
  }
}

/**
 * Delete oldest backups when we exceed MAX_BACKUPS
 */
function rotateBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
      }
      if (toDelete.length > 0) {
        console.log(`🗑️ ${toDelete.length} ancienne(s) sauvegarde(s) supprimée(s)`);
      }
    }
  } catch (error) {
    console.error('⚠️ Erreur rotation sauvegardes:', error.message);
  }
}

/**
 * List all available backups
 * @returns {Array} Array of { name, path, date, sizeMB }
 */
function listBackups() {
  ensureBackupDir();
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database_') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          date: stats.mtime.toISOString(),
          sizeMB: (stats.size / 1024 / 1024).toFixed(1)
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
  } catch (error) {
    console.error('❌ Erreur lecture sauvegardes:', error.message);
    return [];
  }
}

/**
 * Restore a specific backup by name
 * @param {string} backupName - Filename of the backup
 * @param {string} dataFilePath - Path to the main database.json
 * @returns {Object|null} The restored data, or null on failure
 */
function restoreBackup(backupName, dataFilePath) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Sauvegarde introuvable: ${backupName}`);
      return null;
    }

    // First, backup the current state before restoring
    createBackup(dataFilePath);

    const data = fs.readFileSync(backupPath, 'utf8');
    fs.writeFileSync(dataFilePath, data, 'utf8');
    
    console.log(`✅ Sauvegarde restaurée: ${backupName}`);
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Erreur restauration:', error.message);
    return null;
  }
}

/**
 * Start automatic periodic backups
 * @param {string} dataFilePath - Path to the main database.json
 * @param {number} intervalMs - Interval in milliseconds (default: 5 minutes)
 */
function startAutoBackup(dataFilePath, intervalMs = BACKUP_INTERVAL_MS) {
  stopAutoBackup();
  
  // Create immediate backup on start
  createBackup(dataFilePath);
  
  backupTimer = setInterval(() => {
    createBackup(dataFilePath);
  }, intervalMs);
  
  console.log(`⏰ Sauvegardes automatiques activées (toutes les ${intervalMs / 60000} minutes)`);
}

/**
 * Stop automatic backups
 */
function stopAutoBackup() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  startAutoBackup,
  stopAutoBackup,
  ensureBackupDir
};
