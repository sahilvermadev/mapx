import { Button } from "../ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onSignInClick: () => void;
}

export function Header({ onSignInClick }: HeaderProps) {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-background/95 border-border">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <span className="text-xl font-semibold text-foreground">RECCE</span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
            How it Works
          </a>
          <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
            Testimonials
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center space-x-4">
          {!isAuthenticated ? (
            <Button variant="ghost" size="sm" onClick={onSignInClick}>
              Sign In
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log Out
              </Button>
              <Button size="sm" onClick={() => navigate('/map')}>
                Open App
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
