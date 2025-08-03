import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LogIn } from "lucide-react";
import { useLocation } from "wouter";
import akPartiLogo from "@assets/akpartilogo_1753719301210.png";

export default function LoginPage() {
  const [tcNumber, setTcNumber] = useState("");
  const [password, setPassword] = useState("");
  const { user, login, isLoggingIn } = useAuth();
  const [, navigate] = useLocation();

  // Giriş başarılı olduğunda ana sayfaya yönlendir
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ tcNumber, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ak-yellow/10 to-ak-blue/10">
      <div className="max-w-md w-full mx-4">
        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-6">
            <img 
              src={akPartiLogo} 
              alt="AK Parti" 
              className="w-32 h-32 mx-auto mb-6 object-contain"
            />
            <h2 className="text-2xl font-bold ak-text">İrade, İstikamet ve İstişare Kampı</h2>
            <p className="ak-gray mt-2">AK Parti Gençlik Kolları Genel Sekreterlik</p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="tcno" className="ak-text font-medium">
                  T.C. Kimlik Numarası
                </Label>
                <Input
                  id="tcno"
                  type="text"
                  maxLength={11}
                  value={tcNumber}
                  onChange={(e) => setTcNumber(e.target.value)}
                  className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
                  placeholder="11 haneli T.C. kimlik numaranız"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="ak-text font-medium">
                  Şifre
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 focus:ring-ak-yellow focus:border-ak-yellow"
                  placeholder="Şifrenizi giriniz"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-ak-yellow hover:bg-ak-yellow-dark text-white font-semibold py-3"
                disabled={isLoggingIn}
              >
                <LogIn className="mr-2" size={16} />
                {isLoggingIn ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
