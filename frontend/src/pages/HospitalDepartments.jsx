import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, X, Activity, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Loader from '../components/Loader';

const HospitalDepartments = () => {
  const queryClient = useQueryClient();
  const [newDept, setNewDept] = useState('');

  const { data: hospital, isLoading, error } = useQuery({
    queryKey: ['hospital-profile'],
    queryFn: async () => {
      const res = await api.get('/profile/me');
      return res.data.data.profile;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ departments, inactiveDepartments }) => {
      const res = await api.patch('/hospitals/departments', { departments, inactiveDepartments });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Departments updated successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital-profile'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
    },
    onError: () => {
      toast.error('Failed to update departments');
    }
  });

  const departments = hospital?.departments || [];
  const inactiveDepartments = hospital?.inactiveDepartments || [];
  const inactiveSet = new Set(inactiveDepartments);

  const persist = (nextDepartments, nextInactive) => {
    updateMutation.mutate({
      departments: nextDepartments,
      inactiveDepartments: nextInactive.filter((d) => nextDepartments.includes(d)),
    });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newDept.trim()) return;

    if (departments.includes(newDept.trim())) {
      toast.error('Department already exists');
      return;
    }

    persist([...departments, newDept.trim()], inactiveDepartments);
    setNewDept('');
  };

  const handleRemove = (dept) => {
    persist(
      departments.filter((d) => d !== dept),
      inactiveDepartments.filter((d) => d !== dept)
    );
  };

  const handleToggleActive = (dept) => {
    const isInactive = inactiveSet.has(dept);
    const nextInactive = isInactive
      ? inactiveDepartments.filter((d) => d !== dept)
      : [...inactiveDepartments, dept];
    persist(departments, nextInactive);
  };

  if (isLoading) return <Loader message="Fetching departments..." />;

  if (error) {
    return <div className="text-red-500 text-center py-10">Failed to load hospital profile.</div>;
  }

  const activeCount = departments.filter((d) => !inactiveSet.has(d)).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Manage Departments</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Configure specialties and turn departments off when beds or capacity are unavailable. Only active departments appear in consultant referrals and on the bed inventory page.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Add New Department</h2>
        <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
          <input
            type="text"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            placeholder="e.g. Cardiology, Pediatrics..."
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={updateMutation.isLoading || !newDept.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> Add
          </button>
        </form>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity size={18} className="text-blue-500" />
            Departments ({activeCount} active / {departments.length} total)
          </h2>

          {departments.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
              No departments configured yet. Add your first department above to start receiving relevant referrals.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {departments.map((dept) => {
                const isActive = !inactiveSet.has(dept);
                return (
                  <div
                    key={dept}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                      isActive
                        ? 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        : 'bg-slate-100 border-slate-200 opacity-70'
                    }`}
                  >
                    <span className={`font-semibold ${isActive ? 'text-slate-700' : 'text-slate-500 line-through'}`}>
                      {dept}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isActive ? 'Active' : 'Off'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(dept)}
                      disabled={updateMutation.isLoading}
                      className={`p-1 rounded-full transition-colors ml-1 ${
                        isActive
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-amber-600 hover:bg-amber-50'
                      }`}
                      title={isActive ? 'Deactivate (hide from referrals)' : 'Activate (show in referrals)'}
                    >
                      <Power size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(dept)}
                      disabled={updateMutation.isLoading}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Remove Department"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HospitalDepartments;
