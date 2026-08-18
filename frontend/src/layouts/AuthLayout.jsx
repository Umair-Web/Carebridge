import { Outlet, useLocation } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import careBridgeLogoWhite from '../assets/care-bridge-logo-white.png';

const AuthLayout = () => {
  const location = useLocation();
  const isHospitalReg = location.pathname === '/register/hospital';
  const { effective } = useBranding();
  const name = effective.platformName || 'CareBridge';
  const primary = effective.primaryColor || '#2563eb';
  const accent = effective.accentColor || '#06b6d4';

  const panelGradient = {
    background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 45%, #0f172a 100%)`,
  };

  return (
    <div className="min-h-screen flex w-full">
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden"
        style={panelGradient}
      >
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div
            className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: accent }}
          />
          <div className="absolute bottom-[-10%] left-10 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: primary }} />
        </div>

        <div className="z-10 relative">
          <img src={careBridgeLogoWhite} alt={name} className="h-14 max-w-[240px] object-contain" />
        </div>

        <div className="z-10 relative mt-auto mb-20 space-y-6">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            Seamless Referrals.
            <br />
            <span style={{ color: accent }}>Better Outcomes.</span>
          </h1>
          <p className="text-white/80 text-lg max-w-lg leading-relaxed">
            Join Pakistan&apos;s premier digital referral management platform. Connect with top consultants and leading
            hospitals to ensure every patient gets the care they deserve.
          </p>
        </div>

        <div className="z-10 relative text-sm text-white/60 font-medium tracking-wide">
          &copy; {new Date().getFullYear()} {name}. All rights reserved.
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center bg-white overflow-y-auto relative">
        <div className={`w-full mx-auto px-6 py-12 lg:px-12 xl:px-20 ${isHospitalReg ? 'max-w-4xl' : 'max-w-xl'}`}>
          <div className="flex lg:hidden items-center justify-center mb-8">
            <img
              src={careBridgeLogoWhite}
              alt={name}
              className="h-10 object-contain rounded-lg bg-slate-900 px-2 py-1"
            />
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
