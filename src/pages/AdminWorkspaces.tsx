import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Search, ShieldCheck, Trash2 } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  ownerName: string;
}

export default function AdminWorkspaces() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [deleting, setDeleting] = useState<Workspace | null>(null);

  const fetchWorkspaces = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar os workspaces: " + error.message);
      setLoading(false);
      return;
    }

    const ownerIds = [...new Set((data || []).map((workspace) => workspace.created_by))];
    const { data: profiles } = ownerIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds)
      : { data: [] };
    const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));

    setWorkspaces((data || []).map((workspace) => ({
      ...workspace,
      ownerName: names.get(workspace.created_by) || "Usuário sem nome",
    })));
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const verifyAdmin = async () => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!active) return;
      if (error || !data) {
        navigate("/", { replace: true });
        return;
      }
      setAuthorized(true);
      setCheckingAccess(false);
      await fetchWorkspaces();
    };
    verifyAdmin();
    return () => { active = false; };
  }, [user, navigate]);

  const filteredWorkspaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((workspace) =>
      workspace.name.toLocaleLowerCase().includes(query)
      || workspace.ownerName.toLocaleLowerCase().includes(query),
    );
  }, [search, workspaces]);

  const handleRename = async () => {
    if (!editing || !workspaceName.trim()) return;
    const { error } = await supabase
      .from("workspaces")
      .update({ name: workspaceName.trim() })
      .eq("id", editing.id);
    if (error) {
      toast.error("Não foi possível renomear o workspace: " + error.message);
      return;
    }
    setWorkspaces((current) => current.map((workspace) =>
      workspace.id === editing.id ? { ...workspace, name: workspaceName.trim() } : workspace,
    ));
    setEditing(null);
    toast.success("Workspace renomeado.");
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("workspaces").delete().eq("id", deleting.id);
    if (error) {
      toast.error("Não foi possível excluir o workspace: " + error.message);
      return;
    }
    setWorkspaces((current) => current.filter((workspace) => workspace.id !== deleting.id));
    setDeleting(null);
    toast.success("Workspace excluído.");
  };

  if (checkingAccess || !authorized) {
    return (
      <AppLayout title="Workspaces">
        <div className="flex min-h-48 items-center justify-center" aria-label="Verificando acesso">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Workspaces">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Administração do sistema
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Workspaces</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {workspaces.length} {workspaces.length === 1 ? "workspace cadastrado" : "workspaces cadastrados"}
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou proprietário"
              className="pl-9"
              aria-label="Buscar workspaces"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead className="hidden sm:table-cell">Proprietário</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Carregando workspaces...</TableCell></TableRow>
              ) : filteredWorkspaces.length ? filteredWorkspaces.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="truncate font-medium">{workspace.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{workspace.ownerName}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {new Date(workspace.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Renomear ${workspace.name}`}
                        title="Renomear"
                        onClick={() => { setEditing(workspace); setWorkspaceName(workspace.name); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Excluir ${workspace.name}`}
                        title="Excluir"
                        onClick={() => setDeleting(workspace)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {search ? "Nenhum workspace corresponde à busca." : "Nenhum workspace cadastrado."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renomear workspace</AlertDialogTitle>
            <AlertDialogDescription>O novo nome será exibido para todos os membros.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleRename(); }} disabled={!workspaceName.trim()}>
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá “{deleting?.name}” e seus dados associados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => { event.preventDefault(); void handleDelete(); }}
            >
              Excluir workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}