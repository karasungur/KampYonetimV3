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

export default function MainMenuPage() {
  const [, navigate] = useLocation();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-yellow-500 p-4">
      <div className="max-w-6xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AK Parti Gençlik Kolları Genel Sekreterlik
          </h1>
          <h2 className="text-2xl md:text-3xl text-white/90 mb-2">
            İrade, İstikamet ve İstişare Kampı
          </h2>
          <p className="text-xl text-white/80">
            Yönetim Sistemi
          </p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Moderatör Girişi */}
          {menuSettings.moderatorLoginEnabled && (
            <Card className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 cursor-pointer transform hover:scale-105 shadow-lg hover:shadow-xl border-0"
                  onClick={handleModeratorLogin}>
              <CardHeader className="text-center pb-4">
                <UserCheck className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <CardTitle className="text-2xl text-blue-600">
                  {menuSettings.moderatorLoginTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600">
                  Sistem giriş ekranına yönlendirileceksiniz
                </p>
              </CardContent>
            </Card>
          )}

          {/* Program Akışı */}
          {menuSettings.programFlowEnabled && (
            <Card className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border-0">
              <CardHeader className="text-center pb-4">
                <Calendar className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <CardTitle className="text-2xl text-blue-600">
                  {menuSettings.programFlowTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {programEvents && programEvents.length > 0 ? (
                    programEvents.map((event) => (
                      <div key={event.id} className="bg-gradient-to-r from-blue-50 to-yellow-50 p-4 rounded-lg border border-blue-100 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <Clock className="w-5 h-5 text-blue-600 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              {event.title}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {format(new Date(event.eventDate), "d MMMM yyyy, HH:mm", { locale: tr })}
                            </p>
                            {event.location && (
                              <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
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
                    <p className="text-gray-500 text-center py-8">
                      Henüz program bilgisi eklenmemiş
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fotoğraflar */}
          {menuSettings.photosEnabled && (
            <Card className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border-0">
              <CardHeader className="text-center pb-4">
                <Camera className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <CardTitle className="text-2xl text-blue-600">
                  {menuSettings.photosTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <Construction className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 font-medium">
                    Yapım Aşamasında
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Bu bölüm ilerleyen zamanlarda hizmete açılacak
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sosyal Medya */}
          {menuSettings.socialMediaEnabled && (
            <Card className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border-0">
              <CardHeader className="text-center pb-4">
                <Share2 className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <CardTitle className="text-2xl text-blue-600">
                  {menuSettings.socialMediaTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {socialMediaAccounts && socialMediaAccounts.length > 0 ? (
                    socialMediaAccounts
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((account) => (
                        <Button
                          key={account.id}
                          variant="outline"
                          className="w-full justify-between hover:bg-blue-600 hover:text-white transition-all duration-200"
                          onClick={() => handleSocialMediaClick(account.accountUrl)}
                        >
                          <div className="flex items-center gap-3">
                            {getSocialMediaIcon(account.platform)}
                            <span>
                              <strong>{account.platform}:</strong> {account.accountName}
                            </span>
                          </div>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      Henüz sosyal medya hesabı eklenmemiş
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ekibimiz */}
          {menuSettings.teamEnabled && (
            <Card className="bg-white/95 backdrop-blur-sm hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border-0">
              <CardHeader className="text-center pb-4">
                <Users className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <CardTitle className="text-2xl text-blue-600">
                  {menuSettings.teamTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {teamMembers && teamMembers.length > 0 ? (
                    teamMembers
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((member) => (
                        <div key={member.id} className="bg-gradient-to-r from-blue-50 to-yellow-50 p-4 rounded-lg border border-blue-100 hover:shadow-md transition-shadow">
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {member.firstName} {member.lastName}
                          </h4>
                          <p className="text-sm text-blue-600 font-medium mb-2">
                            {member.position}
                          </p>
                          {member.phoneNumber && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 hover:bg-green-50 hover:border-green-500"
                              onClick={() => handlePhoneCall(member.phoneNumber!)}
                            >
                              <Phone className="w-4 h-4" />
                              {member.phoneNumber}
                            </Button>
                          )}
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      Henüz ekip üyesi eklenmemiş
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 inline-block">
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