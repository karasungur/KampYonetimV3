import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleLabel = (role: string, tableNumber?: number) => {
    const roleLabels = {
      genelsekreterlik: 'Genel Sekreterlik',
      genelbaskan: 'Genel Başkan',
      moderator: tableNumber ? `Moderatör - Masa ${tableNumber}` : 'Moderatör'
    };
    return roleLabels[role as keyof typeof roleLabels] || role;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden -ml-2 p-2 ak-gray hover:ak-text hover:bg-gray-100"
              onClick={onMenuClick}
            >
              <Menu size={20} />
            </Button>
            <h1 className="ml-2 text-xl font-semibold ak-text">{title}</h1>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium ak-text">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs ak-gray">
                  {getRoleLabel(user.role, user.tableNumber)}
                </p>
              </div>
              <div className="w-8 h-8 bg-ak-yellow rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {getUserInitials(user.firstName, user.lastName)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
