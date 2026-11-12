CREATE OR REPLACE FUNCTION public.shares_workspace(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m1
    JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces w JOIN public.workspace_members m ON m.workspace_id = w.id
    WHERE (w.created_by = _a AND m.user_id = _b) OR (w.created_by = _b AND m.user_id = _a)
  )
$$;

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND (user_id = auth.uid() OR public.shares_workspace(auth.uid(), user_id)));

DROP POLICY IF EXISTS "Members can view checklists" ON public.checklists;
DROP POLICY IF EXISTS "Members can create checklists" ON public.checklists;
DROP POLICY IF EXISTS "Members can update checklists" ON public.checklists;
DROP POLICY IF EXISTS "Members can delete checklists" ON public.checklists;
CREATE POLICY "Members can view checklists" ON public.checklists FOR SELECT TO authenticated
USING (public.is_project_workspace_member(auth.uid(), (SELECT t.project_id FROM public.tasks t WHERE t.id = checklists.task_id)));
CREATE POLICY "Members can create checklists" ON public.checklists FOR INSERT TO authenticated
WITH CHECK (public.is_project_workspace_member(auth.uid(), (SELECT t.project_id FROM public.tasks t WHERE t.id = checklists.task_id)));
CREATE POLICY "Members can update checklists" ON public.checklists FOR UPDATE TO authenticated
USING (public.is_project_workspace_member(auth.uid(), (SELECT t.project_id FROM public.tasks t WHERE t.id = checklists.task_id)))
WITH CHECK (public.is_project_workspace_member(auth.uid(), (SELECT t.project_id FROM public.tasks t WHERE t.id = checklists.task_id)));
CREATE POLICY "Members can delete checklists" ON public.checklists FOR DELETE TO authenticated
USING (public.is_project_workspace_member(auth.uid(), (SELECT t.project_id FROM public.tasks t WHERE t.id = checklists.task_id)));

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own and teammates profiles" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.shares_workspace(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));