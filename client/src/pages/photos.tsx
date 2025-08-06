import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuthHeader } from "@/lib/auth-utils";
import { 
  Upload, 
  Clock, 
  AlertCircle,
  Search,
  Download,
  CheckCircle,
  FileImage,
  User
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";

interface FaceModel {
  id: string;
  name: string;
  status: 'created' | 'downloading' | 'extracting' | 'ready' | 'error';
  createdAt: string;
}

interface MatchingSession {
  sessionId: string;
  status: 'face_detection' | 'face_selection' | 'queued' | 'matching' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  queuePosition?: number;
  results?: MatchingResult[];
  timeoutAt: string;
  errorMessage?: string;
}

interface MatchingResult {
  modelId: string;
  modelName: string;
  totalMatches: number;
  isZipReady: boolean;
  canDownload: boolean;
}

export default function PhotosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'setup' | 'upload' | 'processing' | 'results'>('setup');
  const [tcNumber, setTcNumber] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<MatchingSession | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  // Start photo matching session
  const startSessionMutation = useMutation({
    mutationFn: async (data: { tcNumber: string; selectedModelIds: string[] }) => {
      return apiRequest('/api/photo-matching/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setCurrentSession({
        sessionId: data.sessionId,
        status: data.status,
        progress: 0,
        currentStep: 'face_detection',
        timeoutAt: data.timeoutAt,
      });
      setStep('upload');
    },
    onError: (error: any) => {
      toast({
        title: "Hata",
        description: error.message || "Oturum başlatılamadı",
        variant: "destructive",
      });
    },
  });

  // Check session status
  const { data: sessionStatus } = useQuery({
    queryKey: ['/api/photo-matching', currentSession?.sessionId, 'status'],
    queryFn: async () => {
      if (!currentSession?.sessionId) return null;
      const response = await fetch(`/api/photo-matching/${currentSession.sessionId}/status`, {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch session status');
      return response.json();
    },
    enabled: !!currentSession?.sessionId,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Update session state when status changes
  useEffect(() => {
    if (sessionStatus) {
      setCurrentSession(sessionStatus);
      if (sessionStatus.status === 'completed') {
        setStep('results');
      } else if (sessionStatus.status === 'error') {
        toast({
          title: "İşlem Hatası",
          description: sessionStatus.errorMessage || "Bilinmeyen hata oluştu",
          variant: "destructive",
        });
      }
    }
  }, [sessionStatus, toast]);

  // Download results
  const downloadMutation = useMutation({
    mutationFn: async (data: { sessionId: string; modelId: string }) => {
      return apiRequest(`/api/photo-matching/${data.sessionId}/${data.modelId}/download`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "İndirme Başladı",
        description: "Dosyalar indiriliyor...",
      });
      // Open download URL
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "İndirme Hatası",
        description: error.message || "İndirme başlatılamadı",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleModelSelection = (modelId: string, checked: boolean) => {
    if (checked) {
      setSelectedModelIds(prev => [...prev, modelId]);
    } else {
      setSelectedModelIds(prev => prev.filter(id => id !== modelId));
    }
  };

  const handleStartMatching = () => {
    if (!tcNumber.trim()) {
      toast({
        title: "Hata",
        description: "TC numarası gereklidir",
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

    startSessionMutation.mutate({
      tcNumber: tcNumber.trim(),
      selectedModelIds,
    });
  };

  const resetProcess = () => {
    setStep('setup');
    setTcNumber('');
    setSelectedModelIds([]);
    setCurrentSession(null);
    setSelectedFile(null);
  };

  const getProgressPhase = () => {
    if (!currentSession) return '';
    
    switch (currentSession.currentStep) {
      case 'face_detection':
        return 'Yüz Tespiti';
      case 'face_selection':
        return 'Yüz Seçimi';
      case 'queued':
        return 'Kuyrukta Bekliyor';
      case 'matching':
        return 'Modelde Arama';
      default:
        return currentSession.currentStep;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'face_detection':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Yüz Tespiti</Badge>;
      case 'face_selection':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Yüz Seçimi</Badge>;
      case 'queued':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700">Kuyrukta</Badge>;
      case 'matching':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Eşleştiriliyor</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-700">Tamamlandı</Badge>;
      case 'error':
        return <Badge variant="destructive">Hata</Badge>;
      default:
        return <Badge variant="secondary">Bilinmeyen</Badge>;
    }
  };



  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fotoğraf Eşleştirme Sistemi</h1>
            <p className="text-muted-foreground">
              InsightFace Buffalo model ile yüz tanıma ve fotoğraf eşleştirme
            </p>
          </div>
          
          {step !== 'setup' && (
            <Button variant="outline" onClick={resetProcess}>
              Yeni İşlem Başlat
            </Button>
          )}
        </div>

        {/* Setup Step - TC Number and Model Selection */}
        {step === 'setup' && (
          <div className="space-y-6">
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
                    placeholder="TC Kimlik numaranızı girin"
                    value={tcNumber}
                    onChange={(e) => setTcNumber(e.target.value)}
                    maxLength={11}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Seçimi</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Eşleştirme yapmak istediğiniz modelleri seçin
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
                      Henüz hazır model bulunmuyor. Yönetici panelinden model eklenmelidir.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {models.map((model: FaceModel) => (
                      <div key={model.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          id={model.id}
                          checked={selectedModelIds.includes(model.id)}
                          onCheckedChange={(checked) => handleModelSelection(model.id, checked as boolean)}
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

                <Button 
                  onClick={handleStartMatching} 
                  disabled={startSessionMutation.isPending || tcNumber.trim() === '' || selectedModelIds.length === 0}
                  className="w-full mt-6"
                >
                  {startSessionMutation.isPending ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Başlatılıyor...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Eşleştirmeyi Başlat
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Processing Step */}
        {(step === 'upload' || step === 'processing') && currentSession && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>İşlem Durumu</span>
                  {getStatusBadge(currentSession.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Aşama: {getProgressPhase()}</span>
                    <span>{currentSession.progress}%</span>
                  </div>
                  <Progress value={currentSession.progress} className="w-full" />
                </div>

                {currentSession.queuePosition && (
                  <Alert>
                    <Clock className="w-4 h-4" />
                    <AlertDescription>
                      Kuyrukta {currentSession.queuePosition}. sıradasınız. Lütfen bekleyiniz.
                    </AlertDescription>
                  </Alert>
                )}

                {currentSession.status === 'face_detection' && (
                  <Alert>
                    <FileImage className="w-4 h-4" />
                    <AlertDescription>
                      Yüzler tespit ediliyor... Bu işlem birkaç saniye sürebilir.
                    </AlertDescription>
                  </Alert>
                )}

                {currentSession.status === 'matching' && (
                  <Alert>
                    <Search className="w-4 h-4" />
                    <AlertDescription>
                      Modellerde arama yapılıyor... Bu işlem birkaç dakika sürebilir.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Step */}
        {step === 'results' && currentSession?.results && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Eşleştirme Sonuçları
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertDescription>
                    İşlem tamamlandı! Aşağıdan sonuçlarınızı indirebilirsiniz.
                    İndirme linkleri 3 saat boyunca geçerlidir.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {currentSession.results.map((result) => (
                    <Card key={result.modelId} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{result.modelName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {result.totalMatches} eşleşme bulundu
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.isZipReady ? (
                              <Badge variant="default" className="bg-green-100 text-green-700">
                                Hazır
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Hazırlanıyor</Badge>
                            )}
                            
                            <Button
                              size="sm"
                              onClick={() => downloadMutation.mutate({
                                sessionId: currentSession.sessionId,
                                modelId: result.modelId
                              })}
                              disabled={!result.canDownload || downloadMutation.isPending}
                            >
                              {downloadMutation.isPending ? (
                                <Clock className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4 mr-1" />
                              )}
                              İndir
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {currentSession?.status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {currentSession.errorMessage || 'Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.'}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}