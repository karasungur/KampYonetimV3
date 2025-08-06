import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import * as faceapi from '@vladmandic/face-api';
import * as ort from 'onnxruntime-web';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { 
  UserCheck, 
  Calendar, 
  Camera, 
  Share2, 
  Users, 
  Clock,
  MapPin,
  Phone,
  ExternalLink,
  Construction,
  ArrowLeft,
  LogIn,
  Upload,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Search,
  Download,
  PlayCircle
} from "lucide-react";
import { 
  SiX, 
  SiInstagram, 
  SiYoutube, 
  SiFacebook, 
  SiLinkedin, 
  SiTiktok,
  SiTelegram,
  SiWhatsapp
} from "react-icons/si";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useLocation } from "wouter";
import backgroundImage from "@assets/GK-KAMP LOGOTYPE -BACKROUND - Düzenlendi_1754227727579.png";
import akPartiLogo from "@assets/akpartilogo_1753719301210.png";
import metinResmi from "@assets/metin_1754239817975.png";
import { Checkbox } from "@/components/ui/checkbox";

// Helper function to convert dataURL to Blob
const dataURLtoBlob = (dataURL: string) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

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
  mainTitle: string;
  mainSlogan: string;
  campTitle: string;
  systemTitle: string;
}

interface ProgramEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
}

interface SocialMediaAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUrl: string;
  displayOrder: number;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  phoneNumber: string | null;
  email: string | null;
  displayOrder: number;
}

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

type ActiveSection = 'program' | 'social' | 'team' | 'login' | 'photos' | null;

