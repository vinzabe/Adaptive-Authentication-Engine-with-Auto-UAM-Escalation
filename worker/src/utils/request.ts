export async function generateDeviceFingerprint(userAgent: string, ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${userAgent}:${ip}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getUserAgentInfo(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';

  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios')) os = 'iOS';

  if (ua.includes('mobile')) device = 'Mobile';
  else if (ua.includes('tablet')) device = 'Tablet';
  else device = 'Desktop';

  return { browser, os, device };
}

export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
         'unknown';
}

export function getClientLocation(request: Request) {
  const cf = request.cf as any;
  if (!cf) return null;

  return {
    country: cf.country || 'Unknown',
    city: cf.city || 'Unknown',
    latitude: cf.lat || 0,
    longitude: cf.lon || 0,
    timezone: cf.timezone || 'UTC'
  };
}