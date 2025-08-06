import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Eye, Camera } from 'lucide-react';

interface DetectedFace {
  id: string;
  embedding: number[];
  confidence: number;
  quality: 'good' | 'poor' | 'blurry' | 'profile';
  boundingBox: { x: number; y: number; width: number; height: number };
  landmarks: { x: number; y: number }[];
  isSelected: boolean;
}

interface FaceDetectorProps {
  imageFile: File;
  onFacesDetected: (faces: DetectedFace[]) => void;
  onError: (error: string) => void;
}

export const FaceDetector: React.FC<FaceDetectorProps> = ({
  imageFile,
  onFacesDetected,
  onError
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);

  useEffect(() => {
    if (imageFile) {
      processImage();
    }
  }, [imageFile]);

  const evaluateFaceQuality = (
    detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>,
    imageWidth: number,
    imageHeight: number
  ): 'good' | 'poor' | 'blurry' | 'profile' => {
    const { box } = detection.detection;
    const landmarks = detection.landmarks;
    
    // Yüz boyutu kontrolü
    const faceArea = box.width * box.height;
    const imageArea = imageWidth * imageHeight;
    const faceRatio = faceArea / imageArea;
    
    if (faceRatio < 0.01) return 'poor'; // Çok küçük yüz
    
    // Profil kontrolü - sol ve sağ gözün görünürlüğünü kontrol et
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    
    // Göz arası mesafe ile burun pozisyonunu karşılaştır
    const eyeDistance = Math.abs(leftEye[0].x - rightEye[0].x);
    const noseToLeftEye = Math.abs(nose[2].x - leftEye[0].x);
    const noseToRightEye = Math.abs(nose[2].x - rightEye[0].x);
    
    const asymmetryRatio = Math.abs(noseToLeftEye - noseToRightEye) / eyeDistance;
    
    if (asymmetryRatio > 0.3) return 'profile'; // Profil pozisyon
    
    // Bulanıklık kontrolü - landmark'ların tutarlılığını kontrol et
    const jawline = landmarks.getJawOutline();
    let jawVariance = 0;
    for (let i = 1; i < jawline.length; i++) {
      const distance = Math.sqrt(
        Math.pow(jawline[i].x - jawline[i-1].x, 2) + 
        Math.pow(jawline[i].y - jawline[i-1].y, 2)
      );
      jawVariance += distance;
    }
    
    const avgJawDistance = jawVariance / (jawline.length - 1);
    if (avgJawDistance < 5) return 'blurry'; // Çok düşük varyasyon = bulanık
    
    return 'good';
  };

  const generateFaceId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const processImage = async () => {
    if (!canvasRef.current || !imageRef.current) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Resmi yükle
      const imageUrl = URL.createObjectURL(imageFile);
      imageRef.current.src = imageUrl;

      await new Promise<void>((resolve) => {
        imageRef.current!.onload = () => resolve();
      });

      setProgress(20);

      const image = imageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;

      // Canvas boyutunu ayarla
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      setProgress(40);

      // Yüz tespiti ve landmark detection
      const detections = await faceapi
        .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      setProgress(70);

      if (detections.length === 0) {
        onError('Bu fotoğrafta hiç yüz tespit edilemedi. Lütfen net bir yüz fotoğrafı yükleyin.');
        return;
      }

      // Tespit edilen yüzleri işle
      const faces: DetectedFace[] = detections.map((detection, index) => {
        const quality = evaluateFaceQuality(detection, image.width, image.height);
        
        return {
          id: generateFaceId(),
          embedding: Array.from(detection.descriptor),
          confidence: detection.detection.score,
          quality,
          boundingBox: {
            x: detection.detection.box.x,
            y: detection.detection.box.y,
            width: detection.detection.box.width,
            height: detection.detection.box.height
          },
          landmarks: detection.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
          isSelected: index === 0 // İlk yüzü varsayılan olarak seç
        };
      });

      setProgress(90);

      // En iyi kaliteli yüzü bul ve varsayılan olarak seç
      const bestFace = faces.reduce((best, current) => {
        const qualityScore = {
          'good': 4,
          'poor': 1,
          'blurry': 2,
          'profile': 3
        };
        
        if (qualityScore[current.quality] > qualityScore[best.quality]) {
          return current;
        } else if (qualityScore[current.quality] === qualityScore[best.quality]) {
          return current.confidence > best.confidence ? current : best;
        }
        return best;
      });

      // Sadece en iyi yüzü seçili yap
      faces.forEach(face => {
        face.isSelected = face.id === bestFace.id;
      });

      setSelectedFaceId(bestFace.id);
      setDetectedFaces(faces);
      setProgress(100);

      // Yüzleri canvas üzerinde göster
      drawDetectedFaces(ctx, faces);

      onFacesDetected(faces);

    } catch (error) {
      console.error('Yüz tespit hatası:', error);
      onError('Yüz tespiti sırasında bir hata oluştu: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const drawDetectedFaces = (ctx: CanvasRenderingContext2D, faces: DetectedFace[]) => {
    faces.forEach((face, index) => {
      const { x, y, width, height } = face.boundingBox;
      
      // Seçili yüz için farklı renk
      ctx.strokeStyle = face.isSelected ? '#10b981' : '#3b82f6';
      ctx.lineWidth = face.isSelected ? 3 : 2;
      ctx.strokeRect(x, y, width, height);

      // Kalite badge'i
      const qualityColors = {
        'good': '#10b981',
        'poor': '#ef4444',
        'blurry': '#f59e0b',
        'profile': '#8b5cf6'
      };

      ctx.fillStyle = qualityColors[face.quality];
      ctx.fillRect(x, y - 25, 80, 20);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(face.quality.toUpperCase(), x + 5, y - 10);

      // Güven skoru
      ctx.fillStyle = face.isSelected ? '#10b981' : '#3b82f6';
      ctx.font = '10px Arial';
      ctx.fillText(`${Math.round(face.confidence * 100)}%`, x, y + height + 15);
    });
  };

  const handleFaceSelect = (faceId: string) => {
    const updatedFaces = detectedFaces.map(face => ({
      ...face,
      isSelected: face.id === faceId
    }));
    
    setDetectedFaces(updatedFaces);
    setSelectedFaceId(faceId);
    onFacesDetected(updatedFaces);

    // Canvas'ı güncelle
    if (canvasRef.current && imageRef.current) {
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(imageRef.current, 0, 0);
      drawDetectedFaces(ctx, updatedFaces);
    }
  };

  const getQualityBadgeVariant = (quality: string) => {
    switch (quality) {
      case 'good': return 'default';
      case 'poor': return 'destructive';
      case 'blurry': return 'secondary';
      case 'profile': return 'outline';
      default: return 'secondary';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'good': return <CheckCircle className="w-3 h-3" />;
      case 'poor': return <AlertCircle className="w-3 h-3" />;
      case 'blurry': return <Eye className="w-3 h-3" />;
      case 'profile': return <Camera className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Yüzler tespit ediliyor...</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="relative">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto border border-border rounded-lg"
              style={{ maxHeight: '500px' }}
            />
            <img
              ref={imageRef}
              style={{ display: 'none' }}
              alt="Yüklenen fotoğraf"
            />
          </div>

          {detectedFaces.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Tespit Edilen Yüzler ({detectedFaces.length})
                </h3>
                <Alert className="w-auto">
                  <AlertDescription className="text-sm">
                    En iyi kaliteli yüzü seçin
                  </AlertDescription>
                </Alert>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {detectedFaces.map((face, index) => (
                  <Card 
                    key={face.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      face.isSelected 
                        ? 'ring-2 ring-primary border-primary' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleFaceSelect(face.id)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">Yüz {index + 1}</span>
                          {face.isSelected && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant={getQualityBadgeVariant(face.quality)} className="text-xs">
                            {getQualityIcon(face.quality)}
                            <span className="ml-1 capitalize">{face.quality}</span>
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(face.confidence * 100)}%
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Boyut: {Math.round(face.boundingBox.width)}×{Math.round(face.boundingBox.height)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FaceDetector;