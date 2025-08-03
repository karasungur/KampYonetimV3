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
import { Plus, Edit, Trash2, Share2, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";

interface SocialMediaAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUrl: string;
  displayOrder: number;
  createdAt: string;
}

interface AccountFormData {
  platform: string;
  accountName: string;
  accountUrl: string;
}

export default function SocialMediaPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialMediaAccount | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    platform: "",
    accountName: "",
    accountUrl: "",
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

  const { data: accounts = [], isLoading } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social-media-accounts"],
    queryFn: async () => {
      const response = await fetch('/api/social-media-accounts', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch social media accounts');
      return response.json();
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (accountData: AccountFormData) => {
      const response = await fetch('/api/social-media-accounts', {
        method: 'POST',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });
      if (!response.ok) throw new Error('Failed to create account');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-media-accounts"] });
      toast({
        title: "Başarılı",
        description: "Sosyal medya hesabı eklendi",
      });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Sosyal medya hesabı eklenemedi",
        variant: "destructive",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, ...accountData }: AccountFormData & { id: string }) => {
      const response = await fetch(`/api/social-media-accounts/${id}`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });
      if (!response.ok) throw new Error('Failed to update account');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-media-accounts"] });
      toast({
        title: "Başarılı",
        description: "Sosyal medya hesabı güncellendi",
      });
      setShowModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Sosyal medya hesabı güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/social-media-accounts/${accountId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete account');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-media-accounts"] });
      toast({
        title: "Başarılı",
        description: "Sosyal medya hesabı silindi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Sosyal medya hesabı silinemedi",
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ accountId, direction }: { accountId: string; direction: 'up' | 'down' }) => {
      const response = await fetch(`/api/social-media-accounts/${accountId}/order`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/social-media-accounts"] });
    },
  });

  const resetForm = () => {
    setFormData({
      platform: "",
      accountName: "",
      accountUrl: "",
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: SocialMediaAccount) => {
    setEditingAccount(account);
    setFormData({
      platform: account.platform,
      accountName: account.accountName,
      accountUrl: account.accountUrl,
    });
    setShowModal(true);
  };

  const handleDelete = (accountId: string) => {
    if (confirm('Bu sosyal medya hesabını silmek istediğinizden emin misiniz?')) {
      deleteAccountMutation.mutate(accountId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingAccount) {
      updateAccountMutation.mutate({ ...formData, id: editingAccount.id });
    } else {
      createAccountMutation.mutate(formData);
    }
  };

  const sortedAccounts = accounts.sort((a, b) => a.displayOrder - b.displayOrder);

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
          title="Sosyal Medya Hesapları"
        />
        
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold ak-text">Sosyal Medya Hesapları</h1>
                <p className="ak-gray mt-2">
                  Ana menüde gösterilecek sosyal medya hesaplarını yönetin
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
                    Yeni Hesap
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingAccount ? 'Hesap Düzenle' : 'Yeni Hesap'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="platform">Platform</Label>
                      <Input
                        id="platform"
                        value={formData.platform}
                        onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                        placeholder="Örn: Twitter, Instagram, YouTube"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="accountName">Hesap Adı</Label>
                      <Input
                        id="accountName"
                        value={formData.accountName}
                        onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                        placeholder="Örn: @akgenclik"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="accountUrl">Hesap Bağlantısı</Label>
                      <Input
                        id="accountUrl"
                        type="url"
                        value={formData.accountUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, accountUrl: e.target.value }))}
                        placeholder="https://twitter.com/akgenclik"
                        required
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                        className="flex-1 bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                      >
                        {editingAccount ? 'Güncelle' : 'Ekle'}
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
              {sortedAccounts.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Share2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Henüz sosyal medya hesabı yok
                    </h3>
                    <p className="text-gray-600">
                      İlk hesabınızı eklemek için "Yeni Hesap" butonuna tıklayın.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedAccounts.map((account, index) => (
                  <Card key={account.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Share2 className="w-5 h-5 text-blue-600" />
                            <CardTitle className="text-lg ak-text">
                              {account.platform}
                            </CardTitle>
                            <Badge variant="outline">
                              #{account.displayOrder}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-2">
                            {account.accountName}
                          </p>
                          <a
                            href={account.accountUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            {account.accountUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateOrderMutation.mutate({ accountId: account.id, direction: 'up' })}
                              disabled={index === 0}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateOrderMutation.mutate({ accountId: account.id, direction: 'down' })}
                              disabled={index === sortedAccounts.length - 1}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(account.id)}
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