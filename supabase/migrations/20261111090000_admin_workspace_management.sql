CREATE POLICY "Global admins can view all workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Global admins can update all workspaces"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Global admins can delete all workspaces"
  ON public.workspaces FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));