import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  User,
  Download,
  Camera,
  Search,
  Loader2
} from "lucide-react";
import * as faceapi from "@vladmandic/face-api";

interface PhotoMatchingFlowProps {
  tcNumber: string;
  selectedModelIds: string[];
  onReset: () => void;
}

interface DetectedFace {
  id: string;
  imageData: string;
  quality: 'good' | 'poor';
  selected: boolean;
  embedding?: number[];
}

export default function PhotoMatchingFlow({ tcNumber, selectedModelIds, onReset }: PhotoMatchingFlowProps) {
  const [step, setStep] = useState<'upload' | 'face-detection' | 'face-selection' | 'processing' | 'completed'>('upload');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Face-API model yükleme
  useEffect(() => {
    loadFaceAPIModels();
  }, []);

  const loadFaceAPIModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      console.log("✅ Face-API modelleri yüklendi");
    } catch (error) {
      console.error("Face-API model yükleme hatası:", error);
    }
  };

  // Dosya yükleme
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newImages: string[] = [];

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push(imageData);
      }
    }

    setUploadedImages(newImages);
    setStep('face-detection');
    
    // Yüz tespiti başlat
    setTimeout(() => detectFaces(newImages), 500);
  };

  // Yüz tespiti
  const detectFaces = async (images: string[]) => {
    setIsProcessing(true);
    const faces: DetectedFace[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const img = new Image();
      img.src = images[i];
      await new Promise(resolve => img.onload = resolve);
      
      const detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      for (let j = 0; j < detections.length; j++) {
        const detection = detections[j];
        const canvas = document.createElement('canvas');
        const box = detection.detection.box;
        
        // Yüzü kırp
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
          
          faces.push({
            id: `${i}-${j}-${Date.now()}`,
            imageData: canvas.toDataURL('image/jpeg'),
            quality: detection.detection.score > 0.8 ? 'good' : 'poor',
            selected: false
          });
        }
      }
    }
    
    setDetectedFaces(faces);
    setIsProcessing(false);
    setStep('face-selection');
    
    toast({
      title: "Yüz Tespiti Tamamlandı",
      description: `${faces.length} adet yüz tespit edildi`,
    });
  };

  // Yüz seçimi
  const toggleFaceSelection = (faceId: string) => {
    setDetectedFaces(prev => 
      prev.map(face => 
        face.id === faceId 
          ? { ...face, selected: !face.selected }
          : face
      )
    );
  };

  // Seçilen yüzleri işle
  const processSelectedFaces = async () => {
    const selectedFaces = detectedFaces.filter(f => f.selected);
    
    if (selectedFaces.length === 0) {
      toast({
        title: "Hata",
        description: "En az bir yüz seçmelisiniz",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setStep('processing');

    try {
      // Her yüz için embedding çıkar
      const faceDataWithEmbeddings = [];
      
      for (const face of selectedFaces) {
        // Blob oluştur
        const response = await fetch(face.imageData);
        const blob = await response.blob();
        
        // FormData oluştur
        const formData = new FormData();
        formData.append('image', blob, 'face.jpg');
        
        // Embedding çıkar
        const embeddingResponse = await fetch('/api/extract-embedding', {
          method: 'POST',
          headers: setAuthHeader(),
          body: formData,
        });
        
        if (embeddingResponse.ok) {
          const result = await embeddingResponse.json();
          faceDataWithEmbeddings.push({
            id: face.id,
            embedding: result.embedding,
            quality: face.quality
          });
        }
      }

      // Photo request gönder
      const photoRequestData = {
        tcNumber,
        faceData: faceDataWithEmbeddings,
        selectedCampDays: selectedModelIds,
        uploadedFilesCount: selectedFaces.length
      };

      const requestResponse = await apiRequest('/api/photo-requests', {
        method: 'POST',
        body: JSON.stringify(photoRequestData),
      });

      console.log("Photo request oluşturuldu:", requestResponse);
      
      // ZIP indirme URL'i oluştur
      setDownloadUrl(`/api/download-results/${tcNumber}?modelIds=${selectedModelIds.join(',')}`);
      setStep('completed');
      
      toast({
        title: "İşlem Başarılı",
        description: "Eşleştirme tamamlandı. ZIP dosyanızı indirebilirsiniz.",
      });
      
    } catch (error) {
      console.error("İşleme hatası:", error);
      toast({
        title: "Hata",
        description: "İşlem sırasında bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ZIP indirme
  const handleDownload = async () => {
    if (!downloadUrl) return;
    
    try {
      const response = await fetch(downloadUrl, {
        headers: setAuthHeader(),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tcNumber}_sonuclar.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "İndirme Başarılı",
          description: "ZIP dosyanız indirildi",
        });
      } else {
        throw new Error('İndirme başarısız');
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Dosya indirilemedi",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* İlerleme göstergesi */}
      <Card>
        <CardHeader>
          <CardTitle>İşlem Akışı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            {['upload', 'face-detection', 'face-selection', 'processing', 'completed'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${step === s ? 'bg-ak-yellow text-white' : 
                    i < ['upload', 'face-detection', 'face-selection', 'processing', 'completed'].indexOf(step) 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200'
                  }
                `}>
                  {i + 1}
                </div>
                {i < 4 && <div className="w-16 h-1 bg-gray-200 mx-2" />}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {step === 'upload' && 'Fotoğraf Yükleme'}
            {step === 'face-detection' && 'Yüz Tespiti'}
            {step === 'face-selection' && 'Yüz Seçimi'}
            {step === 'processing' && 'İşleniyor'}
            {step === 'completed' && 'Tamamlandı'}
          </div>
        </CardContent>
      </Card>

      {/* Fotoğraf yükleme */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Referans Fotoğrafları Yükleyin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-muted-foreground mb-4">
                Yüzünüzün net göründüğü fotoğrafları yükleyin
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Fotoğraf Seç
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yüz tespiti */}
      {step === 'face-detection' && (
        <Card>
          <CardHeader>
            <CardTitle>Yüzler Tespit Ediliyor</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              Vladimir Mandic Face-API ile yüzler tespit ediliyor...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Yüz seçimi */}
      {step === 'face-selection' && (
        <Card>
          <CardHeader>
            <CardTitle>Kendi Yüzlerinizi Seçin</CardTitle>
            <p className="text-sm text-muted-foreground">
              Size ait olan yüzleri işaretleyin
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {detectedFaces.map(face => (
                <div 
                  key={face.id}
                  onClick={() => toggleFaceSelection(face.id)}
                  className={`
                    relative cursor-pointer border-2 rounded-lg p-2
                    ${face.selected ? 'border-ak-yellow' : 'border-gray-200'}
                    hover:border-ak-yellow/50 transition-colors
                  `}
                >
                  <img 
                    src={face.imageData} 
                    alt="Tespit edilen yüz"
                    className="w-full h-full object-cover rounded"
                  />
                  {face.selected && (
                    <div className="absolute top-2 right-2 bg-ak-yellow text-white rounded-full p-1">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                  <Badge 
                    variant={face.quality === 'good' ? 'default' : 'secondary'}
                    className="absolute bottom-2 left-2 text-xs"
                  >
                    {face.quality === 'good' ? 'İyi' : 'Düşük'} Kalite
                  </Badge>
                </div>
              ))}
            </div>
            
            <Button 
              onClick={processSelectedFaces}
              disabled={!detectedFaces.some(f => f.selected) || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  İşleniyor...
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
      )}

      {/* İşleniyor */}
      {step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle>Eşleştirme İşlemi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={75} />
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">
                InsightFace Buffalo_L ile embedding çıkarılıyor ve modellerde arama yapılıyor...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tamamlandı */}
      {step === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              İşlem Tamamlandı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Eşleştirme işlemi başarıyla tamamlandı. Sonuçlarınızı indirebilirsiniz.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-4">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                ZIP İndir
              </Button>
              <Button onClick={onReset} variant="outline" className="flex-1">
                Yeni İşlem
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}