export function normalizePhoneDigits(input: string): string {
  return (input || '').replace(/\D/g, '');
}

export function validatePhoneDigits(input: string): string | null {
  const digits = normalizePhoneDigits(input);
  if (digits.length === 0) return 'Please enter a phone number.';
  if (digits.length < 10 || digits.length > 15) return 'Enter a valid phone (10–15 digits).';
  return null;
}

export function validateOptionalPhoneOrEmail(phone: string, email: string): { phoneError: string | null; emailError: string | null } {
  const hasPhone = (phone || '').trim().length > 0;
  const hasEmail = (email || '').trim().length > 0;

  let phoneError: string | null = null;
  let emailError: string | null = null;

  if (!hasPhone && !hasEmail) {
    phoneError = 'Provide a phone number or an email.';
  }
  if (hasPhone) phoneError = validatePhoneDigits(phone);
  if (hasEmail) emailError = validateEmailFormat(email);

  return { phoneError, emailError };
}

export function validateEmailFormat(input: string): string | null {
  const trimmed = (input || '').trim();
  if (trimmed.length === 0) return 'Please enter an email address.';
  const ok = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed);
  return ok ? null : 'Enter a valid email address.';
}


