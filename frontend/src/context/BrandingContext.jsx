import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../features/auth/AuthContext';
import {
  applyPlatformBranding,
  applyHospitalBranding,
  DEFAULT_PLATFORM_BRANDING,
} from '../utils/applyBranding';

const BrandingContext = createContext(null);

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      platform: DEFAULT_PLATFORM_BRANDING,
      effective: DEFAULT_PLATFORM_BRANDING,
      reloadPlatform: async () => {},
      reloadHospital: async () => {},
    };
  }
  return ctx;
};

export const BrandingProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM_BRANDING);
  const [hospitalBrand, setHospitalBrand] = useState(null);

  const loadPlatform = useCallback(async () => {
    try {
      const res = await api.get('/auth/platform-settings');
      if (res.data.success && res.data.data) {
        const data = { ...DEFAULT_PLATFORM_BRANDING, ...res.data.data };
        setPlatform(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to load platform branding:', err);
    }
    return null;
  }, []);

  const loadHospital = useCallback(async () => {
    if (user?.role !== 'hospital' || !token) {
      setHospitalBrand(null);
      return;
    }
    try {
      const res = await api.get('/profile/me');
      if (res.data.success && res.data.data?.profile) {
        const p = res.data.data.profile;
        setHospitalBrand({
          name: p.hospitalName || 'Hospital',
          logoUrl: p.branding?.logoUrl || '',
          primaryColor: p.branding?.primaryColor || '#2980b9',
        });
      }
    } catch (err) {
      console.error('Failed to load hospital branding:', err);
    }
  }, [user?.role, token]);

  useEffect(() => {
    loadPlatform();
  }, [loadPlatform]);

  useEffect(() => {
    loadHospital();
  }, [loadHospital]);

  useEffect(() => {
    if (user?.role === 'hospital' && hospitalBrand) {
      applyHospitalBranding(hospitalBrand, platform);
    } else {
      applyPlatformBranding(platform);
    }
  }, [user?.role, platform, hospitalBrand]);

  useEffect(() => {
    const onPlatform = () => loadPlatform();
    const onHospital = () => loadHospital();
    window.addEventListener('platform-branding-changed', onPlatform);
    window.addEventListener('hospital-branding-changed', onHospital);
    return () => {
      window.removeEventListener('platform-branding-changed', onPlatform);
      window.removeEventListener('hospital-branding-changed', onHospital);
    };
  }, [loadPlatform, loadHospital]);

  const effective = useMemo(() => {
    if (user?.role === 'hospital' && hospitalBrand) {
      return {
        platformName: hospitalBrand.name || platform.platformName,
        logoUrl: hospitalBrand.logoUrl || platform.logoUrl,
        primaryColor: hospitalBrand.primaryColor || platform.primaryColor,
        accentColor: platform.accentColor,
        faviconUrl: platform.faviconUrl,
      };
    }
    return platform;
  }, [user?.role, hospitalBrand, platform]);

  const value = useMemo(
    () => ({
      platform,
      hospital: hospitalBrand,
      effective,
      reloadPlatform: loadPlatform,
      reloadHospital: loadHospital,
    }),
    [platform, hospitalBrand, effective, loadPlatform, loadHospital]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};
