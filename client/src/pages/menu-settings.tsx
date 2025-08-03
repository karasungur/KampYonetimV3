import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";

interface MenuSettings {
  moderatorLoginEnabled: boolean;
  programFlowEnabled: boolean;
  photosEnabled: boolean;
  socialMediaEnabled: boolean;
  teamEnabled: boolean;
  moderatorLoginTitle: string;
  programFlowTitle: string;
  photosTitle: string;
  socialMediaTitle: string;
  teamTitle: string;
}

export default function MenuSettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState<MenuSettings>({
    moderatorLoginEnabled: true,
    programFlowEnabled: false,
    photosEnabled: false,
    socialMediaEnabled: false,
    teamEnabled: false,
    moderatorLoginTitle: "Moderatör Girişi",
    programFlowTitle: "Program Akışı",
    photosTitle: "Fotoğraflar",
    socialMediaTitle: "Sosyal Medya",
    teamTitle: "Ekibimiz",
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

  const { data: menuSettings, isLoading } = useQuery<MenuSettings>({
    queryKey: ["/api/menu-settings"],
    queryFn: async () => {
      const response = await fetch('/api/menu-settings', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch menu settings');
      const data = await response.json();
      setFormData(data);
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: MenuSettings) => {
      const response = await fetch('/api/menu-settings', {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to update menu settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-settings"] });
      toast({
        title: "Başarılı",
        description: "Menü ayarları güncellendi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Menü ayarları güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  const handleSwitchChange = (field: keyof MenuSettings, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTitleChange = (field: keyof MenuSettings, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
          title="Menü Ayarları"
        />
        
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold ak-text">Menü Ayarları</h1>
              <p className="ak-gray mt-2">
                Ana sayfa menü seçeneklerini ve başlıklarını yönetin
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Menü Yapılandırması
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Moderatör Girişi */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Switch 
                        checked={formData.moderatorLoginEnabled}
                        onCheckedChange={(checked) => handleSwitchChange('moderatorLoginEnabled', checked)}
                      />
                      <Label className="text-sm font-medium">Moderatör Girişi</Label>
                    </div>
                    <div>
                      <Label htmlFor="moderatorLoginTitle" className="text-sm text-gray-600">
                        Başlık
                      </Label>
                      <Input
                        id="moderatorLoginTitle"
                        value={formData.moderatorLoginTitle}
                        onChange={(e) => handleTitleChange('moderatorLoginTitle', e.target.value)}
                        className="mt-1"
                        disabled={!formData.moderatorLoginEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Program Akışı */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Switch 
                        checked={formData.programFlowEnabled}
                        onCheckedChange={(checked) => handleSwitchChange('programFlowEnabled', checked)}
                      />
                      <Label className="text-sm font-medium">Program Akışı</Label>
                    </div>
                    <div>
                      <Label htmlFor="programFlowTitle" className="text-sm text-gray-600">
                        Başlık
                      </Label>
                      <Input
                        id="programFlowTitle"
                        value={formData.programFlowTitle}
                        onChange={(e) => handleTitleChange('programFlowTitle', e.target.value)}
                        className="mt-1"
                        disabled={!formData.programFlowEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Fotoğraflar */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Switch 
                        checked={formData.photosEnabled}
                        onCheckedChange={(checked) => handleSwitchChange('photosEnabled', checked)}
                      />
                      <Label className="text-sm font-medium">Fotoğraflar</Label>
                    </div>
                    <div>
                      <Label htmlFor="photosTitle" className="text-sm text-gray-600">
                        Başlık
                      </Label>
                      <Input
                        id="photosTitle"
                        value={formData.photosTitle}
                        onChange={(e) => handleTitleChange('photosTitle', e.target.value)}
                        className="mt-1"
                        disabled={!formData.photosEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Sosyal Medya */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Switch 
                        checked={formData.socialMediaEnabled}
                        onCheckedChange={(checked) => handleSwitchChange('socialMediaEnabled', checked)}
                      />
                      <Label className="text-sm font-medium">Sosyal Medya</Label>
                    </div>
                    <div>
                      <Label htmlFor="socialMediaTitle" className="text-sm text-gray-600">
                        Başlık
                      </Label>
                      <Input
                        id="socialMediaTitle"
                        value={formData.socialMediaTitle}
                        onChange={(e) => handleTitleChange('socialMediaTitle', e.target.value)}
                        className="mt-1"
                        disabled={!formData.socialMediaEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Ekibimiz */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Switch 
                        checked={formData.teamEnabled}
                        onCheckedChange={(checked) => handleSwitchChange('teamEnabled', checked)}
                      />
                      <Label className="text-sm font-medium">Ekibimiz</Label>
                    </div>
                    <div>
                      <Label htmlFor="teamTitle" className="text-sm text-gray-600">
                        Başlık
                      </Label>
                      <Input
                        id="teamTitle"
                        value={formData.teamTitle}
                        onChange={(e) => handleTitleChange('teamTitle', e.target.value)}
                        className="mt-1"
                        disabled={!formData.teamEnabled}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                    className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateSettingsMutation.isPending ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}