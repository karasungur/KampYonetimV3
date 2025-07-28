import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, MessageSquare } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import AnswerModal from "@/components/modals/answer-modal";
import type { QuestionWithStats, AnswerWithDetails } from "@shared/schema";

export default function ModeratorQuestionsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithStats | null>(null);
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: questions = [], isLoading } = useQuery<QuestionWithStats[]>({
    queryKey: ["/api/questions"],
    queryFn: async () => {
      const response = await fetch('/api/questions', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch questions');
      return response.json();
    },
    enabled: user?.role === 'moderator',
  });

  const { data: myAnswers = [] } = useQuery<AnswerWithDetails[]>({
    queryKey: ["/api/answers/my"],
    queryFn: async () => {
      const response = await fetch('/api/answers/my', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch my answers');
      return response.json();
    },
    enabled: user?.role === 'moderator',
  });

  const sendFeedbackMutation = useMutation({
    mutationFn: async ({ questionId, message }: { questionId: string; message: string }) => {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...setAuthHeader(),
        },
        body: JSON.stringify({ questionId, message }),
      });
      if (!response.ok) throw new Error('Failed to send feedback');
    },
    onSuccess: () => {
      toast({
        title: "Başarılı",
        description: "Geri bildirim gönderildi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Geri bildirim gönderilemedi",
        variant: "destructive",
      });
    },
  });

  const handleAddAnswer = (question: QuestionWithStats) => {
    setSelectedQuestion(question);
    setShowAnswerModal(true);
  };

  const handleViewAnswers = async (questionId: string) => {
    setShowAnswers(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleSendFeedback = (question: QuestionWithStats) => {
    const message = prompt('Geri bildirim mesajınız:');
    if (message && message.trim()) {
      sendFeedbackMutation.mutate({ questionId: question.id, message: message.trim() });
    }
  };

  const getAnswersForQuestion = (questionId: string) => {
    return myAnswers.filter(answer => answer.questionId === questionId);
  };

  const hasAnswered = (questionId: string) => {
    return myAnswers.some(answer => answer.questionId === questionId);
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
        <Header title="Atanmış Sorularım" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Atanmış Sorularım</h2>
            <div className="bg-ak-yellow/10 px-4 py-2 rounded-lg">
              <span className="ak-yellow font-medium">
                {user?.tableNumber ? `Masa ${user.tableNumber}` : 'Masa Atanmamış'}
              </span>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center ak-gray">Yükleniyor...</div>
              </CardContent>
            </Card>
          ) : questions.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center ak-gray">Size atanmış soru bulunmuyor</div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {questions.map((question) => {
                const questionAnswers = getAnswersForQuestion(question.id);
                const answered = hasAnswered(question.id);
                
                return (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-semibold ak-text mb-2">
                            {question.text}
                          </h4>
                          <div className="flex items-center space-x-3 text-sm ak-gray">
                            <Badge 
                              className={question.type === 'general' 
                                ? 'bg-ak-blue/10 text-ak-blue' 
                                : 'bg-ak-yellow/10 text-ak-yellow'
                              }
                            >
                              {question.type === 'general' ? 'Genel Soru' : 'Özel Soru'}
                            </Badge>
                            <span>Eklenme: {new Date(question.createdAt).toLocaleDateString('tr-TR')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm ak-gray">Cevap Durumu</p>
                          <Badge className={answered ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {answered ? 'Cevaplandı' : 'Beklemede'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex space-x-3 mb-4">
                        <Button 
                          onClick={() => handleAddAnswer(question)}
                          className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                        >
                          <Plus className="mr-2" size={16} />
                          Cevap Ekle
                        </Button>
                        {answered && (
                          <Button 
                            onClick={() => handleViewAnswers(question.id)}
                            className="bg-ak-blue hover:bg-ak-blue-dark text-white"
                          >
                            <Eye className="mr-2" size={16} />
                            Cevapları Görüntüle ({questionAnswers.length})
                          </Button>
                        )}
                        <Button 
                          onClick={() => handleSendFeedback(question)}
                          variant="outline"
                          className="border-gray-500 text-gray-500 hover:bg-gray-50"
                        >
                          <MessageSquare className="mr-2" size={16} />
                          Geri Bildirim Gönder
                        </Button>
                      </div>

                      {/* Show answers if expanded */}
                      {showAnswers[question.id] && questionAnswers.length > 0 && (
                        <div className="space-y-3">
                          {questionAnswers.map((answer, index) => (
                            <div key={answer.id} className="bg-ak-light-gray p-4 rounded-lg">
                              <h5 className="font-medium ak-text mb-2">Cevap #{index + 1}</h5>
                              <p className="ak-gray">{answer.text}</p>
                              <p className="text-xs ak-gray mt-2">
                                Eklenme: {new Date(answer.createdAt).toLocaleString('tr-TR')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <AnswerModal
        isOpen={showAnswerModal}
        onClose={() => {
          setShowAnswerModal(false);
          setSelectedQuestion(null);
        }}
        question={selectedQuestion}
      />
    </div>
  );
}
