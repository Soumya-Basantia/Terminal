/**
 * Generates a random session code like G7K29
 * 5 characters: uppercase letters and digits, no ambiguous characters (0, O, I, 1)
 */
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
