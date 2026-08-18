import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, UserPlus, Trash2, Mail, Phone, ShieldCheck, X } from 'lucide-react';
import api from '../utils/api';
import Loader from './Loader';
import { useAuth } from '../features/auth/AuthContext';

/**
 * Reusable team / staff management screen.
 *
 * Backed by the team endpoints (GET/POST/DELETE `endpoint`). Used by the admin,
 * hospital and lab portals — each added account is a full login that shares the
 * same portal and receives the same email / notifications. Members are never
 * treated as a separate facility.
 */
const EMPTY = { name: '', email: '', phone: '', password: '' };

const TeamManagement = ({ endpoint, title, subtitle, memberNoun = 'team member' }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const fetchMembers = async () => {
    try {
      const res = await api.get(endpoint);
      if (res.data.success) setMembers(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch team:', err);
      toast.error(err.response?.data?.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.post(endpoint, form);
      if (res.data.success) {
        toast.success(res.data.message || `${memberNoun} added`);
        setShowModal(false);
        setForm(EMPTY);
        fetchMembers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to add ${memberNoun}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Remove ${member.name} (${member.email})? They will lose access immediately.`)) return;
    try {
      const res = await api.delete(`${endpoint}/${member._id}`);
      if (res.data.success) {
        toast.success(res.data.message || 'Removed');
        fetchMembers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  const isAncestor = (memberId) => {
    let currentId = user?.createdBy;
    while (currentId) {
      if (String(currentId) === String(memberId)) return true;
      const parent = members.find((m) => String(m._id) === String(currentId));
      currentId = parent?.createdBy;
    }
    return false;
  };

  if (loading) return <Loader message="Loading team..." />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
        >
          <Plus size={20} />
          Add {memberNoun}
        </button>
      </div>

      {members.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
          <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-600">
            <UserPlus size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No {memberNoun}s yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            Add an email &amp; password to give someone their own login. They&apos;ll receive the same alerts you do.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {members.map((m) => (
            <div key={m._id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl transition-all relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold text-lg">
                  {m.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                {String(m._id) !== String(user?.id) && m.createdBy && !isAncestor(m._id) && (
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-600 rounded-xl transition-colors"
                    title="Remove access"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{m.name}</h3>
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 rounded-full">
                <ShieldCheck size={11} /> {m.status || 'active'}
              </span>
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 truncate">
                  <Mail size={14} className="text-slate-400 shrink-0" /> <span className="truncate">{m.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Phone size={14} className="text-slate-400 shrink-0" /> {m.phone || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <X size={22} />
            </button>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">Add {memberNoun}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              They can log in right away with these credentials and will receive account emails.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="Full Name">
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls} placeholder="e.g. Sara Ali" />
              </Field>
              <Field label="Email Address">
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls} placeholder="name@example.com" autoComplete="off" />
              </Field>
              <Field label="Phone (Pakistani mobile)">
                <input type="text" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputCls} placeholder="03XXXXXXXXX" />
              </Field>
              <Field label="Password">
                <input type="text" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputCls} placeholder="At least 8 characters" autoComplete="new-password" />
              </Field>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-100 dark:shadow-none">
                  {saving ? 'Adding…' : `Create ${memberNoun}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const inputCls =
  'w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all font-medium text-slate-900 dark:text-slate-100';

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{label}</label>
    {children}
  </div>
);

export default TeamManagement;
