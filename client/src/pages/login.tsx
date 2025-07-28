import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, LogIn } from "lucide-react";

export default function LoginPage() {
  const [tcNumber, setTcNumber] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ tcNumber, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ak-yellow/10 to-ak-blue/10">
      <div className="max-w-md w-full mx-4">
        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-ak-yellow rounded-full flex items-center justify-center">
              <Users className="text-white text-2xl" size={32} />
            </div>
            <h2 className="text-2xl font-bold ak-text">Sisteme Giriş</h2>
            <p className="ak-gray mt-2">AK Parti Gençlik Kolları İstişare Kampı</p>
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
