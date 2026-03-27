
-- Wiki pages table with parent/child hierarchy
CREATE TABLE public.wiki_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.wiki_pages(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content_markdown TEXT DEFAULT '',
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  position INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view wiki pages" ON public.wiki_pages
  FOR SELECT TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));

CREATE POLICY "Members can create wiki pages" ON public.wiki_pages
  FOR INSERT TO authenticated
  WITH CHECK (is_project_workspace_member(auth.uid(), project_id) AND auth.uid() = created_by);

CREATE POLICY "Members can update wiki pages" ON public.wiki_pages
  FOR UPDATE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));

CREATE POLICY "Members can delete wiki pages" ON public.wiki_pages
  FOR DELETE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));

-- Trigger for updated_at
CREATE TRIGGER update_wiki_pages_updated_at
  BEFORE UPDATE ON public.wiki_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
