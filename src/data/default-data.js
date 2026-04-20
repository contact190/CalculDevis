export const DEFAULT_DATA = {
  clients: [
    {
      id: 'CLI-177',
      nom: 'Entreprise de Construction Algérienne',
      adresse: 'Zone Industrielle, Oued Smar, Alger',
      telephone: '0550 00 00 00',
      email: 'contact@eca-dz.com',
      nif: '000016001234567',
      nis: '001616010234567',
      ai: '16010001234',
      rc: '16/00-1234567B20'
    }
  ],
  categories: [
    { id: 'CAT-F', name: 'Fenêtre' },
    { id: 'CAT-P', name: 'Porte' },
    { id: 'CAT-PF', name: 'Porte-Fenêtre' }
  ],
  ranges: [
    { id: 'H36-2V', name: 'Fenêtre Coulissante H36 (2 Vantaux)', minL: 400, maxL: 4000, minH: 400, maxH: 2400 },
    { id: 'H36-3V', name: 'Fenêtre Coulissante H36 (3 Vantaux)', minL: 600, maxL: 6000, minH: 400, maxH: 2400 },
    { id: 'H40-1V', name: 'Fenêtre Battant H40 (1 Vantail)', minL: 350, maxL: 1500, minH: 350, maxH: 2200 },
    { id: 'H40-2V', name: 'Fenêtre Battant H40 (2 Vantaux)', minL: 700, maxL: 2500, minH: 350, maxH: 2200 },
    { id: 'H48', name: 'Gamme H48 (Standard)', minL: 400, maxL: 3000, minH: 400, maxH: 2200 },
  ],
  profiles: [
    { 
      id: 'P101', name: 'Dormant H36', 
      rangeIds: ['H36-2V', 'H36-3V'], 
      weightPerM: 1.25, pricePerKg: 4.5, 
      barLength: 6000, 
      colors: ['RAL9016', 'RAL7016', 'BOIS'],
      type: 'ALU' 
    },
    { 
      id: 'P102', name: 'Ouvrant H36', 
      rangeIds: ['H36-2V', 'H36-3V'], 
      weightPerM: 1.10, pricePerKg: 4.5, 
      barLength: 6000, 
      colors: ['RAL9016', 'RAL7016'],
      type: 'ALU' 
    },
    { 
      id: '2BF40-14025', name: 'Dormant H40', 
      rangeIds: ['H40-1V', 'H40-2V'], 
      weightPerM: 1.35, pricePerKg: 0, 
      barLength: 6000, 
      type: 'ALU' 
    },
    { 
      id: '2BF40-34042', name: 'Ouvrant H40', 
      rangeIds: ['H40-1V', 'H40-2V'], 
      weightPerM: 1.25, pricePerKg: 0, 
      barLength: 6000, 
      type: 'ALU' 
    },
    { 
      id: 'P-3.02', name: 'Parclose H40', 
      rangeIds: ['H40-1V', 'H40-2V'], 
      weightPerM: 0.35, pricePerKg: 0, 
      barLength: 6000, 
      type: 'ALU' 
    },
    { 
      id: '2BF40-34037', name: 'Battement central H40', 
      rangeIds: ['H40-2V'], 
      weightPerM: 0.95, pricePerKg: 0, 
      barLength: 6000, 
      type: 'ALU' 
    },
    { 
      id: '20000-30261', name: 'Profilé Finition H40', 
      rangeIds: ['H40-2V'], 
      weightPerM: 0.45, pricePerKg: 0, 
      barLength: 6000, 
      type: 'ALU' 
    },
    { id: '2CF36-14540', name: 'Dormant H36', rangeIds: ['H36-2V', 'H36-3V'], weightPerM: 1.25, pricePerKg: 0, barLength: 6000, type: 'ALU' },
    { id: '2CF36-14440', name: 'Dormant 3 rails H36', rangeIds: ['H36-3V'], weightPerM: 1.85, pricePerKg: 0, barLength: 6000, type: 'ALU' },
    { id: '2CF36-11207', name: 'Traverse/Chicane H36', rangeIds: ['H36-2V', 'H36-3V'], weightPerM: 0.85, pricePerKg: 0, barLength: 6000, type: 'ALU' },
    { id: '2CF36-35833', name: 'Ouvrant H36', rangeIds: ['H36-2V', 'H36-3V'], weightPerM: 1.15, pricePerKg: 0, barLength: 6000, type: 'ALU' },
    { id: '2CF36-37037', name: 'Chicane Interne H36', rangeIds: ['H36-2V', 'H36-3V'], weightPerM: 0.95, pricePerKg: 0, barLength: 6000, type: 'ALU' },
    { id: '2CF36-34037', name: 'Montant Chicane H36', rangeIds: ['H36-2V', 'H36-3V'], weightPerM: 0.90, pricePerKg: 0, barLength: 6000, type: 'ALU' },
    { id: '2CF36-31200', name: 'Pare-tempête H36', rangeIds: ['H36-3V'], weightPerM: 0.25, pricePerKg: 0, barLength: 6000, type: 'ALU' }
  ],
  glass: [
    { 
      id: 'V4', name: 'Simple 4mm', 
      type: 'SIMPLE', composition: '4', 
      specification: 'Standard',
      thickness: 4, weightPerM2: 10, pricePerM2: 15 
    },
    { 
      id: 'V4-16-4', name: 'Double 4/16/4', 
      type: 'DOUBLE', composition: '4/16/4', 
      specification: 'Standard',
      thickness: 24, weightPerM2: 20, pricePerM2: 35 
    },
    { 
      id: 'V4-12-4-12-4', name: 'Triple 4/12/4/12/4', 
      type: 'TRIPLE', composition: '4/12/4/12/4', 
      specification: 'Standard',
      thickness: 36, weightPerM2: 30, pricePerM2: 55 
    },
  ],
  accessories: [
    { id: 'ACC01', name: 'Kit Galet H36', unit: 'Kit', price: 12.50, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: 'ACC02', name: 'Poignée standard', unit: 'Unité', price: 8.90, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: 'JNT01', name: 'Joint vitrage 3mm', unit: 'Joint', price: 0.85, rangeIds: ['H36-2V', 'H36-3V', 'H40-1V', 'H40-2V'] },
    { id: 'JNT02', name: 'Joint vitrage 4mm', unit: 'Joint', price: 0.95, rangeIds: ['H36-2V', 'H36-3V', 'H40-1V', 'H40-2V'] },
    { id: 'JNT03', name: 'Joint vitrage 5mm', unit: 'Joint', price: 1.10, rangeIds: ['H36-2V', 'H36-3V', 'H40-1V', 'H40-2V'] },
    { id: '40000-22711', name: 'Équerre d\'assemblage', unit: 'Unité', price: 0, rangeIds: ['H40-1V', 'H40-2V'] },
    { id: '40000-21015', name: 'Équerre d\'alignement', unit: 'Unité', price: 0, rangeIds: ['H40-1V', 'H40-2V'] },
    { id: '6XXXX-61010', name: 'Bouchon rejet d\'eau', unit: 'Unité', price: 0, rangeIds: ['H40-1V', 'H40-2V'] },
    { id: 'BC-H36', name: 'Bouchon rejet d\'eau H36', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '6CXXX-27070', name: 'Joint brosse', unit: 'ML', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '40034', name: 'Joint vitrage (3-4mm)', unit: 'Joint', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '40023', name: 'Joint vitrage (2-3mm)', unit: 'Joint', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '40056', name: 'Joint vitrage (5-6mm)', unit: 'Joint', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '40079', name: 'Joint vitrage (7-9mm)', unit: 'Joint', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: 'ROULETTE', name: 'Roulette H36', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '6CF36-60010', name: 'Pièce étanchéité centrale', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '6CF36-61010', name: 'Base étanchéité ouvrant latéral', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '6CF36-61110', name: 'Base étanchéité ouvrant central', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: ' mekanisme-MP', name: 'Mécanisme transmission MP', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: ' poignee-droite', name: 'Poignée coudée Droite', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: ' poignee-gauche', name: 'Poignée coudée Gauche', unit: 'Unité', price: 0, rangeIds: ['H36-2V', 'H36-3V'] },
    { id: '8BXXX-22110', name: 'Kit fermeture 1 vantail', unit: 'Unité', price: 0, rangeIds: ['H40-1V'] },
    { id: '8BXXX-22120', name: 'Kit fermeture 2 vantaux', unit: 'Unité', price: 0, rangeIds: ['H40-2V'] },
    { id: '6BF40-60010', name: 'Bouchon battement central', unit: 'Unité', price: 0, rangeIds: ['H40-2V'] },
    { id: 'PAUMELLE', name: 'Paumelle deux corps', unit: 'Unité', price: 0, rangeIds: ['H40-1V', 'H40-2V'] },
    { id: 'CREMONE', name: 'Crémone battant', unit: 'Unité', price: 0, rangeIds: ['H40-1V', 'H40-2V'] },
  ],
  gasketCompatibility: [
    { rangeId: 'H36-2V', glassThickness: 4, gasketId: '40034', formula: '(L+H)*2' },
    { rangeId: 'H36-2V', glassThickness: 24, gasketId: '40023', formula: '(L+H)*2' },
    { rangeId: 'H36-3V', glassThickness: 4, gasketId: '40034', formula: '(L+H)*2' },
    { rangeId: 'H36-3V', glassThickness: 24, gasketId: '40023', formula: '(L+H)*2' },
    { rangeId: 'H40-1V', glassThickness: 4, gasketId: 'JNT01', formula: '(L+H)*2' },
    { rangeId: 'H40-2V', glassThickness: 4, gasketId: 'JNT01', formula: '(L+H)*2' },
  ],
  glassProfileCompatibility: [
    { rangeId: 'H40-1V', glassThickness: 4, profileHId: 'P-3.02', qtyH: 2, formulaH: 'L-123', profileVId: 'P-3.02', qtyV: 2, formulaV: 'H-162' },
    { rangeId: 'H40-2V', glassThickness: 4, profileHId: 'P-3.02', qtyH: 2, formulaH: 'L-123', profileVId: 'P-3.02', qtyV: 2, formulaV: 'H-162' },
  ],
  options: [
    { id: 'OPT-MOTEUR', name: 'Motorisation Filaire', rangeIds: ['H36-2V', 'H36-3V'], addAccessoryId: 'P101', removeAccessoryId: '', formula: '1' }
  ],
  traverses: [
    { id: 'TRV-F-H',  name: 'Traverse Fenêtre H',     type: 'horizontale', usage: 'fenetre',  profileId: '',  formula: 'L', priceUnit: 'ML' },
    { id: 'TRV-F-V',  name: 'Traverse Fenêtre V',     type: 'verticale',   usage: 'fenetre',  profileId: '',  formula: 'H', priceUnit: 'ML' },
    { id: 'TRV-P-H',  name: 'Traverse Porte H',       type: 'horizontale', usage: 'porte',    profileId: '',  formula: 'L', priceUnit: 'ML' },
    { id: 'TRV-P-V',  name: 'Traverse Porte V',       type: 'verticale',   usage: 'porte',    profileId: '',  formula: 'H', priceUnit: 'ML' },
    { id: 'TRV-PF-H', name: 'Traverse Porte-Fenêtre H', type: 'horizontale', usage: 'pf',    profileId: '',  formula: 'L', priceUnit: 'ML' },
    { id: 'TRV-PF-V', name: 'Traverse Porte-Fenêtre V', type: 'verticale',   usage: 'pf',   profileId: '',  formula: 'H', priceUnit: 'ML' },
  ],
  shutterComponents: {
    caissons: [
      { id: 'CAI-140', name: 'Caisson 140', height: 140, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' },
      { id: 'CAI-155', name: 'Caisson 155', height: 155, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' },
      { id: 'CAI-165', name: 'Caisson 165', height: 165, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' },
      { id: 'CAI-185', name: 'Caisson 185', height: 185, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' },
      { id: 'CAI-200', name: 'Caisson 200', height: 200, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' },
      { id: 'CAI-205', name: 'Caisson 205', height: 205, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' },
      { id: 'CAI-225', name: 'Caisson 225', height: 225, price: 0, priceUnit: 'ML', formula: 'L/1000', jointPrice: 0, jointFormula: 'L/1000' }
    ],
    lames: [
      { id: 'LAM-39E', name: 'Lame 39 Extrudée', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/39)' },
      { id: 'LAM-45E', name: 'Lame 45 Extrudée', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/45)' },
      { id: 'LAM-40P', name: 'Lame 40 Plate',    price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/40)', barLength: 6400 },
      { id: 'LAM-39T', name: 'Lame 39 Thermique', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/39)', barLength: 6400 },
      { id: 'LAM-43T', name: 'Lame 43 Thermique', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/43)', barLength: 6400 },
      { id: 'LAM-45T', name: 'Lame 45 Thermique', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/45)', barLength: 6400 }
    ],
    lameFinales: [
      { id: 'LF-ST', name: 'Lame Finale Standard', price: 0, priceUnit: 'ML', formula: 'L/1000', barLength: 6400 }
    ],
    glissieres: [
      { id: 'GLI-INVDC', name: 'L Invisible Double Côté', shutterType: 'PALA', price: 0, priceUnit: 'ML', formula: 'H/1000*2', 
        opt1Label: 'Largeur Monobloque', opt1Values: '85, 120, 145', barLength: 6400, hasBaguette: false, baguettePrice: 0 },
      { id: 'GLI-VISSC', name: 'L Visible Seul Côté', shutterType: 'MONO', price: 0, priceUnit: 'ML', formula: 'H/1000', 
        opt1Label: 'Épaisseur L Visible', opt1Values: '120, 150, 180', opt2Label: 'Largeur Monobloque', opt2Values: '85, 120, 145', barLength: 6400, hasBaguette: false, baguettePrice: 0 },
      { id: 'GLI-VIDC', name: 'L Visible Double Côté', shutterType: 'MONO', price: 0, priceUnit: 'ML', formula: 'H/1000*2', 
        opt1Label: 'Épaisseur L Visible', opt1Values: '120, 150, 180', barLength: 6400, hasBaguette: false, baguettePrice: 0 },
      { id: 'GLI-SIMDC', name: 'Simple Double Côté', shutterType: 'PALA', price: 0, priceUnit: 'ML', formula: 'H/1000*2', barLength: 6400, hasBaguette: false, baguettePrice: 0 },
    ],
    axes: [
      { id: 'AXE-40', name: 'Axe 40', price: 0, priceUnit: 'ML', formula: 'L/1000', barLength: 6400 },
      { id: 'AXE-60', name: 'Axe 60', price: 0, priceUnit: 'ML', formula: 'L/1000', barLength: 6400 },
      { id: 'AXE-70', name: 'Axe 70', price: 0, priceUnit: 'ML', formula: 'L/1000', barLength: 6400 },
      { id: 'AXE-80', name: 'Axe 80', price: 0, priceUnit: 'ML', formula: 'L/1000', barLength: 6400 }
    ],
    kits: [
      { id: 'KIT-SANG',   name: 'Kit Sangle',    price: 0, priceUnit: 'Unité', formula: '1', barLength: 1 },
      { id: 'KIT-MOTE',   name: 'Kit Moteur',    price: 0, priceUnit: 'Unité', formula: '1', barLength: 1 },
      { id: 'KIT-TUNN',   name: 'Kit Tunnel',    price: 0, priceUnit: 'ML',    formula: 'L/1000', barLength: 1 },
      { id: 'KIT-MANI',   name: 'Kit Manivelle', price: 0, priceUnit: 'Unité', formula: '1', barLength: 1 }
    ]
  },
  colors: [
    { id: 'RAL9016', name: 'Blanc 9016', hex: '#FFFFFF', factor: 1.0 },
    { id: 'RAL7016', name: 'Gris Anthracite', hex: '#373F43', factor: 1.15 },
    { id: 'BOIS', name: 'Chêne Doré', hex: '#8B5A2B', factor: 1.40 },
  ],
  compositions: [
    {
      id: 'COUL-H36',
      name: 'Fenêtre Coulissante H36 (Standard)',
      rangeId: 'H36-2V',
      categoryId: 'CAT-F',
      openingType: 'Coulissant',
      hasGasket: true,
      glassFormulaL: 'L-80',
      glassFormulaH: 'H-80',
      elements: [
        { type: 'profile', id: 'P101', label: 'Dormant Haut', formula: 'L', qty: 1 },
        { type: 'profile', id: 'P101', label: 'Dormant Bas', formula: 'L', qty: 1 },
        { type: 'profile', id: 'P101', label: 'Dormant Gauche', formula: 'H', qty: 1 },
        { type: 'profile', id: 'P101', label: 'Dormant Droite', formula: 'H', qty: 1 },
        { type: 'profile', id: 'P102', label: 'Ouvrant Gauche', formula: '(H-40)', qty: 1 },
        { type: 'profile', id: 'P102', label: 'Ouvrant Droite', formula: '(H-40)', qty: 1 },
        { type: 'profile', id: 'P102', label: 'Ouvrant Haut', formula: '(L-40)/2', qty: 2 },
        { type: 'profile', id: 'P102', label: 'Ouvrant Bas', formula: '(L-40)/2', qty: 2 },
        { type: 'accessory', id: 'ACC01', label: 'Kit Roulettes', formula: '1', qty: 2 },
        { type: 'accessory', id: 'ACC02', label: 'Poignée', formula: '1', qty: 1 },
      ]
    },
    {
      id: 'H40-BATT-1V',
      name: 'Fenêtre Battant H40 (1 Vantail)',
      rangeId: 'H40-1V',
      categoryId: 'CAT-F',
      openingType: 'Battant',
      hasGasket: false,
      glassFormulaL: 'L-137',
      glassFormulaH: 'H-137',
      elements: [
        { type: 'profile', id: '2BF40-14025', label: 'Dormant (L)', formula: 'L', qty: 2 },
        { type: 'profile', id: '2BF40-14025', label: 'Dormant (H)', formula: 'H', qty: 2 },
        { type: 'profile', id: '2BF40-34042', label: 'Ouvrant (L)', formula: 'L-39', qty: 2 },
        { type: 'profile', id: '2BF40-34042', label: 'Ouvrant (H)', formula: 'H-39', qty: 2 },
        { type: 'accessory', id: '40000-22711', label: 'Équerre d\'assemblage', formula: '1', qty: 8 },
        { type: 'accessory', id: '40000-21015', label: 'Équerre d\'alignement', formula: '1', qty: 4 },
        { type: 'accessory', id: 'BC-H36', label: 'Bouchon rejet d\'eau', formula: '1', qty: 2 },
        { type: 'accessory', id: 'PAUMELLE', label: 'Paumelles', formula: '1', qty: 2 },
        { type: 'accessory', id: 'CREMONE', label: 'Crémone battant', formula: '1', qty: 1 },
        { type: 'accessory', id: '8BXXX-22110', label: 'Kit fermeture', formula: '1', qty: 1 }
      ]
    },
    {
      id: 'H40-BATT-2V',
      name: 'Fenêtre Battant H40 (2 Vantaux)',
      rangeId: 'H40-2V',
      categoryId: 'CAT-F',
      openingType: 'Battant',
      hasGasket: false,
      glassFormulaL: '(L-242)/2',
      glassFormulaH: 'H-137',
      glassFormulaQty: '2',
      elements: [
        { type: 'profile', id: '2BF40-14025', label: 'Dormant (L)', formula: 'L', qty: 2 },
        { type: 'profile', id: '2BF40-14025', label: 'Dormant (H)', formula: 'H', qty: 2 },
        { type: 'profile', id: '2BF40-34042', label: 'Ouvrant (L)', formula: '(L-45)/2', qty: 4 },
        { type: 'profile', id: '2BF40-34042', label: 'Ouvrant (H)', formula: 'H-39', qty: 4 },
        { type: 'profile', id: '2BF40-34037', label: 'Battement central', formula: 'H-100', qty: 1 },
        { type: 'profile', id: '20000-30261', label: 'Profilé Finition', formula: 'H', qty: 1 },
        { type: 'accessory', id: '40000-22711', label: 'Équerre d\'assemblage', formula: '1', qty: 12 },
        { type: 'accessory', id: '40000-21015', label: 'Équerre d\'alignement', formula: '1', qty: 8 },
        { type: 'accessory', id: 'BC-H36', label: 'Bouchon rejet d\'eau', formula: '1', qty: 4 },
        { type: 'accessory', id: '6BF40-60010', label: 'Bouchon battement central', formula: '1', qty: 1 },
        { type: 'accessory', id: 'PAUMELLE', label: 'Paumelles', formula: '1', qty: 4 },
        { type: 'accessory', id: 'CREMONE', label: 'Crémone battant', formula: '1', qty: 1 },
        { type: 'accessory', id: '8BXXX-22120', label: 'Kit fermeture 2V', formula: '1', qty: 1 }
      ]
    },
    {
      id: 'H36-COUL-2V',
      name: 'Fenêtre Coulissante H36 (2 Vantaux)',
      rangeId: 'H36-2V',
      categoryId: 'CAT-F',
      openingType: 'Coulissant',
      hasGasket: true,
      glassFormulaL: '(L-194)/2',
      glassFormulaH: 'H-154',
      glassFormulaQty: '2',
      elements: [
        { type: 'profile', id: '2CF36-14540', label: 'Dormant (L)', formula: 'L', qty: 2 },
        { type: 'profile', id: '2CF36-14540', label: 'Dormant (H)', formula: 'H', qty: 2 },
        { type: 'profile', id: '2CF36-11207', label: 'Traverse', formula: 'L-80.5', qty: 2 },
        { type: 'profile', id: '2CF36-35833', label: 'Ouvrant (L)', formula: '(L-179)/2', qty: 4 },
        { type: 'profile', id: '2CF36-37037', label: 'Chicane Interne', formula: 'H-66', qty: 2 },
        { type: 'profile', id: '2CF36-34037', label: 'Montant Chicane', formula: 'H-66', qty: 2 },
        { type: 'accessory', id: '6CXXX-27070', label: 'Joint Brosse', formula: '4*L+6*H', qty: 1 },
        { type: 'accessory', id: 'ROULETTE', label: 'Roulettes', formula: '4', qty: 1 },
        { type: 'accessory', id: ' poignee-droite', label: 'Poignée', formula: '1', qty: 1 }
      ]
    },
    {
      id: 'H36-COUL-3V',
      name: 'Fenêtre Coulissante H36 (3 Vantaux)',
      rangeId: 'H36-3V',
      categoryId: 'CAT-F',
      openingType: 'Coulissant',
      hasGasket: true,
      glassFormulaL: '(L-218)/3',
      glassFormulaH: 'H-157',
      glassFormulaQty: '3',
      elements: [
        { type: 'profile', id: '2CF36-14540', label: 'Dormant (L)', formula: 'L', qty: 2 },
        { type: 'profile', id: '2CF36-14540', label: 'Dormant (H)', formula: 'H', qty: 2 },
        { type: 'profile', id: '2CF36-14440', label: 'Dormant 3 rails', formula: 'L', qty: 2 },
        { type: 'profile', id: '2CF36-11207', label: 'Traverse', formula: 'L-80.5', qty: 3 },
        { type: 'profile', id: '2CF36-35833', label: 'Ouvrant (L)', formula: '(L-186)/3', qty: 6 },
        { type: 'profile', id: '2CF36-37037', label: 'Chicane Interne', formula: 'H-66', qty: 2 },
        { type: 'profile', id: '2CF36-34037', label: 'Montant Chicane', formula: 'H-66', qty: 4 },
        { type: 'profile', id: '2CF36-31200', label: 'Pare-tempête (L)', formula: '(L-244)/3', qty: 6 },
        { type: 'profile', id: '2CF36-31200', label: 'Pare-tempête (H)', formula: 'H-149', qty: 6 },
        { type: 'accessory', id: 'ROULETTE', label: 'Roulettes', formula: '6', qty: 1 }
      ]
    }
  ],
  quotes: [
    {
      id: 'D001',
      clientName: 'EXEMPLE - Projet H36',
      items: [
        { id: 'I1', compId: 'H36-COUL-2V', compName: 'H36 2 vanteaux', width: 1800, height: 1200, rangeId: 'H36-2V' },
        { id: 'I2', compId: 'H40-BATT-2V', compName: 'H40 Battant', width: 1400, height: 1350, rangeId: 'H40-2V' }
      ]
    }
  ],
  margins: {
    default: 2.2,
  }
};
