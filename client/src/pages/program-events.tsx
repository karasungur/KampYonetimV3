import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";

interface ProgramEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  createdAt: string;
}

interface EventFormData {
  title: string;
  description: string;
  eventDate: string;
  location: string;
}

export default function ProgramEventsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ProgramEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    eventDate: "",
    location: "",
  });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has permission to access this page
  if (user?.role !== 'genelsekreterlik') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  const { data: events = [], isLoading } = useQuery<ProgramEvent[]>({
    queryKey: ["/api/program-events"],
    queryFn: async () => {
      const response = await fetch('/api/program-events', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch program events');
      return response.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: EventFormData) => {
      const response = await fetch('/api/program-events', {
        method: 'POST',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error('Failed to create event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program-events"] });
      toast({
        title: "Başarılı",
        description: "Etkinlik oluşturuldu",
      });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Etkinlik oluşturulamadı",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...eventData }: EventFormData & { id: string }) => {
      const response = await fetch(`/api/program-events/${id}`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program-events"] });
      toast({
        title: "Başarılı",
        description: "Etkinlik güncellendi",
      });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Etkinlik güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/program-events/${eventId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete event');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program-events"] });
      toast({
        title: "Başarılı",
        description: "Etkinlik silindi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Etkinlik silinemedi",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      eventDate: "",
      location: "",
    });
    setEditingEvent(null);
  };

  const handleEdit = (event: ProgramEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      eventDate: event.eventDate.slice(0, 16), // Format for datetime-local input
      location: event.location || "",
    });
    setShowModal(true);
  };

  const handleDelete = (eventId: string) => {
    if (confirm('Bu etkinliği silmek istediğinizden emin misiniz?')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingEvent) {
      updateEventMutation.mutate({ ...formData, id: editingEvent.id });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const sortedEvents = events.sort((a, b) => 
    new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-ak-yellow">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="flex-1 lg:ml-64">
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          title="Program Etkinlikleri"
        />
        
        <main className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold ak-text">Program Etkinlikleri</h1>
                <p className="ak-gray mt-2">
                  Kamp program akışı için etkinlikleri yönetin
                </p>
              </div>
              
              <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowModal(true);
                    }}
                    className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Etkinlik
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvent ? 'Etkinlik Düzenle' : 'Yeni Etkinlik'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Etkinlik Başlığı</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Örn: Açılış Konuşması"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="eventDate">Tarih ve Saat</Label>
                      <Input
                        id="eventDate"
                        type="datetime-local"
                        value={formData.eventDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, eventDate: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="location">Konum (İsteğe bağlı)</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Örn: Ana Konferans Salonu"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Açıklama (İsteğe bağlı)</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Etkinlik hakkında ek bilgiler..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        disabled={createEventMutation.isPending || updateEventMutation.isPending}
                        className="flex-1 bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                      >
                        {editingEvent ? 'Güncelle' : 'Oluştur'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowModal(false);
                          resetForm();
                        }}
                      >
                        İptal
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {sortedEvents.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Henüz etkinlik yok
                    </h3>
                    <p className="text-gray-600">
                      İlk etkinliğinizi oluşturmak için "Yeni Etkinlik" butonuna tıklayın.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedEvents.map((event) => (
                  <Card key={event.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg ak-text mb-2">
                            {event.title}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {format(new Date(event.eventDate), "d MMMM yyyy, HH:mm", { locale: tr })}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {event.location}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(event)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(event.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {event.description && (
                      <CardContent className="pt-0">
                        <p className="text-gray-700 text-sm">
                          {event.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}