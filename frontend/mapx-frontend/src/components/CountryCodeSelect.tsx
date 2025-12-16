import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COMMON_COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/data/countryCodes';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { cn } from '@/lib/utils';

interface CountryCodeSelectProps {
  selectedCode?: string; // e.g., "+91"
  onSelect: (code: string) => void;
  className?: string;
}

const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  selectedCode = DEFAULT_COUNTRY_CODE,
  onSelect,
  className = '',
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES]
    ? THEMES[themeName as keyof typeof THEMES]
    : null;

  const selectedCountry = COMMON_COUNTRY_CODES.find(
    (country) => country.code === selectedCode
  ) || COMMON_COUNTRY_CODES.find(
    (country) => country.code === DEFAULT_COUNTRY_CODE
  ) || COMMON_COUNTRY_CODES[0];

  return (
    <Select value={selectedCode} onValueChange={onSelect}>
      <SelectTrigger
        className={cn(
          "h-9 md:h-10 text-sm md:text-base w-28 md:w-36 flex-shrink-0",
          className
        )}
        style={selectedTheme ? {
          backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
          borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
          color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
          boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
        } : undefined}
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            {selectedCountry.flag && (
              <span className="text-base">{selectedCountry.flag}</span>
            )}
            <span>{selectedCountry.code}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={selectedTheme ? {
          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
          borderColor: selectedTheme.borderColor || '#000000',
          boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
        } : undefined}
      >
        {COMMON_COUNTRY_CODES.map((country) => (
          <SelectItem
            key={`${country.code}-${country.isoCode}`}
            value={country.code}
            style={selectedTheme ? {
              color: selectedTheme.textPrimary || '#000000',
            } : undefined}
            className={cn(
              "hover:bg-accent/50",
              selectedTheme && "hover:bg-opacity-50"
            )}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || 'rgba(0, 0, 0, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span className="flex items-center gap-2">
              {country.flag && (
                <span className="text-base">{country.flag}</span>
              )}
              <span>{country.code}</span>
              <span className="text-muted-foreground ml-1">{country.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CountryCodeSelect;


