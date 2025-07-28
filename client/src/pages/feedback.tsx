import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Reply, MessageCircle, Trash2 } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FeedbackWithDetails } from "@shared/schema";

export default function FeedbackPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [responseModal, setResponseModal] = useState<{ open: boolean; feedbackId?: string }>({ open: false });
  const [responseText, setResponseText] = useState("");
  
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
    enabled: user?.role === 'genelsekreterlik' || user?.role === 'moderator',
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

  const respondToFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackId, response }: { feedbackId: string; response: string }) => {
      const res = await fetch(`/api/feedback/${feedbackId}/respond`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response }),
      });
      if (!res.ok) throw new Error('Failed to respond to feedback');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "Başarılı",
        description: "Geri bildirime yanıt verildi",
      });
      setResponseModal({ open: false });
      setResponseText("");
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Yanıt gönderilemedi",
        variant: "destructive",
      });
    },
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete feedback');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "Başarılı",
        description: "Geri bildirim silindi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Geri bildirim silinemedi",
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

  if (user?.role !== 'genelsekreterlik' && user?.role !== 'moderator') {
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
                            {getUserInitials(feedback.userTableNumber ?? undefined)}
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
                    
                    {feedback.response && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <MessageCircle className="text-ak-blue mt-1" size={16} />
                          <div className="flex-1">
                            <p className="text-sm font-medium ak-text mb-1">
                              Yanıt {feedback.respondedByName ? `(${feedback.respondedByName})` : ''}
                            </p>
                            <p className="text-sm ak-gray">{feedback.response}</p>
                            {feedback.respondedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(feedback.respondedAt).toLocaleString('tr-TR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!feedback.isResolved && user?.role === 'genelsekreterlik' && (
                      <div className="flex space-x-3 mt-4">
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
                        {!feedback.response && (
                          <Button 
                            onClick={() => setResponseModal({ open: true, feedbackId: feedback.id })}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Reply className="mr-1" size={16} />
                            Yanıtla
                          </Button>
                        )}
                        <Button 
                          onClick={() => markAsResolvedMutation.mutate(feedback.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={markAsResolvedMutation.isPending}
                        >
                          <Check className="mr-1" size={16} />
                          Çözüldü İşaretle
                        </Button>
                        <Button 
                          onClick={() => {
                            if (window.confirm('Bu geri bildirimi silmek istediğinizden emin misiniz?')) {
                              deleteFeedbackMutation.mutate(feedback.id);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          disabled={deleteFeedbackMutation.isPending}
                        >
                          <Trash2 className="mr-1" size={16} />
                          Sil
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

      {/* Response Modal */}
      <Dialog open={responseModal.open} onOpenChange={(open) => setResponseModal({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Geri Bildirime Yanıt Ver</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="response">Yanıt Mesajı</Label>
              <Textarea
                id="response"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Geri bildirime yanıtınızı yazın..."
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResponseModal({ open: false });
                setResponseText("");
              }}
            >
              İptal
            </Button>
            <Button
              onClick={() => {
                if (responseModal.feedbackId && responseText.trim()) {
                  respondToFeedbackMutation.mutate({
                    feedbackId: responseModal.feedbackId,
                    response: responseText,
                  });
                }
              }}
              disabled={!responseText.trim() || respondToFeedbackMutation.isPending}
              className="bg-ak-blue hover:bg-ak-blue-dark text-white"
            >
              Yanıtla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
