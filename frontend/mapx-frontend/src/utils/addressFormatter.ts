/**
 * Formats a full address to a fixed length with ellipses
 * @param address - The full address string
 * @returns A truncated address with ellipses if needed
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';
  
  // Truncate to 30 characters and add ellipses if longer
  return address.length > 50 ? address.substring(0, 50) + '...' : address;
}; 