import React, { useState, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Search, 
  Image as ImageIcon, 
  Download,
  Eye,
  Users,
  Zap,
  Filter
} from 'lucide-react';

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

interface PhotoDatabase {
  [photoPath: string]: {
    faces: {
      embedding: number[];
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
    }[];
  };
}

interface FaceMatcherProps {
  referenceEmbedding: number[];
  onMatchesFound: (matches: PhotoMatch[]) => void;
  onProgress: (progress: number, message: string) => void;
  onError: (error: string) => void;
}

export const FaceMatcher: React.FC<FaceMatcherProps> = ({
  referenceEmbedding,
  onMatchesFound,
  onProgress,
  onError
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [photoDatabase, setPhotoDatabase] = useState<PhotoDatabase>({});
  const [similarityThreshold, setSimilarityThreshold] = useState([0.6]);
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [searchStats, setSearchStats] = useState({
    totalPhotos: 0,
    processedPhotos: 0,
    totalFaces: 0,
    matchedPhotos: 0
  });

  const calculateCosineSimilarity = (embedding1: number[], embedding2: number[]): number => {
    if (embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  };

  const euclideanDistance = (embedding1: number[], embedding2: number[]): number => {
    if (embedding1.length !== embedding2.length) {
      return Infinity;
    }

    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      sum += Math.pow(embedding1[i] - embedding2[i], 2);
    }
    
    return Math.sqrt(sum);
  };

  const processPhotoFolder = async (folderHandle: any) => {
    const photoFiles: File[] = [];
    
    // Klasördeki tüm resim dosyalarını topla
    try {
      for await (const [name, handle] of (folderHandle as any).entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          if (file.type.startsWith('image/')) {
            photoFiles.push(file);
          }
        } else if (handle.kind === 'directory') {
          // Alt klasörleri de tara (recursive)
          const subFolderFiles = await processPhotoFolder(handle);
          photoFiles.push(...subFolderFiles);
        }
      }
    } catch (error) {
      console.warn('Folder processing error:', error);
    }

    return photoFiles;
  };

  const extractFacesFromPhoto = async (photoFile: File): Promise<{
    faces: {
      embedding: number[];
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
    }[];
  }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const imageUrl = URL.createObjectURL(photoFile);
        const image = new Image();
        
        image.onload = async () => {
          try {
            const detections = await faceapi
              .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
              .withFaceLandmarks()
              .withFaceDescriptors();

            const faces = detections.map(detection => ({
              embedding: Array.from(detection.descriptor),
              boundingBox: {
                x: detection.detection.box.x,
                y: detection.detection.box.y,
                width: detection.detection.box.width,
                height: detection.detection.box.height
              },
              confidence: detection.detection.score
            }));

            URL.revokeObjectURL(imageUrl);
            resolve({ faces });
          } catch (error) {
            URL.revokeObjectURL(imageUrl);
            reject(error);
          }
        };

        image.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Resim yüklenemedi'));
        };

        image.src = imageUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const startFaceMatching = async () => {
    try {
      setIsSearching(true);
      setMatches([]);
      setSearchStats({
        totalPhotos: 0,
        processedPhotos: 0,
        totalFaces: 0,
        matchedPhotos: 0
      });

      onProgress(5, 'Fotoğraf klasörü seçiliyor...');

      // Kullanıcıdan fotoğraf klasörü seçmesini iste
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      onProgress(10, 'Fotoğraflar taranıyor...');

      // Tüm fotoğrafları topla
      const photoFiles = await processPhotoFolder(directoryHandle);
      
      if (photoFiles.length === 0) {
        onError('Seçilen klasörde hiç fotoğraf bulunamadı.');
        return;
      }

      setSearchStats(prev => ({ ...prev, totalPhotos: photoFiles.length }));
      onProgress(15, `${photoFiles.length} fotoğraf bulundu. Yüzler analiz ediliyor...`);

      const foundMatches: PhotoMatch[] = [];
      let totalFacesFound = 0;

      // Her fotoğrafı işle
      for (let i = 0; i < photoFiles.length; i++) {
        const photoFile = photoFiles[i];
        const progressPercent = 15 + ((i / photoFiles.length) * 70);
        
        onProgress(
          progressPercent, 
          `${photoFile.name} işleniyor... (${i + 1}/${photoFiles.length})`
        );

        try {
          const result = await extractFacesFromPhoto(photoFile);
          totalFacesFound += result.faces.length;

          // Eşleşme kontrolü yap
          let bestSimilarity = 0;
          const matchedFaces: {
            x: number;
            y: number;
            width: number;
            height: number;
            confidence: number;
          }[] = [];

          for (const face of result.faces) {
            const similarity = calculateCosineSimilarity(referenceEmbedding, face.embedding);
            
            if (similarity >= similarityThreshold[0]) {
              bestSimilarity = Math.max(bestSimilarity, similarity);
              matchedFaces.push({
                x: face.boundingBox.x,
                y: face.boundingBox.y,
                width: face.boundingBox.width,
                height: face.boundingBox.height,
                confidence: face.confidence
              });
            }
          }

          if (matchedFaces.length > 0) {
            foundMatches.push({
              photoPath: photoFile.name,
              similarity: bestSimilarity,
              faceCount: result.faces.length,
              detectedFaces: matchedFaces
            });
          }

        } catch (error) {
          console.warn(`${photoFile.name} işlenirken hata:`, error);
        }

        setSearchStats(prev => ({
          ...prev,
          processedPhotos: i + 1,
          totalFaces: totalFacesFound,
          matchedPhotos: foundMatches.length
        }));
      }

      // Sonuçları benzerlik skoruna göre sırala
      foundMatches.sort((a, b) => b.similarity - a.similarity);
      setMatches(foundMatches);
      onMatchesFound(foundMatches);

      onProgress(100, `Eşleşme tamamlandı! ${foundMatches.length} fotoğrafta eşleşme bulundu.`);

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        onError('Kullanıcı tarafından iptal edildi.');
      } else {
        onError('Fotoğraf eşleştirme sırasında hata oluştu: ' + (error as Error).message);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const exportResults = () => {
    if (matches.length === 0) return;

    const csvContent = [
      ['Fotoğraf Adı', 'Benzerlik Skoru', 'Toplam Yüz Sayısı', 'Eşleşen Yüz Sayısı'],
      ...matches.map(match => [
        match.photoPath,
        (match.similarity * 100).toFixed(2) + '%',
        match.faceCount.toString(),
        match.detectedFaces.length.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `yuz_eslestirme_sonuclari_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Yüz Eşleştirme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Benzerlik Eşiği: {Math.round(similarityThreshold[0] * 100)}%</Label>
            <Slider
              value={similarityThreshold}
              onValueChange={setSimilarityThreshold}
              min={0.3}
              max={0.9}
              step={0.05}
              disabled={isSearching}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Düşük değer: Daha fazla eşleşme, Yüksek değer: Daha kesin eşleşme
            </div>
          </div>

          <Button 
            onClick={startFaceMatching}
            disabled={isSearching}
            className="w-full"
          >
            {isSearching ? (
              <>
                <Zap className="w-4 h-4 mr-2 animate-spin" />
                Eşleştirme Devam Ediyor...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Fotoğraf Klasörü Seç ve Eşleştirmeyi Başlat
              </>
            )}
          </Button>

          {isSearching && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>İşlem durumu</span>
                    <span>{searchStats.processedPhotos} / {searchStats.totalPhotos}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="font-medium">Fotoğraf</div>
                      <div>{searchStats.processedPhotos}</div>
                    </div>
                    <div>
                      <div className="font-medium">Toplam Yüz</div>
                      <div>{searchStats.totalFaces}</div>
                    </div>
                    <div>
                      <div className="font-medium">Eşleşme</div>
                      <div>{searchStats.matchedPhotos}</div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Eşleşen Fotoğraflar ({matches.length})
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportResults}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV İndir
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                            <Eye className="w-3 h-3" />
                            {match.detectedFaces.length} eşleşme
                          </div>
                        </div>

                        <div className="text-xs">
                          <div className="text-muted-foreground">Tespit edilen yüzler:</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {match.detectedFaces.map((face, faceIndex) => (
                              <Badge key={faceIndex} variant="outline" className="text-xs">
                                {Math.round(face.confidence * 100)}%
                              </Badge>
                            ))}
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
                    İlk 20 sonuç gösteriliyor. Tüm {matches.length} sonucu görmek için CSV dosyasını indirin.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FaceMatcher;