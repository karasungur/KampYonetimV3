import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { setAuthHeader } from "@/lib/auth-utils";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserModal({ isOpen, onClose }: UserModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tcNumber, setTcNumber] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"moderator" | "genelbaskan" | "genelsekreterlik">("moderator");
  const [tableNumber, setTableNumber] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Başarılı",
        description: "Kullanıcı başarıyla oluşturuldu",
      });
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Hata",
        description: error.message || "Kullanıcı oluşturulamadı",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setTcNumber("");
    setPassword("");
    setRole("moderator");
    setTableNumber("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !tcNumber.trim() || !password.trim()) {
      toast({
        title: "Hata",
        description: "Tüm alanlar gereklidir",
        variant: "destructive",
      });
      return;
    }

    if (tcNumber.length !== 11) {
      toast({
        title: "Hata",
        description: "T.C. Kimlik Numarası 11 haneli olmalıdır",
        variant: "destructive",
      });
      return;
    }

    if (role === "moderator" && !tableNumber) {
      toast({
        title: "Hata",
        description: "Moderatör için masa numarası gereklidir",
        variant: "destructive",
      });
      return;
    }

    const data = {
      firstName,
      lastName,
      tcNumber,
      password,
      role,
      tableNumber: role === "moderator" ? parseInt(tableNumber) : null,
      isActive: true,
    };

    createUserMutation.mutate(data);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="ak-text">Yeni Kullanıcı Ekle</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="ak-text font-medium">İsim</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
              required
            />
          </div>
          
          <div>
            <Label className="ak-text font-medium">Soyisim</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
              required
            />
          </div>
          
          <div>
            <Label className="ak-text font-medium">T.C. Kimlik Numarası</Label>
            <Input
              type="text"
              maxLength={11}
              value={tcNumber}
              onChange={(e) => setTcNumber(e.target.value.replace(/\D/g, ''))}
              className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
              required
            />
          </div>
          
          <div>
            <Label className="ak-text font-medium">Şifre</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
              required
            />
          </div>
          
          <div>
            <Label className="ak-text font-medium">Rol</Label>
            <Select value={role} onValueChange={(value: "moderator" | "genelbaskan" | "genelsekreterlik") => setRole(value)}>
              <SelectTrigger className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow">
                <SelectValue placeholder="Rol seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderatör</SelectItem>
                <SelectItem value="genelbaskan">Genel Başkan</SelectItem>
                <SelectItem value="genelsekreterlik">Genel Sekreterlik</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {role === "moderator" && (
            <div>
              <Label className="ak-text font-medium">Masa Numarası</Label>
              <Input
                type="number"
                min="1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
                placeholder="1-12 arası bir numara"
                required
              />
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              İptal
            </Button>
            <Button 
              type="submit" 
              className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? 'Oluşturuluyor...' : 'Kullanıcı Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
