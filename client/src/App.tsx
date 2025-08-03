import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import SplashScreen from "@/pages/splash";
import MainMenuPage from "@/pages/main-menu";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import QuestionsPage from "@/pages/questions";
import UsersPage from "@/pages/users";
import ReportsPage from "@/pages/reports";
import FeedbackPage from "@/pages/feedback";
import LogsPage from "@/pages/logs";
import ModeratorQuestionsPage from "@/pages/moderator-questions";
import ResponsesPage from "@/pages/responses";
import TablesPage from "@/pages/tables";
import MenuSettingsPage from "@/pages/menu-settings";
import ProgramEventsPage from "@/pages/program-events";
import SocialMediaPage from "@/pages/social-media";
import TeamMembersPage from "@/pages/team-members";
import PhotosPage from "@/pages/photos";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading, showSplash } = useAuth();

  if (showSplash) {
    return <SplashScreen />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-ak-yellow">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={!user ? MainMenuPage : DashboardPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/questions" component={user?.role === 'moderator' ? ModeratorQuestionsPage : QuestionsPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/feedback" component={FeedbackPage} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/responses" component={ResponsesPage} />
      <Route path="/tables" component={TablesPage} />
      <Route path="/menu-settings" component={MenuSettingsPage} />
      <Route path="/program-events" component={ProgramEventsPage} />
      <Route path="/social-media" component={SocialMediaPage} />
      <Route path="/team-members" component={TeamMembersPage} />
      <Route path="/photos" component={PhotosPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
