import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ServiceCategoryCombobox from '@/components/ServiceCategoryCombobox';
import CityLocalitySearch from '@/components/CityLocalitySearch';
import CountryCodeSelect from '@/components/CountryCodeSelect';
import { normalizePhoneDigits, validateOptionalPhoneOrEmail } from '@/utils/validation';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { DEFAULT_COUNTRY_CODE } from '@/data/countryCodes';

interface ServiceBasicsData {
  category_id: number | null;
  name: string;
  city_location?: {
    name: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
    lat?: number;
    lng?: number;
  } | null;
  phone_country_code?: string;
  phone?: string;
  email?: string;
}

interface ServiceBasicsStepProps {
  initialData?: Partial<ServiceBasicsData>;
  onContinue: (data: ServiceBasicsData) => void;
  onBack: () => void;
}

const ServiceBasicsStep: React.FC<ServiceBasicsStepProps> = ({
  initialData = {},
  onContinue,
  onBack,
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  const [formData, setFormData] = useState<ServiceBasicsData>({
    category_id: initialData.category_id || null,
    name: initialData.name || '',
    city_location: initialData.city_location || null,
    phone_country_code: initialData.phone_country_code || DEFAULT_COUNTRY_CODE,
    phone: initialData.phone || '',
    email: initialData.email || '',
  });

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Reset errors when fields change
  useEffect(() => {
    if (formData.phone) setPhoneError(null);
    if (formData.email) setEmailError(null);
    if (formData.name) setNameError(null);
    if (formData.category_id) setCategoryError(null);
  }, [formData.phone, formData.email, formData.name, formData.category_id]);

  const handleContinue = async () => {
    // Validate required fields
    let hasErrors = false;

    if (!formData.category_id) {
      setCategoryError('Please select a category');
      hasErrors = true;
    }

    if (!formData.name.trim()) {
      setNameError('Service name is required');
      hasErrors = true;
    }

    const { phoneError: pErr, emailError: eErr } = validateOptionalPhoneOrEmail(
      formData.phone || '',
      formData.email || ''
    );

    if (pErr || eErr) {
      setPhoneError(pErr || null);
      setEmailError(eErr || null);
      hasErrors = true;
    }

    if (!formData.phone?.trim() && !formData.email?.trim()) {
      setPhoneError('Please provide either a phone number or email');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    // Normalize phone if provided
    const normalizedData: ServiceBasicsData = {
      ...formData,
      phone: formData.phone ? normalizePhoneDigits(formData.phone) : undefined,
      email: formData.email?.trim().toLowerCase() || undefined,
      name: formData.name.trim(),
      city_location: formData.city_location || undefined,
    };

    onContinue(normalizedData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left space-y-2.5 sm:space-y-3 md:space-y-4 py-1 sm:py-2 md:py-4"
    >
      <div className="w-full space-y-2.5 sm:space-y-3 md:space-y-4">
        <h1 
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-light tracking-tight leading-tight"
          style={{ color: selectedTheme?.textPrimary || 'inherit' }}
        >
          Basic Information
        </h1>

        <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
          {/* Category Selection */}
          <div className="space-y-1">
            <Label 
              htmlFor="category"
              className="text-xs sm:text-sm font-medium"
              style={{ color: selectedTheme?.textPrimary || 'inherit' }}
            >
              Category <span style={{ color: selectedTheme?.textHighlight || selectedTheme?.accentColor || '#EF4444' }}>*</span>
            </Label>
            <ServiceCategoryCombobox
              selectedCategoryId={formData.category_id}
              onSelect={(categoryId) => {
                setFormData(prev => ({ ...prev, category_id: categoryId }));
                setCategoryError(null);
              }}
              placeholder="Start typing to search categories..."
            />
            {categoryError && (
              <div className="text-xs sm:text-sm text-red-600 mt-0.5">{categoryError}</div>
            )}
          </div>

          {/* Service Name */}
          <div className="space-y-1">
            <Label 
              htmlFor="name"
              className="text-xs sm:text-sm font-medium"
              style={{ color: selectedTheme?.textPrimary || 'inherit' }}
            >
              Name <span style={{ color: selectedTheme?.textHighlight || selectedTheme?.accentColor || '#EF4444' }}>*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                setNameError(null);
              }}
              placeholder="e.g. Ramesh Plumbing Services"
              className="text-sm sm:text-base h-9 sm:h-10"
              style={selectedTheme ? {
                backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground,
                borderColor: nameError ? (selectedTheme.textHighlight || selectedTheme.accentColor || '#EF4444') : (selectedTheme.inputBorder || selectedTheme.borderColor),
                color: selectedTheme.inputText || selectedTheme.textPrimary,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
            />
            {nameError && (
              <div className="text-xs sm:text-sm text-red-600 mt-0.5">{nameError}</div>
            )}
          </div>

          {/* City/Area (Optional) */}
          <div className="space-y-1">
            <Label 
              htmlFor="city"
              className="text-xs sm:text-sm font-medium"
              style={{ color: selectedTheme?.textPrimary || 'inherit' }}
            >
              City/Area
            </Label>
            <CityLocalitySearch
              selectedLocation={formData.city_location}
              onSelect={(location) => {
                setFormData(prev => ({ ...prev, city_location: location }));
              }}
              placeholder="e.g. Mumbai, Bandra"
            />
          </div>

          {/* Contact Info */}
          <div className="space-y-2 sm:space-y-2.5 mt-2 sm:mt-3">
            <div className="space-y-0.5">
              <Label 
                className="text-sm sm:text-base font-medium"
                style={{ color: selectedTheme?.textPrimary || 'inherit' }}
              >
                Contact Information <span style={{ color: selectedTheme?.textHighlight || selectedTheme?.accentColor || '#EF4444' }}>*</span>
              </Label>
              <div className="text-xs" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
                Provide at least one: phone number or email
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label 
                htmlFor="phone"
                className="text-xs sm:text-sm font-medium"
                style={{ color: selectedTheme?.textPrimary || 'inherit' }}
              >
                Phone Number
              </Label>
              <div className="flex gap-1.5 sm:gap-2">
                <CountryCodeSelect
                  selectedCode={formData.phone_country_code}
                  onSelect={(code) => {
                    setFormData(prev => ({ ...prev, phone_country_code: code }));
                    setPhoneError(null);
                  }}
                />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, phone: e.target.value }));
                    setPhoneError(null);
                  }}
                  placeholder="e.g. 98765 43210"
                  className="flex-1 text-sm sm:text-base h-9 sm:h-10"
                  style={selectedTheme ? {
                    backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground,
                    borderColor: phoneError ? (selectedTheme.textHighlight || selectedTheme.accentColor || '#EF4444') : (selectedTheme.inputBorder || selectedTheme.borderColor),
                    color: selectedTheme.inputText || selectedTheme.textPrimary,
                    boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                  } : undefined}
                />
              </div>
              {phoneError && (
                <div className="text-xs sm:text-sm text-red-600 mt-0.5">{phoneError}</div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label 
                htmlFor="email"
                className="text-xs sm:text-sm font-medium"
                style={{ color: selectedTheme?.textPrimary || 'inherit' }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  setEmailError(null);
                }}
                placeholder="e.g. contact@example.com"
                className="text-sm sm:text-base h-9 sm:h-10"
                style={selectedTheme ? {
                  backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground,
                  borderColor: emailError ? (selectedTheme.textHighlight || selectedTheme.accentColor || '#EF4444') : (selectedTheme.inputBorder || selectedTheme.borderColor),
                  color: selectedTheme.inputText || selectedTheme.textPrimary,
                  boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                } : undefined}
              />
              {emailError && (
                <div className="text-xs sm:text-sm text-red-600 mt-0.5">{emailError}</div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div 
          className="flex items-center justify-between pt-2 sm:pt-3 md:pt-4 border-t mt-2 sm:mt-3"
          style={{ borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || '#E5E7EB' }}
        >
          <Button
            variant="ghost"
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-full flex-shrink-0 hover:bg-opacity-10"
            style={selectedTheme ? {
              color: selectedTheme.textPrimary || '#000000',
            } : undefined}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = selectedTheme.textPrimary || '#000000';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = selectedTheme.textPrimary || '#000000';
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button
            onClick={handleContinue}
            aria-label="Continue"
            className="p-2 sm:p-2.5 md:p-3 rounded-full hover:opacity-90 transition-all flex-shrink-0"
            style={selectedTheme ? {
              backgroundColor: accentColor,
              color: textOnAccent,
              boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : undefined}
          >
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceBasicsStep;


