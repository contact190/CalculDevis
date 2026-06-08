import React, { useState, useMemo } from 'react';
import { Plus, FileText, Eye, Lock, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, Edit3, X, Save, Download } from 'lucide-react';
import { invokeFunction } from '../../utils/supabaseClient';
import jsPDF from 'jspdf';
import html2pdf from 'html2pdf.js';

const DEFAULT_CLAUSES = [
  { id: 'CLS-1', titre: 'Article 01: Définitions', contenu: `01-1 Produit\nLe terme << produits >> désigne les fenêtres, portes-fenêtres, portes, garde-corps mur rideau, et tous autres produits dérivés en aluminium, et tous autres produits fabriqués par EURL IDEAL ALUMINIUM.\n\n01-2 Fournisseur\nLe terme << fournisseur >> désigne EURL IDEAL ALUMINIUM, qui s'engage à assurer, au titre du présent contrat de fourniture, l'apport en produits finis ainsi que l'assistance technique et commerciale.\n\n01-3 Client\nLe terme << client >> désigne le Client.\n\n01-4 Garantie technique\nLe terme « garantie technique » désigne, durant la période de garantie technique, la prise en charge par EURL IDEAL ALUMINIUM de toute réclamation motivée du client, acceptée par EURL IDEAL ALUMINIUM, relative aux non conformités techniques du produit conformément aux spécifications des fiches techniques.\n\n01-5 Echange standard\nLe terme « échange standard » désigne l'échange du produit non conforme (signalé par le client et reconnu par le fournisseur) par un produit conforme, et ceci durant la période de garantie technique.` },
  { id: 'CLS-2', titre: 'Article 02: OBJET', contenu: `Le présent contrat a pour objet de fixer les conditions et les modalités de la fourniture et pose au client qui souhaite se procurer les produits de EURL IDEAL Aluminium.\nLa liste des produits pourra faire l'objet de modifications, par l'abandon de certains produits devenus obsolètes et l'adjonction de nouveaux produits que EURL IDEAL ALUMINIUM souhaitera développer sur le marché. Cette modification doit faire l'objet d'un avenant.` },
  { id: 'CLS-3', titre: 'Article 03: BONNE FOI ET ÉTHIQUE', contenu: `Dans l'exécution de leurs obligations, les parties doivent agir de bonne foi et avec loyauté. Les dispositions du présent contrat, ainsi que tous les accords entre parties concernant ce dernier, doivent être interprétées de bonne foi.` },
  { id: 'CLS-4', titre: 'Article 04: OBLIGATIONS FOURNISSEUR', contenu: `Le fournisseur s'engage à :\n- Mettre à la disposition du client les quantités demandées selon le planning arrêté d'un commun accord.\n- Remettre au client toute information ou spécification technique sur demande de ce dernier.\n- Mettre à la disposition du client les équipes de montage nécessaires selon le planning arrêté d'un commun accord pour l'accomplissement de la mission objet du présent contrat.` },
  { id: 'CLS-5', titre: 'Article 05: OBLIGATIONS DU CLIENT', contenu: `Le client s'engage à :\n- Confirmer par bon de commande ferme adressé au fournisseur par E-Mail ou par courrier les quantités demandées.\n- Confirmer la date de livraison avec la direction commerciale de EURL IDEAL ALUMINIUM.\n- Confirmer les dates d'intervention pour installation des produits avec la direction commerciale de EURL IDEAL ALUMINIUM.\n- Effectuer les paiements conformément à l'article 08.\n- Désigner une personne chargée de la réception des produits sur place.\n- Disposer de moyens de télécommunications : téléphone fixe, mobile et connexion internet.\n- Réserver une zone de stockage sec et protégée du soleil pour les produits de EURL IDEAL ALUMINIUM.\n- Mettre à la disposition du fournisseur les moyens de manutention et assurer la manutention en présence de l'équipe de montage pour le déchargement des livraisons et le déploiement sur site du client.\n- Mettre à la disposition du fournisseur toutes les informations pouvant contribuer à la bonne réalisation de l'objet du présent contrat. À cette fin, le Client désigne un ou deux interlocuteurs, pour assurer le dialogue dans les diverses étapes de la mission contractée.\n- Aviser par courrier, en temps opportun, le fournisseur de l'arrêt des approvisionnements dans les cas ci-après :\n  - Baisse du régime de l'activité.\n  - Modification du planning.\n  - Mois de congé.\n  - Changement d'activité.\n  - Cas de force majeure.` },
  { id: 'CLS-6', titre: 'Article 06: CONDITIONS & PRE REQUIS CHANTIER', contenu: `- Lors de la livraison et du déchargement des produits sur le chantier, le client s'engage à mettre à la disposition du fournisseur les moyens de manutention, chariots élévateurs, et monte charges si disponibles.\n- Le client doit procéder au nettoyage des blocs avant le début de la pose par le fournisseur.\n- Les équipes de EURL IDEAL ALUMINIUM doivent intervenir seules dans les appartements, aucune intervention ne doit être programmée lors de la pose sans que le fournisseur ne soit informé et sauf une personne désignée par le client pour la réception des travaux. Après réception des travaux, EURL IDEAL ALUMINIUM se dégage de toutes responsabilités quant à tous éventuels dégâts futurs sur produit.` },
  { id: 'CLS-7', titre: 'Article 07: DUREE DE GARANTIE TECHNIQUE DES PRODUITS', contenu: `La garantie technique est valable 1 année à compter de la date de mise à disposition du produit ; sont exclus de la présente garantie technique les dommages après la réception du produit dus à l'usure naturelle, à un entreposage inapproprié et à un entretien inadéquat, à l'inobservation des instructions de service, à l'emploi de matières consommables impropres, à des interventions inadaptées sur les produits, ou toute autre raison non imputable au fournisseur.\nLa garantie technique se limite uniquement au remplacement des produits reconnus défectueux par le fournisseur. Tout dommage corporel ou matériel- de quelque nature que ce soit- causés par la manipulation et/ou le stockage et/ou l'emploi inadéquat des produits après la réception est à la charge du client.` },
  { id: 'CLS-8', titre: 'Article 08: CONDITIONS FINANCIERES', contenu: `8-1- Prix de vente\nLa facturation se fera selon la quantité de la fourniture de chaque bon de commande faisant l'objet du présent contrat.\nLes prix hors taxes et toutes taxes comprises communiqués par le fournisseur sont fixes et invariables pour tout le projet au titre du présent contrat après le paiement de l'avance sur paiement de 40 % du montant du devis total de la promotion à la signature du présent contrat.\n\n8-2- Modalités de paiements\nLe client s'engage à procéder au paiement du fournisseur de la manière suivante :\n- 40% du montant du devis total de fourniture et pose, à la commande.\n- 30% du montant du devis total à la livraison.\n- 25 % après la réception provisoire.\n- 5% (retenue de garantie) après la réception définitive des travaux.\n\n8-3 Incident de paiement\nTout retard de paiement pourra entrainer la suspension automatique des approvisionnements jusqu'à régularisation de la situation. Et une éventuelle suspension du présent contrat.\nEn cas d'incident de paiement ou de non-respect des délais de règlement, le présent contrat pourra être résilié de plein droit par le fournisseur.\nCette résiliation impliquera le refus, pur et simple par le fournisseur de satisfaire les commandes du client postérieures à l'incident, jusqu'au paiement total des sommes dues.\n\n8-4- Réclamations\nLe client et le fournisseur conviennent d'un commun accord qu'en cas de contradiction entre les prix et montant(s) affichés sur les bons de livraisons et les prix et montant(s) affichés sur les factures correspondantes, les prix et montant(s) figurant sur les factures, primeront.\nEn cas de réclamation du client sur les prix facturés et sur les remises appliquées (taux et montant), le client dispose d'un délai de sept (07) jours calendaires, décompté de la date de chaque facture, pour introduire sa réclamation formelle motivée auprès du fournisseur.\nAu-delà de ce délai calendaire, le client reconnaît, à ses torts exclusifs, qu'il ne peut prétendre – auprès du fournisseur à aucune compensation ou dédommagement de quelque que nature que ce soit.\n\n8-5- Validité et révision des prix\nLa validité des prix reste inchangée pour les quantités mentionnées sur le bon de commande qui sera joint au contrat pendant la durée du contrat (01 année), à condition que le client respecte les modalités de paiements comme de l'article 08-2.\nSauf exception de hausse ou de baisse des prix par le fournisseur, le client en sera informé - par écrit à l'avance, dans un délai raisonnable par le fournisseur. Le client doit manifester par écrit son acceptation de la nouvelle tarification.\nLa nouvelle tarification des produits, sera appliquée à toute commande / Livraison après la date de la notification (d'acceptation) écrite y afférente (et datée) émise par le fournisseur au client (le client). Cette nouvelle tarification interviendra pour les futurs bons de commandes, et donc n'inclura la commande déjà lancée.` },
  { id: 'CLS-9', titre: 'Article 09: APPROVISIONNEMENT ET LIVRAISON DES PRODUITS', contenu: `Le fournisseur s'engage à approvisionner le client aux conditions commerciales et financières définies ci-dessous pour la gamme de produits annexée. Ce dernier reconnait avoir une parfaite connaissance des conditions de la logistique d'approvisionnement du fournisseur, il doit notamment :\n- Confirmer par bon de commande ferme adressé au fournisseur par Email, courrier ou par remise de bon de commande physique ;\n- Confirmer la date de livraison avec la direction commerciale ;\n- Effectuer les paiements aux échéances fixées à l'article 08 ;\nEn cas de modification(s) ou d'annulation de bon(s) de commande, le client est tenu d'informer, par e-mail ou par courrier le fournisseur de la modification ou de l'annulation du bon de commande au plus tard dans les trois (03) jours calendaires suivant la date de notification du bon de commande initial.\nFaute de quoi, le client est tenu de procéder à l'enlèvement et au paiement à échéance initialement convenue des produits et ce, dans les quantités initialement notifiées.\nLe client est réputé avoir connaissance de la liste des prix (mis à jour par le fournisseur) ainsi que les conditions générales de vente, de livraison et de règlement telles que décrites dans le présent contrat.\n- Le fournisseur honorera les commandes du client dans les meilleurs délais possibles ;\n- Le client peut s'informer hebdomadairement auprès de la structure commerciale du fournisseur de l'évolution de la satisfaction physique par produit de chacun de ses bons de commande enregistré et accepté ;\n- Toute livraison et enlèvement quantitatif des produits seront matérialisés par un bon ou des bons de livraison ;\n- Le déchargement, réception des produits sur site du client ainsi que la manutention des produits sont à la charge de ce dernier.` },
  { id: 'CLS-10', titre: 'Article 10: Autres clauses négociées', contenu: `Les autres clauses négociées hors les articles du présent contrat et qui feront l'objet d'un avenant après sont :\n- \n- \n- ` },
  { id: 'CLS-11', titre: 'Article 11: DIMENSIONS STANDARDS IDEAL ALUMINIUM', contenu: `Les dimensions des ouvertures (réservation maçonnerie) et des seuils sur chantier du client doivent être conforme aux mesures communiquées par le client au fournisseur et ceci afin de permettre au fournisseur de procéder à la pose. Faute de quoi, l'équipe de EURL IDEAL ALUMINIUM n'assurera pas cette tâche jusqu'à ce que le client se conforme aux dimensions exigées.` },
  { id: 'CLS-12', titre: 'Article 12: TRANSFERT DE PROPRIETE', contenu: `Le transfert de propriété n'intervient qu'après la réception définitive telle que prévue ci-après :\n- Réception définitive des produits :\nLa réception des produits s'opérera de la manière suivante :\nLa réception définitive quantitative des produits se fait sur le bon de livraison qui atteste de la conformité du nombre de colis et de l'état extérieur de ladite marchandise sur le site du Client.\nLa réception doit être faite par le représentant du client et le chargé d'expédition du fournisseur.\nAucune réclamation ayant trait au nombre de colis ne peut être prise en compte par le fournisseur, une fois le bon de livraison visé par le représentant du client.\nSeules les réclamations ayant trait au sens d'ouverture sont prises en compte par le fournisseur une fois que la marchandise quitte le(s) entrepôt(s) du fournisseur.\nPendant toute la durée de réserve de propriété, les risques sur les produits sont transférés au client à partir du moment où le (s) moyen (s) de transport affrété (s) par le client quittent - chargés avec les produits le(s) entrepôt(s) du fournisseur.\nLe fournisseur prend en charge le déplacement du représentant du client et l'hébergement, le cas échéant.` },
  { id: 'CLS-13', titre: 'Article 13: DOMICILIATIONS BANCAIRES', contenu: `RIB DU FOURNISSEUR :\nORDRE DU FOURNISSEUR :\nRIB DU CLIENT :` },
  { id: 'CLS-14', titre: 'Article 14: GARANTIE TECHNIQUE DES PRODUITS', contenu: `Le fournisseur garantit ses produits livrés dans le cadre du présent contrat contre tout vice technique de conception ou de fabrication\nPour les produits déclarés défectueux par le client dans le délai de garantie et, reconnus non conformes techniquement par le fournisseur, le client peut demander l'échange du produit défectueux.\nSi le fournisseur exige la restitution des produits défectueux avant ou après leur remplacement, le client s'engage à les restituer, faute de quoi il accepte- au titre de la présente- la facturation du remplacement.\nLa garantie technique des produits ne couvre pas les avaries et/ou les manquants encourus ou relevés après les chargements ou pendant le transport ou au cours des opérations de déchargements chez le client et/ou les installations et utilisations non conformes aux préconisations et aux normes techniques en usage dans la profession.\nLe délai de réclamation au titre des produits déclassés, par le client, techniquement non conforme est de dix (10 jours) calendaires décomptés de la date spécifiée sur le bon de livraison. Toute réclamation doit être notifiée par écrit au fournisseur, par le client.\nAu-delà de ce délai calendaire, le client reconnaît qu'il ne peut prétendre, à ses torts exclusifs, à aucun échange, remplacement, compensation ou dédommagement de quelque nature que ce soit.` },
  { id: 'CLS-15', titre: "Article 15: DURÉE-PRISE D'EFFET-PROROGATION DU CONTRAT DE FOURNITURE ET POSE", contenu: `Le présent contrat est conclu pour une durée d'une année, il prend effet à compter de sa date de signature par les personnes habilitées des deux parties.\nLe contrat arrivé à terme est automatiquement renouvelé pour la même période et aux mêmes conditions par la signature d'un avenant entre les deux parties.\nLe signataire souhaitant résilier le contrat doit en faire la demande.` },
  { id: 'CLS-16', titre: 'Article 16: RESILIATION DU CONTRAT DE FOURNITURE ET POSE', contenu: `Les deux parties s'engagent à entretenir des relations caractérisées par la confiance et le respect des engagements définis au présent contrat et aux annexes qui en font partie intégrante.\nChaque partie a la faculté de résilier ce contrat dans le cas du non-respect des engagements (article 04 & 05 et article 8.5 concernant la modification des prix). Elle devra toutefois en aviser l'autre en moins 1 mois à l'avance par lettre recommandée avec accusé de réception.\nDans la mesure ou le contractant n'accuse pas réception de la lettre recommandée le contrat est considéré comme résilié et le retour de l'accusé de réception faisant foi.` },
  { id: 'CLS-17', titre: 'Article 17: CAS DE FORCE MAJEURE', contenu: `La partie désireuse de se prévaloir d'un cas de force majeure (événement extérieur et imprévisible) et tel que défini par le dispositif légal, devra le notifier à l'autre partie dans un délai de huit (08) jours ouvrables à compter de sa date de survenance.\nL'exécution des obligations est suspendue pendant une durée ne pouvant excéder trois (03) mois. A défaut la résiliation du présent contrat peut être prononcée par la partie la plus diligente.` },
  { id: 'CLS-18', titre: 'Article 18: CONFIDENTIALITE ET DISCRETION', contenu: `Le client & Le fournisseur s'engagent pendant toute la durée du présent contrat et sans limitation après son expiration à la confidentialité la plus totale concernant toutes informations auxquelles ils auraient pu avoir accès dans cadre de l'exécution de ce contrat de fourniture et pose.` },
  { id: 'CLS-19', titre: 'Article 19: DIFFERENTS ET CONTENTIEUX', contenu: `19-1 Le présent Contrat est régi par le droit algérien.\n19-2 Tout différend et/ou contentieux relatifs au respect, à l'application ou à l'interprétation des dispositions du présent contrat sera réglé à l'amiable.\nFaute d'arrangement à l'amiable du différend et/ou du contentieux dans un délai maximum de soixante (60) jours. Le différend et/ou le contentieux sera réglé par le tribunal de ________ seul et compétent, et ce même en cas de pluralité de défenses.` },
  { id: 'CLS-20', titre: 'Article 20: DISPOSITIONS GENERALES', contenu: `Le présent contrat est établi en trois (03) exemplaires originaux.\nLe présent contrat ne pourra faire l'objet d'aucune publicité par l'une des parties sans un accord écrit de l'autre partie. Toute modification du présent Contrat ne sera valable qu'après accord écrit et signé entre les Parties. Les modifications feront l'objet d'un avenant à annexer au présent Contrat. Le présent Contrat et ses trois (03) annexes constituent l'ensemble des documents régissant la relation entre les parties.` },
  { id: 'CLS-21', titre: 'Article 21: ELEGIBILITE DE LA TRADUCTION', contenu: `Il est convenu d'un commun accord que seuls les articles écrit dans la langue française priment dans ce contrat. Les articles en langue (..........) ne font office que de traduction, et le client s'engage à ce cette traduction soit conforme aux articles écrits en langue française.\nLa traduction de chaque article doit se faire dans la même page au-dessous de l'article en français.` },
  { id: 'CLS-22', titre: 'Article 22: NOTIFICATIONS', contenu: `Contrat de Fourniture et Pose\nToutes les notifications qui doivent être données au titre du présent contrat, le seront par écrit avec accusé de réception.\nElles sont valablement faites si elles sont envoyées par e-mail ou par courrier adressé au représentant habilité de la partie concernée :\n\nPour EURL IDEAL ALUMINIUM:\nNom & Prénom :\nAdresse : Siege social : Ilot n°35 Zone Industrielle Sidi Chami, Oran- Algérie\nTél. : +213 773 16 58 24\nE-Mail:\n\nPour [NOM DU CLIENT] :\nNom & Prénom :\nAdresse:\nTél, :\nE-Mail:` }
];

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmModal = ({ onConfirm, onCancel, contractInfo }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
  }}>
    <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: '48px', height: '48px', background: '#fef3c7', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <AlertCircle size={24} color="#d97706" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Confirmer la finalisation</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Cette action est irréversible.</p>
        </div>
      </div>
      <div style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
          Vous êtes sur le point de <strong>figer</strong> le contrat <strong>{contractInfo?.id}</strong> pour le client <strong>{contractInfo?.clientName}</strong>.<br /><br />
          Une fois figé, le contrat ne pourra plus être modifié et un suivi financier sera automatiquement créé.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>
          Annuler
        </button>
        <button onClick={onConfirm} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
          ✅ Confirmer et Finaliser
        </button>
      </div>
    </div>
  </div>
);

