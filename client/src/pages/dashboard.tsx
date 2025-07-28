import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HelpCircle, MessageCircle, Clock } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";

interface DashboardStats {
  totalTables: number;
  totalQuestions: number;
  totalAnswers: number;
  pendingAnswers: number;
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-64">
        <Header title="Ana Panel" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-ak-yellow/10">
                    <Users className="text-ak-yellow text-xl" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium ak-gray">Toplam Masa</p>
                    <p className="text-2xl font-bold ak-text">{stats?.totalTables || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-ak-blue/10">
                    <HelpCircle className="text-ak-blue text-xl" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium ak-gray">Toplam Soru</p>
                    <p className="text-2xl font-bold ak-text">{stats?.totalQuestions || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-green-100">
                    <MessageCircle className="text-green-600 text-xl" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium ak-gray">Cevaplanan</p>
                    <p className="text-2xl font-bold ak-text">{stats?.totalAnswers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-red-100">
                    <Clock className="text-red-600 text-xl" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium ak-gray">Bekleyen</p>
                    <p className="text-2xl font-bold ak-text">{stats?.pendingAnswers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Son Aktiviteler</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm ak-text">Sistem yeni başlatıldı</p>
                      <p className="text-xs ak-gray">Şimdi</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Hoş Geldiniz</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold ak-text mb-2">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="ak-gray">
                    AK Parti Gençlik Kolları İstişare Kampı Yönetim Sistemine hoş geldiniz.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
