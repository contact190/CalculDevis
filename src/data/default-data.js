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
    { id: 'H36', name: 'Coulissant H36', minL: 500, maxL: 3000, minH: 500, maxH: 2500 },
    { id: 'H48', name: 'Battant H48', minL: 400, maxL: 2400, minH: 400, maxH: 2400 },
  ],
  profiles: [
    { 
      id: 'P101', name: 'Dormant H36', 
      rangeId: 'H36', 
      weightPerM: 1.25, pricePerKg: 4.5, 
      barLength: 6000, 
      colors: ['RAL9016', 'RAL7016', 'BOIS'],
      type: 'ALU' 
    },
    { 
      id: 'P102', name: 'Ouvrant H36', 
      rangeId: 'H36', 
      weightPerM: 1.10, pricePerKg: 4.5, 
      barLength: 6000, 
      colors: ['RAL9016', 'RAL7016'],
      type: 'ALU' 
    }
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
    { id: 'ACC01', name: 'Kit Galet H36', unit: 'Kit', price: 12.50, rangeId: 'H36' },
    { id: 'ACC02', name: 'Poignée standard', unit: 'Unité', price: 8.90, rangeId: 'H36' },
    { id: 'JNT01', name: 'Joint vitrage 3mm', unit: 'Joint', price: 0.85, rangeId: 'H36' },
    { id: 'JNT02', name: 'Joint vitrage 4mm', unit: 'Joint', price: 0.95, rangeId: 'H36' },
    { id: 'JNT03', name: 'Joint vitrage 5mm', unit: 'Joint', price: 1.10, rangeId: 'H36' },
  ],
  gasketCompatibility: [
    { rangeId: 'H36', glassThickness: 4, gasketId: 'JNT03', formula: '(L+H)*2' },
    { rangeId: 'H36', glassThickness: 24, gasketId: 'JNT02', formula: '(L+H)*2' },
    { rangeId: 'H48', glassThickness: 4, gasketId: 'JNT03', formula: '(L+H)*2' },
    { rangeId: 'H48', glassThickness: 24, gasketId: 'JNT01', formula: '(L+H)*2' },
  ],
  glassProfileCompatibility: [],
  options: [
    { id: 'OPT-MOTEUR', name: 'Motorisation Filaire', rangeId: 'H36', addAccessoryId: 'P101', removeAccessoryId: '', formula: '1' }
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
      { id: 'CAI-140', name: 'Caisson 140', height: 140, price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'CAI-155', name: 'Caisson 155', height: 155, price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'CAI-165', name: 'Caisson 165', height: 165, price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'CAI-185', name: 'Caisson 185', height: 185, price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'CAI-200', name: 'Caisson 200', height: 200, price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'CAI-205', name: 'Caisson 205', height: 205, price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'CAI-225', name: 'Caisson 225', height: 225, price: 0, priceUnit: 'ML', formula: 'L/1000' }
    ],
    lames: [
      { id: 'LAM-39E', name: 'Lame 39 Extrudée', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/39)' },
      { id: 'LAM-45E', name: 'Lame 45 Extrudée', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/45)' },
      { id: 'LAM-40P', name: 'Lame 40 Plate',    price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/40)' },
      { id: 'LAM-39T', name: 'Lame 39 Thermique', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/39)' },
      { id: 'LAM-43T', name: 'Lame 43 Thermique', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/43)' },
      { id: 'LAM-45T', name: 'Lame 45 Thermique', price: 0, priceUnit: 'ML', formula: 'L/1000 * ceil(H/45)' }
    ],
    glissieres: [
      { id: 'GLI-INVDC', name: 'L Invisible Double Côté',   price: 0, priceUnit: 'ML', formula: 'H/1000*2' },
      { id: 'GLI-VISS',  name: 'L Visible Simple Côté',    price: 0, priceUnit: 'ML', formula: 'H/1000' },
      { id: 'GLI-VIDC',  name: 'L Visible Double Côté',    price: 0, priceUnit: 'ML', formula: 'H/1000*2' },
      { id: 'GLI-SIMDC', name: 'Simple Double Côté',       price: 0, priceUnit: 'ML', formula: 'H/1000*2' }
    ],
    axes: [
      { id: 'AXE-40', name: 'Axe 40', price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'AXE-60', name: 'Axe 60', price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'AXE-70', name: 'Axe 70', price: 0, priceUnit: 'ML', formula: 'L/1000' },
      { id: 'AXE-80', name: 'Axe 80', price: 0, priceUnit: 'ML', formula: 'L/1000' }
    ],
    kits: [
      { id: 'KIT-SANG',   name: 'Kit Sangle',    price: 0, priceUnit: 'Unité', formula: '1' },
      { id: 'KIT-MOTE',   name: 'Kit Moteur',    price: 0, priceUnit: 'Unité', formula: '1' },
      { id: 'KIT-TUNN',   name: 'Kit Tunnel',    price: 0, priceUnit: 'ML',    formula: 'L/1000' },
      { id: 'KIT-MANI',   name: 'Kit Manivelle', price: 0, priceUnit: 'Unité', formula: '1' }
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
      rangeId: 'H36',
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
    }
  ],
  margins: {
    default: 2.2,
  }
};
