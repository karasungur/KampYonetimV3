import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import AnswerModal from "@/components/modals/answer-modal";
import type { AnswerWithDetails } from "@shared/schema";

export default function ResponsesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerWithDetails | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: answers = [], isLoading } = useQuery<AnswerWithDetails[]>({
    queryKey: user?.role === 'moderator' ? ["/api/answers/my"] : ["/api/answers"],
    queryFn: async () => {
      const endpoint = user?.role === 'moderator' ? '/api/answers/my' : '/api/answers';
      const response = await fetch(endpoint, {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch answers');
      return response.json();
    },
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: async (answerId: string) => {
      const response = await fetch(`/api/answers/${answerId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete answer');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/answers/my"] });
      toast({
        title: "Başarılı",
        description: "Cevap silindi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Cevap silinemedi",
        variant: "destructive",
      });
    },
  });

  // Group answers by question
  const groupedAnswers = answers.reduce((acc, answer) => {
    const questionId = answer.questionId;
    if (!acc[questionId]) {
      acc[questionId] = {
        question: answer.questionText || 'Bilinmeyen soru',
        answers: [],
      };
    }
    acc[questionId].answers.push(answer);
    return acc;
  }, {} as Record<string, { question: string; answers: AnswerWithDetails[] }>);

  const handleEdit = (answer: AnswerWithDetails) => {
    setSelectedAnswer(answer);
    setShowAnswerModal(true);
  };

  const handleDelete = (answerId: string) => {
    if (confirm('Bu cevabı silmek istediğinizden emin misiniz?')) {
      deleteAnswerMutation.mutate(answerId);
    }
  };

  const handleAddAnswer = (questionId: string, questionText: string) => {
    // Create a mock question object for the modal
    const mockQuestion = {
      id: questionId,
      text: questionText,
      type: 'general' as const,
      assignedTables: null,
      createdBy: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedAnswer(null);
    setShowAnswerModal(true);
  };

  if (user?.role !== 'moderator') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="ak-text">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-64">
        <Header title="Cevaplarım" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Cevaplarım</h2>
            <div className="bg-ak-yellow/10 px-4 py-2 rounded-lg">
              <span className="ak-yellow font-medium">
                {user?.tableNumber ? `Masa ${user.tableNumber}` : 'Masa Atanmamış'} - Toplam {answers.length} cevap
              </span>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center ak-gray">Yükleniyor...</div>
              </CardContent>
            </Card>
          ) : Object.keys(groupedAnswers).length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center ak-gray">Henüz cevap verdiğiniz soru bulunmuyor</div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {Object.entries(groupedAnswers).map(([questionId, group]) => (
                <Card key={questionId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-lg font-semibold ak-text">{group.question}</h4>
                        <p className="text-sm ak-gray mt-1">
                          Cevaplandı: {new Date(group.answers[0]?.createdAt).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Badge className="bg-green-100 text-green-800">
                          {group.answers.length} Cevap
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {group.answers.map((answer, index) => (
                        <div key={answer.id} className="bg-ak-light-gray p-4 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium ak-text">Cevap #{index + 1}</h5>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(answer)}
                                className="text-ak-blue hover:text-ak-blue-dark"
                              >
                                <Edit size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(answer.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          <p className="ak-gray mb-2">{answer.text}</p>
                          <p className="text-xs ak-gray">
                            Eklenme: {new Date(answer.createdAt).toLocaleString('tr-TR')}
                            {answer.updatedAt !== answer.createdAt && (
                              <span className="ml-2">
                                | Güncelleme: {new Date(answer.updatedAt).toLocaleString('tr-TR')}
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      onClick={() => handleAddAnswer(questionId, group.question)}
                      className="mt-4 bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                    >
                      <Plus className="mr-2" size={16} />
                      Ek Cevap Ekle
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <AnswerModal
        isOpen={showAnswerModal}
        onClose={() => {
          setShowAnswerModal(false);
          setSelectedAnswer(null);
        }}
        answer={selectedAnswer}
        question={selectedAnswer ? {
          id: selectedAnswer.questionId,
          text: selectedAnswer.questionText || '',
          type: 'general' as const,
          assignedTables: null,
          createdBy: '',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } : null}
      />
    </div>
  );
}
