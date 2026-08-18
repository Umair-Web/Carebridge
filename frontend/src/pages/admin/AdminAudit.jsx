import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, AlertCircle, RefreshCw, Search, Download } from 'lucide-react';
import api from '../../utils/api';
import Loader from '../../components/Loader';
import toast from 'react-hot-toast';

const AdminAudit = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-logs');
      return res.data.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return <Loader message="Loading audit logs..." />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Failed to load audit logs
      </div>
    );
  }

  const filteredLogs = logs?.filter((log) =>
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entityModel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.adminId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.adminId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString('en-PK', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getActionColor = (action) => {
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'text-blue-600 bg-blue-50';
    if (action.includes('OVERRIDE')) return 'text-red-600 bg-red-50';
    if (action.includes('APPROVE') || action.includes('DISBURSE')) return 'text-green-600 bg-green-50';
    return 'text-slate-600 bg-slate-100';
  };

  const handleExportAudit = async () => {
    const toastId = toast.loading('Exporting audit logs...');
    try {
      const res = await api.get('/admin/audit-logs/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit-logs.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Export successful', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to export audit logs', { id: toastId });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            Compliance & Audit Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">Immutable record of system changes and administrative overrides.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportAudit}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, user, or entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Administrator</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity Model</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs?.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{log.adminId?.name || 'System'}</div>
                    <div className="text-xs text-slate-500">{log.adminId?.email || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{log.entityModel}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.ipAddress}</td>
                </tr>
              ))}
              {filteredLogs?.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    No audit logs found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAudit;
