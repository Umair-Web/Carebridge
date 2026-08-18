import { NavLink } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';

/**
 * NavLink that uses the active platform/hospital primary color for the active state.
 */
const BrandNavLink = ({ to, end, children, className = '' }) => {
  const { effective } = useBranding();
  const primary = effective.primaryColor || '#2563eb';

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          isActive
            ? 'text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
        } ${className}`
      }
      style={({ isActive }) =>
        isActive
          ? {
              backgroundColor: primary,
              boxShadow: `0 4px 14px ${primary}33`,
            }
          : undefined
      }
    >
      {children}
    </NavLink>
  );
};

export default BrandNavLink;
