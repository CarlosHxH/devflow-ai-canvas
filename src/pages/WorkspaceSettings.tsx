import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Mail } from "lucide-react";

interface Member {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role: string;
  status: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

export default function WorkspaceSettings() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentWorkspace) fetchMembers();
  }, [currentWorkspace]);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from("workspace_members")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .eq("workspace_id", currentWorkspace.id);

    if (data) {
      setMembers(data.map((m: any) => ({ ...m, profile: m.profiles })));
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !user) return;
    setLoading(true);

    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: currentWorkspace.id,
      invited_email: inviteEmail,
      role: "member" as const,
      status: "pending",
    });

    if (error) {
      toast.error("Erro ao convidar: " + error.message);
    } else {
      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail("");
      fetchMembers();
    }
    setLoading(false);
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "owner": return "default";
      case "admin": return "secondary";
      default: return "outline";
    }
  };

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Membros do Workspace</CardTitle>
            <CardDescription>Gerencie quem tem acesso a "{currentWorkspace?.name}"</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleInvite} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                <UserPlus className="mr-2 h-4 w-4" />
                Convidar
              </Button>
            </form>

            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {member.profile?.full_name?.[0]?.toUpperCase() || <Mail className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.profile?.full_name || member.invited_email || "Pendente"}
                      </p>
                      {member.status === "pending" && (
                        <p className="text-xs text-muted-foreground">Convite pendente</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={roleColor(member.role) as any}>{member.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
