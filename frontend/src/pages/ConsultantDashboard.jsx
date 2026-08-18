import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import Loader from '../components/Loader';

const ConsultantDashboard = () => {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { name: 'Total Referrals', value: '0', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'blue' },
    { name: 'Accepted', value: '0', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'green' },
    { name: 'Earnings (PKR)', value: '0', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'indigo' },
  ]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch referrals and earnings independently so a failure in one
      // never blanks out the other's stat (e.g. the Accepted count).
      const [refRes, earnRes] = await Promise.allSettled([
        api.get('/referrals/mine'),
        api.get('/referrals/earnings'),
      ]);

      let total = 0;
      let accepted = 0;
      if (refRes.status === 'fulfilled' && refRes.value.data.success) {
        const data = refRes.value.data.data;
        setReferrals(data);
        total = data.length;
        // Only referrals currently in the "accepted" status for this consultant.
        accepted = data.filter(r => r.status === 'accepted').length;
      } else {
        console.error('Failed to fetch referrals:', refRes.reason);
      }

      let earningsDisplay = '0 PKR';
      if (earnRes.status === 'fulfilled' && earnRes.value.data.success) {
        const paisa = earnRes.value.data.data.totalEarningsPaisa || 0;
        earningsDisplay = (paisa / 100).toLocaleString() + ' PKR';
      } else if (earnRes.status === 'rejected') {
        console.error('Failed to fetch earnings:', earnRes.reason);
      }

      setStats(prev => [
        { ...prev[0], value: total.toString() },
        { ...prev[1], value: accepted.toString() },
        { ...prev[2], value: earningsDisplay },
      ]);

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  if (loading) return <Loader message="Loading dashboard stats..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultant Dashboard</h1>
          <p className="text-gray-500">Welcome back. Here is your referral overview.</p>
        </div>
        <Link 
          to="/referrals/new"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Create New Referral
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.name}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Recent Referrals</h2>
          <Link to="/referrals" className="text-blue-600 text-sm font-semibold hover:underline">View All →</Link>
        </div>
        
        {referrals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                  <th className="px-6 py-4">Referral ID</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Hospital</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referrals.slice(0, 5).map((r) => (
                  <tr key={r._id}
                    className="hover:bg-blue-50/40 transition-all cursor-pointer"
                    title="Click to view full details"
                    onClick={() => navigate('/referrals')}
                  >
                    <td className="px-6 py-4 font-semibold text-blue-600 font-mono text-sm">{r.referralCode}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{r.patientName}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{r.targetHospitalId?.hospitalName || 'Pending'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                        r.status === 'pending'  ? 'bg-yellow-50 text-yellow-600' :
                        r.status === 'accepted' ? 'bg-green-50 text-green-600' :
                        r.status === 'rejected' ? 'bg-red-50 text-red-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-medium">No referrals yet</h3>
            <p className="text-gray-500 text-sm mt-1 max-max-xs mx-auto">Start by creating your first patient referral using the smart intake form.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultantDashboard;

