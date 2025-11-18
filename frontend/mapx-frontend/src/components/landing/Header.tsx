import { Button } from "../ui/button";
import { useNavigate, Link } from "react-router-dom";
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
          {!isAuthenticated ? (
            <Link to="/landing" className="cursor-pointer">
              <span className={variant === 'dark' ? 'text-xl font-bold text-white' : 'text-xl font-bold text-black'}>REKKY</span>
            </Link>
          ) : (
          <span className={variant === 'dark' ? 'text-xl font-bold text-white' : 'text-xl font-bold text-black'}>REKKY</span>
          )}
        </div>

        {/* Navigation intentionally minimal for landing */}

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


