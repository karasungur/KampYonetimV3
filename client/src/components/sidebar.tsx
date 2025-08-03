import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Users, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Calendar,
  Camera,
  Share2,
  Table,
  Activity
} from "lucide-react";

const navigation = [
  { name: 'Ana Sayfa', href: '/', icon: Home, roles: ['genelsekreterlik', 'genelbaskan', 'moderator'] },
  { name: 'Sorular', href: '/questions', icon: MessageSquare, roles: ['genelsekreterlik', 'genelbaskan', 'moderator'] },
  { name: 'Kullanıcılar', href: '/users', icon: Users, roles: ['genelsekreterlik'] },
  { name: 'Masalar', href: '/tables', icon: Table, roles: ['genelsekreterlik'] },
  { name: 'Raporlar', href: '/reports', icon: BarChart3, roles: ['genelsekreterlik', 'genelbaskan'] },
  { name: 'Geri Bildirimler', href: '/feedback', icon: FileText, roles: ['genelsekreterlik'] },
  { name: 'Fotoğraflar', href: '/photos', icon: Camera, roles: ['genelsekreterlik', 'genelbaskan', 'moderator'] },
  { name: 'Program Etkinlikleri', href: '/program-events', icon: Calendar, roles: ['genelsekreterlik'] },
  { name: 'Sosyal Medya', href: '/social-media', icon: Share2, roles: ['genelsekreterlik'] },
  { name: 'Ekip Üyeleri', href: '/team-members', icon: Users, roles: ['genelsekreterlik'] },
  { name: 'Menü Ayarları', href: '/menu-settings', icon: Settings, roles: ['genelsekreterlik'] },
  { name: 'Sistem Logları', href: '/logs', icon: Activity, roles: ['genelsekreterlik'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <div className="flex h-full w-64 flex-col bg-white shadow-lg">
      <div className="flex flex-1 flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <h2 className="text-lg font-semibold ak-text">
            AK Parti Gençlik Kolları
          </h2>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <a
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-ak-yellow text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon
                  className={`mr-3 flex-shrink-0 h-5 w-5 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {item.name}
              </a>
            );
          })}
        </nav>
      </div>
      
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex items-center w-full">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user.role === 'genelsekreterlik' ? 'Genel Sekreterlik' :
               user.role === 'genelbaskan' ? 'Genel Başkan' : 'Moderatör'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="ml-2"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}