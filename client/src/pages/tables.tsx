import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table as TableIcon, Plus, Trash2 } from "lucide-react";
import { setAuthHeader } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Table } from "@shared/schema";

export default function TablesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableName, setNewTableName] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ["/api/tables"],
    queryFn: async () => {
      const response = await fetch('/api/tables', {
        headers: setAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch tables');
      return response.json();
    },
    enabled: user?.role === 'adminpro',
  });

  const createTableMutation = useMutation({
    mutationFn: async (data: { number: number; name?: string }) => {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: {
          ...setAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Masa oluşturulamadı');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Başarılı",
        description: "Masa başarıyla oluşturuldu",
      });
      setShowAddModal(false);
      setNewTableNumber("");
      setNewTableName("");
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
        headers: setAuthHeader(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Masa silinemedi');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Başarılı",
        description: "Masa başarıyla silindi",
      });
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddTable = () => {
    const tableNumber = parseInt(newTableNumber);
    if (isNaN(tableNumber) || tableNumber <= 0) {
      toast({
        title: "Hata",
        description: "Geçerli bir masa numarası giriniz",
        variant: "destructive",
      });
      return;
    }
    
    createTableMutation.mutate({ 
      number: tableNumber, 
      name: newTableName || undefined 
    });
  };

  if (user?.role !== 'adminpro') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-64">
        <Header title="Masa Yönetimi" onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold ak-text">Masalar</h2>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
            >
              <Plus className="mr-2" size={16} />
              Masa Ekle
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="ak-gray">Yükleniyor...</p>
            </div>
          ) : tables.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <TableIcon className="mx-auto mb-4 text-gray-300" size={48} />
                <p className="ak-gray">Henüz masa eklenmemiş.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => (
                <Card key={table.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold ak-text">Masa {table.number}</h3>
                        {table.name && (
                          <p className="text-sm ak-gray mt-1">{table.name}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTableMutation.mutate(table.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs ak-gray">
                      Oluşturulma: {new Date(table.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add Table Modal */}
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Masa Ekle</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="tableNumber">Masa Numarası *</Label>
                  <Input
                    id="tableNumber"
                    type="number"
                    min="1"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    placeholder="Örn: 1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tableName">Masa Adı (Opsiyonel)</Label>
                  <Input
                    id="tableName"
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Örn: Salon A"
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewTableNumber("");
                    setNewTableName("");
                  }}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleAddTable}
                  disabled={createTableMutation.isPending}
                  className="bg-ak-yellow hover:bg-ak-yellow-dark text-white"
                >
                  {createTableMutation.isPending ? "Ekleniyor..." : "Ekle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}