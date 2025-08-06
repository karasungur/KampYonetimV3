import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: 'genelbaskan' | 'genelsekreterlik' | 'moderator';
  tableNumber?: number;
}

interface LoginCredentials {
  tcNumber: string;
  password: string;
}

export function useAuth() {
  const [showSplash, setShowSplash] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Show splash screen for 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    enabled: !showSplash,
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          localStorage.removeItem('auth_token');
          return null;
        }
        
        return response.json();
      } catch (error) {
        localStorage.removeItem('auth_token');
        return null;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
      toast({
        title: "Giriş Başarılı",
        description: "Hoş geldiniz!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Giriş Hatası",
        description: error.message || "Kimlik bilgileri geçersiz",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    },
    onSuccess: () => {
      localStorage.removeItem('auth_token');
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      toast({
        title: "Çıkış Başarılı",
        description: "Güvenle çıkış yaptınız",
      });
      // Ana sayfaya yönlendir
      window.location.href = "/";
    },
  });

  return {
    user,
    isLoading: isLoading && !showSplash,
    showSplash,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
