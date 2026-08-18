import { useState } from 'react';
import { Send, User, Clock, ShieldCheck } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../features/auth/AuthContext';

const ClinicalNotesLog = ({ referralId, initialNotes = [], onNoteAdded }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState('');
  const [type, setType] = useState(user?.role === 'consultant' ? 'consultant' : 'nursing');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/referrals/${referralId}/notes`, { content, type });
      if (res.data.success) {
        const newNote = res.data.data;
        setNotes([...notes, newNote]);
        setContent('');
        toast.success('Note added');
        if (onNoteAdded) onNoteAdded(newNote);
      }
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-600" />
          Clinical Timeline & Notes
        </h3>
        {user?.role !== 'consultant' && (
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setType('nursing')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${type === 'nursing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Nursing
            </button>
            <button 
              onClick={() => setType('consultant')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${type === 'consultant' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Consultant
            </button>
          </div>
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
        {notes.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-400 italic">No clinical notes recorded yet.</p>
          </div>
        ) : (
          notes.map((note, idx) => (
            <div key={idx} className={`flex gap-3 ${note.type === 'consultant' ? 'flex-row' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${note.type === 'consultant' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {note.authorName?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{note.authorName}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl text-sm ${note.type === 'consultant' ? 'bg-indigo-50/50 text-indigo-900 rounded-tl-none' : 'bg-emerald-50/50 text-emerald-900 rounded-tl-none'}`}>
                  <div className="text-[9px] font-black uppercase tracking-tighter mb-1 opacity-50">
                    {note.type} Note
                  </div>
                  {note.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Add a ${type} note...`}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] resize-none transition-all"
        />
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="absolute bottom-3 right-3 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
    </div>
  );
};

export default ClinicalNotesLog;
