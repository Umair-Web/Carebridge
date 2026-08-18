import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">CareBridge<span className="text-blue-600">Health</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600">Sign In</Link>
          <Link to="/register/consultant" className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-all">Join Now</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 text-center">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-8">
          Pakistan's Digital <br/>
          <span className="text-blue-600">Referral Ecosystem</span>
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-slate-500 mb-12">
          Connecting consultants and hospitals on a single, trackable, and revenue-generating digital platform.
        </p>

        {/* Role Selection Cards */}
        <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto mt-12">
          <div className="group bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:border-blue-300 transition-all text-left">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">For Consultants</h2>
            <p className="text-slate-500 mb-8">Initiate smart referrals, track patient journeys, and monitor your earnings in real-time.</p>
            <div className="flex flex-col gap-3">
              <Link to="/register/consultant" className="bg-white border border-slate-200 text-center py-3 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-200 transition-all">Create Consultant Account</Link>
              <Link to="/login" className="text-blue-600 font-bold text-center py-2">Sign in to Portal</Link>
            </div>
          </div>

          <div className="group bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:border-blue-300 transition-all text-left">
            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4m0 10V4m-4 18h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">For Hospitals</h2>
            <p className="text-slate-500 mb-8">Manage referral inbox, live bed inventory, and department routing from a central dashboard.</p>
            <div className="flex flex-col gap-3">
              <Link to="/register/hospital" className="bg-white border border-slate-200 text-center py-3 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-200 transition-all">Register Your Hospital</Link>
              <Link to="/login" className="text-indigo-600 font-bold text-center py-2">Hospital Login</Link>
            </div>
          </div>
        </div>
      </main>

      {/* Stats Section */}
      <div className="bg-slate-900 py-16 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold mb-1">500+</p>
            <p className="text-slate-400 text-sm">Active Consultants</p>
          </div>
          <div>
            <p className="text-4xl font-bold mb-1">120+</p>
            <p className="text-slate-400 text-sm">Partner Hospitals</p>
          </div>
          <div>
            <p className="text-4xl font-bold mb-1">15k+</p>
            <p className="text-slate-400 text-sm">Monthly Referrals</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