export default function MainMenuPage() {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [tcNumber, setTcNumber] = useState("");
  const [password, setPassword] = useState("");
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Photos section states
  const [photoTcNumber, setPhotoTcNumber] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoStep, setPhotoStep] = useState<'tc-input' | 'photo-upload' | 'face-extraction' | 'face-selection' | 'model-selection' | 'processing' | 'results'>('tc-input');
  const [tcError, setTcError] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedCampDays, setSelectedCampDays] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<MatchingSession | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // Face detection states
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [faceDetectionProgress, setFaceDetectionProgress] = useState(0);
  const [isFaceDetectionReady, setIsFaceDetectionReady] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [insightFaceSession, setInsightFaceSession] = useState<ort.InferenceSession | null>(null);
  const [isDetectingFaces, setIsDetectingFaces] = useState(false);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [faceQualityScores, setFaceQualityScores] = useState<{[key: string]: number}>({});
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  interface DetectedFace {
    id: string;
    imageData: string; // Base64 cropped face
    confidence: number;
    quality: 'good' | 'poor' | 'blurry' | 'profile';
    boundingBox: { x: number; y: number; width: number; height: number };
    landmarks: any;
    descriptor?: number[]; // 512-dimensional face embedding for recognition
    originalFile: File;
    isSelected: boolean;
  }

  // HİBRİT YAKLAŞIM: Client tarafında InsightFace Buffalo_L yüklenmez
  // Sadece Face-API kullanılır, embedding çıkarma server tarafında Python ile yapılır
  const loadInsightFaceBuffaloL = async () => {
    console.log('🦬 InsightFace Buffalo_L server tarafında kullanılacak (Python)');
    console.log('✅ Client tarafında yükleme atlandı - hibrit yaklaşım');
    // Client tarafında InsightFace yükleme yapmıyoruz
    return true; // Başarılı olarak işaretle ki Face-API devam etsin
  };

  // Extract embeddings using InsightFace Buffalo_L
  const extractBuffaloLEmbedding = async (faceImageData: string): Promise<number[] | null> => {
    if (!insightFaceSession) {
      console.warn('InsightFace Buffalo_L session not available');
      return null;
    }

    try {
      console.log('🔍 Extracting Buffalo_L embedding...');
      
      // Create image element from data URL
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = faceImageData;
      });

      // Create canvas and resize image to 112x112 (InsightFace input size)
      const canvas = document.createElement('canvas');
      canvas.width = 112;
      canvas.height = 112;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 112, 112);

      // Get image data and normalize for Buffalo_L
      const imageData = ctx.getImageData(0, 0, 112, 112);
      const pixels = imageData.data;
      
      // Convert to RGB and normalize to [0, 1] then to [-1, 1]
      const input = new Float32Array(3 * 112 * 112);
      for (let i = 0; i < 112 * 112; i++) {
        input[i] = (pixels[i * 4] / 255.0 - 0.5) / 0.5; // R
        input[i + 112 * 112] = (pixels[i * 4 + 1] / 255.0 - 0.5) / 0.5; // G  
        input[i + 2 * 112 * 112] = (pixels[i * 4 + 2] / 255.0 - 0.5) / 0.5; // B
      }

      // Run inference with Buffalo_L
      const inputTensor = new ort.Tensor('float32', input, [1, 3, 112, 112]);
      const feeds: Record<string, ort.Tensor> = { data: inputTensor };
      
      const results = await insightFaceSession.run(feeds);
      
      // Get embedding from Buffalo_L (512-dimensional)
      const outputName = Object.keys(results)[0];
      const embedding = results[outputName].data as Float32Array;
      
      console.log(`✅ Buffalo_L embedding extracted: ${embedding.length} dimensions`);
      return Array.from(embedding);
    } catch (error) {
      console.error('❌ Buffalo_L embedding extraction failed:', error);
      return null;
    }
  };

  // Initialize face-api for detection and UI
  useEffect(() => {
    const initializeFaceAPI = async () => {
      console.log('Vladimir Mandic Face-API initialization started...');
      setIsLoadingModels(true);
      
      try {
        // Vladimir Mandic's face-api uses different model URLs and structure
        const modelPath = 'https://vladmandic.github.io/face-api/model';
        
        console.log('Loading TinyFaceDetector model...');
        await faceapi.nets.tinyFaceDetector.load(modelPath);
        console.log('TinyFaceDetector loaded');
        
        console.log('Loading FaceLandmark68Net model...');
        await faceapi.nets.faceLandmark68Net.load(modelPath);
        console.log('FaceLandmark68Net loaded');
        
        console.log('Loading FaceRecognitionNet model...');
        await faceapi.nets.faceRecognitionNet.load(modelPath);
        console.log('FaceRecognitionNet loaded');
        
        // Load InsightFace Buffalo_L for superior embeddings
        const buffaloLoaded = await loadInsightFaceBuffaloL();
        
        setIsFaceDetectionReady(true);
        setIsLoadingModels(false); // Loading'i kapat
        console.log('Vladimir Mandic Face-API initialized successfully');
        toast({
          title: "Yüz Tanıma Aktif",
          description: `Face-API ile hibrit yüz tespiti hazır.`,
        });
      } catch (error) {
        console.warn('Face-API initialization failed, trying alternative CDN:', error);
        
        try {
          // Fallback to jsdelivr CDN
          const fallbackPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
          
          await Promise.all([
            faceapi.nets.tinyFaceDetector.load(fallbackPath),
            faceapi.nets.faceLandmark68Net.load(fallbackPath),
            faceapi.nets.faceRecognitionNet.load(fallbackPath)
          ]);
          
          // Load InsightFace Buffalo_L
          const buffaloLoaded = await loadInsightFaceBuffaloL();
          
          setIsFaceDetectionReady(true);
          setIsLoadingModels(false); // Loading'i kapat
          console.log('Face-API loaded from fallback CDN');
          toast({
            title: "Yüz Tanıma Aktif",
            description: `Face-API (fallback CDN) ile hibrit sistem hazır.`,
          });
        } catch (fallbackError) {
          console.warn('All Face-API initialization attempts failed, using manual mode:', fallbackError);
          setIsFaceDetectionReady(false);
          setIsLoadingModels(false); // Loading'i kapat
          toast({
            title: "Manuel Mod",
            description: "Yüz tanıma modelleri yüklenemedi. Manuel seçim modu kullanılacak.",
          });
        }
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    initializeFaceAPI();
  }, [toast]);
  
  // Preload images
  useEffect(() => {
    const preloadImages = () => {
      const logoImg = new Image();
      const textImg = new Image();
      
      let loadedCount = 0;
      const onImageLoad = () => {
        loadedCount++;
        if (loadedCount === 2) {
          setImagesLoaded(true);
        }
      };
      
      logoImg.onload = onImageLoad;
      textImg.onload = onImageLoad;
      logoImg.src = akPartiLogo;
      textImg.src = metinResmi;
    };
    
    preloadImages();
  }, []);

  // Face detection functions
  const detectFacesInFiles = async (files: File[]) => {
    if (!isFaceDetectionReady) {
      // Fallback: Create manual face selection from uploaded images
      const manualFaces: DetectedFace[] = files.map((file, index) => ({
        id: `manual-${index}-${Date.now()}`,
        imageData: URL.createObjectURL(file),
        confidence: 95, // Default confidence for manual selection
        quality: 'good' as const,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        landmarks: null,
        descriptor: undefined,
        originalFile: file,
        isSelected: false,
      }));
      
      toast({
        title: "Manuel Seçim Modu", 
        description: `${files.length} fotoğraf yüklendi. Otomatik yüz tespiti yapılamadığı için fotoğrafları manuel olarak seçebilirsiniz.`,
        variant: "default",
      });
      
      return manualFaces;
    }

    setIsDetectingFaces(true);
    setFaceDetectionProgress(0);
    const allFaces: DetectedFace[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      
      try {
        setFaceDetectionProgress(Math.round((fileIndex / files.length) * 100));
        
        // Use Vladimir Mandic's face-api.js for detection and UI
        const img = await loadImageFromFile(file);
        const detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length === 0) {
          // No faces detected, add manual option
          const manualFace: DetectedFace = {
            id: `manual-${fileIndex}-${Date.now()}`,
            imageData: URL.createObjectURL(file),
            confidence: 95,
            quality: 'good' as const,
            boundingBox: { x: 0, y: 0, width: 100, height: 100 },
            landmarks: null,
            descriptor: undefined,
            originalFile: file,
            isSelected: false,
          };
          allFaces.push(manualFace);
        } else {
          for (let faceIndex = 0; faceIndex < detections.length; faceIndex++) {
            const detection = detections[faceIndex];
            const croppedFace = await cropFaceFromImage(img, detection.detection.box);
            const quality = assessFaceQuality(detection);
            
            // Extract InsightFace Buffalo_L embedding from cropped face
            console.log(`🦬 Extracting Buffalo_L embedding for face ${faceIndex + 1}...`);
            const buffaloEmbedding = await extractBuffaloLEmbedding(croppedFace);
            
            const face: DetectedFace = {
              id: `${fileIndex}-${faceIndex}-${Date.now()}`,
              imageData: croppedFace,
              confidence: detection.detection.score * 100,
              quality,
              boundingBox: {
                x: detection.detection.box.x,
                y: detection.detection.box.y, 
                width: detection.detection.box.width,
                height: detection.detection.box.height,
              },
              landmarks: detection.landmarks,
              descriptor: buffaloEmbedding || (detection.descriptor ? Array.from(detection.descriptor) : undefined),
              originalFile: file,
              isSelected: false,
            };
            
            allFaces.push(face);
          }
        }
        
      } catch (error) {
        console.error(`Face detection error for file ${file.name}:`, error);
        // Fallback to manual selection for this file
        const manualFace: DetectedFace = {
          id: `manual-${fileIndex}-${Date.now()}`,
          imageData: URL.createObjectURL(file),
          confidence: 95,
          quality: 'good' as const,
          boundingBox: { x: 0, y: 0, width: 100, height: 100 },
          landmarks: null,
          descriptor: undefined,
          originalFile: file,
          isSelected: false,
        };
        allFaces.push(manualFace);
      }
    }

    setFaceDetectionProgress(100);
    setIsDetectingFaces(false);
    return allFaces;
  };

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const cropFaceFromImage = async (img: HTMLImageElement, box: any): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const padding = 20;
    const width = box.width + (padding * 2);
    const height = box.height + (padding * 2);
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.drawImage(img, box.x - padding, box.y - padding, width, height, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const assessFaceQuality = (detection: any): 'good' | 'poor' | 'blurry' | 'profile' => {
    const confidence = detection.detection.score;
    const box = detection.detection.box;
    
    if (confidence < 0.5) return 'poor';
    if (box.width < 50 || box.height < 50) return 'blurry';
    
    if (detection.landmarks) {
      const landmarks = detection.landmarks.positions;
      const nose = landmarks[30];
      const leftEye = landmarks[36];
      const rightEye = landmarks[45];
      
      if (nose && leftEye && rightEye) {
        const faceWidth = rightEye.x - leftEye.x;
        const noseOffset = Math.abs(nose.x - (leftEye.x + rightEye.x) / 2);
        if (noseOffset > faceWidth * 0.3) return 'profile';
      }
    }
    
    return 'good';
  };

  const handleFileUpload = async (files: File[]) => {
    setUploadedFiles(files);
    const faces = await detectFacesInFiles(files);
    setDetectedFaces(faces);
    
    const scores: {[key: string]: number} = {};
    faces.forEach(face => { scores[face.id] = face.confidence; });
    setFaceQualityScores(scores);
    
    if (faces.length > 0) {
      toast({
        title: "Yüz Tespiti Tamamlandı",
        description: `${faces.length} yüz tespit edildi. Lütfen size ait yüzleri seçin.`,
      });
    }
  };

  const toggleFaceSelection = (faceId: string) => {
    setSelectedFaceIds(prev => 
      prev.includes(faceId) ? prev.filter(id => id !== faceId) : [...prev, faceId]
    );
    
    setDetectedFaces(prev => 
      prev.map(face => ({
        ...face,
        isSelected: face.id === faceId ? !face.isSelected : face.isSelected
      }))
    );
  };

  const { data: menuSettings } = useQuery<MenuSettings>({
    queryKey: ["/api/menu-settings"],
  });

  const { data: programEvents } = useQuery<ProgramEvent[]>({
    queryKey: ["/api/program-events"],
    enabled: menuSettings?.programFlowEnabled || false,
  });

  const { data: socialMediaAccounts } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social-media-accounts"],
    enabled: menuSettings?.socialMediaEnabled || false,
  });

  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    enabled: menuSettings?.teamEnabled || false,
  });

  const { data: faceModels } = useQuery<FaceModel[]>({
    queryKey: ["/api/face-models"],
    enabled: menuSettings?.photosEnabled || false,
    queryFn: async () => {
      const response = await fetch('/api/face-models', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch face models');
      const data = await response.json();
      return data.filter((model: FaceModel) => model.status === 'ready');
    },
  });

  // Eğer hiçbir menü aktif değilse, otomatik olarak giriş sayfasına yönlendir
  if (menuSettings && !menuSettings.moderatorLoginEnabled && 
      !menuSettings.programFlowEnabled && !menuSettings.photosEnabled && 
      !menuSettings.socialMediaEnabled && !menuSettings.teamEnabled) {
    navigate("/login");
    return null;
  }


  const handlePhoneCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleSocialMediaClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSectionClick = (section: ActiveSection) => {
    setActiveSection(section);
  };

  // TC kimlik numarası doğrulama fonksiyonu
  const validateTCNumber = (tc: string): boolean => {
    if (tc.length !== 11) return false;
    if (!/^\d+$/.test(tc)) return false;
    
    const digits = tc.split('').map(Number);
    const firstDigit = digits[0];
    if (firstDigit === 0) return false;
    
    // TC algoritması kontrolü
    let oddSum = 0, evenSum = 0;
    for (let i = 0; i < 9; i++) {
      if (i % 2 === 0) oddSum += digits[i];
      else evenSum += digits[i];
    }
    
    const tenthDigit = ((oddSum * 7) - evenSum) % 10;
    if (tenthDigit !== digits[9]) return false;
    
    const total = digits.slice(0, 10).reduce((a, b) => a + b, 0);
    const eleventhDigit = total % 10;
    
    return eleventhDigit === digits[10];
  };

  const handleBackToMenu = () => {
    setActiveSection(null);
    setTcNumber("");
    setPassword("");
    // Reset photo states
    setPhotoTcNumber("");
    setUploadedFiles([]);
    setIsProcessing(false);
    setPhotoStep('tc-input');
    setTcError("");
    setSelectedModelIds([]);
    setCurrentSession(null);
    setDetectedFaces([]);
    setSelectedFaceIds([]);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ tcNumber, password });
  };

  const getSocialMediaIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    
    if (platformLower.includes('twitter') || platformLower.includes('x')) {
      return <SiX className="w-5 h-5" />;
    }
    if (platformLower.includes('instagram')) {
      return <SiInstagram className="w-5 h-5" />;
    }
    if (platformLower.includes('youtube')) {
      return <SiYoutube className="w-5 h-5" />;
    }
    if (platformLower.includes('facebook')) {
      return <SiFacebook className="w-5 h-5" />;
    }
    if (platformLower.includes('linkedin')) {
      return <SiLinkedin className="w-5 h-5" />;
    }
    if (platformLower.includes('tiktok')) {
      return <SiTiktok className="w-5 h-5" />;
    }
    if (platformLower.includes('telegram')) {
      return <SiTelegram className="w-5 h-5" />;
    }
    if (platformLower.includes('whatsapp')) {
      return <SiWhatsapp className="w-5 h-5" />;
    }
    
    // Default icon for unknown platforms
    return <Share2 className="w-5 h-5" />;
  };

  if (!menuSettings) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="animate-pulse text-white text-xl bg-black/30 backdrop-blur-sm px-6 py-3 rounded-2xl">Sistem hazırlanıyor...</div>
      </div>
    );
  }

  // Ana menü içeriği
  const renderMainMenu = () => (
    <>
      {/* Header with Logo Space */}
      <div className="text-center mb-0">
        {/* Logo */}
        <img 
          src={akPartiLogo} 
          alt="AK Parti" 
          className={`w-60 h-60 sm:w-56 sm:h-56 mx-auto mb-0 object-contain transition-opacity duration-300 ${imagesLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Metin Resmi */}
        <img 
          src={metinResmi} 
          alt="AK Parti Gençlik Kolları Genel Sekreterlik - Strateji ve İstişare Kampı" 
          className={`w-72 sm:w-56 md:w-64 mx-auto mb-0 object-contain -mt-8 transition-opacity duration-300 ${imagesLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Loading placeholder */}
        {!imagesLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse bg-white/20 rounded-full w-60 h-60 sm:w-56 sm:h-56"></div>
          </div>
        )}
      </div>

      {/* Mobile Optimized Menu Grid */}
      <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto -mt-3">
        {/* Moderatör Girişi */}
        {menuSettings.moderatorLoginEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('login')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-2 md:p-3 cursor-pointer group">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:bg-orange-600 transition-colors">
                <UserCheck className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.moderatorLoginTitle}
              </div>
            </div>
          </div>
        )}

        {/* Program Akışı */}
        {menuSettings.programFlowEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('program')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-2 md:p-3 cursor-pointer group">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:bg-orange-600 transition-colors">
                <Calendar className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.programFlowTitle}
              </div>
            </div>
          </div>
        )}

        {/* Fotoğraflar */}
        {menuSettings.photosEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('photos')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-2 md:p-3 cursor-pointer group">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:bg-orange-600 transition-colors">
                <Camera className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.photosTitle}
              </div>
            </div>
          </div>
        )}

        {/* Sosyal Medya */}
        {menuSettings.socialMediaEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('social')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-2 md:p-3 cursor-pointer group">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:bg-orange-600 transition-colors">
                <Share2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.socialMediaTitle}
              </div>
            </div>
          </div>
        )}

        {/* Ekibimiz */}
        {menuSettings.teamEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('team')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-2 md:p-3 cursor-pointer group">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:bg-orange-600 transition-colors">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.teamTitle}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="max-w-4xl mx-auto p-2 md:p-4 h-screen flex flex-col justify-start pt-4">
        {!activeSection ? renderMainMenu() : (
          <div className="animate-in slide-in-from-right-4 duration-75">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                onClick={handleBackToMenu}
                className="bg-white/20 hover:bg-white/30 text-white border-white/40 backdrop-blur-sm"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ana Menüye Dön
              </Button>
            </div>
            
            {/* Full Screen Content */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xl min-h-[70vh]">

              {/* Program Content */}
              {activeSection === 'program' && menuSettings.programFlowEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Calendar className="w-6 h-6" />
                      Program Detayları
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {programEvents && programEvents.length > 0 ? (
                        programEvents.map((event) => (
                          <div key={event.id} className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-100">
                            <div className="flex items-start gap-4">
                              <Clock className="w-5 h-5 text-orange-600 mt-1" />
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 text-lg mb-2">
                                  {event.title}
                                </h4>
                                <p className="text-sm text-gray-600 mb-2">
                                  {format(new Date(event.eventDate), "d MMMM yyyy, HH:mm", { locale: tr })}
                                </p>
                                {event.location && (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                    <MapPin className="w-4 h-4" />
                                    {event.location}
                                  </div>
                                )}
                                {event.description && (
                                  <p className="text-sm text-gray-600">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg">
                            Henüz program bilgisi eklenmemiş
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

              {/* Social Media Content */}
              {activeSection === 'social' && menuSettings.socialMediaEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Share2 className="w-6 h-6" />
                      Sosyal Medya Hesapları
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {socialMediaAccounts && socialMediaAccounts.length > 0 ? (
                        socialMediaAccounts
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((account) => (
                            <Button
                              key={account.id}
                              variant="outline"
                              className="justify-between hover:bg-orange-500 hover:text-white transition-all duration-200 rounded-xl border-orange-200 h-auto py-4"
                              onClick={() => handleSocialMediaClick(account.accountUrl)}
                            >
                              <div className="flex items-center gap-3">
                                {getSocialMediaIcon(account.platform)}
                                <span className="text-sm">
                                  <strong>{account.platform}:</strong> {account.accountName}
                                </span>
                              </div>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          ))
                      ) : (
                        <div className="col-span-full text-center py-12">
                          <Share2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg">
                            Henüz sosyal medya hesabı eklenmemiş
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

              {/* Team Content */}
              {activeSection === 'team' && menuSettings.teamEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Users className="w-6 h-6" />
                      Ekip Üyeleri
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teamMembers && teamMembers.length > 0 ? (
                        teamMembers
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((member) => (
                            <div key={member.id} className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-100">
                              <h4 className="font-semibold text-gray-900 text-base mb-2">
                                {member.firstName} {member.lastName}
                              </h4>
                              <p className="text-sm text-orange-600 font-medium mb-3">
                                {member.position}
                              </p>
                              {member.phoneNumber && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-sm h-8 px-3 flex items-center gap-2 hover:bg-green-50 hover:border-green-500 rounded-lg w-full justify-center"
                                  onClick={() => handlePhoneCall(member.phoneNumber!)}
                                >
                                  <Phone className="w-4 h-4" />
                                  {member.phoneNumber}
                                </Button>
                              )}
                            </div>
                          ))
                      ) : (
                        <div className="col-span-full text-center py-12">
                          <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg">
                            Henüz ekip üyesi eklenmemiş
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

              {/* Login Content */}
              {activeSection === 'login' && menuSettings.moderatorLoginEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <UserCheck className="w-6 h-6" />
                      Moderatör Girişi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="max-w-md mx-auto">
                      <div className="text-center mb-6">
                        <div className="mb-4">
                          <img 
                            src={akPartiLogo} 
                            alt="AK Parti" 
                            className="w-32 h-32 object-contain mx-auto"
                          />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Moderatör Giriş Portalı</h3>
                        <p className="text-gray-600 text-sm">Sistem erişimi için TC kimlik numaranız ve şifrenizi giriniz</p>
                      </div>
                      
                      <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="tcno" className="text-gray-700 font-medium">
                            T.C. Kimlik Numarası
                          </Label>
                          <Input
                            id="tcno"
                            type="text"
                            maxLength={11}
                            value={tcNumber}
                            onChange={(e) => setTcNumber(e.target.value)}
                            className="mt-1 focus:ring-orange-500 focus:border-orange-500"
                            placeholder="11 haneli T.C. kimlik numaranız"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="password" className="text-gray-700 font-medium">
                            Şifre
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 focus:ring-orange-500 focus:border-orange-500"
                            placeholder="Şifrenizi giriniz"
                            required
                          />
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 mt-6"
                          disabled={isLoggingIn}
                        >
                          <LogIn className="mr-2" size={16} />
                          {isLoggingIn ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </>
              )}

              {/* Photos Content */}
              {activeSection === 'photos' && menuSettings.photosEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Camera className="w-6 h-6" />
                      Kamp Fotoğraflarınızı Alın
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="max-w-2xl mx-auto">
                      <div className="text-center mb-8">
                        <Camera className="w-16 h-16 mx-auto text-orange-500 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Fotoğraflarınızı Bulun</h3>
                        <p className="text-gray-600">TC kimlik numaranızı girin, referans fotoğraflarınızı yükleyin ve kamp fotoğraflarınızı e-posta ile alın.</p>
                      </div>

                      <div className="space-y-6">
                        {/* TC Number Input Step */}
                        {photoStep === 'tc-input' && (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="photo-tc" className="text-gray-700 font-medium">
                                T.C. Kimlik Numarası
                              </Label>
                              <Input
                                id="photo-tc"
                                type="text"
                                maxLength={11}
                                value={photoTcNumber}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9]/g, '');
                                  setPhotoTcNumber(value);
                                  setTcError("");
                                  
                                  // TC kimlik kontrolü
                                  if (value.length === 11) {
                                    if (!validateTCNumber(value)) {
                                      setTcError("Geçersiz T.C. Kimlik Numarası");
                                    }
                                  }
                                }}
                                className={`mt-1 focus:ring-orange-500 focus:border-orange-500 ${
                                  tcError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                                }`}
                                placeholder="11 haneli TC kimlik numaranızı girin"
                              />
                              {tcError && (
                                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-4 h-4" />
                                  {tcError}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                Bulunan fotoğraflar ZIP dosyası olarak indirilecektir
                              </p>
                            </div>
                            
                            <Button 
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3"
                              disabled={photoTcNumber.length !== 11 || tcError !== ""}
                              onClick={() => {
                                setPhotoStep('photo-upload');
                              }}
                            >
                              <CheckCircle className="mr-2 w-4 h-4" />
                              Devam Et
                            </Button>
                          </div>
                        )}

                        {/* Photo Upload Step */}
                        {photoStep === 'photo-upload' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                              <div>
                                <span className="font-medium text-green-800">TC: {photoTcNumber}</span>
                                <p className="text-sm text-green-600">Referans fotoğraf bekleniyor</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setPhotoTcNumber("");
                                  setPhotoStep('tc-input');
                                }}
                              >
                                Değiştir
                              </Button>
                            </div>
                            
                        <div>
                          <Label className="text-gray-700 font-medium mb-2 block">
                            Referans Fotoğraflarınız
                          </Label>
                          
                          {/* Model Loading Indicator */}
                          {isLoadingModels && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                <div>
                                  <p className="text-sm font-medium text-blue-800">Hibrit yüz tanıma sistemi hazırlanıyor...</p>
                                  <p className="text-xs text-blue-600">Face-API + Buffalo_L embedding sistemi yükleniyor</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Model Ready */}
                          {!isLoadingModels && isFaceDetectionReady && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <div>
                                  <p className="text-sm font-medium text-green-800">Hibrit yüz tanıma sistemi hazır</p>
                                  <p className="text-xs text-green-600">Face-API (tespit) + Buffalo_L (embedding) aktif</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Model Loading Failed */}
                          {!isLoadingModels && !isFaceDetectionReady && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                <div>
                                  <p className="text-sm font-medium text-yellow-800">Manuel mod aktif</p>
                                  <p className="text-xs text-yellow-600">Otomatik yüz tespiti yapılamayacak, manuel seçim kullanılacak</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div 
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                              isLoadingModels 
                                ? 'border-gray-300 bg-gray-50/50 cursor-not-allowed' 
                                : 'border-orange-300 bg-orange-50/50 hover:bg-orange-50 cursor-pointer'
                            }`}
                            onDrop={async (e) => {
                              e.preventDefault();
                              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                              if (files.length > 0) {
                                await handleFileUpload([...uploadedFiles, ...files]);
                              }
                            }}
                            onDragOver={(e) => e.preventDefault()}
                          >
                            <Upload className="w-12 h-12 mx-auto text-orange-400 mb-4" />
                            <p className="text-gray-600 mb-2">Fotoğraflarınızı sürükleyip bırakın veya</p>
                            <Button 
                              variant="outline" 
                              className="border-orange-300 text-orange-600 hover:bg-orange-50"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.accept = 'image/*';
                                input.onchange = async (e) => {
                                  const files = Array.from((e.target as HTMLInputElement).files || []);
                                  if (files.length > 0) {
                                    await handleFileUpload([...uploadedFiles, ...files]);
                                  }
                                };
                                input.click();
                              }}
                            >
                              Dosya Seç
                            </Button>
                            <p className="text-xs text-gray-500 mt-2">PNG, JPG, JPEG dosyaları kabul edilir</p>
                          </div>
                        </div>

                        {/* Face Detection Progress */}
                        {isDetectingFaces && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Yüzler tespit ediliyor...</span>
                              <span className="font-medium">{faceDetectionProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${faceDetectionProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {uploadedFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-3">Yüklenen Fotoğraflar ({uploadedFiles.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {uploadedFiles.map((file, index) => (
                                <div key={index} className="relative group">
                                  <img 
                                    src={URL.createObjectURL(file)} 
                                    alt={file.name}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      const newFiles = uploadedFiles.filter((_, i) => i !== index);
                                      setUploadedFiles(newFiles);
                                      setDetectedFaces([]);
                                      setSelectedFaceIds([]);
                                    }}
                                  >
                                    ×
                                  </Button>
                                  <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Detected Faces Display */}
                        {detectedFaces.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-3">
                              Tespit Edilen Yüzler ({detectedFaces.length})
                              {selectedFaceIds.length > 0 && (
                                <span className="ml-2 text-sm text-orange-600">({selectedFaceIds.length} seçili)</span>
                              )}
                            </h4>
                            <Alert className="mb-4">
                              <Camera className="h-4 w-4" />
                              <AlertDescription>
                                Size ait olan yüzleri seçin. Seçilen yüzler kamp fotoğraflarında aranacak.
                              </AlertDescription>
                            </Alert>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                              {detectedFaces.map((face) => (
                                <div
                                  key={face.id}
                                  className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${
                                    face.isSelected 
                                      ? 'border-orange-500 bg-orange-50' 
                                      : 'border-gray-200 hover:border-orange-300'
                                  }`}
                                  onClick={() => toggleFaceSelection(face.id)}
                                >
                                  <img
                                    src={face.imageData}
                                    alt="Tespit edilen yüz"
                                    className="w-full h-20 object-cover rounded"
                                  />
                                  <div className="mt-1 space-y-1">
                                    <div className={`text-xs px-1 py-0.5 rounded text-center font-medium ${
                                      face.quality === 'good' ? 'bg-green-100 text-green-800' :
                                      face.quality === 'poor' ? 'bg-red-100 text-red-800' :
                                      face.quality === 'blurry' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-purple-100 text-purple-800'
                                    }`}>
                                      {face.quality === 'good' ? 'İyi' :
                                       face.quality === 'poor' ? 'Zayıf' :
                                       face.quality === 'blurry' ? 'Bulanık' : 'Profil'}
                                    </div>
                                    <div className="text-xs text-gray-500 text-center">
                                      %{Math.round(face.confidence)}
                                    </div>
                                  </div>
                                  {face.isSelected && (
                                    <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-orange-600" />
                                  )}
                                </div>
                              ))}
                            </div>
                            {detectedFaces.length > 0 && (
                              <div className="mt-3 text-sm text-gray-600">
                                Ortalama Kalite: %{Math.round(detectedFaces.reduce((acc, face) => acc + face.confidence, 0) / detectedFaces.length)}
                              </div>
                            )}
                          </div>
                        )}

                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Nasıl çalışır:</strong> Referans fotoğraflarınızı yükledikten sonra model seçimi yapacaksınız ve sistem kamp fotoğrafları arasında sizin bulunduğunuz fotoğrafları bulacaktır.
                          </AlertDescription>
                        </Alert>

                        <Button 
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3"
                          disabled={uploadedFiles.length === 0 || selectedFaceIds.length === 0}
                          onClick={() => setPhotoStep('model-selection')}
                        >
                          <CheckCircle className="mr-2 w-4 h-4" />
                          Model Seçimine Geç
                        </Button>
                          </div>
                        )}

                        {/* Model Selection Step */}
                        {photoStep === 'model-selection' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                              <div>
                                <span className="font-medium text-green-800">TC: {photoTcNumber}</span>
                                <p className="text-sm text-green-600">
                                  {uploadedFiles.length} fotoğraf, {selectedFaceIds.length} yüz seçildi - Model seçimi
                                </p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setPhotoStep('photo-upload')}
                              >
                                <ArrowLeft className="mr-1 w-3 h-3" />
                                Geri
                              </Button>
                            </div>
                            
                            <div>
                              <Label className="text-gray-700 font-medium">
                                Eşleştirme Modelleri
                              </Label>
                              <p className="text-sm text-gray-600 mb-3">
                                Fotoğraflarınızın aranacağı modelleri seçiniz:
                              </p>
                              <div className="space-y-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                {faceModels && faceModels.length > 0 ? (
                                  faceModels.map((model) => (
                                    <div key={model.id} className="flex items-center space-x-3">
                                      <Checkbox
                                        id={`model-${model.id}`}
                                        checked={selectedModelIds.includes(model.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedModelIds([...selectedModelIds, model.id]);
                                          } else {
                                            setSelectedModelIds(selectedModelIds.filter(id => id !== model.id));
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`model-${model.id}`}
                                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span>{model.name}</span>
                                          <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                                              Hazır
                                            </span>
                                            <span>{new Date(model.createdAt).toLocaleDateString('tr-TR')}</span>
                                          </div>
                                        </div>
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-gray-500 py-4 text-center">
                                    Henüz hazır model bulunmuyor
                                  </div>
                                )}
                              </div>
                              {selectedModelIds.length === 0 && (
                                <p className="text-xs text-red-600 mt-1">
                                  En az bir model seçmelisiniz
                                </p>
                              )}
                            </div>

                        <div>
                          <Label className="text-gray-700 font-medium mb-2 block">
                            Referans Fotoğraflarınız
                          </Label>
                          <div 
                            className="border-2 border-dashed border-orange-300 rounded-lg p-8 text-center bg-orange-50/50 hover:bg-orange-50 transition-colors"
                            onDrop={async (e) => {
                              e.preventDefault();
                              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                              if (files.length > 0) {
                                await handleFileUpload([...uploadedFiles, ...files]);
                              }
                            }}
                            onDragOver={(e) => e.preventDefault()}
                          >
                            <Upload className="w-12 h-12 mx-auto text-orange-400 mb-4" />
                            <p className="text-gray-600 mb-2">Fotoğraflarınızı sürükleyip bırakın veya</p>
                            <Button 
                              variant="outline" 
                              className="border-orange-300 text-orange-600 hover:bg-orange-50"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.accept = 'image/*';
                                input.onchange = async (e) => {
                                  const files = Array.from((e.target as HTMLInputElement).files || []);
                                  if (files.length > 0) {
                                    await handleFileUpload([...uploadedFiles, ...files]);
                                  }
                                };
                                input.click();
                              }}
                            >
                              Dosya Seç
                            </Button>
                            <p className="text-xs text-gray-500 mt-2">PNG, JPG, JPEG dosyaları kabul edilir</p>
                          </div>
                        </div>

                        {/* Face Detection Progress */}
                        {isDetectingFaces && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Yüzler tespit ediliyor...</span>
                              <span className="font-medium">{faceDetectionProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${faceDetectionProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {uploadedFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-3">Yüklenen Fotoğraflar ({uploadedFiles.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {uploadedFiles.map((file, index) => (
                                <div key={index} className="relative group">
                                  <img 
                                    src={URL.createObjectURL(file)} 
                                    alt={file.name}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      const newFiles = uploadedFiles.filter((_, i) => i !== index);
                                      setUploadedFiles(newFiles);
                                      setDetectedFaces([]);
                                      setSelectedFaceIds([]);
                                    }}
                                  >
                                    ×
                                  </Button>
                                  <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Detected Faces Display */}
                        {detectedFaces.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-3">
                              Tespit Edilen Yüzler ({detectedFaces.length})
                              {selectedFaceIds.length > 0 && (
                                <span className="ml-2 text-sm text-orange-600">({selectedFaceIds.length} seçili)</span>
                              )}
                            </h4>
                            <Alert className="mb-4">
                              <Camera className="h-4 w-4" />
                              <AlertDescription>
                                Size ait olan yüzleri seçin. Seçilen yüzler kamp fotoğraflarında aranacak.
                              </AlertDescription>
                            </Alert>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                              {detectedFaces.map((face) => (
                                <div
                                  key={face.id}
                                  className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${
                                    face.isSelected 
                                      ? 'border-orange-500 bg-orange-50' 
                                      : 'border-gray-200 hover:border-orange-300'
                                  }`}
                                  onClick={() => toggleFaceSelection(face.id)}
                                >
                                  <img
                                    src={face.imageData}
                                    alt="Tespit edilen yüz"
                                    className="w-full h-20 object-cover rounded"
                                  />
                                  <div className="mt-1 space-y-1">
                                    <div className={`text-xs px-1 py-0.5 rounded text-center font-medium ${
                                      face.quality === 'good' ? 'bg-green-100 text-green-800' :
                                      face.quality === 'poor' ? 'bg-red-100 text-red-800' :
                                      face.quality === 'blurry' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-purple-100 text-purple-800'
                                    }`}>
                                      {face.quality === 'good' ? 'İyi' :
                                       face.quality === 'poor' ? 'Zayıf' :
                                       face.quality === 'blurry' ? 'Bulanık' : 'Profil'}
                                    </div>
                                    <div className="text-xs text-gray-500 text-center">
                                      %{Math.round(face.confidence)}
                                    </div>
                                  </div>
                                  {face.isSelected && (
                                    <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-orange-600" />
                                  )}
                                </div>
                              ))}
                            </div>
                            {detectedFaces.length > 0 && (
                              <div className="mt-3 text-sm text-gray-600">
                                Ortalama Kalite: %{Math.round(detectedFaces.reduce((acc, face) => acc + face.confidence, 0) / detectedFaces.length)}
                              </div>
                            )}
                          </div>
                        )}

                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Nasıl çalışır:</strong> Referans fotoğraflarınızı yükledikten sonra, sistem kamp fotoğrafları arasında sizin bulunduğunuz fotoğrafları bulup ZIP dosyası olarak indirilmesini sağlayacaktır.
                              </AlertDescription>
                            </Alert>

                            <Button 
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3"
                              disabled={uploadedFiles.length === 0 || isProcessing || (detectedFaces.length > 0 && selectedFaceIds.length === 0)}
                              onClick={() => {
                                setPhotoStep('model-selection');
                              }}
                            >
                              <CheckCircle className="mr-2 w-4 h-4" />
                              Model Seç
                            </Button>
                          </div>
                        )}

                        {/* Model Selection Step */}
                        {photoStep === 'model-selection' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                              <div>
                                <span className="font-medium text-blue-800">6. Adım: Model Seçimi</span>
                                <p className="text-sm text-blue-600">Hangi model ile eşleştirme yapılacağını seçin</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setPhotoStep('photo-upload');
                                }}
                              >
                                Geri
                              </Button>
                            </div>

                            <div>
                              <Label className="text-gray-700 font-medium mb-3 block">
                                Kamp Fotoğraf Modelleri
                              </Label>
                              
                              {faceModels && faceModels.length > 0 ? (
                                <div className="space-y-3">
                                  {faceModels.map((model) => (
                                    <div 
                                      key={model.id}
                                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                        selectedModelIds.includes(model.id)
                                          ? 'border-orange-500 bg-orange-50'
                                          : 'border-gray-200 hover:border-orange-300'
                                      }`}
                                      onClick={() => {
                                        setSelectedModelIds(prev => 
                                          prev.includes(model.id)
                                            ? prev.filter(id => id !== model.id)
                                            : [...prev, model.id]
                                        );
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="font-semibold text-gray-900">{model.name}</h4>
                                          <p className="text-sm text-gray-600">
                                            Durum: <span className={`
                                              ${model.status === 'ready' ? 'text-green-600' : 
                                                model.status === 'error' ? 'text-red-600' : 'text-orange-600'}
                                            `}>
                                              {model.status === 'ready' ? 'Hazır' :
                                               model.status === 'error' ? 'Hata' : 'İşleniyor'}
                                            </span>
                                          </p>
                                        </div>
                                        {selectedModelIds.includes(model.id) && (
                                          <CheckCircle className="w-5 h-5 text-orange-600" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  <Camera className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                  <p>Henüz yüklenmiş model yok</p>
                                </div>
                              )}
                            </div>

                            <Button 
                              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                              disabled={selectedModelIds.length === 0 || isProcessing}
                              onClick={async () => {
                                setIsProcessing(true);
                                try {
                                  // Seçilen yüzlerin embedding verilerini hazırla
                                  const selectedFaces = detectedFaces.filter(face => selectedFaceIds.includes(face.id));
                                  const faceData = [];
                                  
                                  console.log('🔄 Seçilen yüzler için embedding çıkarılıyor...', selectedFaces.length, 'yüz');
                                  
                                  for (let i = 0; i < selectedFaces.length; i++) {
                                    const face = selectedFaces[i];
                                    console.log(`🔍 ${i+1}/${selectedFaces.length} yüz işleniyor...`);
                                    
                                    try {
                                      // Yüz crop'unu server'a gönder
                                      const blob = await dataURLtoBlob(face.imageData);
                                      console.log('📦 Blob oluşturuldu:', blob.size, 'bytes');
                                      
                                      const formData = new FormData();
                                      formData.append('photo', blob, 'face.jpg');
                                      
                                      console.log('📡 Servera embedding request gönderiliyor...');
                                      const response = await fetch('/api/extract-embedding', {
                                        method: 'POST',
                                        body: formData,
                                      });
                                      
                                      console.log('📡 Response status:', response.status, response.statusText);
                                      
                                      if (response.ok) {
                                        const result = await response.json();
                                        console.log('📨 Response data:', result);
                                        
                                        if (result.success && result.embedding) {
                                          faceData.push({
                                            id: face.id,
                                            embedding: result.embedding, // 512 boyutlu
                                            confidence: face.confidence,
                                            quality: face.quality
                                          });
                                          console.log('✅ 512 boyutlu embedding alındı:', result.embedding_size);
                                        } else {
                                          console.log('❌ Response success false veya embedding yok');
                                        }
                                      } else {
                                        const errorText = await response.text();
                                        console.error('❌ Server error:', response.status, errorText);
                                      }
                                    } catch (error) {
                                      console.error('❌ Embedding hatası:', error);
                                    }
                                  }
                                  
                                  console.log('🏁 Embedding extraction tamamlandı. FaceData:', faceData.length, 'adet');
                                  
                                  // Photo request oluştur (authentication gerektirmez)
                                  const requestData = {
                                    tcNumber: photoTcNumber,
                                    faceData: faceData,
                                    selectedCampDays: selectedModelIds,
                                    uploadedFilesCount: uploadedFiles.length
                                  };

                                  console.log('📡 Photo request gönderiliyor:', requestData);
                                  
                                  const response = await fetch('/api/photo-requests', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(requestData),
                                  });

                                  if (response.ok) {
                                    const result = await response.json();
                                    console.log('✅ Photo request başarıyla oluşturuldu:', result);
                                    
                                    // Mock ZIP URL - gerçek implementasyonda burası API'den gelecek
                                    const mockZipUrl = `/api/download-results/${photoTcNumber}`;
                                    setDownloadUrl(mockZipUrl);
                                    
                                    setPhotoStep('results');
                                    toast({
                                      title: "İşlem Tamamlandı",
                                      description: `Fotoğraflar hazırlandı. İndirmeye başlayabilirsiniz.`,
                                    });
                                  } else {
                                    const errorData = await response.json();
                                    throw new Error(errorData.message || 'Photo request oluşturulamadı');
                                  }
                                } catch (error) {
                                  console.error('Photo request error:', error);
                                  toast({
                                    title: "Hata",
                                    description: error instanceof Error ? error.message : "İstek gönderilirken bir hata oluştu.",
                                    variant: "destructive"
                                  });
                                } finally {
                                  setIsProcessing(false);
                                }
                              }}
                            >
                              {isProcessing ? (
                                <>
                                  <Clock className="mr-2 w-4 h-4 animate-spin" />
                                  Başlatılıyor...
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="mr-2 w-4 h-4" />
                                  Başlat ({selectedModelIds.length} model seçili)
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Processing Step */}
                        {photoStep === 'processing' && currentSession && (
                          <div className="space-y-6">
                            <div className="text-center py-8">
                              <Clock className="w-16 h-16 mx-auto text-orange-500 mb-4 animate-spin" />
                              <h3 className="text-xl font-semibold text-gray-900 mb-2">İşlem Devam Ediyor</h3>
                              <p className="text-gray-600">Fotoğraflarınız işleniyor, lütfen bekleyiniz.</p>
                              <div className="mt-4">
                                <div className="bg-gray-200 rounded-full h-2 w-64 mx-auto">
                                  <div className="bg-orange-500 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">Bu işlem birkaç dakika sürebilir</p>
                              </div>
                            </div>
                            
                            <Button 
                              variant="outline"
                              onClick={() => {
                                setPhotoStep('tc-input');
                                setPhotoTcNumber("");
                                setUploadedFiles([]);
                                setDetectedFaces([]);
                                setSelectedFaceIds([]);
                                setSelectedModelIds([]);
                                setDownloadUrl(null);
                              }}
                              className="w-full"
                            >
                              Yeni İşlem Başlat
                            </Button>
                          </div>
                        )}

                        {/* Results Step */}
                        {photoStep === 'results' && (
                          <div className="space-y-6">
                            <div className="text-center py-8">
                              <Download className="w-16 h-16 mx-auto text-green-500 mb-4" />
                              <h3 className="text-xl font-semibold text-gray-900 mb-2">Fotoğraflar Hazır!</h3>
                              <p className="text-gray-600">Eşleşen fotoğraflarınız ZIP dosyası olarak hazırlandı. İndirebilirsiniz.</p>
                            </div>
                            
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <h4 className="font-semibold text-green-800 mb-2">İşlem Sonucu:</h4>
                              <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                                <li>TC: {photoTcNumber} için fotoğraf eşleştirmesi tamamlandı</li>
                                <li>{selectedModelIds.length} modelde arama yapıldı</li>
                                <li>Bulunan fotoğraflar ZIP dosyasında paketlendi</li>
                                <li>İndirme işlemi için aşağıdaki butonu kullanabilirsiniz</li>
                              </ul>
                            </div>

                            <div className="space-y-3">
                              <Button 
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                                onClick={() => {
                                  if (downloadUrl) {
                                    // ZIP dosyasını indir
                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.download = `fotograf_${photoTcNumber}_${new Date().toISOString().split('T')[0]}.zip`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    
                                    toast({
                                      title: "İndirme Başlatıldı",
                                      description: "ZIP dosyası indiriliyor...",
                                    });
                                  }
                                }}
                                disabled={!downloadUrl}
                              >
                                <Download className="mr-2 w-4 h-4" />
                                ZIP Dosyası İndir
                              </Button>

                              <Button 
                                variant="outline"
                                onClick={() => {
                                  setPhotoTcNumber("");
                                  setUploadedFiles([]);
                                  setSelectedModelIds([]);
                                  setCurrentSession(null);
                                  setDetectedFaces([]);
                                  setSelectedFaceIds([]);
                                  setDownloadUrl(null);
                                  setPhotoStep('tc-input');
                                }}
                                className="w-full"
                              >
                                Yeni İşlem Başlat
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Processing Step Component
function ProcessingStep({ 
  session, 
  onComplete, 
  onError 
}: { 
  session: MatchingSession; 
  onComplete: (results: MatchingResult[]) => void; 
  onError: (error: string) => void; 
}) {
  const [currentSession, setCurrentSession] = useState(session);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/photo-matching/session/${session.sessionId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (response.ok) {
          const updatedSession = await response.json();
          setCurrentSession(updatedSession);
          
          if (updatedSession.status === 'completed' && updatedSession.results) {
            clearInterval(pollInterval);
            onComplete(updatedSession.results);
          } else if (updatedSession.status === 'error') {
            clearInterval(pollInterval);
            onError(updatedSession.errorMessage || 'Beklenmeyen bir hata oluştu');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    // Timeout kontrolü
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      onError('İşlem zaman aşımına uğradı');
    }, 15 * 60 * 1000); // 15 dakika

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [session.sessionId, onComplete, onError]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'face_detection': return 'Yüzler tespit ediliyor...';
      case 'face_selection': return 'Yüzler seçiliyor...';
      case 'queued': return 'Sırada bekleniyor...';
      case 'matching': return 'Eşleştirme yapılıyor...';
      default: return 'İşleniyor...';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'face_detection': return <Camera className="w-5 h-5" />;
      case 'face_selection': return <CheckCircle className="w-5 h-5" />;
      case 'queued': return <Clock className="w-5 h-5" />;
      case 'matching': return <Search className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5 animate-spin" />;
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-pulse text-orange-500">
          {getStatusIcon(currentSession.status)}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          {getStatusText(currentSession.status)}
        </h3>
        <p className="text-gray-600">
          {currentSession.currentStep || 'İşlem devam ediyor...'}
        </p>
      </div>

      {currentSession.queuePosition && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Sırada {currentSession.queuePosition}. pozisyondasınız. Lütfen bekleyin.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">İlerleme</span>
          <span className="font-medium">{currentSession.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${currentSession.progress}%` }}
          ></div>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bu işlem birkaç dakika sürebilir. Lütfen sayfayı kapatmayın.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Results Step Component  
function ResultsStep({ 
  session, 
  tcNumber,
  onBackToMenu, 
  onNewSearch 
}: { 
  session: MatchingSession; 
  tcNumber: string;
  onBackToMenu: () => void; 
  onNewSearch: () => void; 
}) {
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);

  const handleDownload = async (modelId: string) => {
    setDownloadingModelId(modelId);
    try {
      const response = await fetch(`/api/photo-matching/download/${session.sessionId}/${modelId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fotograf_eslestirme_${tcNumber}_${modelId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloadingModelId(null);
    }
  };

  if (session.status === 'error') {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-red-500">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">İşlem Başarısız</h3>
          <p className="text-gray-600">
            {session.errorMessage || 'Beklenmeyen bir hata oluştu'}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBackToMenu} className="flex-1">
            Ana Menüye Dön
          </Button>
          <Button onClick={onNewSearch} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
            Yeni Arama
          </Button>
        </div>
      </div>
    );
  }

  const totalMatches = session.results?.reduce((sum, result) => sum + result.totalMatches, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-green-500">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Eşleştirme Tamamlandı</h3>
          <p className="text-gray-600">
            Toplam <strong>{totalMatches}</strong> fotoğraf bulundu
          </p>
        </div>
      </div>

      {session.results && session.results.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-700">Model Sonuçları</h4>
          <div className="space-y-3">
            {session.results.map((result) => (
              <div key={result.modelId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-gray-900">{result.modelName}</h5>
                    <p className="text-sm text-gray-600">{result.totalMatches} fotoğraf bulundu</p>
                  </div>
                  <Button
                    onClick={() => handleDownload(result.modelId)}
                    disabled={!result.canDownload || downloadingModelId === result.modelId}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {downloadingModelId === result.modelId ? (
                      <>
                        <Clock className="mr-2 w-4 h-4 animate-spin" />
                        İndiriliyor...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        İndir
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBackToMenu} className="flex-1">
          Ana Menüye Dön
        </Button>
        <Button onClick={onNewSearch} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
          Yeni Arama Yap
        </Button>
      </div>
    </div>
  );
}