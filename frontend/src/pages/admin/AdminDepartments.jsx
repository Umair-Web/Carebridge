import { useEffect, useState, useCallback } from 'react';
import { Tags, Plus, Trash2 } from 'lucide-react';
import api from '../../utils/api';

const AdminDepartments = () => {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const res = await api.get('/admin/departments');
    if (res.data.success) setRows(res.data.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const kw = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      await api.post('/admin/departments', { name, keywords: kw, sortOrder: rows.length });
      setName('');
      setKeywords('');
      await load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Create failed');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this department catalog entry?')) return;
    await api.delete(`/admin/departments/${id}`);
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
          <Tags className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Department & symptom tags</h1>
          <p className="text-slate-500 text-sm mt-1">Keyword routing for smart intake (FR-33).</p>
        </div>
      </div>

      <form onSubmit={add} className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="w-4 h-4" /> Add department
        </div>
        <input
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5"
          placeholder="Department name (e.g. Cardiology)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5"
          placeholder="Keywords comma-separated (chest pain, heart)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm">
          Add
        </button>
      </form>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r._id}
            className="bg-white border border-slate-100 rounded-xl p-4 flex flex-wrap justify-between gap-3 items-start"
          >
            <div>
              <p className="font-bold text-slate-900">{r.name}</p>
              <p className="text-xs text-slate-500 mt-1">{(r.keywords || []).join(' · ') || 'No keywords'}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(r._id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminDepartments;
