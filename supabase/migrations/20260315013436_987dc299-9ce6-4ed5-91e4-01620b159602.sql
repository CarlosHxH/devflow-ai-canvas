
-- Projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project statuses
CREATE TABLE public.project_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES public.project_statuses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  assignee_id uuid,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Checklists
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Canvases
CREATE TABLE public.canvases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled',
  mermaid_code text,
  react_flow_data jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helper function (after tables exist)
CREATE OR REPLACE FUNCTION public.is_project_workspace_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = _project_id AND wm.user_id = _user_id AND wm.status = 'accepted'
  )
$$;

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

-- Projects RLS
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = created_by);
CREATE POLICY "Members can update projects" ON public.projects FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Owners can delete projects" ON public.projects FOR DELETE TO authenticated
  USING (is_workspace_owner(auth.uid(), workspace_id));

-- Project statuses RLS
CREATE POLICY "Members can view statuses" ON public.project_statuses FOR SELECT TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can manage statuses" ON public.project_statuses FOR INSERT TO authenticated
  WITH CHECK (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can update statuses" ON public.project_statuses FOR UPDATE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can delete statuses" ON public.project_statuses FOR DELETE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));

-- Tasks RLS
CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can create tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (is_project_workspace_member(auth.uid(), project_id) AND auth.uid() = created_by);
CREATE POLICY "Members can update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can delete tasks" ON public.tasks FOR DELETE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));

-- Checklists RLS
CREATE POLICY "Members can view checklists" ON public.checklists FOR SELECT TO authenticated
  USING (is_project_workspace_member(auth.uid(), (SELECT project_id FROM public.tasks WHERE id = task_id)));
CREATE POLICY "Members can create checklists" ON public.checklists FOR INSERT TO authenticated
  WITH CHECK (is_project_workspace_member(auth.uid(), (SELECT project_id FROM public.tasks WHERE id = task_id)));
CREATE POLICY "Members can update checklists" ON public.checklists FOR UPDATE TO authenticated
  USING (is_project_workspace_member(auth.uid(), (SELECT project_id FROM public.tasks WHERE id = task_id)));
CREATE POLICY "Members can delete checklists" ON public.checklists FOR DELETE TO authenticated
  USING (is_project_workspace_member(auth.uid(), (SELECT project_id FROM public.tasks WHERE id = task_id)));

-- Comments RLS
CREATE POLICY "Members can view comments" ON public.comments FOR SELECT TO authenticated
  USING (is_project_workspace_member(auth.uid(), (SELECT project_id FROM public.tasks WHERE id = task_id)));
CREATE POLICY "Members can create comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (is_project_workspace_member(auth.uid(), (SELECT project_id FROM public.tasks WHERE id = task_id)) AND auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Canvases RLS
CREATE POLICY "Members can view canvases" ON public.canvases FOR SELECT TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can create canvases" ON public.canvases FOR INSERT TO authenticated
  WITH CHECK (is_project_workspace_member(auth.uid(), project_id) AND auth.uid() = created_by);
CREATE POLICY "Members can update canvases" ON public.canvases FOR UPDATE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));
CREATE POLICY "Members can delete canvases" ON public.canvases FOR DELETE TO authenticated
  USING (is_project_workspace_member(auth.uid(), project_id));

-- Triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_canvases_updated_at BEFORE UPDATE ON public.canvases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create default statuses
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_statuses (project_id, name, position, color) VALUES
    (NEW.id, 'Backlog', 0, '#6b7280'),
    (NEW.id, 'Em Desenvolvimento', 1, '#3b82f6'),
    (NEW.id, 'Em Revisão', 2, '#f59e0b'),
    (NEW.id, 'Concluído', 3, '#10b981');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project();
