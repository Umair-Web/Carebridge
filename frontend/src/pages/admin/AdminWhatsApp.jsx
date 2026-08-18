import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Send, Users, User, Search, CheckSquare,
  Square, ChevronDown, RefreshCw, Smartphone, AlertCircle,
  BarChart2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'consultant', label: 'Consultants' },
  { value: 'hospital', label: 'Hospitals' },
];

const MAX_CHARS = 1500;

const AdminWhatsApp = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [broadcastRole, setBroadcastRole] = useState('');
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);

  const [message, setMessage] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [waStatus, setWaStatus] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/whatsapp/status');
      if (res.data.success) setWaStatus(res.data.data);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await api.get('/admin/whatsapp/users', { params });
      setUsers(res.data.data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchTerm]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const toggleUser = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u._id)));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    const payload = { message: message.trim() };

    if (isBroadcastMode) {
      payload.role = broadcastRole || 'all';
    } else {
      if (selectedIds.size === 0) {
        toast.error('Please select at least one recipient');
        return;
      }
      payload.userIds = [...selectedIds];
    }

    setSending(true);
    try {
      const res = await api.post('/admin/whatsapp/send', payload);
      if (res.data.success) {
        setLastResult(res.data.data);
        if (res.data.data?.mockMode) {
          toast('Mock mode: messages logged on server console only. Add Meta API keys to .env for live delivery.', {
            icon: '⚠️',
            duration: 7000,
          });
        }
        toast.success(res.data.message, { icon: '📱', duration: 5000 });
        setMessage('');
        setSelectedIds(new Set());
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  const roleColor = (role) => {
    if (role === 'consultant') return 'bg-blue-100 text-blue-700';
    if (role === 'hospital') return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="text-emerald-500" size={26} />
            WhatsApp Messaging
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Send WhatsApp notifications to individual users or broadcast to a role group.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all"
          title="Refresh user list"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {waStatus && !waStatus.productionReady && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">
              {waStatus.mockMode ? 'WhatsApp not configured' : 'Not ready for live users'}
            </p>
            <p className="mt-1 text-amber-800">{waStatus.message}</p>
            {!waStatus.mockMode && (
              <p className="mt-2 text-amber-800 text-xs">
                Real users need approved templates in Meta +{' '}
                <code className="bg-amber-100 px-1 rounded">META_WA_USE_TEMPLATES=true</code>. See{' '}
                <code className="bg-amber-100 px-1 rounded">backend/docs/WHATSAPP_LIVE_SETUP.md</code>.
              </p>
            )}
          </div>
        </div>
      )}
      {waStatus?.productionReady && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <p className="font-semibold">Live WhatsApp mode</p>
            <p className="mt-1">
              Templates: OTP <code className="text-xs bg-emerald-100 px-1 rounded">{waStatus.templates?.otp}</code>, alerts{' '}
              <code className="text-xs bg-emerald-100 px-1 rounded">{waStatus.templates?.alert}</code>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Recipients Panel */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mode toggle */}
          <div className="flex border-b border-slate-100">
            <button
              id="tab-individual"
              onClick={() => setIsBroadcastMode(false)}
              className={`flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                !isBroadcastMode
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <User size={15} />
              Individual
            </button>
            <button
              id="tab-broadcast"
              onClick={() => setIsBroadcastMode(true)}
              className={`flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                isBroadcastMode
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Users size={15} />
              Broadcast
            </button>
          </div>

          {isBroadcastMode ? (
            /* Broadcast mode */
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Send the message to an entire role group in one click.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'all', label: 'All Users', icon: Users, count: users.length },
                  { value: 'consultant', label: 'Consultants', icon: User, count: users.filter(u => u.role === 'consultant').length },
                  { value: 'hospital', label: 'Hospitals', icon: Smartphone, count: users.filter(u => u.role === 'hospital').length },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    id={`broadcast-${opt.value}`}
                    onClick={() => setBroadcastRole(opt.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      broadcastRole === opt.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <opt.icon
                      size={20}
                      className={broadcastRole === opt.value ? 'text-emerald-600 mb-2' : 'text-slate-400 mb-2'}
                    />
                    <div className={`font-semibold text-sm ${broadcastRole === opt.value ? 'text-emerald-800' : 'text-slate-700'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.count} users</div>
                  </button>
                ))}
              </div>

              {!broadcastRole && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={15} />
                  Select a broadcast group above
                </div>
              )}
            </div>
          ) : (
            /* Individual mode */
            <>
              {/* Search & filter bar */}
              <div className="p-4 border-b border-slate-100 flex gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="wa-search"
                    type="text"
                    placeholder="Search by name or phone…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="relative">
                  <select
                    id="wa-role-filter"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Select all */}
              <div className="px-4 py-2.5 bg-slate-50 flex items-center gap-2 border-b border-slate-100">
                <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                  {selectedIds.size === users.length && users.length > 0 ? (
                    <CheckSquare size={16} className="text-emerald-500" />
                  ) : (
                    <Square size={16} />
                  )}
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </button>
              </div>

              {/* User list */}
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <RefreshCw size={20} className="animate-spin mr-2" />
                    Loading users…
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No users found</div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u._id}
                      id={`wa-user-${u._id}`}
                      onClick={() => toggleUser(u._id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-all ${
                        selectedIds.has(u._id) ? 'bg-emerald-50' : ''
                      }`}
                    >
                      {selectedIds.has(u._id) ? (
                        <CheckSquare size={17} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Square size={17} className="text-slate-300 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-slate-800 truncate">{u.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{u.phone}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                      {u.isPhoneVerified ? (
                        <Smartphone size={13} className="text-emerald-500 flex-shrink-0" title="Phone verified" />
                      ) : (
                        <Smartphone size={13} className="text-slate-300 flex-shrink-0" title="Phone not verified" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Compose Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Send size={16} className="text-emerald-500" />
              Compose Message
            </h3>

            {/* Recipient preview */}
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4 text-sm">
              {isBroadcastMode ? (
                <span className="text-slate-600">
                  Broadcasting to: <strong className="text-slate-900">
                    {broadcastRole === 'all' ? 'All Users' : broadcastRole === 'consultant' ? 'All Consultants' : broadcastRole === 'hospital' ? 'All Hospitals' : '—'}
                  </strong>
                </span>
              ) : (
                <span className="text-slate-600">
                  Sending to: <strong className="text-slate-900">{selectedIds.size} user{selectedIds.size !== 1 ? 's' : ''}</strong>
                </span>
              )}
            </div>

            {/* Message textarea */}
            <div className="relative mb-4">
              <textarea
                id="wa-message"
                rows={7}
                placeholder="Type your WhatsApp message here…"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
              />
              <span className={`absolute bottom-3 right-3 text-xs ${message.length > MAX_CHARS * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                {message.length}/{MAX_CHARS}
              </span>
            </div>

            {/* Preview box */}
            {message.trim() && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
                <p className="text-xs text-emerald-700 font-semibold mb-2 uppercase tracking-wide">Preview</p>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-emerald-600 font-bold mb-1">📢 CareBridge Health — Admin Message</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{message.trim()}</p>
                  <p className="text-xs text-slate-400 mt-2">— CareBridge Health Platform</p>
                </div>
              </div>
            )}

            {/* Send button */}
            <button
              id="btn-send-whatsapp"
              onClick={handleSend}
              disabled={sending || !message.trim() || (isBroadcastMode ? !broadcastRole : selectedIds.size === 0)}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send via WhatsApp
                </>
              )}
            </button>
          </div>

          {/* Last result */}
          {lastResult && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BarChart2 size={16} className="text-blue-500" />
                Delivery Result
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-slate-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-slate-800">{lastResult.total}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="text-center bg-emerald-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-emerald-600">{lastResult.sent}</div>
                  <div className="text-xs text-emerald-600">Sent</div>
                </div>
                <div className="text-center bg-red-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-red-500">{lastResult.failed}</div>
                  <div className="text-xs text-red-500">Failed</div>
                </div>
              </div>
              <button
                onClick={() => setLastResult(null)}
                className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={12} /> Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminWhatsApp;
