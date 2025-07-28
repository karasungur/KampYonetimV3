import { Users } from "lucide-react";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-32 h-32 mx-auto mb-6 bg-ak-yellow rounded-full flex items-center justify-center animate-pulse">
          <Users className="text-white text-4xl" size={64} />
        </div>
        <h1 className="text-2xl font-bold ak-text mb-4">AK Parti Gençlik Kolları</h1>
        <p className="ak-gray">İstişare Kampı Yönetim Sistemi</p>
        <div className="mt-8 p-4 border-2 border-dashed border-ak-yellow rounded-lg">
          <p className="ak-gray text-sm">GIF Animasyonu Yüklenecek</p>
          <p className="text-xs ak-gray mt-2">Animasyon bitiminde giriş ekranına yönlendirilecek</p>
        </div>
      </div>
    </div>
  );
}
