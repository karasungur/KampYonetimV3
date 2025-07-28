import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { setAuthHeader } from "@/lib/auth-utils";
import type { User } from "@shared/schema";

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function EditUserModal({ isOpen, onClose, user }: EditUserModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tcNumber, setTcNumber] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"moderator" | "genelbaskan" | "genelsekreterlik">("moderator");
  const [tableNumber, setTableNumber] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setTcNumber(user.tcNumber);
      setRole(user.role);
      setTableNumber(user.tableNumber?.toString() || "");
      setPassword(""); // Always clear password field
    }
  }, [user]);

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Başarılı",
        description: "Kullanıcı başarıyla güncellendi",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Hata",
        description: error.message || "Kullanıcı güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !tcNumber.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen tüm zorunlu alanları doldurun",
        variant: "destructive",
      });
      return;
    }

    const data: any = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      tcNumber: tcNumber.trim(),
      role,
    };

    // Only include password if provided
    if (password.trim()) {
      data.password = password.trim();
    }

    // Only include tableNumber for moderators
    if (role === 'moderator' && tableNumber) {
      data.tableNumber = parseInt(tableNumber);
    } else {
      data.tableNumber = null;
    }

    updateUserMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Kullanıcı Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Ad</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ad"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Soyad</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Soyad"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="tcNumber">TC Kimlik No</Label>
            <Input
              id="tcNumber"
              value={tcNumber}
              onChange={(e) => setTcNumber(e.target.value)}
              placeholder="TC Kimlik No"
              maxLength={11}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">Şifre (Boş bırakılırsa değişmez)</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Yeni şifre"
            />
          </div>
          
          <div>
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderatör</SelectItem>
                <SelectItem value="genelbaskan">Genel Başkan</SelectItem>
                <SelectItem value="genelsekreterlik">Genel Sekreterlik</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {role === 'moderator' && (
            <div>
              <Label htmlFor="tableNumber">Masa Numarası</Label>
              <Input
                id="tableNumber"
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Masa numarası"
                min="1"
              />
            </div>
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}