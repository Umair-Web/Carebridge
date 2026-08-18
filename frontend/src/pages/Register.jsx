import { Link } from 'react-router-dom';
import { UserPlus, Building2, FlaskConical, ArrowRight } from 'lucide-react';

const Register = () => {
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create an account</h2>
        <p className="mt-2 text-slate-600">
          Select your role to join the CareBridge Health platform.
        </p>
      </div>

      <div className="space-y-4">
        {/* Consultant Card */}
        <Link 
          to="/register/consultant"
          className="group block w-full p-6 bg-white border-2 border-slate-100 hover:border-blue-500 rounded-2xl transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <UserPlus size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">I am a Consultant</h3>
                <p className="text-sm text-slate-500 mt-1">Refer patients and track your earnings</p>
              </div>
            </div>
            <ArrowRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>

        {/* Hospital Card */}
        <Link 
          to="/register/hospital"
          className="group block w-full p-6 bg-white border-2 border-slate-100 hover:border-blue-500 rounded-2xl transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Building2 size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">I am a Hospital Admin</h3>
                <p className="text-sm text-slate-500 mt-1">Receive referrals and manage admissions</p>
              </div>
            </div>
            <ArrowRight className="text-slate-300 group-hover:text-teal-500 transition-colors" />
          </div>
        </Link>

        {/* Laboratory Card */}
        <Link
          to="/register/laboratory"
          className="group block w-full p-6 bg-white border-2 border-slate-100 hover:border-sky-500 rounded-2xl transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <FlaskConical size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">I am a Laboratory</h3>
                <p className="text-sm text-slate-500 mt-1">Receive test referrals, upload reports, and bill</p>
              </div>
            </div>
            <ArrowRight className="text-slate-300 group-hover:text-sky-500 transition-colors" />
          </div>
        </Link>
      </div>

      <div className="text-center text-sm mt-10">
        <span className="text-slate-600">Already have an account? </span>
        <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
};

export default Register;
