-- Exécutez ce script dans l'éditeur SQL de votre tableau de bord Supabase

CREATE TABLE IF NOT EXISTS public.operations_log (
    id SERIAL PRIMARY KEY,
    op VARCHAR(50) NOT NULL,
    collection VARCHAR(100) NOT NULL,
    doc_id VARCHAR(100) NOT NULL,
    data JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sécurité RLS
ALTER TABLE public.operations_log ENABLE ROW LEVEL SECURITY;

-- Autoriser la lecture publique (nécessaire pour l'API Key anonyme)
CREATE POLICY "Allow anonymous read operations"
ON public.operations_log FOR SELECT
TO anon
USING (true);

-- Autoriser l'écriture publique
CREATE POLICY "Allow anonymous insert operations"
ON public.operations_log FOR INSERT
TO anon
WITH CHECK (true);

-- Activer le mode Realtime pour cette table afin que les autres PC soient notifiés
BEGIN;
  -- Si une publication "supabase_realtime" existe déjà, on l'utilise, sinon on la crée (par défaut elle existe)
  -- Pour éviter une erreur si elle existe, on ajoute simplement la table
  ALTER PUBLICATION supabase_realtime ADD TABLE public.operations_log;
COMMIT;
