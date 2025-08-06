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
import { useQuery } from "@tanstack/react-query";
import { setAuthHeader } from "@/lib/auth-utils";
import { 
  AlertCircle,
  User,
  Database,
  Camera
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import PhotoMatchingFlow from "@/components/PhotoMatchingFlow";

interface FaceModel {
  id: string;
  name: string;
  status: 'created' | 'downloading' | 'extracting' | 'ready' | 'error' | 'pending';
  createdAt: string;
  progress?: number;
}

export default function PhotosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showFlow, setShowFlow] = useState(false);
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
      // Sadece hazır modelleri göster
      return data.filter((model: FaceModel) => model.status === 'ready');
    },
  });

  const handleModelSelection = (modelId: string, checked: boolean) => {
    if (checked) {
      setSelectedModelIds([...selectedModelIds, modelId]);
    } else {
      setSelectedModelIds(selectedModelIds.filter(id => id !== modelId));
    }
  };

  const handleStartMatching = () => {
    // TC kimlik kontrolü
    if (!tcNumber || tcNumber.trim().length !== 11) {
      toast({
        title: "Hata",
        description: "Geçerli bir TC kimlik numarası giriniz",
        variant: "destructive",
      });
      return;
    }

    // Model seçimi kontrolü
    if (selectedModelIds.length === 0) {
      toast({
        title: "Hata", 
        description: "En az bir model seçmelisiniz",
        variant: "destructive",
      });
      return;
    }

    // PhotoMatchingFlow'u göster
    setShowFlow(true);
  };

  const handleReset = () => {
    setShowFlow(false);
    setTcNumber('');
    setSelectedModelIds([]);
  };

  // PhotoMatchingFlow gösteriliyorsa
  if (showFlow) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Fotoğraf Eşleştirme</h1>
              <p className="text-muted-foreground">
                TC: {tcNumber} | Model: {models.find(m => m.id === selectedModelIds[0])?.name}
              </p>
            </div>
            <Button variant="outline" onClick={handleReset}>
              İptal Et
            </Button>
          </div>
          
          <PhotoMatchingFlow
            tcNumber={tcNumber}
            selectedModelIds={selectedModelIds}
            onReset={handleReset}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Normal görünüm
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fotoğraf Eşleştirme Sistemi</h1>
            <p className="text-muted-foreground">
              8 adımlı akış: TC girişi → Fotoğraf yükleme → Yüz tespiti → Yüz seçimi → Model seçimi → İşleme → ZIP indirme
            </p>
          </div>
        </div>

        {/* İşlem Akışı Özeti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              İşlem Akışı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ak-yellow text-white flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <p className="font-medium">TC Kimlik</p>
                  <p className="text-sm text-muted-foreground">TC kimlik numaranızı girin</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ak-yellow text-white flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Model Seçimi</p>
                  <p className="text-sm text-muted-foreground">Kamp gününü seçin</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ak-yellow text-white flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Fotoğraf Yükleme</p>
                  <p className="text-sm text-muted-foreground">Referans fotoğraflarınızı yükleyin</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ak-yellow text-white flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Sonuç İndirme</p>
                  <p className="text-sm text-muted-foreground">Eşleşen fotoğrafları ZIP olarak indirin</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TC Kimlik Girişi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Kullanıcı Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tcNumber">TC Kimlik Numarası</Label>
              <Input
                id="tcNumber"
                type="text"
                placeholder="11 haneli TC kimlik numaranızı girin"
                value={tcNumber}
                onChange={(e) => setTcNumber(e.target.value.replace(/\D/g, ''))}
                maxLength={11}
              />
              <p className="text-sm text-muted-foreground">
                TC kimlik numaranız sonuçların kaydedilmesi için kullanılacaktır
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Model Seçimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Model Seçimi
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Fotoğraflarınızın aranacağı kamp günü modelini seçin
            </p>
          </CardHeader>
          <CardContent>
            {modelsLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse">Modeller yükleniyor...</div>
              </div>
            ) : models.length === 0 ? (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Henüz hazır model bulunmuyor. Yönetici panelinden model eklenmesi gerekmektedir.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {models.map((model: FaceModel) => (
                  <div key={model.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={model.id}
                      checked={selectedModelIds.includes(model.id)}
                      onCheckedChange={(checked) => handleModelSelection(model.id, checked as boolean)}
                    />
                    <Label htmlFor={model.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-lg">{model.name}</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            Oluşturulma: {new Date(model.createdAt).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          ✓ Hazır
                        </Badge>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {/* Başlat Butonu */}
            <div className="mt-6">
              <Button 
                onClick={handleStartMatching} 
                disabled={!tcNumber || tcNumber.length !== 11 || selectedModelIds.length === 0}
                className="w-full"
                size="lg"
              >
                <Camera className="w-4 h-4 mr-2" />
                Fotoğraf Eşleştirmeyi Başlat
              </Button>
              
              {(!tcNumber || tcNumber.length !== 11) && (
                <p className="text-sm text-red-500 mt-2 text-center">
                  * Lütfen 11 haneli TC kimlik numaranızı girin
                </p>
              )}
              
              {tcNumber && tcNumber.length === 11 && selectedModelIds.length === 0 && (
                <p className="text-sm text-red-500 mt-2 text-center">
                  * Lütfen en az bir model seçin
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bilgilendirme */}
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <strong>Önemli:</strong> Fotoğraf eşleştirme işlemi InsightFace Buffalo_L modeli kullanılarak yapılmaktadır. 
            Yüklediğiniz fotoğraflardaki yüzler otomatik olarak tespit edilecek ve seçtiğiniz modeldeki 
            fotoğraflarla karşılaştırılacaktır. İşlem sonunda eşleşen fotoğraflar ZIP dosyası olarak indirilecektir.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}