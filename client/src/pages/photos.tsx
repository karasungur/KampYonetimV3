import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search,
  Zap,
  FileImage,
  ArrowRight
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import FaceDetector from "@/components/face-detection/FaceDetector";
import FaceMatcher from "@/components/face-detection/FaceMatcher";
import * as faceapi from '@vladmandic/face-api';

interface DetectedFace {
  id: string;
  embedding: number[];
  confidence: number;
  quality: 'good' | 'poor' | 'blurry' | 'profile';
  boundingBox: { x: number; y: number; width: number; height: number };
  landmarks: { x: number; y: number }[];
  isSelected: boolean;
}

interface PhotoMatch {
  photoPath: string;
  similarity: number;
  faceCount: number;
  detectedFaces: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }[];
}

export default function PhotosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'detect' | 'match' | 'results'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [referenceEmbedding, setReferenceEmbedding] = useState<number[]>([]);
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // Face-API.js initialization
  useEffect(() => {
    initializeFaceAPI();
  }, []);

  const initializeFaceAPI = async () => {
    try {
      setInitProgress(10);
      
      // Model dosyalarının yollarını ayarla
      const MODEL_URL = '/models';
      
      setInitProgress(30);
      console.log('Loading face-api models...');
      
      // Sadece gerekli modelleri yükle
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setInitProgress(60);
      
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      setInitProgress(80);
      
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setInitProgress(100);
      
      setIsInitialized(true);
      console.log('Face-API initialized successfully');
      
      toast({
        title: "Face-API Hazır",
        description: "Yüz tanıma sistemi başarıyla yüklendi.",
      });
      
    } catch (error) {
      console.error('Face-API initialization error:', error);
      toast({
        title: "Başlatma Hatası",
        description: "Face-API yüklenirken bir hata oluştu. Sayfayı yenileyin.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Geçersiz Dosya",
          description: "Lütfen bir resim dosyası seçin.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      setStep('detect');
    }
  };

  const handleFacesDetected = (faces: DetectedFace[]) => {
    setDetectedFaces(faces);
    
    // Seçili yüzün embedding'ini al
    const selectedFace = faces.find(face => face.isSelected);
    if (selectedFace) {
      setReferenceEmbedding(selectedFace.embedding);
      toast({
        title: "Yüz Tespit Edildi",
        description: `${faces.length} yüz tespit edildi. Eşleştirme için hazır.`,
      });
    }
  };

  const handleDetectionError = (error: string) => {
    toast({
      title: "Tespit Hatası",
      description: error,
      variant: "destructive",
    });
  };

  const startMatching = () => {
    if (referenceEmbedding.length === 0) {
      toast({
        title: "Hata",
        description: "Önce referans yüz seçmelisiniz.",
        variant: "destructive",
      });
      return;
    }
    
    setStep('match');
  };

  const handleMatchesFound = (foundMatches: PhotoMatch[]) => {
    setMatches(foundMatches);
    setStep('results');
    
    toast({
      title: "Eşleştirme Tamamlandı",
      description: `${foundMatches.length} fotoğrafta eşleşme bulundu.`,
    });
  };

  const handleMatchingProgress = (progressValue: number, message: string) => {
    setProgress(progressValue);
    setProgressMessage(message);
  };

  const handleMatchingError = (error: string) => {
    toast({
      title: "Eşleştirme Hatası",
      description: error,
      variant: "destructive",
    });
  };

  const resetProcess = () => {
    setStep('upload');
    setSelectedFile(null);
    setDetectedFaces([]);
    setReferenceEmbedding([]);
    setMatches([]);
    setProgress(0);
    setProgressMessage("");
  };

  if (!isInitialized) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fotoğraf İşleme Sistemi</h1>
            <p className="text-muted-foreground">
              AI destekli yüz tanıma ve fotoğraf eşleştirme sistemi
            </p>
          </div>

          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <Zap className="w-12 h-12 mx-auto text-primary animate-pulse" />
                <h3 className="text-lg font-semibold">Face-API Yükleniyor...</h3>
                <p className="text-sm text-muted-foreground">
                  Yüz tanıma modelleri yükleniyor, lütfen bekleyin.
                </p>
                <Progress value={initProgress} className="w-full max-w-md mx-auto" />
                <div className="text-xs text-muted-foreground">
                  {initProgress}% tamamlandı
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fotoğraf İşleme Sistemi</h1>
            <p className="text-muted-foreground">
              AI destekli yüz tanıma ve fotoğraf eşleştirme sistemi
            </p>
          </div>
          
          {step !== 'upload' && (
            <Button variant="outline" onClick={resetProcess}>
              Yeni İşlem Başlat
            </Button>
          )}
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              {[
                { key: 'upload', icon: Upload, label: 'Fotoğraf Yükle' },
                { key: 'detect', icon: Camera, label: 'Yüz Tespit Et' },
                { key: 'match', icon: Search, label: 'Eşleştir' },
                { key: 'results', icon: CheckCircle, label: 'Sonuçlar' }
              ].map((stepItem, index, array) => (
                <div key={stepItem.key} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step === stepItem.key 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : array.findIndex(s => s.key === step) > index
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-muted bg-muted text-muted-foreground'
                  }`}>
                    <stepItem.icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    step === stepItem.key ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {stepItem.label}
                  </span>
                  {index < array.length - 1 && (
                    <ArrowRight className="w-4 h-4 mx-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Referans Fotoğraf Yükle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Camera className="w-4 h-4" />
                <AlertDescription>
                  Eşleştirmek istediğiniz kişinin net bir yüz fotoğrafını yükleyin. 
                  En iyi sonuç için önden çekilmiş, iyi aydınlatmalı fotoğraflar kullanın.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="photo">Fotoğraf Seç</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'detect' && selectedFile && (
          <FaceDetector
            imageFile={selectedFile}
            onFacesDetected={handleFacesDetected}
            onError={handleDetectionError}
          />
        )}

        {step === 'detect' && detectedFaces.length > 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <Button onClick={startMatching} size="lg" className="w-full">
                <Search className="w-5 h-5 mr-2" />
                Fotoğraf Eşleştirmeyi Başlat
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'match' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Search className="w-12 h-12 mx-auto text-primary animate-pulse" />
                  <h3 className="text-lg font-semibold">Fotoğraflar Eşleştiriliyor...</h3>
                  <p className="text-sm text-muted-foreground">{progressMessage}</p>
                  <Progress value={progress} className="w-full max-w-md mx-auto" />
                </div>
              </CardContent>
            </Card>

            <FaceMatcher
              referenceEmbedding={referenceEmbedding}
              onMatchesFound={handleMatchesFound}
              onProgress={handleMatchingProgress}
              onError={handleMatchingError}
            />
          </div>
        )}

        {step === 'results' && matches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Eşleştirme Sonuçları ({matches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Toplamda {matches.length} fotoğrafta eşleşme bulundu. 
                    Sonuçlar benzerlik skoruna göre sıralanmıştır.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matches.slice(0, 20).map((match, index) => (
                    <Card key={index} className="border">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate" title={match.photoPath}>
                              {match.photoPath}
                            </span>
                            <Badge variant="default">
                              {Math.round(match.similarity * 100)}%
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {match.faceCount} yüz
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {match.detectedFaces.length} eşleşme
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {matches.length > 20 && (
                  <Alert>
                    <AlertDescription>
                      İlk 20 sonuç gösteriliyor. Tüm sonuçları görmek için CSV export özelliğini kullanın.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'results' && matches.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Eşleşme Bulunamadı</h3>
              <p className="text-muted-foreground mb-4">
                Seçilen fotoğraf klasöründe eşleşen yüz bulunamadı.
              </p>
              <Button onClick={resetProcess}>
                Yeni Fotoğraf Dene
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}