import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Download, ChevronRight } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import AnswerModal from "@/components/modals/answer-modal";
import type { AnswerWithDetails, QuestionWithStats } from "@shared/schema";

export default function ResponsesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerWithDetails | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery<QuestionWithStats[]>({
    queryKey: ["/api/questions"],
    queryFn: async () => {
      const response = await fetch('/api/questions', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch questions');
      return response.json();
    },
  });

  const { data: answers = [], isLoading: answersLoading } = useQuery<AnswerWithDetails[]>({
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

  // Filter answers based on selected question
  const filteredAnswers = selectedQuestionId 
    ? answers.filter(answer => answer.questionId === selectedQuestionId)
    : [];

  const handleEdit = (answer: AnswerWithDetails) => {
    setSelectedAnswer(answer);
    setShowAnswerModal(true);
  };

  const handleDelete = (answerId: string) => {
    if (confirm('Bu cevabı silmek istediğinizden emin misiniz?')) {
      deleteAnswerMutation.mutate(answerId);
    }
  };

  const handleDownloadAll = async () => {
    try {
      const response = await fetch('/api/export/answers?format=csv', {
        headers: setAuthHeader(),
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tum_cevaplar_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Başarılı",
        description: "Tüm cevaplar CSV olarak indirildi",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "CSV dosyası indirilemedi",
        variant: "destructive",
      });
    }
  };

  const handleDownloadQuestion = async (questionId: string, questionText: string) => {
    try {
      const questionAnswers = answers.filter(a => a.questionId === questionId);
      
      const csv = [
        ['Soru', 'Masa No', 'Cevap', 'Cevaplayan', 'Tarih'].join(','),
        ...questionAnswers.map(answer => [
          `"${questionText}"`,
          answer.tableNumber,
          `"${answer.text.replace(/"/g, '""')}"`,
          `"${answer.userName || 'Bilinmeyen'}"`,
          new Date(answer.createdAt).toLocaleString('tr-TR')
        ].join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soru_cevaplari_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Başarılı",
        description: "Soru cevapları CSV olarak indirildi",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "CSV dosyası indirilemedi",
        variant: "destructive",
      });
    }
  };

  if (user?.role !== 'moderator' && user?.role !== 'genelbaskan' && user?.role !== 'genelsekreterlik') {
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

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);
  const isLoading = questionsLoading || answersLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-64">
        <Header title="Cevaplar" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Cevaplar</h2>
            <Button 
              onClick={handleDownloadAll}
              variant="outline"
              className="text-ak-blue hover:text-ak-blue-dark"
            >
              <Download className="mr-2" size={16} />
              Tüm Cevapları İndir
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Questions List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sorular</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 text-center ak-gray">Yükleniyor...</div>
                  ) : questions.length === 0 ? (
                    <div className="p-4 text-center ak-gray">Henüz soru bulunmuyor</div>
                  ) : (
                    <div className="divide-y">
                      {questions.map((question) => {
                        const answerCount = answers.filter(a => a.questionId === question.id).length;
                        return (
                          <button
                            key={question.id}
                            onClick={() => setSelectedQuestionId(question.id)}
                            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                              selectedQuestionId === question.id ? 'bg-ak-yellow/10' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium ak-text line-clamp-2">{question.text}</p>
                                <div className="flex items-center gap-4 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {question.type === 'general' ? 'Genel' : 'Özel'}
                                  </Badge>
                                  <span className="text-xs ak-gray">{answerCount} cevap</span>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 ak-gray mt-1 flex-shrink-0" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Selected Question Answers */}
            <div className="lg:col-span-2">
              {!selectedQuestionId ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center ak-gray">
                      Cevaplarını görmek için bir soru seçin
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">Soru</CardTitle>
                        <p className="ak-text">{selectedQuestion?.text}</p>
                      </div>
                      <Button 
                        onClick={() => handleDownloadQuestion(selectedQuestionId, selectedQuestion?.text || '')}
                        variant="outline"
                        size="sm"
                        className="text-ak-blue hover:text-ak-blue-dark"
                      >
                        <Download className="mr-2" size={14} />
                        Bu Sorunun Cevaplarını İndir
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredAnswers.length === 0 ? (
                      <div className="text-center ak-gray py-8">
                        Bu soru için henüz cevap verilmemiş
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredAnswers.map((answer, index) => (
                          <div key={answer.id} className="bg-ak-light-gray p-4 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h5 className="font-medium ak-text">
                                  Masa {answer.tableNumber} - {answer.userName || 'Bilinmeyen Kullanıcı'}
                                </h5>
                                <p className="text-sm ak-gray mt-1">
                                  {new Date(answer.createdAt).toLocaleString('tr-TR')}
                                </p>
                              </div>
                              {user?.role === 'moderator' && answer.userId === user.id && (
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
                              )}
                            </div>
                            <p className="ak-text">{answer.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {showAnswerModal && selectedQuestionId && selectedQuestion && (
        <AnswerModal
          isOpen={showAnswerModal}
          onClose={() => {
            setShowAnswerModal(false);
            setSelectedAnswer(null);
          }}
          answer={selectedAnswer}
          question={{
            id: selectedQuestion.id,
            text: selectedQuestion.text,
            type: selectedQuestion.type,
            assignedTables: selectedQuestion.assignedTables,
            createdBy: selectedQuestion.createdBy,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }}
        />
      )}
    </div>
  );
}
