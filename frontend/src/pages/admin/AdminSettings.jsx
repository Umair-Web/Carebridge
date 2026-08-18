import { useEffect, useState, useCallback } from 'react';
import { Settings, Calculator, Percent, Shield, Wallet, Landmark, RefreshCw, ArrowRightLeft, Palette, Image, Globe } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const AdminSettings = () => {
  // Financial Engine Settings State
  const [hospPct, setHospPct] = useState(20);
  const [consPct, setConsPct] = useState(60);
  const [thresholdPKR, setThresholdPKR] = useState(10000);
  const [holdPKR, setHoldPKR] = useState(9500);

  // White-label Settings State
  const [platformName, setPlatformName] = useState('CareBridge');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [accentColor, setAccentColor] = useState('#06b6d4');
  const [faviconUrl, setFaviconUrl] = useState('');

  // Uploading states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Estimator Slider States
  const [totalAmount, setTotalAmount] = useState(10000); // 10,000 PKR
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/settings');
      if (res.data.success) {
        const d = res.data.data;
        setHospPct(d.defaultHospitalDeductionPercentage ?? 20);
        setConsPct(d.defaultConsultantCommissionPercentage ?? 60);
        setThresholdPKR((d.walletThresholdPaisa ?? 1000000) / 100);
        setHoldPKR((d.walletInitialHoldPaisa ?? 950000) / 100);
        
        setPlatformName(d.platformName ?? 'CareBridge');
        setLogoUrl(d.logoUrl ?? '');
        setPrimaryColor(d.primaryColor ?? '#4f46e5');
        setAccentColor(d.accentColor ?? '#06b6d4');
        setFaviconUrl(d.faviconUrl ?? '');
      }
    } catch (err) {
      toast.error('Failed to load platform settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/admin/settings', {
        defaultHospitalDeductionPercentage: Number(hospPct),
        defaultConsultantCommissionPercentage: Number(consPct),
        walletThresholdPaisa: Number(thresholdPKR) * 100, // back to paisa
        walletInitialHoldPaisa: Number(holdPKR) * 100, // back to paisa
        platformName,
        logoUrl,
        primaryColor,
        accentColor,
        faviconUrl,
      });
      toast.success('Platform configurations successfully updated!');
      await load();
      // Trigger a window event so App.jsx knows to re-apply the styling
      window.dispatchEvent(new Event('platform-branding-changed'));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update platform settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    if (type === 'logo') setUploadingLogo(true);
    else setUploadingFavicon(true);

    try {
      const res = await api.post('/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data.success) {
        if (type === 'logo') setLogoUrl(res.data.url);
        else setFaviconUrl(res.data.url);
        toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload file');
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  };

  // Estimator Calculations based on settings
  const platformCut = Math.round(totalAmount * (hospPct / 100));
  const consultantShare = Math.round(platformCut * (consPct / 100));
  const hospitalNets = totalAmount - platformCut;
  const adminShare = platformCut - consultantShare;

  if (isLoading) {
    return <Loader message="Loading platform configuration..." />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Title Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-200">
          <Settings className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Platform Configuration</h1>
          <p className="text-slate-500 font-medium mt-1">Configure global financial splits, holding reserves, and platform branding details.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Settings Form */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Main Form */}
          <form onSubmit={save} className="space-y-8">
            
            {/* Financial Settings Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Percent className="text-blue-600" size={20} />
                Global Financial Settings
              </h2>
              
              {/* Split Percentages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Default Hospital Cut (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={hospPct}
                      onChange={(e) => setHospPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-mono text-lg focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all bg-slate-50/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      %
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Fallback platform cut deducted from patient bill.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Default Consultant split (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={consPct}
                      onChange={(e) => setConsPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-mono text-lg focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all bg-slate-50/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      %
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Physician share of the deducted platform cut.</p>
                </div>
              </div>

              {/* Wallet Thresholds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Wallet Release Threshold (PKR)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      value={thresholdPKR}
                      onChange={(e) => setThresholdPKR(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-mono text-lg focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all bg-slate-50/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs uppercase">
                      PKR
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Minimum balance to auto-trigger payout release.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Initial Reserve Hold (PKR)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      value={holdPKR}
                      onChange={(e) => setHoldPKR(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-mono text-lg focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all bg-slate-50/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs uppercase">
                      PKR
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Locked reserve amount retained in consultant wallet.</p>
                </div>
              </div>
            </div>

            {/* White Label Settings Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Palette className="text-blue-600" size={20} />
                Dynamic White-Labeling (Branding)
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Platform Custom Name</label>
                  <input
                    type="text"
                    required
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="e.g. CareBridge"
                  />
                  <p className="text-[10px] text-slate-400">Updates browser title bar and logo displays dynamically.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Primary Theme Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0"
                      />
                      <input
                        type="text"
                        required
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                        placeholder="#4f46e5"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Accent Theme Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0"
                      />
                      <input
                        type="text"
                        required
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                        placeholder="#06b6d4"
                      />
                    </div>
                  </div>
                </div>

                {/* File Uploading Widgets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Logo Image</label>
                    <div className="flex items-center gap-4">
                      {logoUrl && (
                        <div className="w-12 h-12 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
                          <img src={logoUrl} alt="Platform Logo Preview" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'logo')}
                          className="hidden"
                          id="logo-upload"
                          disabled={uploadingLogo}
                        />
                        <label
                          htmlFor="logo-upload"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-dashed"
                        >
                          <Image size={14} />
                          {uploadingLogo ? 'Uploading logo...' : 'Choose Logo'}
                        </label>
                        <input
                          type="text"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          className="w-full mt-2 rounded-lg border border-slate-100 px-2 py-1 text-[10px] font-mono text-slate-500"
                          placeholder="Logo Image URL"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Favicon Icon (.ico/.png)</label>
                    <div className="flex items-center gap-4">
                      {faviconUrl && (
                        <div className="w-12 h-12 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
                          <img src={faviconUrl} alt="Favicon Preview" className="w-6 h-6 object-contain" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/x-icon, image/png, image/jpeg"
                          onChange={(e) => handleFileUpload(e, 'favicon')}
                          className="hidden"
                          id="favicon-upload"
                          disabled={uploadingFavicon}
                        />
                        <label
                          htmlFor="favicon-upload"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-dashed"
                        >
                          <Globe size={14} />
                          {uploadingFavicon ? 'Uploading favicon...' : 'Choose Favicon'}
                        </label>
                        <input
                          type="text"
                          value={faviconUrl}
                          onChange={(e) => setFaviconUrl(e.target.value)}
                          className="w-full mt-2 rounded-lg border border-slate-100 px-2 py-1 text-[10px] font-mono text-slate-500"
                          placeholder="Favicon URL"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSaving || uploadingLogo || uploadingFavicon}
              className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
            >
              {isSaving ? 'Saving Platform Settings...' : (
                <>
                  <Shield size={18} className="text-blue-400" />
                  Save Platform Configuration
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Real-Time Split Simulator Dashboard */}
        <div className="lg:col-span-5 bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-100 relative overflow-hidden space-y-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Calculator className="text-blue-400" size={18} />
              Real-Time Commission Simulator
            </h2>
            <span className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-300">
              Live Flow
            </span>
          </div>

          <div className="space-y-6">
            {/* Total Patient Bill Paid Slider */}
            <div className="space-y-3 bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className="flex justify-between items-end">
                <span className="text-xs text-slate-400 font-medium">Admission Total Bill</span>
                <span className="text-lg font-black text-white">PKR {Number(totalAmount).toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Split Flow Visualizer */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dynamic Distribution Breakdown</p>
              
              <div className="space-y-2">
                {/* Hospital Net */}
                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-3.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    <div>
                      <p className="text-xs font-bold">Hospital Receives</p>
                      <p className="text-[9px] text-slate-400">100% - Platform Cut ({100 - hospPct}%)</p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-teal-400">PKR {hospitalNets.toLocaleString()}</span>
                </div>

                {/* Platform Total Cut */}
                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-3.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-xs font-bold">Platform Total Cut</p>
                      <p className="text-[9px] text-slate-400">Deduction Percentage ({hospPct}%)</p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-blue-400">PKR {platformCut.toLocaleString()}</span>
                </div>

                {/* Sub-splits from Platform Cut */}
                <div className="pl-6 border-l-2 border-slate-800 space-y-2 mt-1">
                  {/* Consultant Share */}
                  <div className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-xs font-bold">Consultant Share</p>
                        <p className="text-[9px] text-slate-400">{consPct}% of Platform Cut</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-400">PKR {consultantShare.toLocaleString()}</span>
                  </div>

                  {/* Admin Net Share */}
                  <div className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <p className="text-xs font-bold">Platform Net Share</p>
                        <p className="text-[9px] text-slate-400">Admin Cut ({100 - consPct}%)</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-400">PKR {adminShare.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note Panel */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 items-start text-slate-300">
              <ArrowRightLeft className="text-blue-400 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] leading-relaxed text-blue-200/90">
                This simulator demonstrates the live split logic. Payouts are computed mathematically to prevent rounding conflicts, automatically applying holding reserves when releasing balances.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
