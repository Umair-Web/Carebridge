import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, EyeOff, FileCheck, Plus, Trash2, MapPin } from 'lucide-react';
import api from '../utils/api';
import PolicyAgreement from '../components/PolicyAgreement';

const LaboratoryRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    labName: '',
    registrationNumber: '',
    representativeCnic: '',
    city: 'Karachi',
    area: '',
    address: '',
    role: 'laboratory',
    lat: '',
    lng: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [tests, setTests] = useState([{ testName: '', price: '', turnaroundHours: 24 }]);
  const [registrationDocuments, setRegistrationDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleFileUpload = async (e, docName) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const uploadData = new FormData();
      uploadData.append('file', file);
      const res = await api.post('/upload', uploadData);
      if (res.data.success) {
        setRegistrationDocuments((prev) => [
          ...prev.filter((d) => d.name !== docName),
          { name: docName, url: res.data.url },
        ]);
        toast.success(`${docName} uploaded successfully`);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(`Failed to upload ${docName}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
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

  const updateTest = (idx, field, value) => {
    setTests((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };
  const addTest = () => setTests((prev) => [...prev, { testName: '', price: '', turnaroundHours: 24 }]);
  const removeTest = (idx) => setTests((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedToPolicy) {
      toast.error('Please read and accept the Privacy Policy & SOP to continue');
      return;
    }
    if (!registrationDocuments.find((d) => d.name === 'Lab License')) {
      toast.error('Please upload your Lab License for verification.');
      return;
    }
    if (!registrationDocuments.find((d) => d.name === 'CNIC')) {
      toast.error('Please upload your CNIC copy for verification.');
      return;
    }
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(formData.representativeCnic)) {
      return toast.error('Representative CNIC must be in the format XXXXX-XXXXXXX-X');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return toast.error('Please enter a valid email address');
    }
    const phoneClean = formData.phone.replace(/[\s\-()]/g, '');
    const labPhoneRegex = /^((\+92)|(0092)|0)?(3\d{9}|(21|42|51|91|81|61|22|71)\d{7})$/;
    if (!labPhoneRegex.test(phoneClean)) {
      return toast.error('Please enter a valid Pakistani phone/landline number');
    }
    if (formData.password.length < 8) {
      return toast.error('Password must be at least 8 characters long');
    }

    // Tests are stored in paisa; UI takes PKR
    const testCatalog = tests
      .filter((t) => t.testName.trim() && t.price !== '' && Number(t.price) >= 0)
      .map((t) => ({
        testName: t.testName.trim(),
        price: Math.round(Number(t.price) * 100),
        turnaroundHours: Number(t.turnaroundHours) || 24,
      }));

    const payload = {
      ...formData,
      phone: phoneClean,
      testCatalog,
      registrationDocuments,
    };

    const result = await register(payload);
    if (result.success) {
      toast.success(result.message || 'Laboratory registered! A verification code was sent to your email.', {
        duration: 6000,
        icon: '✉️',
      });
      navigate('/verify-email', { state: { email: result.email || formData.email } });
    } else {
      toast.error(result.message || 'Registration failed');
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-sm text-sm';

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link
          to="/register"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-sky-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to roles
        </Link>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Laboratory Registration</h2>
        <p className="mt-2 text-sm text-slate-600">
          Onboard your lab — your account is reviewed and approved by an admin before you can log in.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Section 1: Lab Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Laboratory Details</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Laboratory Name</label>
            <input
              name="labName"
              type="text"
              required
              value={formData.labName}
              onChange={handleChange}
              className={inputClass}
              placeholder="City Diagnostic Lab"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registration Number</label>
              <input
                name="registrationNumber"
                type="text"
                required
                value={formData.registrationNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="L-12345"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Admin Full Name</label>
              <input
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className={inputClass}
                placeholder="John Admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Representative CNIC Number</label>
            <input
              name="representativeCnic"
              type="text"
              required
              value={formData.representativeCnic}
              onChange={handleChange}
              className={inputClass}
              placeholder="42101-XXXXXXX-X"
            />
            <p className="text-xs text-slate-400 mt-1">CNIC of the authorized lab representative.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">City</label>
              <input name="city" type="text" value={formData.city} onChange={handleChange} className={inputClass} placeholder="Karachi" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Area</label>
              <input name="area" type="text" value={formData.area} onChange={handleChange} className={inputClass} placeholder="Gulshan" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lab Address</label>
            <input
              name="address"
              type="text"
              required
              value={formData.address}
              onChange={handleChange}
              className={inputClass}
              placeholder="Main Road, Karachi"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Laboratory Location</label>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="grid grid-cols-2 gap-3 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Latitude</label>
                  <input
                    name="lat"
                    type="text"
                    readOnly
                    value={formData.lat}
                    className={`${inputClass} bg-slate-50 cursor-not-allowed`}
                    placeholder="Not detected"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Longitude</label>
                  <input
                    name="lng"
                    type="text"
                    readOnly
                    value={formData.lng}
                    className={`${inputClass} bg-slate-50 cursor-not-allowed`}
                    placeholder="Not detected"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={detectLocation}
                disabled={isDetecting}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-sky-200 text-sky-700 font-semibold text-sm hover:bg-sky-50 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <MapPin size={16} /> {isDetecting ? 'Detecting…' : 'Detect Location'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Tap “Detect Location” to automatically capture your lab’s coordinates.</p>
          </div>
        </div>

        {/* Section 2: Test Catalog (optional) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Test Catalog (optional)</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>
          <p className="text-xs text-slate-400">Add the tests you offer and their prices (PKR). You can edit these later.</p>
          <div className="space-y-3">
            {tests.map((t, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Test name</label>
                  <input
                    type="text"
                    value={t.testName}
                    onChange={(e) => updateTest(idx, 'testName', e.target.value)}
                    className={inputClass}
                    placeholder="CBC"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Price (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={t.price}
                    onChange={(e) => updateTest(idx, 'price', e.target.value)}
                    className={inputClass}
                    placeholder="1500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTest(idx)}
                  className="p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTest}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              <Plus size={16} /> Add test
            </button>
          </div>
        </div>

        {/* Section 3: Documents */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verification Documents</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>
          <div className="bg-sky-50 rounded-2xl p-5 border border-sky-100 space-y-4">
            <p className="text-xs text-sky-800 font-medium">
              Upload your Lab License, CNIC copy of the representative, and an optional rate list. All are reviewed during admin approval.
            </p>

            {['Lab License', 'CNIC', 'Rate List'].map((docName) => {
              const required = docName !== 'Rate List';
              const uploaded = registrationDocuments.find((d) => d.name === docName);
              return (
                <div key={docName} className="relative group">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e, docName)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isUploading}
                  />
                  <div
                    className={`flex items-center justify-between p-4 bg-white rounded-xl border-2 border-dashed transition-all ${
                      uploaded ? 'border-emerald-500 bg-emerald-50' : 'border-sky-200 group-hover:border-sky-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${uploaded ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {uploaded ? `${docName} uploaded` : `Upload ${docName}`}
                          {required && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <p className="text-xs text-slate-500">PDF, JPG, PNG (max 5MB)</p>
                      </div>
                    </div>
                    {uploaded && <span className="text-xs font-bold text-emerald-600 uppercase">Ready</span>}
                  </div>
                </div>
              );
            })}

            {isUploading && <p className="text-xs text-center text-sky-700 font-semibold animate-pulse">Uploading document…</p>}
          </div>
        </div>

        {/* Section 4: Account Credentials */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account Credentials</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
            <input name="email" type="email" required value={formData.email} onChange={handleChange} className={inputClass} placeholder="admin@lab.com" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <input name="phone" type="tel" required value={formData.phone} onChange={handleChange} className={inputClass} placeholder="021-3456789" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`${inputClass} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <PolicyAgreement agreed={agreedToPolicy} onChange={setAgreedToPolicy} accent="sky" />

        <button
          type="submit"
          disabled={isLoading || !agreedToPolicy}
          className="w-full py-3.5 px-4 border border-transparent rounded-xl shadow-md hover:shadow-lg text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Register Laboratory'}
        </button>
      </form>

      <div className="mt-8 text-center text-sm">
        <span className="text-slate-600">Already have an account? </span>
        <Link to="/login" className="font-bold text-sky-600 hover:text-sky-500 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
};

export default LaboratoryRegister;
