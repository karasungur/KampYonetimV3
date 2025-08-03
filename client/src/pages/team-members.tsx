import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Users, Phone, Mail, ArrowUp, ArrowDown } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  phoneNumber: string | null;
  email: string | null;
  displayOrder: number;
  createdAt: string;
}

interface MemberFormData {
  firstName: string;
  lastName: string;
  position: string;
  phoneNumber: string;
  email: string;
}

export default function TeamMembersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState<MemberFormData>({
    firstName: "",
    lastName: "",
    position: "",
    phoneNumber: "",
    email: "",
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

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await fetch('/api/team-members', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json();
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async (memberData: MemberFormData) => {
      const response = await fetch('/api/team-members', {
        method: 'POST',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      });
      if (!response.ok) throw new Error('Failed to create member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({
        title: "Başarılı",
        description: "Ekip üyesi eklendi",
      });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Ekip üyesi eklenemedi",
        variant: "destructive",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, ...memberData }: MemberFormData & { id: string }) => {
      const response = await fetch(`/api/team-members/${id}`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      });
      if (!response.ok) throw new Error('Failed to update member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({
        title: "Başarılı",
        description: "Ekip üyesi güncellendi",
      });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Ekip üyesi güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/team-members/${memberId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete member');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({
        title: "Başarılı",
        description: "Ekip üyesi silindi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Ekip üyesi silinemedi",
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ memberId, direction }: { memberId: string; direction: 'up' | 'down' }) => {
      const response = await fetch(`/api/team-members/${memberId}/order`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction }),
      });
      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      position: "",
      phoneNumber: "",
      email: "",
    });
    setEditingMember(null);
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      position: member.position,
      phoneNumber: member.phoneNumber || "",
      email: member.email || "",
    });
    setShowModal(true);
  };

  const handleDelete = (memberId: string) => {
    if (confirm('Bu ekip üyesini silmek istediğinizden emin misiniz?')) {
      deleteMemberMutation.mutate(memberId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingMember) {
      updateMemberMutation.mutate({ ...formData, id: editingMember.id });
    } else {
      createMemberMutation.mutate(formData);
    }
  };

  const sortedMembers = members.sort((a, b) => a.displayOrder - b.displayOrder);

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
          title="Ekip Üyeleri"
        />
        
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold ak-text">Ekip Üyeleri</h1>
                <p className="ak-gray mt-2">
                  Ana menüde gösterilecek ekip üyelerini yönetin
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
                    Yeni Üye
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingMember ? 'Üye Düzenle' : 'Yeni Üye'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Ad</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="Adı"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Soyad</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Soyadı"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="position">Görev</Label>
                      <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                        placeholder="Örn: Genel Koordinatör"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phoneNumber">Telefon (İsteğe bağlı)</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="05XX XXX XX XX"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">E-posta (İsteğe bağlı)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        disabled={createMemberMutation.isPending || updateMemberMutation.isPending}
                        className="flex-1 bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                      >
                        {editingMember ? 'Güncelle' : 'Ekle'}
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

            <div className="space-y-4">
              {sortedMembers.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Henüz ekip üyesi yok
                    </h3>
                    <p className="text-gray-600">
                      İlk ekip üyesini eklemek için "Yeni Üye" butonuna tıklayın.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedMembers.map((member, index) => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <CardTitle className="text-lg ak-text">
                              {member.firstName} {member.lastName}
                            </CardTitle>
                            <Badge variant="outline">
                              #{member.displayOrder}
                            </Badge>
                          </div>
                          <p className="text-blue-600 font-medium mb-3">
                            {member.position}
                          </p>
                          <div className="flex gap-4">
                            {member.phoneNumber && (
                              <a
                                href={`tel:${member.phoneNumber}`}
                                className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                              >
                                <Phone className="w-4 h-4" />
                                {member.phoneNumber}
                              </a>
                            )}
                            {member.email && (
                              <a
                                href={`mailto:${member.email}`}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                <Mail className="w-4 h-4" />
                                {member.email}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateOrderMutation.mutate({ memberId: member.id, direction: 'up' })}
                              disabled={index === 0}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateOrderMutation.mutate({ memberId: member.id, direction: 'down' })}
                              disabled={index === sortedMembers.length - 1}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(member)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(member.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
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