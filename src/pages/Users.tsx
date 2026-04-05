import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserPlus, Building2, User } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Workspace {
  id: string;
  name: string;
}

export default function Users() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myWorkspaces, setMyWorkspaces] = useState<Workspace[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchProfiles(); }, []);
  useEffect(() => { if (user) fetchMyWorkspaces(); }, [user]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    if (data) setProfiles(data);
  };

  const fetchMyWorkspaces = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name)")
      .eq("user_id", user.id)
      .eq("role", "owner");
    if (data) {
      const wss = data.map((d: any) => d.workspaces).filter(Boolean);
      const uniqueWss = wss.filter((ws, index, self) =>
        index === self.findIndex((t) => t.id === ws.id)
      );
      setMyWorkspaces(uniqueWss);
    }
  };

  const handleOpenAssignDialog = async (profile: Profile) => {
    setSelectedProfile(profile);
    setUserWorkspaces([]);
    setIsDialogOpen(true);
    setLoading(true);
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", profile.id);
    if (data) setUserWorkspaces(data.map((d) => d.workspace_id));
    setLoading(false);
  };

  const toggleWorkspaceAssignment = async (workspaceId: string, isAssigned: boolean) => {
    if (!selectedProfile) return;
    setLoading(true);
    if (isAssigned) {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .match({ workspace_id: workspaceId, user_id: selectedProfile.id });
      if (error) toast.error("Erro ao remover do workspace: " + error.message);
      else { setUserWorkspaces((prev) => prev.filter((id) => id !== workspaceId)); toast.success("Usuário removido do workspace"); }
    } else {
      const { error } = await supabase
        .from("workspace_members")
        .insert({ workspace_id: workspaceId, user_id: selectedProfile.id, role: "member", status: "accepted" });
      if (error) toast.error("Erro ao adicionar ao workspace: " + error.message);
      else { setUserWorkspaces((prev) => [...prev, workspaceId]); toast.success("Usuário adicionado ao workspace"); }
    }
    setLoading(false);
  };

  return (
    <AppLayout title="Usuários">
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Todos os Usuários do Sistema</CardTitle>
            <CardDescription>
              Lista de todos os perfis registrados. Atribua ou remova usuários dos seus workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">ID</TableHead>
                  <TableHead className="w-16 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {profile.full_name?.[0]?.toUpperCase() || <User className="h-3 w-3" />}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{profile.full_name || "Usuário Sem Nome"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs font-mono">{profile.id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenAssignDialog(profile)}
                        title="Atribuir Workspaces"
                        className="hover:text-primary hover:bg-primary/10"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Workspaces</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <Avatar className="h-8 w-8">
                {selectedProfile?.avatar_url && <AvatarImage src={selectedProfile.avatar_url} />}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedProfile?.full_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{selectedProfile?.full_name || "Usuário Sem Nome"}</p>
                <p className="text-xs text-muted-foreground">ID: {selectedProfile?.id.slice(0, 8)}...</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Seus Workspaces (Administração)</h4>
              {myWorkspaces.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  Você não é proprietário de nenhum workspace no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {myWorkspaces.map((ws) => {
                    const isAssigned = userWorkspaces.includes(ws.id);
                    return (
                      <div key={ws.id} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/30 transition-colors">
                        <Checkbox
                          id={`ws-${ws.id}`}
                          checked={isAssigned}
                          onCheckedChange={() => toggleWorkspaceAssignment(ws.id, isAssigned)}
                          disabled={loading}
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <label htmlFor={`ws-${ws.id}`} className="text-sm font-medium cursor-pointer flex items-center gap-2 select-none">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {ws.name}
                          </label>
                          {isAssigned && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Membro</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
