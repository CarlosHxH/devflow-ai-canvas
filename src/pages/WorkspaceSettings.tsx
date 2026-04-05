import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { UserPlus, Mail, Trash2, Shield, Building2, User, Crown, Save, Key, Eye, EyeOff, Upload, Loader2 } from "lucide-react";
import { AvatarImage } from "@/components/ui/avatar";
import { AvatarCropDialog } from "@/components/profile/AvatarCropDialog";

interface Member {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "admin" | "member";
  status: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

interface Profile {
  full_name: string;
  avatar_url: string;
}

export default function WorkspaceSettings() {
  const navigate = useNavigate();
  const { currentWorkspace, refetch } = useWorkspace();
  const { user } = useAuth();

  // General tab
  const [wsName, setWsName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Members tab
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);

  // Profile tab
  const [profile, setProfile] = useState<Profile>({ full_name: "", avatar_url: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // API Key tab
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  const isOwner = currentWorkspace?.created_by === user?.id;

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name);
      fetchMembers();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchApiKey();
    }
  }, [user]);

  // ---- Fetch ----
  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", currentWorkspace.id);
    if (!data) return;

    // Fetch profiles for members that have user_id
    const userIds = data.map((m) => m.user_id).filter(Boolean) as string[];
    let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      if (profiles) {
        profiles.forEach((p) => { profilesMap[p.id] = p; });
      }
    }

    setMembers(data.map((m: any) => ({
      ...m,
      profile: m.user_id ? profilesMap[m.user_id] || null : null,
    })));
  };

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
    if (data) setProfile({ full_name: data.full_name || "", avatar_url: data.avatar_url || "" });
  };

  const fetchApiKey = async () => {
    if (!user) return;
    const { data } = await (supabase.from("user_settings") as any).select("gemini_api_key").eq("user_id", user.id).maybeSingle();
    if (data?.gemini_api_key) setGeminiApiKey(data.gemini_api_key);
    setApiKeyLoaded(true);
  };

  const handleSaveApiKey = async () => {
    if (!user) return;
    setSavingApiKey(true);
    const { data: existing } = await (supabase.from("user_settings") as any).select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await (supabase.from("user_settings") as any).update({ gemini_api_key: geminiApiKey || null }).eq("user_id", user.id);
    } else {
      await (supabase.from("user_settings") as any).insert({ user_id: user.id, gemini_api_key: geminiApiKey || null });
    }
    toast.success("Chave da API salva");
    setSavingApiKey(false);
  };

  // ---- General ----
  const handleRenameWorkspace = async () => {
    if (!currentWorkspace || !wsName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("workspaces").update({ name: wsName.trim() }).eq("id", currentWorkspace.id);
    if (error) toast.error("Erro ao renomear: " + error.message);
    else { toast.success("Workspace renomeado"); refetch(); }
    setSavingName(false);
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;
    const { error } = await supabase.from("workspaces").delete().eq("id", currentWorkspace.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Workspace excluído"); refetch(); navigate("/"); }
  };

  // ---- Members ----
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !user) return;
    setLoading(true);
    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: currentWorkspace.id,
      invited_email: inviteEmail,
      role: inviteRole,
      status: "pending",
    });
    if (error) toast.error("Erro ao convidar: " + error.message);
    else { toast.success(`Convite enviado para ${inviteEmail}`); setInviteEmail(""); fetchMembers(); }
    setLoading(false);
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member") => {
    const { error } = await supabase.from("workspace_members").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error("Erro ao alterar role");
    else { toast.success("Papel atualizado"); fetchMembers(); }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    if (error) toast.error("Erro ao remover membro");
    else { toast.success("Membro removido"); fetchMembers(); }
  };

  // ---- Profile ----
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCrop, setShowCrop] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setShowCrop(true);
    e.target.value = "";
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!user) return;
    setShowCrop(false);
    setUploadingAvatar(true);

    const filePath = `${user.id}/avatar.png`;
    const file = new File([blob], "avatar.png", { type: "image/png" });

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar imagem: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
    if (error) toast.error("Erro ao salvar avatar");
    else {
      setProfile((p) => ({ ...p, avatar_url: avatarUrl }));
      toast.success("Avatar atualizado!");
    }
    setUploadingAvatar(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name || null,
      avatar_url: profile.avatar_url || null,
    }).eq("id", user.id);
    if (error) toast.error("Erro ao salvar perfil");
    else toast.success("Perfil atualizado");
    setSavingProfile(false);
  };

  const roleConfig: Record<string, { label: string; icon: typeof Shield; variant: string }> = {
    owner: { label: "Proprietário", icon: Crown, variant: "default" },
    admin: { label: "Admin", icon: Shield, variant: "secondary" },
    member: { label: "Membro", icon: User, variant: "outline" },
  };

  const userInitials = profile.full_name
    ?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <AppLayout title="Configurações">
      <div className="max-w-3xl space-y-6 animate-fade-in">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="gap-2"><Building2 className="h-4 w-4" /> Workspace</TabsTrigger>
            <TabsTrigger value="members" className="gap-2"><UserPlus className="h-4 w-4" /> Membros</TabsTrigger>
            <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" /> Meu Perfil</TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-2"><Key className="h-4 w-4" /> API Keys</TabsTrigger>
          </TabsList>

          {/* ========== GENERAL ========== */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Workspace</CardTitle>
                <CardDescription>Renomeie ou gerencie seu workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Nome do Workspace</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ws-name"
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      disabled={!isOwner}
                    />
                    {isOwner && (
                      <Button onClick={handleRenameWorkspace} disabled={savingName || wsName === currentWorkspace?.name}>
                        <Save className="h-4 w-4 mr-2" />
                        {savingName ? "Salvando..." : "Salvar"}
                      </Button>
                    )}
                  </div>
                  {!isOwner && <p className="text-xs text-muted-foreground">Apenas o proprietário pode renomear.</p>}
                </div>
              </CardContent>
            </Card>

            {isOwner && (
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-destructive">Zona de perigo</CardTitle>
                  <CardDescription>Ações irreversíveis para este workspace</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir workspace
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir workspace "{currentWorkspace?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todos os projetos, tarefas, documentos e dados associados serão excluídos permanentemente. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteWorkspace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir permanentemente
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ========== MEMBERS ========== */}
          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Membros do Workspace</CardTitle>
                <CardDescription>
                  Gerencie quem tem acesso a "{currentWorkspace?.name}" · {members.length} membro{members.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {isOwner && (
                  <>
                    <form onSubmit={handleInvite} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        className="flex-1"
                      />
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "member" | "admin")}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="submit" disabled={loading}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Convidar
                      </Button>
                    </form>
                    <Separator />
                  </>
                )}

                <div className="space-y-2">
                  {members.map((member) => {
                    const rc = roleConfig[member.role] || roleConfig.member;
                    const RoleIcon = rc.icon;
                    const isSelf = member.user_id === user?.id;
                    const memberIsOwner = member.role === "owner";

                    return (
                      <div key={member.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {member.profile?.full_name?.[0]?.toUpperCase() || <Mail className="h-3.5 w-3.5" />}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {member.profile?.full_name || member.invited_email || "Pendente"}
                              {isSelf && <span className="text-xs text-muted-foreground ml-1">(você)</span>}
                            </p>
                            {member.invited_email && member.status === "pending" && (
                              <p className="text-xs text-muted-foreground">{member.invited_email} · Convite pendente</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOwner && !memberIsOwner && !isSelf ? (
                            <>
                              <Select
                                value={member.role}
                                onValueChange={(v) => handleChangeRole(member.id, v as "admin" | "member")}
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Membro</SelectItem>
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {member.profile?.full_name || member.invited_email} perderá acesso a todos os projetos deste workspace.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveMember(member.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          ) : (
                            <Badge variant={rc.variant as any} className="gap-1">
                              <RoleIcon className="h-3 w-3" />
                              {rc.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== PROFILE ========== */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meu Perfil</CardTitle>
                <CardDescription>Edite suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-16 w-16">
                      {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                      <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Upload className="h-5 w-5 text-white" />}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploadingAvatar} />
                    </label>
                  </div>
                  <div>
                    <p className="font-medium">{profile.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">Passe o mouse no avatar para trocar a foto</p>
                  </div>
                </div>
                <AvatarCropDialog open={showCrop} imageFile={cropFile} onClose={() => setShowCrop(false)} onCrop={handleCroppedUpload} />

                <Separator />

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Nome completo</Label>
                    <Input
                      id="profile-name"
                      value={profile.full_name}
                      onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingProfile ? "Salvando..." : "Salvar perfil"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== API KEYS ========== */}
          <TabsContent value="apikeys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Chave da API Gemini</CardTitle>
                <CardDescription>
                  Configure sua chave da API do Google Gemini para gerar diagramas com IA no Canvas.
                  Obtenha uma chave em{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Google AI Studio
                  </a>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gemini-key">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="gemini-key"
                        type={showApiKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIza..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={handleSaveApiKey} disabled={savingApiKey}>
                      <Save className="h-4 w-4 mr-2" />
                      {savingApiKey ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sua chave é armazenada de forma segura e usada apenas para chamadas à API Gemini.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
