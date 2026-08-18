import { Loader2 } from 'lucide-react';

const Loader = ({ message = 'Loading details, please wait...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center mb-4">
        {/* Glowing pulsing outer ring */}
        <div className="absolute w-12 h-12 rounded-full border-4 border-blue-100 dark:border-blue-900/30 animate-pulse"></div>
        {/* Spinning main indicator */}
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 relative z-10" />
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide">{message}</p>
    </div>
  );
};

export default Loader;
