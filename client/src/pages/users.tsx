import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, UserX, Download, Upload } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import UserModal from "@/components/modals/user-modal";
import EditUserModal from "@/components/modals/edit-user-modal";
import type { UserWithStats } from "@shared/schema";

export default function UsersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<UserWithStats[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: user?.role === 'genelsekreterlik',
  });

  const filteredUsers = users.filter(userItem => {
    const fullName = `${userItem.firstName} ${userItem.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                         userItem.tcNumber.includes(searchTerm);
    const matchesFilter = filterRole === "all" || userItem.role === filterRole;
    return matchesSearch && matchesFilter;
  });

  const getRoleBadgeProps = (role: string) => {
    switch (role) {
      case 'genelsekreterlik':
        return { className: 'bg-red-100 text-red-800', label: 'Genel Sekreterlik' };
      case 'genelbaskan':
        return { className: 'bg-ak-yellow/20 text-ak-yellow', label: 'Genel Başkan' };
      case 'moderator':
        return { className: 'bg-ak-blue/20 text-ak-blue', label: 'Moderatör' };
      default:
        return { className: 'bg-gray-100 text-gray-800', label: role };
    }
  };

  const getStatusBadge = (isActive: boolean, lastLogin?: string | Date | null) => {
    if (!isActive) {
      return <Badge className="bg-red-100 text-red-800">Pasif</Badge>;
    }
    
    if (lastLogin) {
      const lastLoginDate = typeof lastLogin === 'string' ? new Date(lastLogin) : lastLogin;
      const now = new Date();
      const diffMinutes = (now.getTime() - lastLoginDate.getTime()) / (1000 * 60);
      
      if (diffMinutes < 30) {
        return <Badge className="bg-green-100 text-green-800">Aktif</Badge>;
      }
    }
    
    return <Badge className="bg-yellow-100 text-yellow-800">Beklemede</Badge>;
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (user?.role !== 'genelsekreterlik') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="ak-text">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-64">
        <Header title="Kullanıcı Yönetimi" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Kullanıcı Yönetimi</h2>
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        const response = await fetch('/api/users/import', {
                          method: 'POST',
                          headers: setAuthHeader(),
                          body: formData,
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.message || 'Import failed');
                        }
                        
                        const result = await response.json();
                        
                        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
                        
                        toast({
                          title: "Başarılı",
                          description: `${result.imported} kullanıcı başarıyla içe aktarıldı${result.tablesCreated > 0 ? `, ${result.tablesCreated} masa oluşturuldu` : ''}`,
                        });
                      } catch (error) {
                        toast({
                          title: "Hata",
                          description: error instanceof Error ? error.message : "JSON dosyası içe aktarılamadı",
                          variant: "destructive",
                        });
                      }
                    }
                  };
                  input.click();
                }}
                variant="outline"
                className="text-green-600 hover:text-green-700"
              >
                <Upload className="mr-2" size={16} />
                JSON İçe Aktar
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/export/users?format=csv', {
                      headers: setAuthHeader(),
                    });
                    
                    if (!response.ok) throw new Error('Export failed');
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kullanicilar_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    toast({
                      title: "Başarılı",
                      description: "Kullanıcı listesi CSV olarak indirildi",
                    });
                  } catch (error) {
                    toast({
                      title: "Hata",
                      description: "CSV dosyası indirilemedi",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                className="text-ak-blue hover:text-ak-blue-dark"
              >
                <Download className="mr-2" size={16} />
                CSV İndir
              </Button>
              <Button 
                onClick={() => setShowModal(true)} 
                className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
              >
                <Plus className="mr-2" size={16} />
                Yeni Kullanıcı Ekle
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Kullanıcı Rolleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm ak-text">Genel Sekreterlik</span>
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                      {users.filter(u => u.role === 'genelsekreterlik').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm ak-text">Genel Başkan</span>
                    <span className="px-2 py-1 bg-ak-yellow/20 text-ak-yellow text-xs rounded-full">
                      {users.filter(u => u.role === 'genelbaskan').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm ak-text">Moderatör</span>
                    <span className="px-2 py-1 bg-ak-blue/20 text-ak-blue text-xs rounded-full">
                      {users.filter(u => u.role === 'moderator').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Aktif Kullanıcılar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {users.filter(u => u.isActive).length}
                  </div>
                  <p className="text-sm ak-gray">Kayıtlı kullanıcı</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Toplam Cevap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold ak-blue mb-2">
                    {users.reduce((sum, u) => sum + (u.answersCount || 0), 0)}
                  </div>
                  <p className="text-sm ak-gray">Tüm kullanıcılar</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex space-x-4">
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Rol seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Roller</SelectItem>
                      <SelectItem value="genelsekreterlik">Genel Sekreterlik</SelectItem>
                      <SelectItem value="genelbaskan">Genel Başkan</SelectItem>
                      <SelectItem value="moderator">Moderatör</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Kullanıcı ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center ak-gray">Yükleniyor...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center ak-gray">Kullanıcı bulunamadı</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-ak-light-gray">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Kullanıcı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          T.C. Kimlik No
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Rol
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Masa No
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Son Giriş
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Durum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          İşlemler
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.map((userItem) => {
                        const roleBadge = getRoleBadgeProps(userItem.role);
                        return (
                          <tr key={userItem.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-ak-yellow rounded-full flex items-center justify-center mr-3">
                                  <span className="text-white text-xs font-semibold">
                                    {getUserInitials(userItem.firstName, userItem.lastName)}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium ak-text">
                                    {userItem.firstName} {userItem.lastName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm ak-gray">
                              {userItem.tcNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={roleBadge.className}>
                                {roleBadge.label}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm ak-text font-medium">
                              {userItem.tableNumber ? `Masa ${userItem.tableNumber}` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm ak-gray">
                              {userItem.lastLogin 
                                ? new Date(userItem.lastLogin).toLocaleString('tr-TR')
                                : 'Hiç giriş yapmadı'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(userItem.isActive, userItem.lastLogin)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-ak-blue hover:text-ak-blue-dark"
                                onClick={() => {
                                  setSelectedUser(userItem);
                                  setShowEditModal(true);
                                }}
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                              >
                                <UserX size={16} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <UserModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
      
      <EditUserModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
}
