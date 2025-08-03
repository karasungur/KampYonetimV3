import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Upload, 
  Save, 
  Trash2, 
  Move, 
  Eye, 
  Monitor, 
  Smartphone,
  Plus,
  Settings,
  Palette,
  Type,
  MousePointer,
  Grid,
  ImageIcon
} from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  createdAt: string;
}

interface PageLayout {
  id: string;
  name: string;
  backgroundImageDesktop: string | null;
  backgroundImageMobile: string | null;
  backgroundPosition: string;
  backgroundSize: string;
  backgroundColor: string;
  isActive: boolean;
  elements?: PageElement[];
}

interface PageElement {
  id: string;
  layoutId: string;
  type: 'text' | 'button' | 'logo' | 'slogan';
  content: string;
  elementKey: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fontSize: string;
  fontWeight: string;
  color: string;
  backgroundColor: string | null;
  borderRadius: string;
  displayOrder: number;
  isVisible: boolean;
  deviceType: 'desktop' | 'mobile' | 'both';
}

interface ElementFormData {
  type: 'text' | 'button' | 'logo' | 'slogan';
  content: string;
  elementKey: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fontSize: string;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  borderRadius: string;
  deviceType: 'desktop' | 'mobile' | 'both';
}

export default function PageLayoutPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<PageElement | null>(null);
  const [showElementDialog, setShowElementDialog] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [elementFormData, setElementFormData] = useState<ElementFormData>({
    type: 'text',
    content: '',
    elementKey: '',
    positionX: 100,
    positionY: 100,
    width: 200,
    height: 50,
    fontSize: '16px',
    fontWeight: 'normal',
    color: '#000000',
    backgroundColor: '',
    borderRadius: '8px',
    deviceType: 'both',
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has permission to access this page
  if (user?.role !== 'genelsekreterlik') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  const { data: layouts = [], isLoading: layoutsLoading } = useQuery<PageLayout[]>({
    queryKey: ["/api/page-layouts"],
    queryFn: async () => {
      const response = await fetch('/api/page-layouts', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch layouts');
      return response.json();
    },
  });

  const { data: uploadedFiles = [] } = useQuery<UploadedFile[]>({
    queryKey: ["/api/uploaded-files"],
    queryFn: async () => {
      const response = await fetch('/api/uploaded-files', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
  });

  const selectedLayoutData = layouts.find(l => l.id === selectedLayout);

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: setAuthHeader(),
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uploaded-files"] });
      toast({
        title: "Başarılı",
        description: "Dosya yüklendi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Dosya yüklenemedi",
        variant: "destructive",
      });
    },
  });

  const createLayoutMutation = useMutation({
    mutationFn: async (layoutData: Partial<PageLayout>) => {
      const response = await fetch('/api/page-layouts', {
        method: 'POST',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(layoutData),
      });
      if (!response.ok) throw new Error('Failed to create layout');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
      toast({
        title: "Başarılı",
        description: "Sayfa düzeni oluşturuldu",
      });
    },
  });

  const updateLayoutMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PageLayout> }) => {
      const response = await fetch(`/api/page-layouts/${id}`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update layout');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
      toast({
        title: "Başarılı",
        description: "Sayfa düzeni güncellendi",
      });
    },
  });

  const createElement = useMutation({
    mutationFn: async (elementData: Partial<PageElement>) => {
      const response = await fetch('/api/page-elements', {
        method: 'POST',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...elementData,
          layoutId: selectedLayout,
        }),
      });
      if (!response.ok) throw new Error('Failed to create element');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
      setShowElementDialog(false);
      resetElementForm();
      toast({
        title: "Başarılı",
        description: "Öğe eklendi",
      });
    },
  });

  const updateElementPosition = useMutation({
    mutationFn: async ({ id, positionX, positionY }: { id: string; positionX: number; positionY: number }) => {
      const response = await fetch(`/api/page-elements/${id}/position`, {
        method: 'PUT',
        headers: {
          ...setAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ positionX, positionY }),
      });
      if (!response.ok) throw new Error('Failed to update position');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
    },
  });

  const deleteElement = useMutation({
    mutationFn: async (elementId: string) => {
      const response = await fetch(`/api/page-elements/${elementId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete element');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
      toast({
        title: "Başarılı",
        description: "Öğe silindi",
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate(file);
    }
  };

  const createNewLayout = () => {
    createLayoutMutation.mutate({
      name: `Düzen ${layouts.length + 1}`,
      backgroundColor: '#f8f9fa',
      backgroundPosition: 'center center',
      backgroundSize: 'cover',
      isActive: false,
    });
  };

  const handleElementDragStart = (e: React.MouseEvent, element: PageElement) => {
    setIsDragging(true);
    setSelectedElement(element);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleElementDrag = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement) return;
    
    const previewArea = e.currentTarget.getBoundingClientRect();
    const newX = e.clientX - previewArea.left - dragOffset.x;
    const newY = e.clientY - previewArea.top - dragOffset.y;
    
    // Update element position immediately for smooth dragging
    setSelectedElement({
      ...selectedElement,
      positionX: Math.max(0, Math.min(newX, previewArea.width - selectedElement.width)),
      positionY: Math.max(0, Math.min(newY, previewArea.height - selectedElement.height)),
    });
  };

  const handleElementDragEnd = () => {
    if (isDragging && selectedElement) {
      updateElementPosition.mutate({
        id: selectedElement.id,
        positionX: selectedElement.positionX,
        positionY: selectedElement.positionY,
      });
    }
    setIsDragging(false);
    setSelectedElement(null);
  };

  const resetElementForm = () => {
    setElementFormData({
      type: 'text',
      content: '',
      elementKey: '',
      positionX: 100,
      positionY: 100,
      width: 200,
      height: 50,
      fontSize: '16px',
      fontWeight: 'normal',
      color: '#000000',
      backgroundColor: '',
      borderRadius: '8px',
      deviceType: 'both',
    });
  };

  const handleCreateElement = () => {
    createElement.mutate(elementFormData);
  };

  if (layoutsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-ak-yellow">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="flex-1 lg:ml-64">
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          title="Sayfa Düzeni Yönetimi"
        />
        
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold ak-text">Sayfa Düzeni Yönetimi</h1>
                <p className="ak-gray mt-2">
                  Ana sayfa görünümünü ve öğe konumlarını yönetin
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={createNewLayout}
                  className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Düzen
                </Button>
              </div>
            </div>

            <Tabs defaultValue="layouts" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="layouts">Düzen Yönetimi</TabsTrigger>
                <TabsTrigger value="files">Dosya Yönetimi</TabsTrigger>
                <TabsTrigger value="preview">Önizleme</TabsTrigger>
              </TabsList>

              <TabsContent value="layouts" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Layout List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Grid className="w-5 h-5" />
                        Mevcut Düzenler
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {layouts.map((layout) => (
                        <div
                          key={layout.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedLayout === layout.id
                              ? 'border-ak-yellow bg-ak-yellow/10'
                              : layout.isActive
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedLayout(layout.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{layout.name}</span>
                            {layout.isActive && (
                              <Badge variant="default" className="bg-green-600">
                                Aktif
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {layout.elements?.length || 0} öğe
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Layout Editor */}
                  {selectedLayoutData && (
                    <div className="lg:col-span-2 space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Düzen Ayarları
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Arkaplan Rengi</Label>
                              <Input
                                type="color"
                                value={selectedLayoutData.backgroundColor}
                                onChange={(e) => {
                                  updateLayoutMutation.mutate({
                                    id: selectedLayoutData.id,
                                    updates: { backgroundColor: e.target.value }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <Label>Arkaplan Boyutu</Label>
                              <Select
                                value={selectedLayoutData.backgroundSize}
                                onValueChange={(value) => {
                                  updateLayoutMutation.mutate({
                                    id: selectedLayoutData.id,
                                    updates: { backgroundSize: value }
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cover">Kapla</SelectItem>
                                  <SelectItem value="contain">Sığdır</SelectItem>
                                  <SelectItem value="auto">Otomatik</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Masaüstü Arkaplan</Label>
                              <Select
                                value={selectedLayoutData.backgroundImageDesktop || ""}
                                onValueChange={(value) => {
                                  updateLayoutMutation.mutate({
                                    id: selectedLayoutData.id,
                                    updates: { backgroundImageDesktop: value || null }
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Görsel seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Görsel yok</SelectItem>
                                  {uploadedFiles.map((file) => (
                                    <SelectItem key={file.id} value={file.id}>
                                      {file.originalName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Mobil Arkaplan</Label>
                              <Select
                                value={selectedLayoutData.backgroundImageMobile || ""}
                                onValueChange={(value) => {
                                  updateLayoutMutation.mutate({
                                    id: selectedLayoutData.id,
                                    updates: { backgroundImageMobile: value || null }
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Görsel seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Görsel yok</SelectItem>
                                  {uploadedFiles.map((file) => (
                                    <SelectItem key={file.id} value={file.id}>
                                      {file.originalName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Elements Management */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Type className="w-5 h-5" />
                              Sayfa Öğeleri
                            </div>
                            <Dialog open={showElementDialog} onOpenChange={setShowElementDialog}>
                              <DialogTrigger asChild>
                                <Button size="sm" className="bg-ak-yellow hover:bg-ak-yellow-dark text-white">
                                  <Plus className="w-4 h-4 mr-2" />
                                  Öğe Ekle
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Yeni Öğe Ekle</DialogTitle>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Öğe Türü</Label>
                                      <Select
                                        value={elementFormData.type}
                                        onValueChange={(value: any) => 
                                          setElementFormData(prev => ({ ...prev, type: value }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="text">Metin</SelectItem>
                                          <SelectItem value="button">Buton</SelectItem>
                                          <SelectItem value="logo">Logo</SelectItem>
                                          <SelectItem value="slogan">Slogan</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Aygıt</Label>
                                      <Select
                                        value={elementFormData.deviceType}
                                        onValueChange={(value: any) => 
                                          setElementFormData(prev => ({ ...prev, deviceType: value }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="both">Her İkisi</SelectItem>
                                          <SelectItem value="desktop">Masaüstü</SelectItem>
                                          <SelectItem value="mobile">Mobil</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div>
                                    <Label>İçerik</Label>
                                    <Textarea
                                      value={elementFormData.content}
                                      onChange={(e) => 
                                        setElementFormData(prev => ({ ...prev, content: e.target.value }))
                                      }
                                      placeholder="Öğe içeriği"
                                    />
                                  </div>

                                  <div>
                                    <Label>Anahtar</Label>
                                    <Input
                                      value={elementFormData.elementKey}
                                      onChange={(e) => 
                                        setElementFormData(prev => ({ ...prev, elementKey: e.target.value }))
                                      }
                                      placeholder="Örn: main_title, team_button"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>X Pozisyon</Label>
                                      <Input
                                        type="number"
                                        value={elementFormData.positionX}
                                        onChange={(e) => 
                                          setElementFormData(prev => ({ ...prev, positionX: Number(e.target.value) }))
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label>Y Pozisyon</Label>
                                      <Input
                                        type="number"
                                        value={elementFormData.positionY}
                                        onChange={(e) => 
                                          setElementFormData(prev => ({ ...prev, positionY: Number(e.target.value) }))
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Genişlik</Label>
                                      <Input
                                        type="number"
                                        value={elementFormData.width}
                                        onChange={(e) => 
                                          setElementFormData(prev => ({ ...prev, width: Number(e.target.value) }))
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label>Yükseklik</Label>
                                      <Input
                                        type="number"
                                        value={elementFormData.height}
                                        onChange={(e) => 
                                          setElementFormData(prev => ({ ...prev, height: Number(e.target.value) }))
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Yazı Rengi</Label>
                                      <Input
                                        type="color"
                                        value={elementFormData.color}
                                        onChange={(e) => 
                                          setElementFormData(prev => ({ ...prev, color: e.target.value }))
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label>Arkaplan Rengi</Label>
                                      <Input
                                        type="color"
                                        value={elementFormData.backgroundColor}
                                        onChange={(e) => 
                                          setElementFormData(prev => ({ ...prev, backgroundColor: e.target.value }))
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-4">
                                    <Button
                                      onClick={handleCreateElement}
                                      disabled={createElement.isPending}
                                      className="flex-1 bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                                    >
                                      {createElement.isPending ? 'Ekleniyor...' : 'Ekle'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setShowElementDialog(false);
                                        resetElementForm();
                                      }}
                                    >
                                      İptal
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedLayoutData.elements?.map((element) => (
                              <div
                                key={element.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  {element.type === 'text' && <Type className="w-4 h-4 text-blue-600" />}
                                  {element.type === 'button' && <MousePointer className="w-4 h-4 text-green-600" />}
                                  {element.type === 'logo' && <ImageIcon className="w-4 h-4 text-purple-600" />}
                                  {element.type === 'slogan' && <Palette className="w-4 h-4 text-orange-600" />}
                                  <div>
                                    <span className="font-medium">{element.content}</span>
                                    <div className="text-xs text-gray-500">
                                      {element.type} • {element.positionX}x{element.positionY}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteElement.mutate(element.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            {!selectedLayoutData.elements?.length && (
                              <p className="text-gray-500 text-center py-4">
                                Bu düzende henüz öğe yok
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="files" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Dosya Yükleme
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">
                        Arkaplan görseli yüklemek için tıklayın veya dosyayı sürükleyin
                      </p>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadFileMutation.isPending}
                        className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                      >
                        {uploadFileMutation.isPending ? 'Yükleniyor...' : 'Dosya Seç'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Yüklenen Dosyalar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="border rounded-lg p-4">
                          <div className="aspect-video bg-gray-100 rounded mb-3">
                            <img
                              src={file.filePath}
                              alt={file.originalName}
                              className="w-full h-full object-cover rounded"
                            />
                          </div>
                          <p className="font-medium text-sm truncate">{file.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ))}
                      {uploadedFiles.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                          Henüz dosya yüklenmemiş
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview" className="space-y-6">
                {selectedLayoutData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-5 h-5" />
                          Düzen Önizleme
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={previewMode === 'desktop' ? 'default' : 'outline'}
                            onClick={() => setPreviewMode('desktop')}
                          >
                            <Monitor className="w-4 h-4 mr-1" />
                            Masaüstü
                          </Button>
                          <Button
                            size="sm"
                            variant={previewMode === 'mobile' ? 'default' : 'outline'}
                            onClick={() => setPreviewMode('mobile')}
                          >
                            <Smartphone className="w-4 h-4 mr-1" />
                            Mobil
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`relative border rounded-lg overflow-hidden ${
                          previewMode === 'desktop' ? 'aspect-video' : 'aspect-[9/16] max-w-sm mx-auto'
                        }`}
                        style={{
                          backgroundColor: selectedLayoutData.backgroundColor,
                          backgroundSize: selectedLayoutData.backgroundSize,
                          backgroundPosition: selectedLayoutData.backgroundPosition,
                        }}
                        onMouseMove={handleElementDrag}
                        onMouseUp={handleElementDragEnd}
                      >
                        {selectedLayoutData.elements
                          ?.filter(el => el.deviceType === 'both' || el.deviceType === previewMode)
                          .map((element) => (
                            <div
                              key={element.id}
                              className="absolute cursor-move border-2 border-dashed border-ak-yellow/50 hover:border-ak-yellow"
                              style={{
                                left: element.positionX,
                                top: element.positionY,
                                width: element.width,
                                height: element.height,
                                color: element.color,
                                backgroundColor: element.backgroundColor || undefined,
                                borderRadius: element.borderRadius,
                                fontSize: element.fontSize,
                                fontWeight: element.fontWeight,
                              }}
                              onMouseDown={(e) => handleElementDragStart(e, element)}
                            >
                              <div className="flex items-center justify-center h-full p-2 text-center text-sm">
                                {element.content}
                              </div>
                              <div className="absolute -top-6 left-0 text-xs bg-ak-yellow text-white px-2 py-1 rounded">
                                {element.type}
                              </div>
                            </div>
                          ))}
                        
                        {!selectedLayoutData.elements?.length && (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            Bu düzende henüz öğe yok
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}