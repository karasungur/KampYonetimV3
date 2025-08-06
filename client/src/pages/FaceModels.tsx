import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuthHeader } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Download, Trash2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { FaceModel } from "@shared/schema";

export default function FaceModels() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [googleDriveLink, setGoogleDriveLink] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch face models
  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['/api/face-models'],
    queryFn: async () => {
      const response = await fetch('/api/face-models', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch face models');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds to see status updates
  });

  // Create face model mutation
  const createModelMutation = useMutation({
    mutationFn: async (data: { name: string; googleDriveLink: string }) => {
      return apiRequest('/api/face-models', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/face-models'] });
      setIsDialogOpen(false);
      setModelName("");
      setGoogleDriveLink("");
      toast({
        title: "Başarılı",
        description: "Yeni model oluşturuldu",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Hata",
        description: error.message || "Model oluşturulurken hata oluştu",
        variant: "destructive",
      });
    },
  });

  // Download model mutation
  const downloadModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest(`/api/face-models/${modelId}/download`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/face-models'] });
      toast({
        title: "Başarılı",
        description: "İndirme işlemi başlatıldı",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Hata", 
        description: error.message || "İndirme başlatılırken hata oluştu",
        variant: "destructive",
      });
    },
  });

  // Delete model mutation
  const deleteModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest(`/api/face-models/${modelId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/face-models'] });
      toast({
        title: "Başarılı",
        description: "Model silindi",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Hata",
        description: error.message || "Model silinirken hata oluştu",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'downloading':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 mr-1 animate-spin" />İndiriliyor</Badge>;
      case 'extracting':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Açılıyor</Badge>;
      case 'ready':
        return <Badge variant="default" className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Hazır</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Hata</Badge>;
      default:
        return <Badge variant="secondary">Bilinmeyen</Badge>;
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString('tr-TR');
  };

  const handleCreateModel = () => {
    if (!modelName.trim()) {
      toast({
        title: "Hata",
        description: "Model adı gereklidir",
        variant: "destructive",
      });
      return;
    }

    if (!googleDriveLink.trim()) {
      toast({
        title: "Hata", 
        description: "Google Drive linki gereklidir",
        variant: "destructive",
      });
      return;
    }

    createModelMutation.mutate({
      name: modelName.trim(),
      googleDriveLink: googleDriveLink.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Hata</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Modeller yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Yüz Tanıma Modelleri</h1>
          <p className="text-gray-600 mt-2">
            Buffalo_l modeli ile eğitilmiş yüz tanıma veritabanlarını yönetin
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Model Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Yüz Tanıma Modeli</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="modelName">Model Adı</Label>
                <Input
                  id="modelName"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="Örn: 15 Ağustos Kampı"
                />
              </div>
              <div>
                <Label htmlFor="googleDriveLink">Google Drive ZIP Linki</Label>
                <Input
                  id="googleDriveLink"
                  value={googleDriveLink}
                  onChange={(e) => setGoogleDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  ZIP dosyası training_package/ klasörü içermelidir
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleCreateModel}
                  disabled={createModelMutation.isPending}
                >
                  {createModelMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Oluştur
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Henüz model bulunmuyor</p>
              <p className="text-gray-400 text-sm mt-2">
                Yeni bir model eklemek için yukarıdaki butonu kullanın
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Adı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İlerleme</TableHead>
                  <TableHead>Yüz Sayısı</TableHead>
                  <TableHead>Oluşturulma</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model: FaceModel) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell>{getStatusBadge(model.status)}</TableCell>
                    <TableCell>
                      {(model.status === 'downloading' || model.status === 'extracting') && (
                        <div className="space-y-1">
                          <Progress value={model.downloadProgress || 0} className="w-24" />
                          <span className="text-xs text-gray-500">
                            {model.downloadProgress || 0}%
                          </span>
                        </div>
                      )}
                      {model.status === 'ready' && (
                        <span className="text-green-600 text-sm">Tamamlandı</span>
                      )}
                      {model.status === 'error' && (
                        <span className="text-red-600 text-xs">
                          {model.errorMessage}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {model.faceCount ? `${model.faceCount} yüz` : '-'}
                    </TableCell>
                    <TableCell>{formatDate(model.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {(model.status === 'pending' || model.status === 'created' || model.status === 'error') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadModelMutation.mutate(model.id)}
                            disabled={downloadModelMutation.isPending}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            {model.status === 'error' ? 'Tekrar Dene' : 'İndir'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteModelMutation.mutate(model.id)}
                          disabled={deleteModelMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}