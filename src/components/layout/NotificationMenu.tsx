import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  content: string;
  link: string | null;
  read: boolean;
  created_at: string;
  actor_id: string;
  actor: { full_name: string; avatar_url: string } | null;
}

export function NotificationMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      const sub = supabase.channel("realtime-notifications")
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
          fetchNotifications();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("notifications")
      .select(`
        *,
        actor:profiles!actor_id(full_name, avatar_url)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
      
    if (data) {
      setNotifications(data as any);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    fetchNotifications();
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-80 p-0 mr-4 mt-1 z-50">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-primary">
              Marcar todas lidas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-center text-muted-foreground">Nenhuma notificação</p>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm leading-tight">
                      <span className="font-semibold">{n.actor?.full_name || "Alguém"}</span>{" "}
                      <span className="text-muted-foreground">{n.content}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {!n.read && <div className="h-2 w-2 bg-primary rounded-full mt-1 shrink-0" />}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
