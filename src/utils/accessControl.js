import { getDeviceId, getSynchronizedDate } from './patchEngine';

export const MASTER_ADMIN = {
  id: 'admin-master',
  name: 'Administrateur Principal',
  role: 'admin',
  code: '092000',
  allowedTabs: ['all'],
  createdAt: '2026-01-01T00:00:00.000Z',
  active: true
};

export const AVAILABLE_TABS = [
  { id: 'commercial', label: 'Commercial', description: 'Calculateur, profilés, remises et devis direct' },
  { id: 'quotes', label: 'Devis', description: 'Liste et gestion des devis enregistrés' },
  { id: 'shop', label: 'Shop', description: 'Point de vente rapide et articles boutique' },
  { id: 'siteplan', label: 'Plan de Chantier', description: 'Gestion des plans de pose et repérage' },
  { id: 'orders', label: 'Commandes', description: 'Suivi des commandes clients et validation' },
  { id: 'production', label: 'Atelier / Production', description: 'Débits, optimisation de coupe et verres' },
  { id: 'tracking', label: 'Gestion & Suivi', description: 'Suivi de fabrication par sous-lots et QR codes' },
  { id: 'finished_goods', label: 'Produit Fini', description: 'Contrôle qualité et stockage produits finis' },
  { id: 'shipping', label: 'Expédition & Colisage', description: 'Bons de livraison, chargement et installation' },
  { id: 'clients', label: 'Clients', description: 'Répertoire des clients et fiches contacts' },
  { id: 'finance', label: 'Finance', description: 'Facturation, encaissements et trésorerie' },
  { id: 'admin', label: 'Administration', description: 'Gestion des articles, séries, prix et formules' },
];

const ACTIVE_USER_KEY = 'calculDevis_activeUser';

let _currentActiveUser = null;

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export function getActiveUser() {
  if (_currentActiveUser) return _currentActiveUser;
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY) || sessionStorage.getItem(ACTIVE_USER_KEY);
    if (raw) {
      _currentActiveUser = JSON.parse(raw);
      return _currentActiveUser;
    }
  } catch (e) {
    console.error('Erreur lecture activeUser:', e);
  }
  return null;
}

/**
 * Définir l'utilisateur actif
 */
export function setActiveUser(user) {
  _currentActiveUser = user;
  if (!user) {
    try { localStorage.removeItem(ACTIVE_USER_KEY); } catch(e) {}
    try { sessionStorage.removeItem(ACTIVE_USER_KEY); } catch(e) {}
    return;
  }

  const userJson = JSON.stringify(user);

  try {
    localStorage.setItem(ACTIVE_USER_KEY, userJson);
  } catch (err) {
    console.warn("localStorage saturé (quota dépassé), purge des anciens caches volumineux...", err);
    try {
      // Purger les anciens gros snapshots d'avant IndexedDB
      localStorage.removeItem('calculDevisDB');
      localStorage.removeItem('calculDevisQuotes');
      localStorage.removeItem('calculDevis_backup');
      localStorage.setItem(ACTIVE_USER_KEY, userJson);
    } catch (retryErr) {
      console.warn("Bascule sur sessionStorage suite au quota localStorage:", retryErr);
      try {
        sessionStorage.setItem(ACTIVE_USER_KEY, userJson);
      } catch (sessionErr) {
        console.warn("Utilisateur conservé en mémoire pour cette session:", sessionErr);
      }
    }
  }
}

/**
 * Récupérer la liste des comptes utilisateurs depuis la base de données
 */
export function getAccounts(database) {
  const accounts = Array.isArray(database?.userAccounts) ? database.userAccounts.filter(Boolean) : [];
  
  // S'assurer que le compte Admin maître est toujours présent avec son code à jour
  const masterIndex = accounts.findIndex(a => a && (a.id === MASTER_ADMIN.id || (a.role === 'admin' && a.code === MASTER_ADMIN.code)));
  if (masterIndex === -1) {
    accounts.unshift(MASTER_ADMIN);
  } else {
    accounts[masterIndex] = {
      ...accounts[masterIndex],
      ...MASTER_ADMIN,
      name: accounts[masterIndex].name || MASTER_ADMIN.name,
      code: MASTER_ADMIN.code // Toujours forcer le code maître défini
    };
  }
  
  return accounts;
}

/**
 * Vérifier un code d'accès et retourner le compte correspondant
 */
export function authenticateWithCode(code, database) {
  if (!code) return null;
  const cleanCode = String(code).trim();
  
  // Vérification directe code maître
  if (cleanCode === MASTER_ADMIN.code) {
    return MASTER_ADMIN;
  }
  
  try {
    const accounts = getAccounts(database);
    const found = accounts.find(a => a && String(a.code || '').trim() === cleanCode && a.active !== false);
    return found || null;
  } catch (err) {
    console.error("authenticateWithCode error:", err);
    return null;
  }
}

/**
 * Vérifier si un utilisateur a accès à un onglet donné
 */
export function canAccessTab(user, tabId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!Array.isArray(user.allowedTabs)) return false;
  if (user.allowedTabs.includes('all')) return true;
  return user.allowedTabs.includes(tabId);
}

/**
 * Enregistrer un accès (login / logout) dans les logs de la base
 */
export function recordAccessLog(user, type = 'login', database, setDatabase) {
  if (!user || !setDatabase) return;
  
  try {
    const logEntry = {
      id: `ACC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user.id,
      userName: user.name,
      role: user.role || 'user',
      type, // 'login' | 'logout'
      timestamp: getSynchronizedDate().toISOString(),
      deviceId: getDeviceId(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    };
    
    setDatabase(prev => {
      if (!prev) return prev;
      const currentLogs = Array.isArray(prev.accessLogs) ? prev.accessLogs : [];
      // Garder les 500 derniers logs pour ne pas alourdir la mémoire
      const updatedLogs = [logEntry, ...currentLogs].slice(0, 500);
      return {
        ...prev,
        accessLogs: updatedLogs
      };
    });
  } catch (e) {
    console.warn("Échec d'enregistrement du log d'accès:", e);
  }
}
