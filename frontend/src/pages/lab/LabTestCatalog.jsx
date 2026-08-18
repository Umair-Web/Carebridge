import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Trash2, Save, X, Pencil } from 'lucide-react';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const LabTestCatalog = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ testName: '', price: '', turnaroundHours: 24 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ testName: '', price: '', turnaroundHours: 24 });

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: async () => (await api.get('/labs/tests')).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['lab-tests'] });

  const addTest = async (e) => {
    e.preventDefault();
    if (!form.testName.trim() || form.price === '') return toast.error('Enter a test name and price');
    try {
      await api.post('/labs/tests', {
        testName: form.testName.trim(),
        price: Math.round(Number(form.price) * 100),
        turnaroundHours: Number(form.turnaroundHours) || 24,
      });
      toast.success('Test added');
      setForm({ testName: '', price: '', turnaroundHours: 24 });
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add test');
    }
  };

  const startEdit = (t) => {
    setEditingId(t._id);
    setEditForm({ testName: t.testName, price: (t.price / 100).toString(), turnaroundHours: t.turnaroundHours });
  };

  const saveEdit = async (id) => {
    try {
      await api.patch(`/labs/tests/${id}`, {
        testName: editForm.testName.trim(),
        price: Math.round(Number(editForm.price) * 100),
        turnaroundHours: Number(editForm.turnaroundHours) || 24,
      });
      toast.success('Test updated');
      setEditingId(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update test');
    }
  };

  const removeTest = async (id) => {
    try {
      await api.delete(`/labs/tests/${id}`);
      toast.success('Test removed');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove test');
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-sky-500 outline-none';

  if (isLoading) return <Loader message="Loading test catalog..." />;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">Test Catalog</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">The tests your lab offers and their prices.</p>
        </div>
      </div>

      <form onSubmit={addTest} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Test name</label>
          <input className={inputClass} value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} placeholder="Complete Blood Count" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Price (PKR)</label>
          <input type="number" min={0} className={`${inputClass} w-32`} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="1500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">TAT (hrs)</label>
          <input type="number" min={0} className={`${inputClass} w-24`} value={form.turnaroundHours} onChange={(e) => setForm({ ...form, turnaroundHours: e.target.value })} />
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-lg transition-colors">
          <Plus size={16} /> Add
        </button>
      </form>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {tests.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No tests added yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/40 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Test</th>
                <th className="text-left px-4 py-3 font-semibold">Price</th>
                <th className="text-left px-4 py-3 font-semibold">TAT</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tests.map((t) => (
                <tr key={t._id}>
                  {editingId === t._id ? (
                    <>
                      <td className="px-4 py-2"><input className={inputClass} value={editForm.testName} onChange={(e) => setEditForm({ ...editForm, testName: e.target.value })} /></td>
                      <td className="px-4 py-2"><input type="number" className={`${inputClass} w-28`} value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></td>
                      <td className="px-4 py-2"><input type="number" className={`${inputClass} w-20`} value={editForm.turnaroundHours} onChange={(e) => setEditForm({ ...editForm, turnaroundHours: e.target.value })} /></td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => saveEdit(t._id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{t.testName}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPkr(t.price)}</td>
                      <td className="px-4 py-3 text-slate-500">{t.turnaroundHours} hrs</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(t)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => removeTest(t._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LabTestCatalog;
