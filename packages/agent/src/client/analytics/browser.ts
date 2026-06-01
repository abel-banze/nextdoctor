let _browserInfo: { browser: string; os: string; device: string } | null = null;

export function getBrowserInfo() {
  if (_browserInfo) return _browserInfo;

  if (typeof navigator === 'undefined') {
    _browserInfo = { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
    return _browserInfo;
  }

  const uaData = (navigator as any).userAgentData;
  if (uaData) {
    const { platform, mobile, brands } = uaData;
    const brand = brands?.find((b: { brand: string; version: string }) => !b.brand.includes('Not')) || brands?.[0];
    _browserInfo = {
      browser: brand?.brand || 'Unknown',
      os: platform || 'Unknown',
      device: mobile ? 'Mobile' : 'Desktop',
    };
    return _browserInfo;
  }

  const ua = navigator.userAgent.toLowerCase();
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('chrome') && !ua.includes('edg') && !ua.includes('opr')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opr') || ua.includes('opera')) browser = 'Opera';

  if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';

  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'Tablet';
  }

  _browserInfo = { browser, os, device };
  return _browserInfo;
}

export function isInteractiveElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' && (el as HTMLAnchorElement).href) return true;
  if (tag === 'button') return true;
  if (['input', 'select', 'textarea'].includes(tag)) return true;
  if (el.hasAttribute('tabindex')) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.getAttribute('role') === 'button') return true;
  if (el.closest('a[href], button, input, select, textarea, [tabindex], [contenteditable], [role="button"]')) return true;
  return false;
}
