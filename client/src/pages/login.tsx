import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LogIn, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import akPartiLogo from "@assets/akpartilogo_1753719301210.png";
import backgroundImage from "@assets/GK-KAMP LOGOTYPE -BACKROUND - Düzenlendi_1754227727579.png";

export default function LoginPage() {
  const [tcNumber, setTcNumber] = useState("");
  const [password, setPassword] = useState("");
  const { user, login, isLoggingIn } = useAuth();
  const [, navigate] = useLocation();
  
  const handleBack = () => {
    navigate("/");
  };

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
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Geri Butonu */}
      <div className="p-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-white hover:text-white/80 transition-colors bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Logo doğrudan mavi arka plan üzerinde */}
        <div className="mb-8">
          <img 
            src={akPartiLogo} 
            alt="AK Parti" 
            className="w-72 h-72 object-contain mx-auto"
          />
        </div>
      
      <div className="max-w-md w-full mx-4">
        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-6">
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
    </div>
  );
}
