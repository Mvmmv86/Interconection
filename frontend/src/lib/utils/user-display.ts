/**
 * Helpers for displaying user info in the UI consistently.
 */

/**
 * Generate initials from a user's full name to show in avatars.
 *
 * UX trade-off — there are 3 valid approaches:
 *
 * 1. "first letter of first 2 words" (e.g., "Marcus Admin" → "MA")
 *    - Pro: works for "John Doe", "Maria Silva", typical Western names
 *    - Con: "Marcoceo" (single word) becomes just "M" — looks lonely
 *
 * 2. "first 2 chars of name" (e.g., "Marcus Admin" → "MA", "Marcoceo" → "MC")
 *    - Pro: always 2 chars, visually balanced
 *    - Con: "John Doe" becomes "JO" instead of "JD"
 *
 * 3. "smart hybrid": if 2+ words use approach 1, else use approach 2
 *    - Pro: best of both worlds
 *    - Con: slightly more code
 *
 * @param name - The user's full name (e.g., "Marcoceo", "Marcus Admin", "John Doe")
 * @returns 1-2 character uppercase string for avatar display
 *
 * TODO: implement the chosen approach below.
 */
export function getInitials(name: string | undefined | null): string {
  if (!name?.trim()) return '?';

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0].slice(0, 2).toUpperCase();
}

/**
 * Format role enum value for display.
 * Backend returns "ADMIN", "MANAGER", "VIEWER" — these are jarring in UI.
 */
export function formatRole(role: string | undefined | null): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}
