import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Filter } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import type { AnswerWithDetails } from "@shared/schema";

export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("last7days");
  const [tableFilter, setTableFilter] = useState("all");
  const [questionFilter, setQuestionFilter] = useState("all");
  
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: answers = [], isLoading } = useQuery<AnswerWithDetails[]>({
    queryKey: ["/api/answers"],
    queryFn: async () => {
      const response = await fetch('/api/answers', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch answers');
      return response.json();
    },
    enabled: user?.role === 'genelbaskan' || user?.role === 'genelsekreterlik',
  });

  // Calculate stats
  const totalAnswers = answers.length;
  const uniqueTables = new Set(answers.map(a => a.tableNumber)).size;
  const responseRate = uniqueTables > 0 ? Math.round((totalAnswers / (uniqueTables * 10)) * 100) : 0; // Assuming 10 questions on average
  const avgResponseTime = 12; // Mock data for demo

  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/export/answers?format=xlsx', {
        headers: setAuthHeader(),
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cevaplar_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Başarılı",
        description: "Excel dosyası indirildi",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Excel dosyası indirilemedi",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/export/answers?format=csv', {
        headers: setAuthHeader(),
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cevaplar_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Başarılı",
        description: "CSV dosyası indirildi",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "CSV dosyası indirilemedi",
        variant: "destructive",
      });
    }
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
        <Header title="Raporlar ve Analizler" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Raporlar ve Analizler</h2>
            <div className="flex space-x-3">
              <Button 
                onClick={handleExportExcel}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <FileSpreadsheet className="mr-2" size={16} />
                Excel İndir
              </Button>
              <Button 
                onClick={handleExportCSV}
                className="bg-ak-blue hover:bg-ak-blue-dark text-white"
              >
                <FileText className="mr-2" size={16} />
                CSV İndir
              </Button>
            </div>
          </div>

          {/* Filter Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="ak-text">Filtreleme Seçenekleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium ak-gray mb-2">Tarih Aralığı</label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tarih seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last7days">Son 7 gün</SelectItem>
                      <SelectItem value="last30days">Son 30 gün</SelectItem>
                      <SelectItem value="custom">Özel aralık</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium ak-gray mb-2">Masa Seçimi</label>
                  <Select value={tableFilter} onValueChange={setTableFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Masa seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Masalar</SelectItem>
                      {/* Gerçek masalar buraya eklenecek - API'den çekilip listelenecek */}
                      {Array.from(new Set(answers.map(a => a.tableNumber))).sort((a, b) => a - b).map((tableNum) => (
                        <SelectItem key={tableNum} value={`table${tableNum}`}>
                          Masa {tableNum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium ak-gray mb-2">Soru Kategorisi</label>
                  <Select value={questionFilter} onValueChange={setQuestionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Sorular</SelectItem>
                      <SelectItem value="general">Genel Sorular</SelectItem>
                      <SelectItem value="specific">Özel Sorular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full bg-ak-yellow hover:bg-ak-yellow-dark text-white">
                    <Filter className="mr-2" size={16} />
                    Filtrele
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Cevap Verme Oranı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">{responseRate}%</div>
                  <p className="text-sm ak-gray">Masaların cevaplama oranı</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="ak-text">En Aktif Masa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold ak-yellow mb-2">
                    {uniqueTables > 0 ? Math.max(...Array.from(new Set(answers.map(a => a.tableNumber)))) : '-'}
                  </div>
                  <p className="text-sm ak-gray">
                    {totalAnswers > 0 ? `${Math.max(...Object.values(
                      answers.reduce((acc, a) => {
                        acc[a.tableNumber] = (acc[a.tableNumber] || 0) + 1;
                        return acc;
                      }, {} as Record<number, number>)
                    ))} cevap ile` : 'Henüz cevap yok'}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="ak-text">Ortalama Yanıt Süresi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold ak-blue mb-2">{avgResponseTime}</div>
                  <p className="text-sm ak-gray">dakika</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle className="ak-text">Detaylı Cevap Raporu</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center ak-gray">Yükleniyor...</div>
              ) : answers.length === 0 ? (
                <div className="p-6 text-center ak-gray">Henüz cevap bulunmuyor</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-ak-light-gray">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Masa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Soru
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Cevap
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Tarih
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {answers.slice(0, 10).map((answer) => (
                        <tr key={answer.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className="bg-ak-yellow/20 text-ak-yellow font-medium">
                              Masa {answer.tableNumber}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm ak-text max-w-xs truncate">
                              {answer.questionText}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm ak-gray max-w-md truncate">
                              {answer.text}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ak-gray">
                            {new Date(answer.createdAt).toLocaleString('tr-TR')}
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
