type FooterProps = {
  variant?: 'light' | 'dark';
};

export function Footer({ variant = 'light' }: FooterProps) {
  const isDark = variant === 'dark';
  
  return (
    <footer className={`border-t-4 ${isDark ? 'border-white/20 bg-black' : 'border-black bg-white'}`}>
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10 mb-12">
          <div className="space-y-4 max-w-md">
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>Rekky</div>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              Share only with the people that matter.
              Private vaults, sealed AI, and circles that decide what leaves the room.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className={`uppercase tracking-[0.35em] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              Contact
            </p>
            <p className={isDark ? 'text-white' : 'text-gray-900'}>hello@rekky.app</p>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              No public roadmaps, email if you need us!
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`border-t pt-8 ${isDark ? 'border-white/20' : 'border-gray-200'}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              © 2025 Rekky. All rights reserved.
            </div>

            <p className={`text-xs uppercase tracking-[0.35em] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              No ads · No viral loops
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

