import fs from 'fs';

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

function optimizeBOM(priceData) {
  if (!priceData || !priceData.bom) return;
  const bom = priceData.bom;

  // 1. Profils
  if (Array.isArray(bom.profiles)) {
    bom.profiles = bom.profiles.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      length: p.length,
      qty: p.qty,
      cost: p.cost,
      formula: p.formula,
      resolvedFormula: p.resolvedFormula,
      unitPrice: p.unitPrice,
      source: p.source
    }));
  }

  // 2. Accessoires
  if (Array.isArray(bom.accessories)) {
    bom.accessories = bom.accessories.map(a => ({
      id: a.id,
      name: a.name,
      label: a.label,
      qty: a.qty,
      cost: a.cost,
      unit: a.unit,
      formula: a.formula,
      resolvedFormula: a.resolvedFormula,
      multiplier: a.multiplier,
      totalMeasure: a.totalMeasure,
      unitPrice: a.unitPrice,
      source: a.source
    }));
  }

  // 3. Vitrages
  if (bom.glass) {
    const g = bom.glass;
    bom.glass = {
      id: g.id,
      name: g.name,
      qty: g.qty,
      width: g.width,
      height: g.height,
      area: g.area,
      cost: g.cost,
      pricePerM2: g.pricePerM2,
      unitPrice: g.unitPrice,
      source: g.source
    };
  }

  if (Array.isArray(bom.glassDetails)) {
    bom.glassDetails = bom.glassDetails.map(g => ({
      id: g.id,
      name: g.name,
      qty: g.qty,
      width: g.width,
      height: g.height,
      area: g.area,
      cost: g.cost,
      pricePerM2: g.pricePerM2,
      unitPrice: g.unitPrice,
      source: g.source
    }));
  }
}

function cleanAndOptimizeDatabase(db) {
  // Nettoyer dans les devis (quotes)
  if (Array.isArray(db.quotes)) {
    for (const q of db.quotes) {
      if (Array.isArray(q.items)) {
        for (const item of q.items) {
          if (item.config && item.config.thumbnail) {
            item.config.thumbnail = '';
          }
          if (item.priceData) {
            optimizeBOM(item.priceData);
          }
        }
      }
    }
  }

  // Nettoyer dans les commandes (orders)
  if (Array.isArray(db.orders)) {
    for (const o of db.orders) {
      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          if (item.config && item.config.thumbnail) {
            item.config.thumbnail = '';
          }
          if (item.priceData) {
            optimizeBOM(item.priceData);
          }
        }
      }
      if (Array.isArray(o.batches)) {
        for (const b of o.batches) {
          if (Array.isArray(b.items)) {
            for (const item of b.items) {
              if (item.config && item.config.thumbnail) {
                item.config.thumbnail = '';
              }
              if (item.priceData) {
                optimizeBOM(item.priceData);
              }
            }
          }
        }
      }
    }
  }
}

async function testSave() {
  const path = './backup_devis_2026-06-03 (6).json';
  const db = JSON.parse(fs.readFileSync(path, 'utf8'));

  cleanAndOptimizeDatabase(db);

  const { quotes, ...mainDb } = db;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  const now = new Date().toISOString();

  console.log("Saving main-db, size:", JSON.stringify(mainDb).length);
  try {
    const resMain = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'main-db', data: mainDb, updated_at: now })
    });
    if (!resMain.ok) {
      console.error("main-db save failed:", resMain.status, await resMain.text());
    } else {
      console.log("main-db save success!");
    }
  } catch (e) {
    console.error("main-db fetch error:", e);
  }

  console.log("Saving quotes-db, size:", JSON.stringify(quotes).length);
  try {
    const resQuotes = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'quotes-db', data: quotes || [], updated_at: now })
    });
    if (!resQuotes.ok) {
      console.error("quotes-db save failed:", resQuotes.status, await resQuotes.text());
    } else {
      console.log("quotes-db save success!");
    }
  } catch (e) {
    console.error("quotes-db fetch error:", e);
  }
}

testSave().catch(console.error);
