import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (user) {
      fetchMyWorkspaces();
    }
  }, [user]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    if (data) setProfiles(data);
  };

  const fetchMyWorkspaces = async () => {
    if (!user) return;
    // Pega workspaces on o user_id logado é 'owner'
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name)")
      .eq("user_id", user.id)
      .eq("role", "owner");
    
    if (data) {
      const wss = data.map((d: any) => d.workspaces).filter(Boolean);
      // Remove duplicatas se houver
      const uniqueWss = wss.filter((ws, index, self) => 
        index === self.findIndex((t) => t.id === ws.id)
      );
      setMyWorkspaces(uniqueWss);
    }
  };

  const handleOpenAssignDialog = async (profile: Profile) => {
    setSelectedProfile(profile);
    setUserWorkspaces([]); // reset
    setIsDialogOpen(true);
    setLoading(true);

    // Fetch workspaces this user is currently in
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", profile.id);
      
    if (data) {
      setUserWorkspaces(data.map((d) => d.workspace_id));
    }
    setLoading(false);
  };

  const toggleWorkspaceAssignment = async (workspaceId: string, isAssigned: boolean) => {
    if (!selectedProfile) return;
    setLoading(true);

    if (isAssigned) {
      // Remove
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .match({ workspace_id: workspaceId, user_id: selectedProfile.id });
        
      if (error) {
        toast.error("Erro ao remover do workspace: " + error.message);
      } else {
        setUserWorkspaces((prev) => prev.filter((id) => id !== workspaceId));
        toast.success("Usuário removido do workspace");
      }
    } else {
      // Add
      const { error } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: selectedProfile.id,
          role: "member",
          status: "accepted"
        });
        
      if (error) {
        toast.error("Erro ao adicionar ao workspace: " + error.message);
      } else {
        setUserWorkspaces((prev) => [...prev, workspaceId]);
        toast.success("Usuário adicionado ao workspace");
      }
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors shadow-sm">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {profile.full_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile.full_name || "Usuário Sem Nome"}</p>
                    <p className="text-xs text-muted-foreground truncate" title={profile.id}>{profile.id.slice(0, 8)}...</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleOpenAssignDialog(profile)}
                    title="Atribuir Workspaces"
                    className="hover:text-primary hover:bg-primary/10"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {profiles.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum usuário encontrado.</p>
            )}
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
                  Você não é proprietário de nenhum workspace no momento. Crie um workspace para poder gerenciar membros.
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
                          <label 
                            htmlFor={`ws-${ws.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 flex items-center gap-2 select-none"
                          >
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