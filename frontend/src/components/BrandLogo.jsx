import { useBranding } from '../context/BrandingContext';
import careBridgeLogoWhite from '../assets/care-bridge-logo-white.png';

/** Sidebar / header logo block using current effective branding */
const BrandLogo = ({ size = 'md', className = '' }) => {
  const { effective } = useBranding();
  const name = effective.platformName || 'CareBridge';
  const hasCustomLogo = Boolean(effective.logoUrl);
  const logoUrl = effective.logoUrl || careBridgeLogoWhite;

  const box =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
        ? 'w-12 h-12 text-lg'
        : 'w-9 h-9 text-sm';

  // White asset needs a dark tile on the light sidebar; custom logos keep a light tile.
  const tileBg = hasCustomLogo ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800';

  return (
    <div className={`flex items-center min-w-0 ${className}`}>
      <img
        src={logoUrl}
        alt={name}
        onError={(e) => {
          e.target.src = careBridgeLogoWhite;
        }}
      />
    </div>
  );
};

export default BrandLogo;
