import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Camera, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

interface DetectedFace {
  id: string;
  faceImagePath: string;
  confidence: string;
  quality: 'good' | 'poor' | 'blurry' | 'profile';
  boundingBox: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
}

interface PhotoRequest {
  id: string;
  tcNumber: string;
  email: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  referencePhotoPath?: string;
  detectedFacesCount?: number;
  matchedPhotosCount?: number;
  errorMessage?: string;
  createdAt: string;
}

export default function PhotosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [tcNumber, setTcNumber] = useState("");
  const [email, setEmail] = useState("");
  const [currentRequest, setCurrentRequest] = useState<PhotoRequest | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'upload' | 'faces' | 'processing' | 'completed'>('input');

  // TC numarası ile önceki talep kontrolü
  const checkExistingRequest = useCallback(async (tc: string) => {
    try {
      const response = await apiRequest('GET', `/api/photo-requests/check/${tc}`);
      const responseData = await response.json();
      if (responseData && typeof responseData === 'object' && 'exists' in responseData) {
        if (responseData.exists && responseData.request) {
          setCurrentRequest(responseData.request as PhotoRequest);
          if (responseData.request.status === 'completed') {
            setStep('completed');
          } else if (responseData.request.detectedFacesCount && responseData.request.detectedFacesCount > 0) {
            setStep('faces');
            // Tespit edilen yüzleri yükle
            const facesResponse = await apiRequest('GET', `/api/photo-requests/${responseData.request.id}/faces`);
            const facesData = await facesResponse.json();
            if (Array.isArray(facesData)) {
              setDetectedFaces(facesData);
            }
          }
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Talep kontrolü hatası:', error);
      return false;
    }
  }, []);

  // TC numarası doğrulama ve talep başlatma
  const startPhotoRequest = useMutation({
    mutationFn: async () => {
      if (tcNumber.length !== 11) {
        throw new Error('TC kimlik numarası 11 haneli olmalıdır');
      }
      if (!email) {
        throw new Error('E-posta adresi gereklidir');
      }

      // Önceki talep kontrolü
      const hasExisting = await checkExistingRequest(tcNumber);
      if (hasExisting) {
        return null;
      }

      // Yeni talep oluştur
      const response = await apiRequest('POST', '/api/photo-requests', { tcNumber, email });
      const responseData = await response.json();
      
      if (responseData && typeof responseData === 'object') {
        const photoRequest = responseData as PhotoRequest;
        setCurrentRequest(photoRequest);
        setStep('upload');
        return photoRequest;
      }
      
      throw new Error('Geçersiz sunucu yanıtı');
    },
    onSuccess: (result) => {
      if (result) {
        toast({
          title: "Başarılı",
          description: "Fotoğraf talebi oluşturuldu. Şimdi referans fotoğrafınızı yükleyebilirsiniz.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fotoğraf yükleme parametreleri
  const handleGetUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const responseData = await response.json();
    
    if (responseData && typeof responseData === 'object' && 'uploadURL' in responseData) {
      return {
        method: 'PUT' as const,
        url: responseData.uploadURL as string,
      };
    }
    
    throw new Error('Yükleme URL\'si alınamadı');
  };

  // Fotoğraf yükleme tamamlandığında
  const handleUploadComplete = useMutation({
    mutationFn: async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      if (!currentRequest || !result.successful || result.successful.length === 0) {
        throw new Error('Geçersiz yükleme sonucu');
      }
      
      const uploadedFile = result.successful[0];
      const response = await apiRequest('POST', `/api/photo-requests/${currentRequest.id}/upload`, {
        referencePhotoURL: uploadedFile.uploadURL,
      });
      const responseData = await response.json();
      
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Başarılı",
        description: "Fotoğraf yüklendi ve yüz tespit işlemi başlatıldı.",
      });
      setStep('processing');
      // Yüz tespit sonuçlarını bekle
      setTimeout(checkFaceDetection, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Hata",
        description: "Fotoğraf yükleme sırasında hata oluştu: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Yüz tespit sonuçlarını kontrol et
  const checkFaceDetection = useCallback(async () => {
    if (!currentRequest) return;
    
    try {
      const response = await apiRequest('GET', `/api/photo-requests/${currentRequest.id}/faces`);
      const responseData = await response.json();
      if (Array.isArray(responseData) && responseData.length > 0) {
        setDetectedFaces(responseData);
        setStep('faces');
      } else {
        // Henüz yüz tespit edilmedi, tekrar dene
        setTimeout(checkFaceDetection, 2000);
      }
    } catch (error) {
      console.error('Yüz tespit kontrolü hatası:', error);
    }
  }, [currentRequest]);

  // Yüz seçimi
  const selectFace = useMutation({
    mutationFn: async (faceId: string) => {
      if (!currentRequest) {
        throw new Error('Geçerli talep bulunamadı');
      }
      
      await apiRequest('POST', `/api/photo-requests/${currentRequest.id}/select-face`, { faceId });
      
      return faceId;
    },
    onSuccess: (faceId) => {
      setSelectedFaceId(faceId);
      setDetectedFaces(faces => 
        faces.map(face => ({ ...face, isSelected: face.id === faceId }))
      );
      toast({
        title: "Başarılı",
        description: "Yüz seçildi ve eşleşen fotoğraflar aranıyor.",
      });
      setStep('processing');
      // Eşleşme işlemini başlat
      setTimeout(() => setStep('completed'), 5000);
    },
    onError: (error: Error) => {
      toast({
        title: "Hata",
        description: "Yüz seçimi sırasında hata oluştu: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Yeni talep başlatma
  const startNewRequest = () => {
    setTcNumber("");
    setEmail("");
    setCurrentRequest(null);
    setDetectedFaces([]);
    setSelectedFaceId(null);
    setStep('input');
  };

  // Admin için tüm talepleri görüntüleme
  const { data: allRequests = [] } = useQuery({
    queryKey: ['/api/photo-requests'],
    enabled: user?.role === 'genelsekreterlik',
  });

  const { data: queueStatus = [] } = useQuery({
    queryKey: ['/api/photo-requests/queue'],
    enabled: user?.role === 'genelsekreterlik',
    refetchInterval: 5000, // 5 saniyede bir güncelle
  });

  if (user?.role === 'genelsekreterlik') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold ak-text">Fotoğraf Yönetimi</h1>
            <p className="ak-gray mt-2">Kamp fotoğraf talepleri ve işlem durumu</p>
          </div>

          {/* Kuyruk Durumu */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                İşlem Kuyruğu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(queueStatus) && queueStatus.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{item.tcNumber}</p>
                      <p className="text-sm text-gray-500">{item.email}</p>
                      <Badge variant="outline">{item.currentStep || 'Bekliyor'}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Sıra: {item.queuePosition}</p>
                      <p className="text-sm">İlerleme: %{item.progress || 0}</p>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(queueStatus) || queueStatus.length === 0) && (
                  <p className="text-center text-gray-500 py-4">Kuyrukta bekleyen talep yok</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tüm Talepler */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Tüm Fotoğraf Talepleri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(allRequests) && allRequests.map((request: PhotoRequest) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{request.tcNumber}</p>
                      <p className="text-sm text-gray-500">{request.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={
                          request.status === 'completed' ? 'default' :
                          request.status === 'processing' ? 'secondary' :
                          request.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {request.status}
                        </Badge>
                        {request.detectedFacesCount && (
                          <Badge variant="outline">{request.detectedFacesCount} yüz</Badge>
                        )}
                        {request.matchedPhotosCount && (
                          <Badge variant="outline">{request.matchedPhotosCount} eşleşme</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
                {(!Array.isArray(allRequests) || allRequests.length === 0) && (
                  <p className="text-center text-gray-500 py-4">Henüz fotoğraf talebi yok</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold ak-text">Fotoğraflarımı Bul</h1>
          <p className="ak-gray mt-2">Kamp fotoğraflarınızı otomatik olarak bulun ve e-posta ile alın</p>
        </div>

        {step === 'input' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Fotoğraf Talebi Başlat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tcNumber">T.C. Kimlik Numarası</Label>
                <Input
                  id="tcNumber"
                  type="text"
                  maxLength={11}
                  value={tcNumber}
                  onChange={(e) => setTcNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="11 haneli TC kimlik numaranız"
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-posta Adresi</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Fotoğrafların gönderileceği e-posta adresiniz"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Sisteme bir referans fotoğrafınızı yükleyerek kamp fotoğrafları arasından size ait olanları otomatik olarak bulabilirsiniz.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => startPhotoRequest.mutate()}
                disabled={startPhotoRequest.isPending || tcNumber.length !== 11 || !email}
                className="w-full"
              >
                <Upload className="mr-2 w-4 h-4" />
                {startPhotoRequest.isPending ? 'Kontrol ediliyor...' : 'Fotoğraf Talebini Başlat'}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'upload' && currentRequest && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Referans Fotoğraf Yükle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Size ait net bir fotoğraf yükleyin. Yüzünüzün açık ve bulanık olmadığından emin olun.
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760} // 10MB
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={(result) => handleUploadComplete.mutate(result)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                    <span>Fotoğraf Yükle</span>
                    <span className="text-sm text-gray-500">JPG, PNG (Max 10MB)</span>
                  </div>
                </ObjectUploader>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'processing' && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ak-yellow mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">İşleniyor...</h3>
              <p className="text-gray-500">Fotoğrafınız analiz ediliyor ve yüzler tespit ediliyor.</p>
            </CardContent>
          </Card>
        )}

        {step === 'faces' && detectedFaces.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Tespit Edilen Yüzler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Size ait olan yüzü seçin. Bu yüz kamp fotoğraflarında aranacak.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {detectedFaces.map((face) => (
                  <div
                    key={face.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      face.isSelected 
                        ? 'border-ak-yellow bg-ak-yellow/10' 
                        : 'border-gray-200 hover:border-ak-yellow'
                    }`}
                    onClick={() => selectFace.mutate(face.id)}
                  >
                    <img
                      src={`/api/images/${face.faceImagePath}`}
                      alt="Tespit edilen yüz"
                      className="w-full h-32 object-cover rounded"
                    />
                    <div className="mt-2 space-y-1">
                      <Badge variant={face.quality === 'good' ? 'default' : 'secondary'}>
                        {face.quality}
                      </Badge>
                      <p className="text-xs text-gray-500">
                        Güven: {parseFloat(face.confidence).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedFaceId && (
                <div className="text-center">
                  <Button onClick={() => setStep('processing')} disabled={selectFace.isPending}>
                    <CheckCircle className="mr-2 w-4 h-4" />
                    Seçimi Onayla ve Aramaya Başla
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'completed' && currentRequest && (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Tamamlandı!</h3>
              <p className="text-gray-500 mb-4">
                Fotoğraflarınız e-posta adresinize gönderildi.
              </p>
              {currentRequest.matchedPhotosCount && (
                <Badge variant="default" className="mb-4">
                  {currentRequest.matchedPhotosCount} fotoğraf bulundu
                </Badge>
              )}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={startNewRequest}>
                  Yeni Talep
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}