import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  UserCheck, 
  Calendar, 
  Camera, 
  Share2, 
  Users, 
  Clock,
  MapPin,
  Phone,
  ExternalLink,
  Construction,
  ArrowLeft
} from "lucide-react";
import { 
  SiX, 
  SiInstagram, 
  SiYoutube, 
  SiFacebook, 
  SiLinkedin, 
  SiTiktok,
  SiTelegram,
  SiWhatsapp
} from "react-icons/si";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useLocation } from "wouter";
import backgroundImage from "@assets/GK-KAMP LOGOTYPE -BACKROUND - Düzenlendi_1754227727579.png";
import akPartiLogo from "@assets/akpartilogo_1753719301210.png";

interface MenuSettings {
  moderatorLoginEnabled: boolean;
  programFlowEnabled: boolean;
  photosEnabled: boolean;
  socialMediaEnabled: boolean;
  teamEnabled: boolean;
  moderatorLoginTitle: string;
  programFlowTitle: string;
  photosTitle: string;
  socialMediaTitle: string;
  teamTitle: string;
  mainTitle: string;
  mainSlogan: string;
  campTitle: string;
  systemTitle: string;
}

interface ProgramEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
}

interface SocialMediaAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUrl: string;
  displayOrder: number;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  phoneNumber: string | null;
  email: string | null;
  displayOrder: number;
}

type ActiveSection = 'program' | 'social' | 'team' | null;

