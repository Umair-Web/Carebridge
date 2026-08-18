import { useState } from 'react';
import { Upload, Eye, Loader2, Lock } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

/**
 * Upload or replace a named profile document (PMDC, CNIC, SHCC, etc.)
 * When `locked` is true, the document is verified and can be viewed but not replaced.
 */
const ProfileDocumentUpload = ({ docName, documents = [], onUpdated, locked = false }) => {
  const [uploading, setUploading] = useState(false);
  const existing = documents.find((d) => d.name === docName);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    setUploading(true);
    try {
      const up = await api.post('/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!up.data.success || !up.data.url) {
        throw new Error('Upload failed');
      }
      const res = await api.post('/profile/documents', { name: docName, url: up.data.url });
      if (res.data.success) {
        toast.success(`${docName} updated`);
        onUpdated?.(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to upload ${docName}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-all ${
        existing ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{docName}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {locked
            ? 'Verified — locked from changes'
            : existing
              ? 'Uploaded — replace with a new file'
              : 'Required — upload PDF or image'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {existing?.url && (
          <a
            href={existing.url}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-blue-600"
            title="View"
          >
            <Eye size={18} />
          </a>
        )}
        {locked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg">
            <Lock size={14} />
            Verified
          </span>
        ) : (
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} disabled={uploading} />
            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {existing ? 'Replace' : 'Upload'}
            </span>
          </label>
        )}
      </div>
    </div>
  );
};

export default ProfileDocumentUpload;
