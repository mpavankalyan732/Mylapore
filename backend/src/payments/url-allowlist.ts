/**
 * Only redirect customers to checkout URLs on trusted hosts. Protects against a compromised/misconfigured
 * gateway response (or an injected value) turning checkout into an open redirect or phishing page.
 */
export function isTrustedCheckoutUrl(raw: string, trustedHosts: string[], allowHttpLocalhost = false): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  const localhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(allowHttpLocalhost && localhost && u.protocol === 'http:')) return false;
  if (u.username || u.password) return false;
  return trustedHosts.some((h) => {
    const host = h.trim().toLowerCase();
    return host && (u.hostname === host || u.hostname.endsWith('.' + host));
  });
}
