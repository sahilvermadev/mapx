import React, { useEffect, useRef, useState } from 'react';
import { Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface ContactRevealProps {
  contact?: { phone?: string; email?: string } | null;
  className?: string; // wrapper class (positioned by parent)
  align?: 'left' | 'right'; // popover alignment relative to icon
  ariaLabel?: string;
  buttonClassName?: string; // extra/override button styling
  iconClassName?: string; // size override for the icon
}

const ContactReveal: React.FC<ContactRevealProps> = ({ contact, className, align = 'right', ariaLabel = 'Show contact information', buttonClassName, iconClassName }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const el = ref.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!contact?.phone && !contact?.email) return null;

  const popoverSideClass = align === 'left' ? 'left-0' : 'right-0';

  // Base: subtle circular hover ring in brand yellow
  const baseButtonClasses = 'rounded-full flex items-center justify-center transition-colors hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-300/40 focus:outline-none';
  const buttonClasses = [baseButtonClasses, buttonClassName || 'h-8 w-8'].join(' ').trim();
  const iconClasses = iconClassName || 'h-4 w-4';

  return (
    <div ref={ref} className={className || ''}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
        className={buttonClasses}
      >
        {contact?.phone ? <Phone className={iconClasses} /> : <Mail className={iconClasses} />}
      </button>
      {open && (
        <div className={`absolute mt-2 w-60 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm text-gray-800 ${popoverSideClass}`}>
          {contact?.phone && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="h-4 w-4" />
                <span>{contact.phone}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(contact.phone || '');
                    toast.success('Number copied to clipboard');
                  } catch {
                    // no-op
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
          )}
          {contact?.email && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="h-4 w-4" />
                <span className="truncate">{contact.email}</span>
              </div>
              <a
                href={`mailto:${contact.email}`}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              >
                Email
              </a>
            </div>
          )}
          <div className="pt-2 text-[11px] text-muted-foreground">Contact details are private to this post. Click to copy.</div>
        </div>
      )}
    </div>
  );
};

export default ContactReveal;


