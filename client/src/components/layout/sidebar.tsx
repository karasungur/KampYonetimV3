import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  HelpCircle,
  Users,
  BarChart3,
  MessageSquare,
  History,
  MessageCircle,
  LogOut,
  Settings,
  Calendar,
  Share2,
} from "lucide-react";
import akPartiLogo from "@assets/akpartilogo_1753719301210.png";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navigationItems = {
    genelsekreterlik: [
      { path: "/", label: "Ana Panel", icon: LayoutDashboard },
      { path: "/questions", label: "Soru Yönetimi", icon: HelpCircle },
      { path: "/tables", label: "Masa Yönetimi", icon: Users },
      { path: "/users", label: "Kullanıcı Yönetimi", icon: Users },
      { path: "/responses", label: "Cevaplar", icon: MessageCircle },
      { path: "/reports", label: "Raporlar", icon: BarChart3 },
      { path: "/feedback", label: "Geri Bildirimler", icon: MessageSquare },
      { path: "/logs", label: "Sistem Logları", icon: History },
      { path: "/menu-settings", label: "Menü Ayarları", icon: Settings },
      { path: "/program-events", label: "Program Etkinlikleri", icon: Calendar },
      { path: "/social-media", label: "Sosyal Medya", icon: Share2 },
      { path: "/team-members", label: "Ekip Üyeleri", icon: Users },
    ],
    genelbaskan: [
      { path: "/", label: "Ana Panel", icon: LayoutDashboard },
      { path: "/responses", label: "Cevaplar", icon: MessageCircle },
      { path: "/reports", label: "Raporlar", icon: BarChart3 },
      { path: "/logs", label: "Sistem Logları", icon: History },
    ],
    moderator: [
      { path: "/", label: "Ana Panel", icon: LayoutDashboard },
      { path: "/questions", label: "Sorularım", icon: HelpCircle },
      { path: "/responses", label: "Cevaplarım", icon: MessageCircle },
    ],
  };

  const items = user ? navigationItems[user.role] || [] : [];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        <div className="flex flex-col items-center justify-center h-auto p-4 bg-white border-b">
          <img 
            src={akPartiLogo} 
            alt="AK Parti" 
            className="w-16 h-16 mb-2 object-contain"
          />
          <h1 className="text-center ak-text font-bold text-sm">İrade, İstikamet ve İstişare Kampı</h1>
          <p className="text-xs ak-gray mt-1">AK Parti Gençlik Kolları</p>
        </div>
        
        <nav className="mt-8">
          <div className="px-4 mb-4">
            <p className="text-xs font-semibold ak-gray uppercase tracking-wider">Menü</p>
          </div>
          
          <div className="space-y-2 px-4">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      isActive 
                        ? "bg-ak-yellow text-white hover:bg-ak-yellow-dark" 
                        : "ak-text hover:bg-ak-light-gray"
                    )}
                    onClick={() => onClose()}
                  >
                    <Icon className="mr-3" size={16} />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t">
          <Button
            variant="ghost"
            onClick={() => logout()}
            className="w-full justify-start text-red-600 hover:bg-red-50"
          >
            <LogOut className="mr-2" size={16} />
            Güvenli Çıkış
          </Button>
        </div>
      </div>
    </>
  );
}
