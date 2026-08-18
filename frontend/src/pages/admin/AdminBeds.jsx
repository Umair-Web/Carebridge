import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bed, AlertCircle, Search, Edit2, X, Check } from 'lucide-react';
import api from '../../utils/api';
import Loader from '../../components/Loader';
import toast from 'react-hot-toast';

const WARDS = ['General', 'Private', 'ICU', 'NICU', 'PICU', 'HDU'];

const AdminBeds = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingHospital, setEditingHospital] = useState(null);
  const [bedsForm, setBedsForm] = useState({}); // { [ward]: { totalBeds, occupiedBeds } }

  const { data: hospitals, isLoading, error } = useQuery({
    queryKey: ['admin-beds'],
    queryFn: async () => {
      const res = await api.get('/admin/beds');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const updateBedsMutation = useMutation({
    mutationFn: async ({ hospitalId, payload }) => {
      const res = await api.patch(`/admin/beds/${hospitalId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Bed inventory updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-beds'] });
      setEditingHospital(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update beds');
    },
  });

  if (isLoading) {
    return <Loader message="Loading beds status..." />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Failed to load beds data
      </div>
    );
  }

  const filteredHospitals = hospitals?.filter((h) =>
    h.hospitalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getWardData = (inventory = [], wardName) => {
    return inventory.find((b) => b.ward?.toLowerCase() === wardName.toLowerCase()) || { totalBeds: 0, occupiedBeds: 0, availableBeds: 0 };
  };

  const renderBedCell = (bedData) => {
    const { totalBeds = 0, occupiedBeds = 0, availableBeds = 0 } = bedData;
    const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
    
    let colorClass = 'text-green-600';
    if (occupancyRate > 85) colorClass = 'text-red-600';
    else if (occupancyRate > 70) colorClass = 'text-orange-500';

    if (totalBeds === 0) {
      return <span className="text-slate-400 font-mono text-xs">Unlisted</span>;
    }

    return (
      <div className="flex flex-col">
        <span className="font-bold text-slate-900">{occupiedBeds} / {totalBeds}</span>
        <span className={`text-xs font-semibold ${colorClass}`}>{availableBeds} available</span>
      </div>
    );
  };

  const handleEditClick = (hospital) => {
    setEditingHospital(hospital);
    
    const initialForm = {};
    WARDS.forEach(ward => {
      const wardData = getWardData(hospital.bedsInventory, ward);
      initialForm[ward] = {
        totalBeds: wardData.totalBeds || 0,
        occupiedBeds: wardData.occupiedBeds || 0
      };
    });
    setBedsForm(initialForm);
  };

  const handleInputChange = (ward, field, value) => {
    const val = Math.max(0, parseInt(value, 10) || 0);
    setBedsForm(prev => ({
      ...prev,
      [ward]: {
        ...prev[ward],
        [field]: val
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      beds: Object.entries(bedsForm).map(([ward, data]) => ({
        ward,
        totalBeds: data.totalBeds,
        occupiedBeds: data.occupiedBeds
      }))
    };
    updateBedsMutation.mutate({ hospitalId: editingHospital._id, payload });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bed className="w-6 h-6 text-blue-600" />
            Live Bed Management Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">Cross-hospital bed occupancy and capacity monitoring.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search hospitals or cities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Hospital Name</th>
                <th className="px-4 py-3 font-semibold">City</th>
                {WARDS.map(w => (
                  <th key={w} className="px-4 py-3 font-semibold">{w}</th>
                ))}
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHospitals?.map((h) => (
                <tr key={h._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{h.hospitalName}</td>
                  <td className="px-4 py-3 text-slate-600">{h.city}</td>
                  {WARDS.map(w => (
                    <td key={w} className="px-4 py-3">{renderBedCell(getWardData(h.bedsInventory, w))}</td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEditClick(h)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredHospitals?.length === 0 && (
                <tr>
                  <td colSpan={WARDS.length + 3} className="px-4 py-8 text-center text-slate-500">
                    No hospitals found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Beds Dialog */}
      {editingHospital && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900">Override Bed Inventory</h3>
              <button onClick={() => setEditingHospital(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Manually set bed capacities and occupancies for <span className="font-bold text-slate-800">{editingHospital.hospitalName}</span>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
                  <div>Ward / Department</div>
                  <div>Total Beds</div>
                  <div>Occupied Beds</div>
                </div>
                
                {WARDS.map(ward => (
                  <div key={ward} className="grid grid-cols-3 gap-4 items-center">
                    <span className="text-sm font-semibold text-slate-800">{ward}</span>
                    <input
                      type="number"
                      min="0"
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={bedsForm[ward]?.totalBeds ?? 0}
                      onChange={(e) => handleInputChange(ward, 'totalBeds', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={bedsForm[ward]?.occupiedBeds ?? 0}
                      onChange={(e) => handleInputChange(ward, 'occupiedBeds', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingHospital(null)}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBedsMutation.isPending}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1"
                >
                  <Check size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBeds;
