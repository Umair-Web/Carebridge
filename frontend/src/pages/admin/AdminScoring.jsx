import { useEffect, useState, useCallback } from 'react';
import { Sliders } from 'lucide-react';
import api from '../../utils/api';
import Loader from '../../components/Loader';

const FIELDS = [
  { key: 'specialtyMatch', label: 'Specialty match' },
  { key: 'bedAvailability', label: 'Bed availability' },
  { key: 'distance', label: 'Distance' },
  { key: 'costFit', label: 'Cost / budget fit' },
  { key: 'slaHistory', label: 'SLA / acceptance history' },
  { key: 'preference', label: 'Consultant preference' },
];

const AdminScoring = () => {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get('/admin/scoring');
    if (res.data.success) setCfg(res.data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sum = cfg
    ? FIELDS.reduce((s, f) => s + (Number(cfg[f.key]) || 0), 0)
    : 0;

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    if (Math.abs(sum - 100) > 0.01) {
      setMsg('Weights must sum to exactly 100.');
      return;
    }
    setSaving(true);
    try {
      const body = {};
      FIELDS.forEach((f) => {
        body[f.key] = Number(cfg[f.key]);
      });
      await api.put('/admin/scoring', body);
      setMsg('Saved successfully.');
      await load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) {
    return <Loader message="Loading scoring weights..." />;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
          <Sliders className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scoring weights</h1>
          <p className="text-slate-500 text-sm mt-1">Six-factor engine (FR-32, §8). Total must equal 100.</p>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={cfg[f.key] ?? ''}
              onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div
          className={`text-sm font-semibold ${Math.abs(sum - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}
        >
          Current sum: {sum} / 100
        </div>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
      </form>
    </div>
  );
};

export default AdminScoring;
