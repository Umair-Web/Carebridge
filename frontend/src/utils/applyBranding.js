/** Apply platform-wide branding to document CSS variables, title, and favicon */
export function applyPlatformBranding(settings = {}) {
  const primary = settings.primaryColor || '#2563eb';
  const accent = settings.accentColor || '#06b6d4';
  const root = document.documentElement;

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--primary-hover', primary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-color', accent);
  root.dataset.brandPrimary = primary;

  if (settings.platformName) {
    document.title = settings.platformName;
  }

  const faviconHref = settings.faviconUrl || '/favicon.ico';
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconHref;

  document.documentElement.style.removeProperty('--hospital-primary');
}

/** Hospital portal overrides accent (keeps platform favicon/title unless hospital name set) */
export function applyHospitalBranding(profile, platformFallback = {}) {
  if (!profile?.primaryColor && !profile?.logoUrl && !profile?.name) {
    applyPlatformBranding(platformFallback);
    return;
  }

  const primary = profile.primaryColor || platformFallback.primaryColor || '#2980b9';
  const root = document.documentElement;

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--primary-hover', primary);
  root.style.setProperty('--hospital-primary', primary);
  root.dataset.brandPrimary = primary;

  if (profile.name) {
    document.title = profile.name;
  } else if (platformFallback.platformName) {
    document.title = platformFallback.platformName;
  }
}

export const DEFAULT_PLATFORM_BRANDING = {
  platformName: 'CareBridge',
  logoUrl: '',
  primaryColor: '#2563eb',
  accentColor: '#06b6d4',
  faviconUrl: '/favicon.ico',
};
