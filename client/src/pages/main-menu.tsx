import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import * as faceapi from '@vladmandic/face-api';
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
  Image as ImageIcon
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

interface CampDay {
  id: string;
  dayName: string;
  dayDate: string;
  modelPath: string | null;
  modelStatus: string;
  photoCount: number;
  faceCount: number;
  lastTrainedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [photoEmail, setPhotoEmail] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoStep, setPhotoStep] = useState<'tc-input' | 'existing-request' | 'new-request'>('tc-input');
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [tcError, setTcError] = useState("");
  const [selectedCampDays, setSelectedCampDays] = useState<string[]>([]);
  
  // Face detection states
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [faceDetectionProgress, setFaceDetectionProgress] = useState(0);
  const [isFaceDetectionReady, setIsFaceDetectionReady] = useState(false);
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

  // Initialize face-api for detection and UI
  useEffect(() => {
    const initializeFaceAPI = async () => {
      try {
        const modelPath = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js-models@master';
        
        console.log('Loading face-api models...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(`${modelPath}/tiny_face_detector`);
        console.log('Tiny face detector loaded');
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(`${modelPath}/face_landmark_68`);
        console.log('Face landmarks loaded');
        
        setIsFaceDetectionReady(true);
        console.log('Face-API initialized successfully');
      } catch (error) {
        console.error('Face-API initialization error:', error);
        setIsFaceDetectionReady(false);
      }
    };
    
    initializeFaceAPI();
  }, []);
  
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
      toast({
        title: "Uyarı", 
        description: "Yüz tanıma sistemi henüz hazır değil. Fotoğraflar yüklendi ancak yüz tespiti yapılamadı.",
        variant: "destructive",
      });
      return [];
    }

    setIsDetectingFaces(true);
    setFaceDetectionProgress(0);
    const allFaces: DetectedFace[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      
      try {
        setFaceDetectionProgress(Math.round((fileIndex / files.length) * 100));
        
        // Use face-api.js for detection and UI
        const img = await loadImageFromFile(file);
        const detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        for (let faceIndex = 0; faceIndex < detections.length; faceIndex++) {
          const detection = detections[faceIndex];
          const croppedFace = await cropFaceFromImage(img, detection.detection.box);
          const quality = assessFaceQuality(detection);
          
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
            descriptor: undefined, // Will be filled server-side during submission
            originalFile: file,
            isSelected: false,
          };
          
          allFaces.push(face);
        }
        
      } catch (error) {
        console.error(`Face detection error for file ${file.name}:`, error);
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

  const { data: campDays } = useQuery<CampDay[]>({
    queryKey: ["/api/camp-days"],
    enabled: menuSettings?.photosEnabled || false,
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
    setPhotoEmail("");
    setUploadedFiles([]);
    setIsProcessing(false);
    setPhotoStep('tc-input');
    setExistingRequest(null);
    setIsCheckingStatus(false);
    setTcError("");
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
        <div className="animate-pulse text-white text-xl bg-black/30 backdrop-blur-sm px-6 py-3 rounded-2xl">Menü yükleniyor...</div>
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
                            </div>
                            
                            <Button 
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3"
                              disabled={photoTcNumber.length !== 11 || tcError !== "" || isCheckingStatus}
                              onClick={async () => {
                                setIsCheckingStatus(true);
                                try {
                                  // Check for existing request
                                  const response = await fetch(`/api/photo-requests/check/${photoTcNumber}`);
                                  if (response.ok) {
                                    const requestData = await response.json();
                                    if (requestData.exists) {
                                      setExistingRequest(requestData.request);
                                      setPhotoStep('existing-request');
                                    } else {
                                      setPhotoStep('new-request');
                                    }
                                  } else {
                                    setPhotoStep('new-request');
                                  }
                                } catch (error) {
                                  console.error('Error checking request:', error);
                                  setPhotoStep('new-request');
                                } finally {
                                  setIsCheckingStatus(false);
                                }
                              }}
                            >
                              {isCheckingStatus ? (
                                <>
                                  <Clock className="mr-2 w-4 h-4 animate-spin" />
                                  Kontrol ediliyor...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 w-4 h-4" />
                                  Devam Et
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Existing Request Status */}
                        {photoStep === 'existing-request' && existingRequest && (
                          <div className="space-y-4">
                            <Alert>
                              <Clock className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Mevcut İsteğiniz:</strong> {photoTcNumber} TC numarası için zaten bir fotoğraf isteği bulunuyor.
                              </AlertDescription>
                            </Alert>
                            
                            <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-700">Durum:</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  existingRequest.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  existingRequest.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                  existingRequest.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {existingRequest.status === 'completed' ? 'Tamamlandı' :
                                   existingRequest.status === 'processing' ? 'İşleniyor' :
                                   existingRequest.status === 'failed' ? 'Başarısız' : 'Bekliyor'}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-700">E-posta:</span>
                                <span className="text-gray-600">{existingRequest.email}</span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-700">Oluşturma Tarihi:</span>
                                <span className="text-gray-600">
                                  {new Date(existingRequest.createdAt).toLocaleString('tr-TR')}
                                </span>
                              </div>
                              
                              {existingRequest.matchedPhotosCount !== undefined && (
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-gray-700">Bulunan Fotoğraf:</span>
                                  <span className="text-gray-600">{existingRequest.matchedPhotosCount} adet</span>
                                </div>
                              )}
                              
                              {existingRequest.errorMessage && (
                                <div className="text-red-600 text-sm">
                                  <strong>Hata:</strong> {existingRequest.errorMessage}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-3">
                              <Button 
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  setPhotoTcNumber("");
                                  setPhotoStep('tc-input');
                                  setExistingRequest(null);
                                }}
                              >
                                <ArrowLeft className="mr-2 w-4 h-4" />
                                Geri Dön
                              </Button>
                              
                              {existingRequest.status === 'failed' && (
                                <Button 
                                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                                  onClick={() => {
                                    setPhotoStep('new-request');
                                  }}
                                >
                                  Yeni İstek Oluştur
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* New Request Form */}
                        {photoStep === 'new-request' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                              <div>
                                <span className="font-medium text-green-800">TC: {photoTcNumber}</span>
                                <p className="text-sm text-green-600">Yeni fotoğraf isteği oluşturuluyor</p>
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
                            
                            {/* Kamp günü seçimi */}
                            <div>
                              <Label className="text-gray-700 font-medium">
                                Aranacak Kamp Günleri
                              </Label>
                              <p className="text-sm text-gray-600 mb-3">
                                Fotoğraflarınızın aranacağı kamp günlerini seçiniz:
                              </p>
                              <div className="space-y-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                {campDays && campDays.length > 0 ? (
                                  campDays.map((day) => (
                                    <div key={day.id} className="flex items-center space-x-3">
                                      <Checkbox
                                        id={`day-${day.id}`}
                                        checked={selectedCampDays.includes(day.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedCampDays([...selectedCampDays, day.id]);
                                          } else {
                                            setSelectedCampDays(selectedCampDays.filter(id => id !== day.id));
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`day-${day.id}`}
                                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span>{day.dayName}</span>
                                          <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              day.modelStatus === 'ready' ? 'bg-green-100 text-green-700' :
                                              day.modelStatus === 'training' ? 'bg-yellow-100 text-yellow-700' :
                                              day.modelStatus === 'error' ? 'bg-red-100 text-red-700' :
                                              'bg-gray-100 text-gray-700'
                                            }`}>
                                              {day.modelStatus === 'ready' && 'Hazır'}
                                              {day.modelStatus === 'training' && 'Eğitiliyor'}
                                              {day.modelStatus === 'error' && 'Hata'}
                                              {day.modelStatus === 'not_trained' && 'Eğitilmedi'}
                                            </span>
                                            <span>{day.photoCount} fotoğraf</span>
                                          </div>
                                        </div>
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-gray-500 py-4 text-center">
                                    Henüz kamp günü eklenmemiş
                                  </div>
                                )}
                              </div>
                              {selectedCampDays.length === 0 && (
                                <p className="text-xs text-red-600 mt-1">
                                  En az bir kamp günü seçmelisiniz
                                </p>
                              )}
                            </div>
                            
                            <div>
                              <Label htmlFor="photo-email" className="text-gray-700 font-medium">
                                E-posta Adresi
                              </Label>
                              <Input
                                id="photo-email"
                                type="email"
                                value={photoEmail}
                                onChange={(e) => setPhotoEmail(e.target.value)}
                                className="mt-1 focus:ring-orange-500 focus:border-orange-500"
                                placeholder="ornek@email.com"
                              />
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
                                <strong>Nasıl çalışır:</strong> Referans fotoğraflarınızı yükledikten sonra, sistem kamp fotoğrafları arasında sizin bulunduğunuz fotoğrafları bulup e-posta adresinize gönderecektir.
                              </AlertDescription>
                            </Alert>

                            <Button 
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3"
                              disabled={!photoEmail || uploadedFiles.length === 0 || selectedCampDays.length === 0 || isProcessing || (detectedFaces.length > 0 && selectedFaceIds.length === 0)}
                              onClick={async () => {
                                setIsProcessing(true);
                                try {
                                  // Seçilen yüzlerin embedding verilerini hazırla
                                  const selectedFaces = detectedFaces.filter(face => selectedFaceIds.includes(face.id));
                                  // Seçilen yüzleri server'a gönderip 512 boyutlu embedding al
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
                                  

                                  // Debug: Embedding çıkarıldı mı kontrol et
                                  console.log('🔬 Face embedding debug:');
                                  console.log('- Seçilen yüz sayısı:', selectedFaces.length);
                                  console.log('- Face data sayısı:', faceData.length);
                                  faceData.forEach((face, idx) => {
                                    console.log(`- Face ${idx + 1}: embedding boyutu=${face.embedding.length}, confidence=${face.confidence}`);
                                  });

                                  // API'ye fotoğraf isteği gönder
                                  await apiRequest('POST', '/api/photo-requests', {
                                    tcNumber: photoTcNumber,
                                    email: photoEmail,
                                    selectedCampDays: selectedCampDays,
                                    faceData: faceData,
                                    uploadedFilesCount: uploadedFiles.length
                                  });
                                  
                                  toast({
                                    title: "İstek Alındı",
                                    description: `Fotoğraf eşleştirme işlemi başlatıldı. ${selectedCampDays.length} kamp günü seçildi. Sonuçlar e-posta adresinize gönderilecektir.`,
                                  });
                                  
                                  // Form'u sıfırla
                                  setPhotoTcNumber("");
                                  setPhotoEmail("");
                                  setUploadedFiles([]);
                                  setSelectedCampDays([]);
                                  handleBackToMenu();
                                } catch (error) {
                                  toast({
                                    title: "Hata",
                                    description: "İstek gönderilirken bir hata oluştu. Lütfen tekrar deneyin.",
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
                                  İşlem başlatılıyor...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 w-4 h-4" />
                                  Fotoğrafları Bul ve Gönder
                                </>
                              )}
                            </Button>
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