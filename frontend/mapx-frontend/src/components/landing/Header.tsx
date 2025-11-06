import { Button } from "../ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";

interface HeaderProps {
  onSignInClick: () => void;
  variant?: 'light' | 'dark';
  hideNav?: boolean;
  position?: 'sticky' | 'fixed';
}

export function Header({ onSignInClick, variant = 'light', hideNav = false, position = 'sticky' }: HeaderProps) {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  return (
    <header
      className={
        `${position === 'fixed' ? 'fixed' : 'sticky'} top-0 ${position === 'fixed' ? 'left-0 right-0' : ''} z-50 w-full border-b-4 ` +
        (variant === 'dark'
          ? 'bg-black text-white border-black'
          : 'backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/95 border-black')
      }
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between relative">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <span className={variant === 'dark' ? 'text-xl font-bold text-white' : 'text-xl font-bold text-black'}>RECCE</span>
        </div>

        {/* Navigation - Centered */}
        {!hideNav && (
          <nav className="hidden md:flex items-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
            <a href="#features" className={variant === 'dark' ? 'text-white/70 hover:text-white transition-colors' : 'text-gray-600 hover:text-gray-900 transition-colors'}>
              Features
            </a>
            <a href="#how-it-works" className={variant === 'dark' ? 'text-white/70 hover:text-white transition-colors' : 'text-gray-600 hover:text-gray-900 transition-colors'}>
              How it Works
            </a>
          </nav>
        )}

        {/* CTA Buttons */}
        <div className="flex items-center space-x-4">
          {!isAuthenticated ? (
            <Button variant={variant === 'dark' ? 'secondary' : 'ghost'} size="sm" onClick={onSignInClick}>
              Sign In
            </Button>
          ) : (
            <>
              <Button variant={variant === 'dark' ? 'secondary' : 'ghost'} size="sm" onClick={logout}>
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


