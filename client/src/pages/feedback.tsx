import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Reply } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackWithDetails } from "@shared/schema";

export default function FeedbackPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feedbackItems = [], isLoading } = useQuery<FeedbackWithDetails[]>({
    queryKey: ["/api/feedback"],
    queryFn: async () => {
      const response = await fetch('/api/feedback', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch feedback');
      return response.json();
    },
    enabled: user?.role === 'genelsekreterlik',
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      const response = await fetch(`/api/feedback/${feedbackId}/read`, {
        method: 'PUT',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "Başarılı",
        description: "Geri bildirim okundu olarak işaretlendi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "İşlem gerçekleştirilemedi",
        variant: "destructive",
      });
    },
  });

  const markAsResolvedMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      const response = await fetch(`/api/feedback/${feedbackId}/resolve`, {
        method: 'PUT',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to mark as resolved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "Başarılı",
        description: "Geri bildirim çözüldü olarak işaretlendi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "İşlem gerçekleştirilemedi",
        variant: "destructive",
      });
    },
  });

  const filteredFeedback = feedbackItems.filter(item => {
    if (statusFilter === "all") return true;
    if (statusFilter === "unread") return !item.isRead;
    if (statusFilter === "read") return item.isRead && !item.isResolved;
    if (statusFilter === "resolved") return item.isResolved;
    return true;
  });

  const getStatusBadge = (feedback: FeedbackWithDetails) => {
    if (feedback.isResolved) {
      return <Badge className="bg-green-100 text-green-800">Çözüldü</Badge>;
    }
    if (feedback.isRead) {
      return <Badge className="bg-blue-100 text-blue-800">Okundu</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Okunmamış</Badge>;
  };

  const getUserInitials = (tableNumber?: number) => {
    return tableNumber ? `M${tableNumber}` : "U";
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
        <Header title="Geri Bildirimler" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Geri Bildirimler</h2>
            <div className="flex space-x-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Durum seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  <SelectItem value="unread">Okunmamış</SelectItem>
                  <SelectItem value="read">Okunmuş</SelectItem>
                  <SelectItem value="resolved">Çözüldü</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center ak-gray">Yükleniyor...</div>
              </CardContent>
            </Card>
          ) : filteredFeedback.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center ak-gray">
                  {statusFilter === "all" ? "Henüz geri bildirim bulunmuyor" : "Seçilen kriterlere uygun geri bildirim bulunamadı"}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {filteredFeedback.map((feedback) => (
                <Card key={feedback.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-ak-blue rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {getUserInitials(feedback.userTableNumber)}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold ak-text">
                            {feedback.userTableNumber ? `Masa ${feedback.userTableNumber}` : 'Bilinmeyen Masa'} - {feedback.userName}
                          </h4>
                          <p className="text-sm ak-gray">
                            {new Date(feedback.createdAt).toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(feedback)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h5 className="font-medium ak-text mb-2">
                      Soru: "{feedback.questionText}"
                    </h5>
                    <p className="ak-gray mb-4">"{feedback.message}"</p>
                    
                    {!feedback.isResolved && (
                      <div className="flex space-x-3">
                        {!feedback.isRead && (
                          <Button 
                            onClick={() => markAsReadMutation.mutate(feedback.id)}
                            className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                            disabled={markAsReadMutation.isPending}
                          >
                            <Check className="mr-1" size={16} />
                            Okundu İşaretle
                          </Button>
                        )}
                        <Button 
                          onClick={() => markAsResolvedMutation.mutate(feedback.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={markAsResolvedMutation.isPending}
                        >
                          <Reply className="mr-1" size={16} />
                          Çözüldü İşaretle
                        </Button>
                      </div>
                    )}

                    {feedback.isResolved && (
                      <div className="bg-ak-light-gray p-3 rounded-lg">
                        <p className="text-sm ak-gray">
                          <strong>Durum:</strong> Bu geri bildirim çözüldü olarak işaretlenmiştir.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
