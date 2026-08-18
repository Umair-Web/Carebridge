import { useState } from 'react';
import { Bed, Plus, Minus, CheckCircle, AlertCircle, RefreshCcw, Pencil, X } from 'lucide-react';
import api from '../utils/api';
import { useBeds } from '../hooks/useReferrals';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';

const BedManagement = () => {
  const queryClient = useQueryClient();
  const { data: beds = [], isLoading, isFetching } = useBeds();
  const [updating, setUpdating] = useState(null);
  const [editingWard, setEditingWard] = useState(null);
  const [editRow, setEditRow] = useState({ totalBeds: '', occupiedBeds: '' });

  const refreshBeds = (data) => {
    queryClient.setQueryData(['beds'], data);
  };

  const updateAvailable = async (ward, current, delta) => {
    const newValue = Math.max(0, current + delta);
    setUpdating(ward);
    try {
      const res = await api.patch('/hospitals/beds', { ward, availableBeds: newValue });
      if (res.data.success) {
        refreshBeds(res.data.data);
        toast.success(`${ward} beds updated.`);
      }
    } catch {
      toast.error('Failed to update beds');
    } finally {
      setUpdating(null);
    }
  };

  const openEdit = (ward) => {
    setEditingWard(ward.ward);
    setEditRow({
      totalBeds: String(ward.totalBeds ?? ''),
      occupiedBeds: String(ward.occupiedBeds ?? ''),
    });
  };

  const saveEdit = async () => {
    if (!editingWard) return;
    const total = Number(editRow.totalBeds);
    const occupied = Number(editRow.occupiedBeds);
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(occupied) || occupied < 0) {
      return toast.error('Enter valid bed numbers');
    }
    if (occupied > total) {
      return toast.error('Occupied cannot exceed total beds');
    }
    setUpdating(editingWard);
    try {
      const res = await api.patch('/hospitals/beds', {
        ward: editingWard,
        totalBeds: total,
        occupiedBeds: occupied,
      });
      if (res.data.success) {
        refreshBeds(res.data.data);
        toast.success(`${editingWard} inventory saved`);
        setEditingWard(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setUpdating(null);
    }
  };

  if (isLoading) return <Loader message="Fetching bed inventory..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className="p-3 rounded-2xl bg-blue-100 text-blue-600 shadow-sm">
            <Bed className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Bed Inventory</h1>
            <p className="text-slate-500 text-sm mt-1">
              Quick +/- for availability, or edit total and occupied beds per ward.
            </p>
          </div>
        </div>
        {isFetching && <RefreshCcw className="w-5 h-5 animate-spin text-slate-300" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {beds.map((ward) => {
          const isLow = ward.availableBeds < 3 && ward.availableBeds > 0;
          const isFull = ward.availableBeds === 0;
          const isEditing = editingWard === ward.ward;

          return (
            <div
              key={ward._id || ward.ward}
              className={`relative bg-white rounded-3xl border-2 transition-all duration-300 p-6 flex flex-col justify-between min-h-[14rem]
                ${isFull ? 'border-red-100 bg-red-50/10' : 'border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-900">{ward.ward}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => (isEditing ? setEditingWard(null) : openEdit(ward))}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      title="Edit totals"
                    >
                      {isEditing ? <X size={16} /> : <Pencil size={16} />}
                    </button>
                    {isFull ? (
                      <AlertCircle className="text-red-500 w-5 h-5" />
                    ) : (
                      <CheckCircle className="text-emerald-500 w-5 h-5" />
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Total beds</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"
                        value={editRow.totalBeds}
                        onChange={(e) => setEditRow({ ...editRow, totalBeds: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Occupied</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"
                        value={editRow.occupiedBeds}
                        onChange={(e) => setEditRow({ ...editRow, occupiedBeds: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Available / Total · Occupied {ward.occupiedBeds ?? 0}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-black tabular-nums ${isFull ? 'text-red-600' : 'text-slate-900'}`}>
                        {ward.availableBeds}
                      </span>
                      <span className="text-slate-400 font-medium text-lg">/ {ward.totalBeds}</span>
                    </div>
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="flex items-center justify-between gap-4 mt-4">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 rounded-full ${
                        isFull ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${ward.totalBeds > 0 ? (ward.availableBeds / ward.totalBeds) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={updating === ward.ward || ward.availableBeds === 0}
                      onClick={() => updateAvailable(ward.ward, ward.availableBeds, -1)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-30 border border-slate-200"
                    >
                      <Minus size={18} />
                    </button>
                    <button
                      type="button"
                      disabled={updating === ward.ward || ward.availableBeds >= ward.totalBeds}
                      onClick={() => updateAvailable(ward.ward, ward.availableBeds, 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 shadow-md"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              )}

              {updating === ward.ward && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-3xl flex items-center justify-center">
                  <RefreshCcw className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BedManagement;
