import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, FileCheck, Eye, EyeOff, MapPin } from 'lucide-react';
import api from '../utils/api';
import PolicyAgreement from '../components/PolicyAgreement';

const ConsultantRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    pmdcNumber: '',
    cnic: '',
    specialty: 'General Physician',
    clinicName: '',
    clinicAddress: '',
    lat: '',
    lng: '',
    role: 'consultant'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [verificationDocuments, setVerificationDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleFileUpload = async (e, docName) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append('file', file);
        
        const res = await api.post('/upload', uploadData, {
        // headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (res.data.success) {
          const fileUrl = res.data.url;
          setVerificationDocuments(prev => [
            ...prev.filter(d => d.name !== docName),
            { name: docName, url: fileUrl }
          ]);
          toast.success(`${docName} uploaded successfully`);
        }
      } catch (err) {
        console.error('Upload failed:', err);
        toast.error(`Failed to upload ${docName}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      return toast.error('Geolocation is not supported by your browser');
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setIsDetecting(false);
        toast.success('Location detected');
      },
      () => {
        setIsDetecting(false);
        toast.error('Could not detect location. Please allow location access and try again.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedToPolicy) {
      return toast.error('Please read and accept the Privacy Policy & SOP to continue');
    }
    if (!verificationDocuments.find(d => d.name === 'PMDC Certificate')) {
      return toast.error('Please upload your PMDC Certificate for verification');
    }
    if (!verificationDocuments.find(d => d.name === 'CNIC')) {
      return toast.error('Please upload your CNIC copy for verification');
    }
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(formData.cnic)) {
      return toast.error('CNIC must be in the format XXXXX-XXXXXXX-X');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return toast.error('Please enter a valid email address');
    }
    const phoneClean = formData.phone.replace(/[\s\-()]/g, '');
    const phoneRegex = /^((\+92)|(0092)|0)?3\d{9}$/;
    if (!phoneRegex.test(phoneClean)) {
      return toast.error('Please enter a valid Pakistani phone number (e.g. 03001234567)');
    }
    if (formData.password.length < 8) {
      return toast.error('Password must be at least 8 characters long');
    }
    const result = await register({ ...formData, phone: phoneClean, verificationDocuments });
    if (result.success) {
      toast.success(result.message || 'Registration successful! A verification code was sent to your email.', { duration: 6000, icon: '✉️' });
      navigate('/verify-email', { state: { email: result.email || formData.email } });
    } else {
      toast.error(result.message || 'Registration failed');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link to="/register" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-4">
          <ArrowLeft size={16} className="mr-1" /> Back to roles
        </Link>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Consultant Registration
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Join the CareBridge referral network
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input name="name" type="text" required value={formData.name} onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              placeholder="Dr. John Doe" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">PMDC Number</label>
              <input name="pmdcNumber" type="text" required value={formData.pmdcNumber} onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                placeholder="12345-P" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specialty</label>
              <select name="specialty" value={formData.specialty} onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-white">
                <option value="General Physician">General Physician</option>
                <option value="Cardiologist">Cardiologist</option>
                <option value="Neurologist">Neurologist</option>
                <option value="Orthopedic">Orthopedic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">CNIC Number</label>
            <input name="cnic" type="text" required value={formData.cnic} onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              placeholder="42101-XXXXXXX-X" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Clinic Name (Optional)</label>
            <input name="clinicName" type="text" value={formData.clinicName} onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              placeholder="City Health Clinic" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Clinic Address (Optional)</label>
            <input name="clinicAddress" type="text" value={formData.clinicAddress} onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              placeholder="Street, area, city" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Clinic Location</label>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Latitude</label>
                  <input name="lat" type="text" readOnly value={formData.lat}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 cursor-not-allowed outline-none transition-all shadow-sm"
                    placeholder="Not detected" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Longitude</label>
                  <input name="lng" type="text" readOnly value={formData.lng}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 cursor-not-allowed outline-none transition-all shadow-sm"
                    placeholder="Not detected" />
                </div>
              </div>
              <button
                type="button"
                onClick={detectLocation}
                disabled={isDetecting}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <MapPin size={16} /> {isDetecting ? 'Detecting…' : 'Detect Location'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Tap “Detect Location” to automatically capture your clinic’s coordinates.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
            <input name="email" type="email" required value={formData.email} onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              placeholder="doctor@example.com" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <input name="phone" type="tel" required value={formData.phone} onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              placeholder="+92 300 1234567" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input name="password" type={showPassword ? "text" : "password"} required value={formData.password} onChange={handleChange}
                className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                placeholder="••••••••" />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Verification Documents</label>
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <p className="text-xs text-blue-600 font-medium mb-4">
                Please upload a clear copy of your PMDC Registration Certificate. This is required for account activation.
              </p>
              
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(e, 'PMDC Certificate')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading}
                />
                <div className={`flex items-center justify-between p-4 bg-white rounded-xl border-2 border-dashed ${verificationDocuments.find(d => d.name === 'PMDC Certificate') ? 'border-emerald-500 bg-emerald-50' : 'border-blue-200 group-hover:border-blue-400'} transition-all`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${verificationDocuments.find(d => d.name === 'PMDC Certificate') ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                      <ArrowLeft className={`w-5 h-5 transform rotate-90`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {verificationDocuments.find(d => d.name === 'PMDC Certificate') ? 'Certificate Uploaded' : 'Upload PMDC Certificate'}
                      </p>
                      <p className="text-xs text-slate-500">PDF, JPG, PNG (Max 5MB)</p>
                    </div>
                  </div>
                  {verificationDocuments.find(d => d.name === 'PMDC Certificate') && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <span className="text-xs font-bold uppercase">Ready</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative group mt-4">
                <input 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(e, 'CNIC')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading}
                />
                <div className={`flex items-center justify-between p-4 bg-white rounded-xl border-2 border-dashed ${verificationDocuments.find(d => d.name === 'CNIC') ? 'border-emerald-500 bg-emerald-50' : 'border-blue-200 group-hover:border-blue-400'} transition-all`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${verificationDocuments.find(d => d.name === 'CNIC') ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                      <ArrowLeft className={`w-5 h-5 transform rotate-90`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {verificationDocuments.find(d => d.name === 'CNIC') ? 'CNIC Copy Uploaded' : 'Upload CNIC Copy'}
                      </p>
                      <p className="text-xs text-slate-500">PDF, JPG, PNG (Max 5MB)</p>
                    </div>
                  </div>
                  {verificationDocuments.find(d => d.name === 'CNIC') && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <span className="text-xs font-bold uppercase">Ready</span>
                    </div>
                  )}
                </div>
              </div>
              {isUploading && (
                <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold uppercase tracking-wider">Uploading...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <PolicyAgreement agreed={agreedToPolicy} onChange={setAgreedToPolicy} accent="blue" />

        <button type="submit" disabled={isLoading || !agreedToPolicy}
          className="w-full py-3.5 px-4 border border-transparent rounded-xl shadow-md hover:shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4">
          {isLoading ? 'Creating Account...' : 'Complete Registration'}
        </button>
      </form>

      <div className="mt-8 text-center text-sm">
        <span className="text-slate-600">Already have an account? </span>
        <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">Sign in</Link>
      </div>
    </div>
  );
};

export default ConsultantRegister;