// ─── Email Confirmation Modal ─────────────────────────────────────────────────
const EmailModal = ({ clientEmail, onSend, onCancel, isSending }) => {
  const [email, setEmail] = useState(clientEmail || '');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', background: '#dbeafe', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <FileText size={24} color="#2563eb" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Envoi de confirmation par email</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Un email de confirmation sera envoyé au client.</p>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label className="label">Email du client</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@exemple.com" />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>
            Annuler
          </button>
          <button onClick={() => onSend(email)} disabled={isSending} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', cursor: 'pointer', fontWeight: 700, opacity: isSending ? 0.7 : 1 }}>
            {isSending ? '📤 Envoi...' : '📧 Envoyer et Figer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Clause Editor ────────────────────────────────────────────────────────────
const ClauseEditor = ({ clauses, setClauses, readOnly }) => {
  const [newTitle, setNewTitle] = useState('');
  const handleAdd = () => {
    if (!newTitle.trim()) return;
    setClauses(prev => [...prev, { id: `CLS-${Date.now()}`, titre: newTitle.trim(), contenu: '' }]);
    setNewTitle('');
  };
  const handleUpdate = (id, field, value) => {
    setClauses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const handleRemove = (id) => {
    setClauses(prev => prev.filter(c => c.id !== id));
  };
  const handleMove = (idx, dir) => {
    setClauses(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>📋 Clauses du Contrat</h3>
        {!readOnly && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Titre de la nouvelle clause..."
              style={{ padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '220px' }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', background: '#0f4c75', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
              <Plus size={14} /> Ajouter
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {clauses.map((clause, idx) => (
          <div key={clause.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ width: '24px', height: '24px', background: '#0f4c75', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: '2px' }}>
                <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>{idx + 1}</span>
              </div>
              {readOnly ? (
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{clause.titre}</strong>
              ) : (
                <input
                  value={clause.titre}
                  onChange={e => handleUpdate(clause.id, 'titre', e.target.value)}
                  style={{ flex: 1, fontWeight: 700, padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.9rem' }}
                />
              )}
              {!readOnly && (
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} style={{ padding: '0.2rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.3rem', cursor: 'pointer', color: '#64748b' }} title="Monter"><ChevronUp size={14} /></button>
                  <button onClick={() => handleMove(idx, 1)} disabled={idx === clauses.length - 1} style={{ padding: '0.2rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.3rem', cursor: 'pointer', color: '#64748b' }} title="Descendre"><ChevronDown size={14} /></button>
                  <button onClick={() => handleRemove(clause.id)} style={{ padding: '0.2rem', background: 'none', border: '1px solid #fca5a5', borderRadius: '0.3rem', cursor: 'pointer', color: '#ef4444' }} title="Supprimer"><X size={14} /></button>
                </div>
              )}
            </div>
            {readOnly ? (
              <p style={{ margin: '0 0 0 2rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{clause.contenu}</p>
            ) : (
              <textarea
                value={clause.contenu}
                onChange={e => handleUpdate(clause.id, 'contenu', e.target.value)}
                rows={3}
                style={{ width: '100%', marginLeft: '2rem', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', color: '#374151', lineHeight: 1.6 }}
              />
            )}
          </div>
        ))}
        {clauses.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 0', fontSize: '0.9rem' }}>Aucune clause. Ajoutez-en une ci-dessus.</p>
        )}
      </div>
    </div>
  );
};

// ─── Contract Generator Main Component ───────────────────────────────────────
const ContractGenerator = ({ data, setData, quoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [editingContract, setEditingContract] = useState(null);
  const [clauses, setClauses] = useState([...DEFAULT_CLAUSES]);
  const [montantHT, setMontantHT] = useState(0);
  const [tauxTVA, setTauxTVA] = useState(19);
  const [delaiJours, setDelaiJours] = useState(30);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [viewingContract, setViewingContract] = useState(null);

  const contracts = data.contracts || [];
  const orders = data.orders || [];
  const clients = data.clients || [];

  const montantTTC = useMemo(() => montantHT * (1 + tauxTVA / 100), [montantHT, tauxTVA]);
  const montantTVA = useMemo(() => montantHT * tauxTVA / 100, [montantHT, tauxTVA]);

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);
  const selectedClient = useMemo(() => {
    if (!selectedOrder) return null;
    return clients.find(c => c.id === selectedOrder.clientId) || null;
  }, [selectedOrder, clients]);

  const handleStartNewContract = (targetOrderId) => {
    const idToUse = targetOrderId || selectedOrderId;
    if (!idToUse) { alert('Veuillez sélectionner une commande.'); return; }
    const existingContract = contracts.find(c => c.orderId === idToUse && c.status === 'Figé');
    if (existingContract) {
      alert(`Un contrat est déjà figé pour cette commande (${existingContract.id}).`);
      return;
    }
    const order = orders.find(o => o.id === idToUse);
    const newContractId = `CTR-${Date.now().toString().slice(-6)}`;
    const draft = {
      id: newContractId,
      orderId: idToUse,
      clientId: order?.clientId || '',
      status: 'Brouillon',
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      companyInfo: {
        name: quoteSettings?.companyName || '',
        address: quoteSettings?.companyAddress || '',
        phone: quoteSettings?.companyPhone || '',
        email: quoteSettings?.companyEmail || '',
        rc: quoteSettings?.companyRC || '',
        nif: quoteSettings?.companyMF || '',
      },
      clientInfo: {
        nom: selectedClient?.nom || '',
        adresse: selectedClient?.adresse || '',
        telephone: selectedClient?.telephone || '',
        email: selectedClient?.email || '',
        nif: selectedClient?.nif || '',
        nis: selectedClient?.nis || '',
        rc: selectedClient?.rc || '',
      },
      montantHT: order?.totals?.ht || 0,
      montantTVA: (order?.totals?.ht || 0) * (tauxTVA / 100),
      montantTTC: order?.totals?.ttc || 0,
      tauxTVA: tauxTVA,
      delaiPaiementJours: delaiJours,
      clauses: [...DEFAULT_CLAUSES],
      confirmationEmailSent: false,
    };
    setMontantHT(draft.montantHT);
    setTauxTVA(draft.tauxTVA);
    setDelaiJours(draft.delaiPaiementJours);
    setClauses([...DEFAULT_CLAUSES]);
    setEditingContract(draft);
    setShowPreview(false);
  };

  const handleSaveDraft = () => {
    if (!editingContract) return;
    const updated = {
      ...editingContract,
      montantHT,
      montantTVA,
      montantTTC,
      tauxTVA,
      delaiPaiementJours: delaiJours,
      clauses,
    };
    setData(prev => {
      const existing = (prev.contracts || []).find(c => c.id === updated.id);
      const contracts = existing
        ? (prev.contracts || []).map(c => c.id === updated.id ? updated : c)
        : [...(prev.contracts || []), updated];
      return { ...prev, contracts };
    });
    setEditingContract(updated);
    alert('Brouillon sauvegardé !');
  };

  const handleFinalizeContract = () => {
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    setShowEmailModal(true);
  };

  const handleSendEmailAndFinalize = async (emailAddr) => {
    if (!emailAddr || !emailAddr.includes('@')) { alert('Email invalide.'); return; }
    setIsSending(true);
    const finalContract = {
      ...editingContract,
      montantHT,
      montantTVA,
      montantTTC,
      tauxTVA,
      delaiPaiementJours: delaiJours,
      clauses,
      status: 'Figé',
      acceptedAt: new Date().toISOString(),
      confirmationEmailSent: true,
      confirmationEmailAddr: emailAddr,
    };

    // Generate tracker
    const trackerId = `FIN-${Date.now().toString().slice(-6)}`;
    const newTracker = {
      id: trackerId,
      orderId: finalContract.orderId,
      contractId: finalContract.id,
      clientId: finalContract.clientId,
      montantContrat: finalContract.montantTTC,
      avance: { montant: 0, date: null, fichier: null, lienDrive: '' },
      versements: [],
      createdAt: new Date().toISOString(),
    };

    setData(prev => {
      const contracts = (prev.contracts || []).map(c => {
        if (c.id === finalContract.id) {
          return finalContract;
        }
        if (c.orderId === finalContract.orderId && c.status === 'Brouillon') {
          return { ...c, status: 'Annulé' };
        }
        return c;
      });
      
      const exists = contracts.some(c => c.id === finalContract.id);
      if (!exists) {
        contracts.push(finalContract);
      }

      const trackers = [...(prev.financialTrackers || []).filter(t => t.contractId !== finalContract.id), newTracker];
      return { ...prev, contracts, financialTrackers: trackers };
    });

    // Try to send email
    try {
      await invokeFunction('send-contract-confirmation', {
        recipient: emailAddr,
        clientName: finalContract.clientInfo?.nom || '',
        companyName: finalContract.companyInfo?.name || '',
        contractId: finalContract.id,
        orderId: finalContract.orderId,
        montantTTC: finalContract.montantTTC,
      });
    } catch (e) {
      console.warn('Email envoi échoué (non critique):', e);
    }

    setIsSending(false);
    setShowEmailModal(false);
    setEditingContract(null);
    alert(`✅ Contrat ${finalContract.id} figé ! Suivi financier ${trackerId} créé automatiquement.`);
  };

  const handleDeleteContract = (id) => {
    if (!window.confirm('Supprimer ce contrat ?')) return;
    setData(prev => ({ ...prev, contracts: (prev.contracts || []).filter(c => c.id !== id) }));
  };

  const statusColor = { 'Brouillon': '#f59e0b', 'Figé': '#10b981', 'Annulé': '#ef4444' };
  const statusBg = { 'Brouillon': '#fef3c7', 'Figé': '#dcfce7', 'Annulé': '#fee2e2' };

  const handleEditDraft = (contract) => {
    setEditingContract(contract);
    setMontantHT(contract.montantHT || 0);
    setTauxTVA(contract.tauxTVA || 19);
    setDelaiJours(contract.delaiPaiementJours || 30);
    setClauses(contract.clauses || [...DEFAULT_CLAUSES]);
    setShowPreview(false);
  };

  const handleDownloadPDF = (contractToDownload) => {
    if (!contractToDownload) return;
    
    const container = document.createElement('div');
    container.style.fontFamily = '"Times New Roman", Times, serif';
    container.style.color = '#000';
    container.style.fontSize = '12pt';
    container.style.lineHeight = '1.5';
    container.style.padding = '0';
    container.style.width = '170mm'; // A4 (210mm) - margins (2x20mm)
    container.style.backgroundColor = 'white';
    
    // Page de garde
    const coverPage = document.createElement('div');
    coverPage.style.display = 'flex';
    coverPage.style.flexDirection = 'column';
    coverPage.style.justifyContent = 'center';
    coverPage.style.alignItems = 'center';
    coverPage.style.pageBreakAfter = 'always';
    coverPage.style.minHeight = '250mm'; // Ajusté pour tenir compte des marges
    coverPage.style.textAlign = 'center';
    coverPage.style.boxSizing = 'border-box';
    
    coverPage.innerHTML = `
      <div style="font-size: 28pt; font-weight: bold; margin-bottom: 2rem; border-bottom: 3px solid #000; padding-bottom: 1rem; width: 100%; text-align: center;">
        IDEAL Aluminium
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%;">
        <div style="border: 2px solid #000; padding: 2rem; width: 100%; box-sizing: border-box;">
          <h1 style="font-size: 24pt; font-weight: bold; margin: 0; line-height: 1.4;">
            Projet de contrat<br/>
            Réalisation des travaux en fourniture et pose de menuiserie aluminium projet
          </h1>
        </div>
        <div style="margin-top: 4rem; font-size: 14pt; text-align: left; width: 100%;">
          <p style="border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; margin-bottom: 1rem;"><strong>Date prise d'effet :</strong> ${new Date(contractToDownload.createdAt).toLocaleDateString('fr-FR')}</p>
        </div>
      </div>
    `;
    container.appendChild(coverPage);
    
    // Page 2: Informations des parties
    const introPage = document.createElement('div');
    introPage.style.pageBreakAfter = 'always';
    introPage.style.boxSizing = 'border-box';
    introPage.style.display = 'flex';
    introPage.style.flexDirection = 'column';
    introPage.style.justifyContent = 'center';
    introPage.style.minHeight = '250mm'; // Ajusté pour tenir compte des marges
    
    introPage.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 3rem;">
        <div style="width: 45%; border: 1px solid #000; padding: 1rem; box-sizing: border-box;">
          <h3 style="margin-top: 0; font-size: 12pt; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem;">EURL IDEAL ALUMINIUM</h3>
          <p style="font-size: 11pt;">Siège social : ${contractToDownload.companyInfo?.address}</p>
          <p style="font-size: 11pt;">Tél : ${contractToDownload.companyInfo?.phone}</p>
          <p style="font-size: 11pt;">Email : ${contractToDownload.companyInfo?.email}</p>
          ${contractToDownload.companyInfo?.rc ? `<p style="font-size: 11pt;">RC : ${contractToDownload.companyInfo?.rc}</p>` : ''}
          ${contractToDownload.companyInfo?.nif ? `<p style="font-size: 11pt;">NIF : ${contractToDownload.companyInfo?.nif}</p>` : ''}
          <br/><br/>
          <p style="font-size: 11pt; text-align: justify;"><em>Représentée par son Directeur Général, est désigné ci-après « FOURNISSEUR ».</em></p>
          <p style="text-align: right; font-weight: bold; margin-top: 1rem;">D'une part,</p>
        </div>
        <div style="width: 45%; border: 1px solid #000; padding: 1rem; box-sizing: border-box;">
          <h3 style="margin-top: 0; font-size: 12pt; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem;">${contractToDownload.clientInfo?.nom}</h3>
          <p style="font-size: 11pt;">Siège social / Adresse : ${contractToDownload.clientInfo?.adresse}</p>
          <p style="font-size: 11pt;">Tél : ${contractToDownload.clientInfo?.telephone}</p>
          <p style="font-size: 11pt;">Email : ${contractToDownload.clientInfo?.email}</p>
          ${contractToDownload.clientInfo?.rc ? `<p style="font-size: 11pt;">RC : ${contractToDownload.clientInfo?.rc}</p>` : ''}
          ${contractToDownload.clientInfo?.nif ? `<p style="font-size: 11pt;">NIF : ${contractToDownload.clientInfo?.nif}</p>` : ''}
          <br/><br/>
          <p style="font-size: 11pt; text-align: justify;"><em>Représentée par : ______________ en qualité de gérant ayant tous les pouvoirs à l'effet de l'exécution du présent marché, dénommée ci-après le « CLIENT ».</em></p>
          <p style="text-align: right; font-weight: bold; margin-top: 1rem;">D'autre part,</p>
        </div>
      </div>
      
      <div style="margin-bottom: 2rem; text-align: left;">
        <p style="font-size: 12pt;">Dans le présent Contrat le Client et le Fournisseur seront désignées comme les <strong>« Parties »</strong> conjointement et comme <strong>« Partie »</strong> séparément.</p>
        <p style="font-size: 12pt; margin-top: 1rem; font-weight: bold;">Il a été arrêté et convenu ce qui suit :</p>
      </div>
    `;
    container.appendChild(introPage);
    
    // Contenu (Clauses)
    const contentContainer = document.createElement('div');
    contentContainer.style.boxSizing = 'border-box';
    
    const clausesHTML = contractToDownload.clauses.map(clause => {
      const titreParts = clause.titre.split(':');
      let formattedTitle = clause.titre;
      if (titreParts.length > 1) {
         formattedTitle = `<strong>${titreParts[0]}</strong>: ${titreParts.slice(1).join(':')}`;
      } else {
         formattedTitle = `<strong>${clause.titre}</strong>`;
      }

      return `
      <div style="margin-bottom: 1.5rem; text-align: justify;">
        <div style="background-color: #f0f0f0; padding: 0.5rem 1rem; margin-bottom: 0.5rem; border-left: 4px solid #000; page-break-after: avoid;">
          <p style="margin: 0; font-size: 12pt;">${formattedTitle}</p>
        </div>
        <div style="white-space: pre-wrap; font-size: 12pt; line-height: 1.6; padding-left: 0.5rem;">${clause.contenu}</div>
      </div>
    `}).join('');
    
    contentContainer.innerHTML += clausesHTML;
    
    contentContainer.innerHTML += `
      <div style="margin-top: 4rem; display: flex; justify-content: space-between; page-break-inside: avoid; border-top: 1px solid #ccc; padding-top: 2rem;">
        <div style="width: 45%; text-align: center;">
          <p style="font-weight: bold; font-size: 12pt; margin-bottom: 4rem;">Le Fournisseur</p>
          <p style="font-size: 10pt; color: #666;">(Signature et Cachet)</p>
        </div>
        <div style="width: 45%; text-align: center;">
          <p style="font-weight: bold; font-size: 12pt; margin-bottom: 4rem;">Le Client</p>
          <p style="font-size: 10pt; color: #666;">(Signature et Cachet lu et approuvé)</p>
        </div>
      </div>
    `;
    
    container.appendChild(contentContainer);
    
    const opt = {
      margin:       20,
      filename:     `Contrat_${contractToDownload.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };
    
    html2pdf().set(opt).from(container).save();
  };

  return (
    <div>
      {showConfirmModal && (
        <ConfirmModal
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirmModal(false)}
          contractInfo={{ id: editingContract?.id, clientName: selectedClient?.nom || editingContract?.clientInfo?.nom }}
        />
      )}
      {showEmailModal && (
        <EmailModal
          clientEmail={selectedClient?.email || editingContract?.clientInfo?.email || ''}
          onSend={handleSendEmailAndFinalize}
          onCancel={() => setShowEmailModal(false)}
          isSending={isSending}
        />
      )}
      {viewingContract && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Contrat {viewingContract.id}</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button onClick={() => handleDownloadPDF(viewingContract)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>
                  <Download size={16} /> Télécharger PDF
                </button>
                <button onClick={() => setViewingContract(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Société</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{viewingContract.companyInfo?.name}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Client</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{viewingContract.clientInfo?.nom}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Montant HT</p>
                <p style={{ margin: '0.25rem 0 0' }}>{(viewingContract.montantHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Montant TTC</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: '#0f4c75' }}>{(viewingContract.montantTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Délai de paiement</p>
                <p style={{ margin: '0.25rem 0 0' }}>{viewingContract.delaiPaiementJours} jours</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Figé le</p>
                <p style={{ margin: '0.25rem 0 0' }}>{viewingContract.acceptedAt ? new Date(viewingContract.acceptedAt).toLocaleDateString('fr-FR') : '—'}</p>
              </div>
            </div>
            <ClauseEditor clauses={viewingContract.clauses || []} setClauses={() => {}} readOnly={true} />
          </div>
        </div>
      )}

      {/* New contract creation bar */}
      {!editingContract && (
        <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>📝 Créer un nouveau contrat</h3>
          
          <div className="form-group" style={{ marginBottom: '1.25rem', maxWidth: '400px' }}>
            <label className="label">1. Sélectionner un Client</label>
            <select
              value={selectedClientId}
              onChange={e => { setSelectedClientId(e.target.value); setSelectedOrderId(''); }}
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
            >
              <option value="">— Choisir un client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          {selectedClientId && (
            <div>
              <label className="label" style={{ marginBottom: '0.75rem', display: 'block' }}>2. Devis / Commandes du client</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {orders.filter(o => o.clientId === selectedClientId).map(o => {
                  const hasContract = (data.contracts || []).some(ct => ct.orderId === o.id && ct.status !== 'Annulé');
                  
                  // Déterminer le plan de chantier
                  let sitePlanName = 'Aucun plan rattaché';
                  const client = clients.find(c => c.id === selectedClientId);
                  if (client && client.sitePlans) {
                    if (o.sitePlanId) {
                      const plan = client.sitePlans.find(p => p.id === o.sitePlanId);
                      if (plan) sitePlanName = plan.name || 'Plan sans nom';
                    } else {
                      // Recherche si une mesure de la commande est dans un plan
                      for (const plan of client.sitePlans) {
                        for (const floor of (plan.floors || [])) {
                          for (const apt of (floor.apartments || [])) {
                            for (const voidItem of (apt.voids || [])) {
                              if (o.items?.some(i => i.id === voidItem.itemId)) {
                                sitePlanName = plan.name || 'Plan sans nom';
                                break;
                              }
                            }
                          }
                        }
                      }
                    }
                  }

                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                          <strong style={{ color: '#0f4c75', fontSize: '1.05rem' }}>Commande {o.id}</strong>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: '#e2e8f0', borderRadius: '999px', color: '#475569', fontWeight: 600 }}>
                            {o.status || 'Nouveau'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          📍 Plan de chantier : <strong>{sitePlanName}</strong>
                        </p>
                      </div>
                      <div>
                        {hasContract ? (
                          <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700, padding: '0.5rem 1rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #a7f3d0' }}>
                            ✓ Contrat existant
                          </span>
                        ) : (
                          <button
                            onClick={() => { setSelectedOrderId(o.id); setTimeout(() => handleStartNewContract(o.id), 0); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                          >
                            <Plus size={16} /> Créer Contrat
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {orders.filter(o => o.clientId === selectedClientId).length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Ce client n'a aucune commande / devis.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {editingContract && (
        <div className="glass" style={{ marginBottom: '1.5rem', border: '2px solid #1b6ca8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>✏️ Contrat {editingContract.id}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Commande {editingContract.orderId} — {editingContract.clientInfo?.nom || 'Client'}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleDownloadPDF({ ...editingContract, clauses, montantHT, montantTVA, montantTTC, tauxTVA, delaiPaiementJours: delaiJours })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#0369a1' }}>
                <Download size={15} /> PDF
              </button>
              <button onClick={() => setShowPreview(!showPreview)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
                <Eye size={15} /> {showPreview ? 'Masquer' : 'Aperçu'}
              </button>
              <button onClick={handleSaveDraft}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#0369a1' }}>
                <Save size={15} /> Sauvegarder
              </button>
              <button onClick={handleFinalizeContract}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: 'linear-gradient(135deg, #059669, #047857)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'white' }}>
                <Lock size={15} /> Finaliser
              </button>
              <button onClick={() => setEditingContract(null)}
                style={{ padding: '0.5rem 0.9rem', background: 'none', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>
                Fermer
              </button>
            </div>
          </div>

          {showPreview ? (
            /* ── Preview mode ── */
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '2rem', fontFamily: 'Georgia, serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '3px double #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>CONTRAT DE FOURNITURE ET POSE</h1>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>Réf. {editingContract.id} — {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', borderLeft: '3px solid #1b6ca8' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b' }}>Le Prestataire</h4>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.companyInfo.name}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.companyInfo.address}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.companyInfo.phone} | {editingContract.companyInfo.email}</p>
                  {editingContract.companyInfo.rc && <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>RC: {editingContract.companyInfo.rc}</p>}
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', borderLeft: '3px solid #059669' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b' }}>Le Client</h4>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.clientInfo.nom}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.clientInfo.adresse}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.clientInfo.telephone} | {editingContract.clientInfo.email}</p>
                  {editingContract.clientInfo.nif && <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>NIF: {editingContract.clientInfo.nif}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#eff6ff', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Montant HT</span><br /><strong>{montantHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></div>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b' }}>TVA ({tauxTVA}%)</span><br /><strong>{montantTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></div>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Montant TTC</span><br /><strong style={{ fontSize: '1.1rem', color: '#0f4c75' }}>{montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></div>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Délai paiement</span><br /><strong>{delaiJours} jours</strong></div>
              </div>
              <ClauseEditor clauses={clauses} setClauses={() => {}} readOnly={true} />
            </div>
          ) : (
            /* ── Edit mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Parties info display */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#eff6ff', borderRadius: '0.75rem', padding: '1rem', borderLeft: '3px solid #1b6ca8' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Société (depuis Commercial)</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.companyInfo.name || '—'}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.companyInfo.address}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.companyInfo.phone} | {editingContract.companyInfo.email}</p>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: '0.75rem', padding: '1rem', borderLeft: '3px solid #059669' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Client (depuis fiche client)</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.clientInfo.nom || '—'}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.clientInfo.adresse}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.clientInfo.telephone} | {editingContract.clientInfo.email}</p>
                </div>
              </div>
              {/* Montants */}
              <div style={{ background: '#fafafa', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>💰 Montants du Contrat</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="label">Montant HT (DZD)</label>
                    <input className="input" type="number" value={montantHT} onChange={e => setMontantHT(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Taux TVA (%)</label>
                    <input className="input" type="number" value={tauxTVA} onChange={e => setTauxTVA(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label className="label">TVA (DZD)</label>
                    <input className="input" value={montantTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} readOnly style={{ background: '#f1f5f9', color: '#64748b' }} />
                  </div>
                  <div className="form-group">
                    <label className="label" style={{ color: '#0f4c75', fontWeight: 700 }}>Montant TTC (DZD)</label>
                    <input className="input" value={montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} readOnly style={{ background: '#eff6ff', fontWeight: 700, color: '#0f4c75' }} />
                  </div>
                  <div className="form-group">
                    <label className="label">Délai de paiement (jours)</label>
                    <input className="input" type="number" value={delaiJours} onChange={e => setDelaiJours(parseInt(e.target.value) || 30)} />
                  </div>
                </div>
              </div>
              {/* Clauses editor */}
              <ClauseEditor clauses={clauses} setClauses={setClauses} readOnly={false} />
            </div>
          )}
        </div>
      )}

      {/* Contracts list */}
      <div className="glass">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>📄 Contrats enregistrés</h2>
        {contracts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucun contrat. Créez-en un ci-dessus.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Contrat</th>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Montant TTC</th>
                  <th>Délai</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(ct => {
                  const client = clients.find(c => c.id === ct.clientId);
                  return (
                    <tr key={ct.id}>
                      <td style={{ fontWeight: 700, color: '#0f4c75' }}>{ct.id}</td>
                      <td>{ct.orderId}</td>
                      <td>{ct.clientInfo?.nom || client?.nom || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{(ct.montantTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td>{ct.delaiPaiementJours || '—'} j</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: statusBg[ct.status] || '#f1f5f9', color: statusColor[ct.status] || '#64748b' }}>
                          {ct.status === 'Figé' ? '🔒 ' : ct.status === 'Brouillon' ? '✏️ ' : ''}{ct.status}
                        </span>
                      </td>
                      <td>{new Date(ct.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button onClick={() => setViewingContract(ct)} style={{ padding: '0.3rem 0.6rem', background: '#e0f2fe', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#0369a1', fontSize: '0.8rem', fontWeight: 600 }}>
                            <Eye size={13} style={{ verticalAlign: 'middle' }} /> Voir
                          </button>
                          {ct.status === 'Brouillon' && (
                            <button onClick={() => handleEditDraft(ct)} style={{ padding: '0.3rem 0.6rem', background: '#fef3c7', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#d97706', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Edit3 size={13} style={{ verticalAlign: 'middle' }} /> Éditer
                            </button>
                          )}
                          <button onClick={() => handleDeleteContract(ct.id)} style={{ padding: '0.3rem 0.6rem', background: '#fee2e2', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractGenerator;
