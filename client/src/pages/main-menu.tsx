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
  Construction
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
    setActiveSection(activeSection === section ? null : section);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-yellow-500">
        <div className="animate-pulse text-white text-xl">Menü yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-500 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header with Logo Space */}
        <div className="text-center mb-8">
          {/* Logo space - kullanıcı arka plan resmini ekleyecek */}
          <div className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <div className="text-white font-bold text-2xl">AK</div>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
            AK Parti Gençlik Kolları
          </h1>
          <h2 className="text-lg md:text-xl text-white/95 mb-4 font-semibold">
            Milletin Gücüyle SINIRLARI AŞAN LİDERLİK
          </h2>
          <div className="text-sm text-white/80 mb-2">
            İrade, İstikamet ve İstişare Kampı
          </div>
          <div className="text-xs text-white/70">
            Yönetim Sistemi
          </div>
        </div>

        {/* iOS Style Menu Grid - 3x3 Layout */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto">
          {/* Moderatör Girişi */}
          {menuSettings.moderatorLoginEnabled && (
            <div className="aspect-square cursor-pointer" onClick={handleModeratorLogin}>
              <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mb-3">
                  <UserCheck className="w-6 h-6 text-white" />
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
              <div className={`bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-4 cursor-pointer group ${
                activeSection === 'program' ? 'ring-2 ring-orange-400 bg-white' : ''
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                  activeSection === 'program' ? 'bg-orange-600' : 'bg-orange-500 group-hover:bg-orange-600'
                }`}>
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                  {menuSettings.programFlowTitle}
                </div>
                {programEvents && programEvents.length > 0 && (
                  <div className="text-xs text-orange-600 mt-1 font-bold">
                    {programEvents.length} etkinlik
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fotoğraflar */}
          {menuSettings.photosEnabled && (
            <div className="aspect-square">
              <div className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-4 cursor-pointer group">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-600 transition-colors">
                  <Camera className="w-6 h-6 text-white" />
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
              <div className={`bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-4 cursor-pointer group ${
                activeSection === 'social' ? 'ring-2 ring-orange-400 bg-white' : ''
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                  activeSection === 'social' ? 'bg-orange-600' : 'bg-orange-500 group-hover:bg-orange-600'
                }`}>
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                  {menuSettings.socialMediaTitle}
                </div>
                {socialMediaAccounts && socialMediaAccounts.length > 0 && (
                  <div className="text-xs text-orange-600 mt-1 font-bold">
                    {socialMediaAccounts.length} hesap
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ekibimiz */}
          {menuSettings.teamEnabled && (
            <div className="aspect-square" onClick={() => handleSectionClick('team')}>
              <div className={`bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-0 rounded-2xl h-full flex flex-col items-center justify-center p-4 cursor-pointer group ${
                activeSection === 'team' ? 'ring-2 ring-orange-400 bg-white' : ''
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                  activeSection === 'team' ? 'bg-orange-600' : 'bg-orange-500 group-hover:bg-orange-600'
                }`}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-xs font-medium text-gray-700 text-center leading-tight">
                  {menuSettings.teamTitle}
                </div>
                {teamMembers && teamMembers.length > 0 && (
                  <div className="text-xs text-orange-600 mt-1 font-bold">
                    {teamMembers.length} üye
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Content Area - Only show active section */}
        {activeSection === 'program' && menuSettings.programFlowEnabled && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 duration-300">
            <Card className="bg-white/95 backdrop-blur-sm border-0 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Program Detayları
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    onClick={() => setActiveSection(null)}
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {programEvents && programEvents.length > 0 ? (
                    programEvents.map((event) => (
                      <div key={event.id} className="bg-gradient-to-r from-orange-50 to-yellow-50 p-3 rounded-xl border border-orange-100">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-orange-600 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">
                              {event.title}
                            </h4>
                            <p className="text-xs text-gray-600 mb-1">
                              {format(new Date(event.eventDate), "d MMMM yyyy, HH:mm", { locale: tr })}
                            </p>
                            {event.location && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </div>
                            )}
                            {event.description && (
                              <p className="text-xs text-gray-600">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      Henüz program bilgisi eklenmemiş
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'social' && menuSettings.socialMediaEnabled && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 duration-300">
            <Card className="bg-white/95 backdrop-blur-sm border-0 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Sosyal Medya Hesapları
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    onClick={() => setActiveSection(null)}
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-2">
                  {socialMediaAccounts && socialMediaAccounts.length > 0 ? (
                    socialMediaAccounts
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((account) => (
                        <Button
                          key={account.id}
                          variant="outline"
                          className="justify-between hover:bg-orange-500 hover:text-white transition-all duration-200 rounded-xl border-orange-200"
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
                    <p className="text-gray-500 text-center py-4 text-sm">
                      Henüz sosyal medya hesabı eklenmemiş
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'team' && menuSettings.teamEnabled && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 duration-300">
            <Card className="bg-white/95 backdrop-blur-sm border-0 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Ekip Üyeleri
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    onClick={() => setActiveSection(null)}
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teamMembers && teamMembers.length > 0 ? (
                    teamMembers
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((member) => (
                        <div key={member.id} className="bg-gradient-to-r from-orange-50 to-yellow-50 p-3 rounded-xl border border-orange-100">
                          <h4 className="font-semibold text-gray-900 text-sm mb-1">
                            {member.firstName} {member.lastName}
                          </h4>
                          <p className="text-xs text-orange-600 font-medium mb-2">
                            {member.position}
                          </p>
                          {member.phoneNumber && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 flex items-center gap-1 hover:bg-green-50 hover:border-green-500 rounded-lg"
                              onClick={() => handlePhoneCall(member.phoneNumber!)}
                            >
                              <Phone className="w-3 h-3" />
                              {member.phoneNumber}
                            </Button>
                          )}
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      Henüz ekip üyesi eklenmemiş
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
      </div>
    </div>
  );
}