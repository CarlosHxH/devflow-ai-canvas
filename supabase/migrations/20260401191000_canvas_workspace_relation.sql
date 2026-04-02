-- Adiciona workspace_id na tabela de canvases
ALTER TABLE public.canvases ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Atualiza as políticas de RLS para canvases
DROP POLICY IF EXISTS "Members can view canvases" ON public.canvases;
DROP POLICY IF EXISTS "Members can create canvases" ON public.canvases;
DROP POLICY IF EXISTS "Members can update canvases" ON public.canvases;
DROP POLICY IF EXISTS "Members can delete canvases" ON public.canvases;

-- Nova política de visualização
CREATE POLICY "Members can view canvases" ON public.canvases 
FOR SELECT TO authenticated
USING (
  (project_id IS NOT NULL AND is_project_workspace_member(auth.uid(), project_id)) OR
  (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id))
);

-- Nova política de criação
CREATE POLICY "Members can create canvases" ON public.canvases 
FOR INSERT TO authenticated
WITH CHECK (
  ((project_id IS NOT NULL AND is_project_workspace_member(auth.uid(), project_id)) OR
   (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id))) 
  AND auth.uid() = created_by
);

-- Nova política de atualização
CREATE POLICY "Members can update canvases" ON public.canvases 
FOR UPDATE TO authenticated
USING (
  (project_id IS NOT NULL AND is_project_workspace_member(auth.uid(), project_id)) OR
  (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id))
);

-- Nova política de deleção
CREATE POLICY "Members can delete canvases" ON public.canvases 
FOR DELETE TO authenticated
USING (
  (project_id IS NOT NULL AND is_project_workspace_member(auth.uid(), project_id)) OR
  (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id))
);
