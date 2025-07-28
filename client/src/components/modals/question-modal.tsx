import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { setAuthHeader } from "@/lib/auth-utils";
import type { QuestionWithStats } from "@shared/schema";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  question?: QuestionWithStats | null;
}

export default function QuestionModal({ isOpen, onClose, question }: QuestionModalProps) {
  const [text, setText] = useState("");
  const [type, setType] = useState<"general" | "specific">("general");
  const [assignedTables, setAssignedTables] = useState<number[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sample table numbers - in real app, this would come from API
  const tableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  useEffect(() => {
    if (question) {
      setText(question.text);
      setType(question.type);
      setAssignedTables(question.assignedTables as number[] || []);
    } else {
      setText("");
      setType("general");
      setAssignedTables([]);
    }
  }, [question]);

  const createQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create question');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({
        title: "Başarılı",
        description: "Soru başarıyla oluşturuldu",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Soru oluşturulamadı",
        variant: "destructive",
      });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/questions/${question!.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update question');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({
        title: "Başarılı",
        description: "Soru başarıyla güncellendi",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Soru güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      toast({
        title: "Hata",
        description: "Soru metni gereklidir",
        variant: "destructive",
      });
      return;
    }

    if (type === "specific" && assignedTables.length === 0) {
      toast({
        title: "Hata",
        description: "Özel soru için en az bir masa seçmelisiniz",
        variant: "destructive",
      });
      return;
    }

    const data = {
      text,
      type,
      assignedTables: type === "specific" ? assignedTables : null,
    };

    if (question) {
      updateQuestionMutation.mutate(data);
    } else {
      createQuestionMutation.mutate(data);
    }
  };

  const handleTableChange = (tableNumber: number, checked: boolean) => {
    if (checked) {
      setAssignedTables(prev => [...prev, tableNumber]);
    } else {
      setAssignedTables(prev => prev.filter(t => t !== tableNumber));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="ak-text">
            {question ? 'Soru Düzenle' : 'Yeni Soru Ekle'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="ak-text font-medium">Soru Metni</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
              placeholder="Soru metnini giriniz..."
              required
            />
          </div>
          
          <div>
            <Label className="ak-text font-medium">Soru Türü</Label>
            <RadioGroup value={type} onValueChange={(value: "general" | "specific") => setType(value)}>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="general" id="general" />
                <Label htmlFor="general" className="ak-text">Genel (Tüm masalara açık)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specific" id="specific" />
                <Label htmlFor="specific" className="ak-text">Özel (Belirli masalara)</Label>
              </div>
            </RadioGroup>
          </div>
          
          {type === "specific" && (
            <div>
              <Label className="ak-text font-medium">Masa Seçimi</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {tableNumbers.map((tableNumber) => (
                  <div key={tableNumber} className="flex items-center space-x-2">
                    <Checkbox
                      id={`table-${tableNumber}`}
                      checked={assignedTables.includes(tableNumber)}
                      onCheckedChange={(checked) => handleTableChange(tableNumber, checked as boolean)}
                    />
                    <Label htmlFor={`table-${tableNumber}`} className="ak-text">
                      Masa {tableNumber}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button 
              type="submit" 
              className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
              disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
            >
              {question ? 'Güncelle' : 'Soru Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
