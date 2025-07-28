import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import QuestionModal from "@/components/modals/question-modal";
import type { QuestionWithStats } from "@shared/schema";

export default function QuestionsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithStats | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has permission to access this page
  if (user?.role === 'moderator') {
    window.location.href = '/questions'; // This will redirect to moderator questions
    return null;
  }

  const { data: questions = [], isLoading } = useQuery<QuestionWithStats[]>({
    queryKey: ["/api/questions"],
    queryFn: async () => {
      const response = await fetch('/api/questions', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch questions');
      return response.json();
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to delete question');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({
        title: "Başarılı",
        description: "Soru silindi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Soru silinemedi",
        variant: "destructive",
      });
    },
  });

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || question.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleEdit = (question: QuestionWithStats) => {
    setEditingQuestion(question);
    setShowModal(true);
  };

  const handleDelete = (questionId: string) => {
    if (confirm('Bu soruyu silmek istediğinizden emin misiniz?')) {
      deleteQuestionMutation.mutate(questionId);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingQuestion(null);
  };

  if (user?.role !== 'adminpro') {
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
        <Header title="Soru Yönetimi" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold ak-text">Soru Yönetimi</h2>
            <Button 
              onClick={() => setShowModal(true)} 
              className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
            >
              <Plus className="mr-2" size={16} />
              Yeni Soru Ekle
            </Button>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex space-x-4">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Soru türü seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Sorular</SelectItem>
                      <SelectItem value="general">Genel Sorular</SelectItem>
                      <SelectItem value="specific">Masa Özel Sorular</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Soru ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center ak-gray">Yükleniyor...</div>
              ) : filteredQuestions.length === 0 ? (
                <div className="p-6 text-center ak-gray">Soru bulunamadı</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-ak-light-gray">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Soru
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Tür
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Cevap Sayısı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          Tarih
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ak-gray uppercase tracking-wider">
                          İşlemler
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredQuestions.map((question) => (
                        <tr key={question.id}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium ak-text max-w-md">
                              {question.text}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge 
                              variant={question.type === 'general' ? 'default' : 'secondary'}
                              className={question.type === 'general' ? 'bg-ak-blue/10 text-ak-blue' : 'bg-ak-yellow/10 text-ak-yellow'}
                            >
                              {question.type === 'general' ? 'Genel' : 'Özel'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ak-text">
                            {question.answersCount || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ak-gray">
                            {new Date(question.createdAt).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(question)}
                              className="text-ak-blue hover:text-ak-blue-dark"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(question.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <QuestionModal
        isOpen={showModal}
        onClose={handleCloseModal}
        question={editingQuestion}
      />
    </div>
  );
}
