const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerificationResult {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  challenge_ts?: string;
}

export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIP?: string
): Promise<TurnstileVerificationResult> {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  
  if (remoteIP) {
    formData.append('remoteip', remoteIP);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData
    });

    const result = await response.json() as TurnstileVerificationResult;
    return result;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return {
      success: false,
      'error-codes': ['network-error']
    };
  }
}

export function generateTurnstileHTML(siteKey: string, theme: 'light' | 'dark' = 'light'): string {
  return `
    <div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="${theme}"></div>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  `;
}