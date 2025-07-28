import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { setAuthHeader } from "@/lib/auth-utils";
import type { QuestionWithStats, AnswerWithDetails } from "@shared/schema";

interface AnswerModalProps {
  isOpen: boolean;
  onClose: () => void;
  question?: QuestionWithStats | null;
  answer?: AnswerWithDetails | null;
}

export default function AnswerModal({ isOpen, onClose, question, answer }: AnswerModalProps) {
  const [text, setText] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (answer) {
      setText(answer.text);
    } else {
      setText("");
    }
  }, [answer]);

  const createAnswerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create answer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/answers/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({
        title: "Başarılı",
        description: "Cevap başarıyla eklendi",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Cevap eklenemedi",
        variant: "destructive",
      });
    },
  });

  const updateAnswerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/answers/${answer!.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update answer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/answers/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({
        title: "Başarılı",
        description: "Cevap başarıyla güncellendi",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Cevap güncellenemedi",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      toast({
        title: "Hata",
        description: "Cevap metni gereklidir",
        variant: "destructive",
      });
      return;
    }

    if (!question) {
      toast({
        title: "Hata",
        description: "Soru bilgisi bulunamadı",
        variant: "destructive",
      });
      return;
    }

    const data = {
      questionId: question.id,
      text: text.trim(),
      orderIndex: answer?.orderIndex || 1,
    };

    if (answer) {
      updateAnswerMutation.mutate(data);
    } else {
      createAnswerMutation.mutate(data);
    }
  };

  const handleClose = () => {
    setText("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="ak-text">
            {answer ? 'Cevap Düzenle' : 'Cevap Ekle'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-4 p-4 bg-ak-light-gray rounded-lg">
          <h4 className="font-medium ak-text mb-2">Soru:</h4>
          <p className="ak-gray">{question?.text || 'Soru metni yüklenemedi'}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="ak-text font-medium">Cevabınız</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
              placeholder="Cevabınızı detaylı şekilde yazınız..."
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              İptal
            </Button>
            <Button 
              type="submit" 
              className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
              disabled={createAnswerMutation.isPending || updateAnswerMutation.isPending}
            >
              {answer ? 'Güncelle' : 'Cevap Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