export default function MainMenuPage() {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  const { data: menuSettings } = useQuery<MenuSettings>({
    queryKey: ["/api/menu-settings"],
  });

  const { data: programEvents } = useQuery<ProgramEvent[]>({
    queryKey: ["/api/program-events"],
    enabled: menuSettings?.programFlowEnabled || false,
  });

  const { data: socialMediaAccounts } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social-media-accounts"],
    enabled: menuSettings?.socialMediaEnabled || false,
  });

  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    enabled: menuSettings?.teamEnabled || false,
  });

  // Eğer hiçbir menü aktif değilse, otomatik olarak giriş sayfasına yönlendir
  if (menuSettings && !menuSettings.moderatorLoginEnabled && 
      !menuSettings.programFlowEnabled && !menuSettings.photosEnabled && 
      !menuSettings.socialMediaEnabled && !menuSettings.teamEnabled) {
    navigate("/login");
    return null;
  }

  const handleModeratorLogin = () => {
    navigate("/login");
  };

  const handlePhoneCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleSocialMediaClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSectionClick = (section: ActiveSection) => {
    setActiveSection(section);
  };

  const handleBackToMenu = () => {
    setActiveSection(null);
  };

  const getSocialMediaIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    
    if (platformLower.includes('twitter') || platformLower.includes('x')) {
      return <SiX className="w-5 h-5" />;
    }
    if (platformLower.includes('instagram')) {
      return <SiInstagram className="w-5 h-5" />;
    }
    if (platformLower.includes('youtube')) {
      return <SiYoutube className="w-5 h-5" />;
    }
    if (platformLower.includes('facebook')) {
      return <SiFacebook className="w-5 h-5" />;
    }
    if (platformLower.includes('linkedin')) {
      return <SiLinkedin className="w-5 h-5" />;
    }
    if (platformLower.includes('tiktok')) {
      return <SiTiktok className="w-5 h-5" />;
    }
    if (platformLower.includes('telegram')) {
      return <SiTelegram className="w-5 h-5" />;
    }
    if (platformLower.includes('whatsapp')) {
      return <SiWhatsapp className="w-5 h-5" />;
    }
    
    // Default icon for unknown platforms
    return <Share2 className="w-5 h-5" />;
  };

  if (!menuSettings) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="animate-pulse text-white text-xl bg-black/30 backdrop-blur-sm px-6 py-3 rounded-2xl">Menü yükleniyor...</div>
      </div>
    );
  }

  // Ana menü içeriği
  const renderMainMenu = () => (
    <>
      {/* Header with Logo Space */}
      <div className="text-center mb-8">
        {/* Logo */}
        <img 
          src={akPartiLogo} 
          alt="AK Parti" 
          className="w-28 h-28 md:w-32 md:h-32 mx-auto mb-6 object-contain"
        />
        
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {menuSettings?.mainTitle || "AK Parti Gençlik Kolları"}
        </h1>
        <h2 className="text-lg md:text-xl text-white/95 mb-4 font-semibold">
          {menuSettings?.mainSlogan || "Milletin Gücüyle SINIRLARI AŞAN LİDERLİK"}
        </h2>
        <div className="text-sm text-white/80 mb-2">
          {menuSettings?.campTitle || "İrade, İstikamet ve İstişare Kampı"}
        </div>
        <div className="text-xs text-white/70">
          {menuSettings?.systemTitle || "Yönetim Sistemi"}
        </div>
      </div>

      {/* Mobile Optimized Menu Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-sm md:max-w-md mx-auto mb-8 md:mb-0">
        {/* Moderatör Girişi */}
        {menuSettings.moderatorLoginEnabled && (
          <div className="aspect-square cursor-pointer" onClick={handleModeratorLogin}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-3 md:p-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2 md:mb-3">
                <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.moderatorLoginTitle}
              </div>
            </div>
          </div>
        )}

        {/* Program Akışı */}
        {menuSettings.programFlowEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('program')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:bg-orange-600 transition-colors">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.programFlowTitle}
              </div>
            </div>
          </div>
        )}

        {/* Fotoğraflar */}
        {menuSettings.photosEnabled && (
          <div className="aspect-square">
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:bg-orange-600 transition-colors">
                <Camera className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.photosTitle}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Yakında
              </div>
            </div>
          </div>
        )}

        {/* Sosyal Medya */}
        {menuSettings.socialMediaEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('social')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:bg-orange-600 transition-colors">
                <Share2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.socialMediaTitle}
              </div>
            </div>
          </div>
        )}

        {/* Ekibimiz */}
        {menuSettings.teamEnabled && (
          <div className="aspect-square" onClick={() => handleSectionClick('team')}>
            <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:bg-orange-600 transition-colors">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                {menuSettings.teamTitle}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="text-center mt-12">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 inline-block">
          <p className="text-white/90 text-sm font-medium">
            © 2025 AK Parti Gençlik Kolları Genel Sekreterlik
          </p>
          <p className="text-white/70 text-xs mt-1">
            Tüm hakları saklıdır
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div 
      className="min-h-screen p-4 bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="max-w-4xl mx-auto py-4 md:py-8 flex-1 flex flex-col justify-center md:justify-start">
        {!activeSection ? renderMainMenu() : (
          <div className="animate-in slide-in-from-right-4 duration-300">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                onClick={handleBackToMenu}
                className="bg-white/20 hover:bg-white/30 text-white border-white/40 backdrop-blur-sm"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ana Menüye Dön
              </Button>
            </div>
            
            {/* Full Screen Content */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xl min-h-[70vh]">

              {/* Program Content */}
              {activeSection === 'program' && menuSettings.programFlowEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Calendar className="w-6 h-6" />
                      Program Detayları
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {programEvents && programEvents.length > 0 ? (
                        programEvents.map((event) => (
                          <div key={event.id} className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-100">
                            <div className="flex items-start gap-4">
                              <Clock className="w-5 h-5 text-orange-600 mt-1" />
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 text-lg mb-2">
                                  {event.title}
                                </h4>
                                <p className="text-sm text-gray-600 mb-2">
                                  {format(new Date(event.eventDate), "d MMMM yyyy, HH:mm", { locale: tr })}
                                </p>
                                {event.location && (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                    <MapPin className="w-4 h-4" />
                                    {event.location}
                                  </div>
                                )}
                                {event.description && (
                                  <p className="text-sm text-gray-600">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg">
                            Henüz program bilgisi eklenmemiş
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

              {/* Social Media Content */}
              {activeSection === 'social' && menuSettings.socialMediaEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Share2 className="w-6 h-6" />
                      Sosyal Medya Hesapları
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {socialMediaAccounts && socialMediaAccounts.length > 0 ? (
                        socialMediaAccounts
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((account) => (
                            <Button
                              key={account.id}
                              variant="outline"
                              className="justify-between hover:bg-orange-500 hover:text-white transition-all duration-200 rounded-xl border-orange-200 h-auto py-4"
                              onClick={() => handleSocialMediaClick(account.accountUrl)}
                            >
                              <div className="flex items-center gap-3">
                                {getSocialMediaIcon(account.platform)}
                                <span className="text-sm">
                                  <strong>{account.platform}:</strong> {account.accountName}
                                </span>
                              </div>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          ))
                      ) : (
                        <div className="col-span-full text-center py-12">
                          <Share2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg">
                            Henüz sosyal medya hesabı eklenmemiş
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

              {/* Team Content */}
              {activeSection === 'team' && menuSettings.teamEnabled && (
                <>
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Users className="w-6 h-6" />
                      Ekip Üyeleri
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teamMembers && teamMembers.length > 0 ? (
                        teamMembers
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((member) => (
                            <div key={member.id} className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-100">
                              <h4 className="font-semibold text-gray-900 text-base mb-2">
                                {member.firstName} {member.lastName}
                              </h4>
                              <p className="text-sm text-orange-600 font-medium mb-3">
                                {member.position}
                              </p>
                              {member.phoneNumber && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-sm h-8 px-3 flex items-center gap-2 hover:bg-green-50 hover:border-green-500 rounded-lg w-full justify-center"
                                  onClick={() => handlePhoneCall(member.phoneNumber!)}
                                >
                                  <Phone className="w-4 h-4" />
                                  {member.phoneNumber}
                                </Button>
                              )}
                            </div>
                          ))
                      ) : (
                        <div className="col-span-full text-center py-12">
                          <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg">
                            Henüz ekip üyesi eklenmemiş
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}