/**
 * Catalog of every Google OAuth scope the app may ever request.
 * Adding a new feature = adding a string here + passing it as requiredScopes.
 * Nothing else in the module needs to change.
 */
export type GoogleScope =
  | 'openid'
  | 'email'
  | 'profile'
  | 'https://www.googleapis.com/auth/drive.file'
  | 'https://www.googleapis.com/auth/documents'
  | 'https://www.googleapis.com/auth/gmail.send';

export function hasAllScopes(stored: string[], required: GoogleScope[]): boolean {
  return required.every((s) => stored.includes(s));
}
