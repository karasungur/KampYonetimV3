import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { setAuthHeader } from "@/lib/auth-utils";
import type { ActivityLog } from "@shared/schema";

export default function LogsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  
  const { user } = useAuth();

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs"],
    queryFn: async () => {
      const response = await fetch('/api/logs?limit=100', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'adminpro',
  });

  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesDate = !dateFilter || 
      new Date(log.createdAt).toDateString() === new Date(dateFilter).toDateString();
    return matchesAction && matchesDate;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'login':
      case 'logout':
        return <Badge className="bg-gray-100 text-gray-800">Giriş/Çıkış</Badge>;
      case 'create_question':
      case 'edit_question':
      case 'delete_question':
        return <Badge className="bg-ak-blue/20 text-ak-blue">Soru İşlemi</Badge>;
      case 'create_answer':
      case 'edit_answer':
      case 'delete_answer':
        return <Badge className="bg-green-100 text-green-800">Cevap İşlemi</Badge>;
      case 'create_user':
      case 'edit_user':
      case 'delete_user':
        return <Badge className="bg-ak-yellow/20 text-ak-yellow">Kullanıcı İşlemi</Badge>;
      case 'send_feedback':
        return <Badge className="bg-purple-100 text-purple-800">Geri Bildirim</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{action}</Badge>;
    }
  };

  const getUserDisplay = (log: ActivityLog) => {
    // In a real app, you'd join with user data or include it in the log
    return log.userId.substring(0, 8) + "...";
  };

  if (user?.role === 'moderator') {
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
        <Header title="Sistem Logları" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Sistem Logları</h2>
            <div className="flex space-x-3">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="İşlem türü seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm İşlemler</SelectItem>
                  <SelectItem value="login">Giriş</SelectItem>
                  <SelectItem value="logout">Çıkış</SelectItem>
                  <SelectItem value="create_question">Soru Oluşturma</SelectItem>
                  <SelectItem value="create_answer">Cevap Ekleme</SelectItem>
                  <SelectItem value="create_user">Kullanıcı Oluşturma</SelectItem>
                  <SelectItem value="send_feedback">Geri Bildirim</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center ak-gray">Yükleniyor...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-6 text-center ak-gray">
                  {actionFilter === "all" && !dateFilter 
                    ? "Henüz log kaydı bulunmuyor" 
                    : "Seçilen kriterlere uygun log bulunamadı"
                  }
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-ak-light-gray">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Zaman
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Kullanıcı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          İşlem
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Detay
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          IP Adresi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ak-gray">
                            {new Date(log.createdAt).toLocaleString('tr-TR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-6 h-6 bg-ak-blue rounded-full flex items-center justify-center mr-2">
                                <span className="text-white text-xs">U</span>
                              </div>
                              <span className="text-sm ak-text">{getUserDisplay(log)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getActionBadge(log.action)}
                          </td>
                          <td className="px-6 py-4 text-sm ak-gray max-w-md truncate">
                            {log.details || 'Detay bulunmuyor'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ak-gray">
                            {log.ipAddress || 'Bilinmiyor'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
