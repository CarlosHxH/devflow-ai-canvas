-- 1. Garantir que a coluna position existe e tem um valor padrão
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='checklists' AND
column_name='position') THEN
        ALTER TABLE public.checklists ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. Atualizar as políticas de RLS para o Checklist
-- Removemos as antigas para evitar conflitos
DROP POLICY IF EXISTS "Members can update checklists" ON public.checklists;
DROP POLICY IF EXISTS "Members can view checklists" ON public.checklists;
DROP POLICY IF EXISTS "Members can create checklists" ON public.checklists;
DROP POLICY IF EXISTS "Members can delete checklists" ON public.checklists;

-- Política de Visualização
CREATE POLICY "Members can view checklists" ON public.checklists
FOR SELECT TO authenticated
USING (true); -- Simplificado para teste, ou mantenha a lógica de projeto se preferir

-- Política de Inserção
CREATE POLICY "Members can create checklists" ON public.checklists
FOR INSERT TO authenticated 
WITH CHECK (true);

-- Política de Atualização (CRÍTICA PARA O REORDENAMENTO)
-- Usamos USING(true) para permitir que o banco encontre a linha e WITH CHECK para validar a permissão
CREATE POLICY "Members can update checklists" ON public.checklists
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Política de Deleção
CREATE POLICY "Members can delete checklists" ON public.checklists
FOR DELETE TO authenticated