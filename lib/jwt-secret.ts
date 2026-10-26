/**
 * JWT secret validation and retrieval.
 * 
 * This helper ensures the JWT_SECRET environment variable is set and meets
 * minimum security requirements before any token signing or verification occurs.
 * 
 * Returns null when the secret is missing or too short, forcing auth to fail
 * closed per request rather than at module load.
 */

const MIN_SECRET_LENGTH = 32;

export function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    if (typeof process.env.JWT_SECRET === "undefined") {
      console.error("JWT_SECRET environment variable is not set");
    } else {
      console.error(`JWT_SECRET is too short (${secret?.length || 0} characters, minimum ${MIN_SECRET_LENGTH})`);
    }
    return null;
  }
  
  return new TextEncoder().encode(secret);
}
