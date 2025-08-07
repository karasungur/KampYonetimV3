import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuthHeader } from "@/lib/auth-utils";
import { 
  Download, 
  Search,
  Info,
  Camera,
  AlertTriangle
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";

interface FaceModel {
  id: string;
  name: string;
  status: 'created' | 'downloading' | 'extracting' | 'ready' | 'error';
  createdAt: string;
}

export default function PhotosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [tcNumber, setTcNumber] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // Fetch available face models
  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['/api/face-models'],
    queryFn: async () => {
      const response = await fetch('/api/face-models', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch face models');
      const data = await response.json();
      return data.filter((model: FaceModel) => model.status === 'ready');
    },
  });

  // Create photo request (minimal)
  const photoRequestMutation = useMutation({
    mutationFn: async (data: { tcNumber: string; selectedCampDays: string[] }) => {
      return apiRequest('/api/photo-requests', {
        method: 'POST',
        body: JSON.stringify({
          tcNumber: data.tcNumber,
          faceData: [], // Empty for demo
          selectedCampDays: data.selectedCampDays,
          uploadedFilesCount: 0
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "✅ İstek Oluşturuldu",
        description: "Şimdi ZIP dosyanızı indirebilirsiniz",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Hata",
        description: error.message || "İstek oluşturulamadı",
        variant: "destructive",
      });
    },
  });

  // Download ZIP
  const downloadMutation = useMutation({
    mutationFn: async (tcNumber: string) => {
      const response = await fetch(`/api/download-results/${tcNumber}`, {
        method: 'GET',
        headers: setAuthHeader(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'İndirme başarısız');
      }
      
      return response.blob();
    },
    onSuccess: (blob, tcNumber) => {
      // ZIP dosyasını indir
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${tcNumber}_face_matching_results.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "✅ İndirme Başarılı",
        description: "ZIP dosyası indirildi",
      });
    },
    onError: (error: any) => {
      let userMessage = "İndirme başarısız";
      
      if (error.message?.includes('embedding')) {
        userMessage = "⚠️ Demo ZIP indiriliyor - gerçek eşleştirme için fotoğraf yükleme gerekli";
      } else if (error.message?.includes('session')) {
        userMessage = "⚠️ Önce istek oluşturun";
      } else if (error.message) {
        userMessage = error.message;
      }

      toast({
        title: "Bilgi",
        description: userMessage,
        variant: error.message?.includes('embedding') ? "default" : "destructive",
      });
    },
  });

  const handleModelSelection = (modelId: string, checked: boolean) => {
    if (checked) {
      setSelectedModelIds(prev => [...prev, modelId]);
    } else {
      setSelectedModelIds(prev => prev.filter(id => id !== modelId));
    }
  };

  const handleCreateRequest = async () => {
    if (!tcNumber.trim()) {
      toast({
        title: "Hata",
        description: "TC numarası gerekli",
        variant: "destructive",
      });
      return;
    }

    if (selectedModelIds.length === 0) {
      toast({
        title: "Hata", 
        description: "En az bir model seçmelisiniz",
        variant: "destructive",
      });
      return;
    }

    await photoRequestMutation.mutateAsync({
      tcNumber: tcNumber.trim(),
      selectedCampDays: selectedModelIds
    });
  };

  const handleDirectDownload = () => {
    if (!tcNumber.trim()) {
      toast({
        title: "Hata",
        description: "TC numarası gerekli",
        variant: "destructive",
      });
      return;
    }

    downloadMutation.mutate(tcNumber.trim());
  };

  const isLoading = photoRequestMutation.isPending || downloadMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Camera className="w-8 h-8 text-orange-500" />
            <h1 className="text-3xl font-bold">Yüz Tanıma Sistemi</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Buffalo-S Lite AI ile gelişmiş yüz eşleştirme sistemi. 
            Gerçek neural network algoritması kullanır, hash-based fallback yoktur.
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>Demo Modu:</strong> Bu sistem şu anda demo amaçlıdır. 
            Gerçek yüz eşleştirmesi için fotoğraf yükleme ve Buffalo-S Lite işlemcisi gereklidir.
          </AlertDescription>
        </Alert>

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Yüz Eşleştirme İsteği</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* TC Number Input */}
            <div className="space-y-2">
              <Label htmlFor="tc">TC Kimlik Numarası</Label>
              <Input
                id="tc"
                placeholder="11 haneli TC numaranızı girin"
                value={tcNumber}
                onChange={(e) => setTcNumber(e.target.value)}
                maxLength={11}
                disabled={isLoading}
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Eşleştirme Yapılacak Modeller</Label>
              
              {modelsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Modeller yükleniyor...</p>
                </div>
              ) : models.length === 0 ? (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Henüz hazır model bulunmuyor. Lütfen yöneticiye başvurun.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {models.map((model: FaceModel) => (
                    <div key={model.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={model.id}
                        checked={selectedModelIds.includes(model.id)}
                        onCheckedChange={(checked) => handleModelSelection(model.id, checked as boolean)}
                        disabled={isLoading}
                      />
                      <Label htmlFor={model.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{model.name}</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            Hazır
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Oluşturulma: {new Date(model.createdAt).toLocaleDateString('tr-TR')}
                        </p>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleCreateRequest}
                disabled={isLoading || !tcNumber.trim() || selectedModelIds.length === 0}
                className="flex-1"
                variant="outline"
              >
                {photoRequestMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    İstek Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    1. İstek Oluştur
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleDirectDownload}
                disabled={isLoading || !tcNumber.trim()}
                className="flex-1"
              >
                {downloadMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    İndiriliyor...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    2. ZIP İndir
                  </>
                )}
              </Button>
            </div>

            {/* Instructions */}
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Kullanım:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>TC numaranızı girin</li>
                  <li>Eşleştirme yapılacak model(ler)i seçin</li>  
                  <li>"İstek Oluştur" ile işlemi başlatın</li>
                  <li>"ZIP İndir" ile sonuçları alın</li>
                </ol>
                <p className="mt-2 text-sm">
                  <strong>Not:</strong> Gerçek yüz eşleştirmesi için fotoğraf yükleme özelliği geliştirilme aşamasındadır.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}