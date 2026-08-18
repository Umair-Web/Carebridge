import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, EyeOff, FileCheck, MapPin } from 'lucide-react';
import api from '../utils/api';
import PolicyAgreement from '../components/PolicyAgreement';

const WARDS = ['General', 'Private', 'ICU', 'NICU', 'PICU', 'HDU', 'Burns', 'Maternity', 'Psychiatric', 'Cardiac'];

const DEPT_OPTIONS = [
  'Internal Medicine',
  'Cardiology',
  'Orthopedics',
  'Neurology',
  'Gastroenterology',
  'General Surgery',
  'Pediatrics',
  'Psychiatry',
  'Gynae/Obs',
  'Radiology',
  'Anesthesiology',
  'Pathology',
];

const defaultBeds = () =>
  WARDS.map((ward) => ({
    ward,
    totalBeds: ward === 'General' ? 20 : ward === 'ICU' ? 6 : 0,
    availableBeds: ward === 'General' ? 10 : ward === 'ICU' ? 2 : 0,
  }));

const HospitalRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hospitalName: '',
    registrationNumber: '',
    representativeCnic: '',
    address: '',
    role: 'hospital',
    lat: '24.8607',
    lng: '67.0099',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState(['Internal Medicine']);
  const [bedsInventory, setBedsInventory] = useState(defaultBeds);
  const [registrationDocuments, setRegistrationDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

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

  const handleFileUpload = async (e, docName) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const uploadData = new FormData();
      uploadData.append('file', file);
      const res = await api.post('/upload', uploadData, {
        // headers: { 'Content-Type': 'multipart/form-data' },
      });
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

  const toggleDepartment = (dept) => {
    setDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const updateBed = (ward, field, raw) => {
    const n = raw === '' ? '' : Number(raw);
    setBedsInventory((prev) =>
      prev.map((row) =>
        row.ward === ward ? { ...row, [field]: n === '' ? '' : n } : row
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedToPolicy) {
      toast.error('Please read and accept the Privacy Policy & SOP to continue');
      return;
    }
    if (departments.length === 0) {
      toast.error('Please select at least one department.');
      return;
    }
    if (!registrationDocuments.find(d => d.name === 'SHCC License')) {
      toast.error('Please upload your SHCC License for verification.');
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
    const phoneRegex = /^((\+92)|(0092)|0)?3\d{9}$/;
    // Wait, hospital phone number can also be landline (e.g. 021-3456789).
    // Let's support both mobile and landline for hospital: /^((\+92)|(0092)|0)?(3\d{9}|\d{2,3}\d{7,8})$/
    const hospitalPhoneRegex = /^((\+92)|(0092)|0)?(3\d{9}|(21|42|51|91|81|61|22|71)\d{7})$/;
    if (!hospitalPhoneRegex.test(phoneClean)) {
      return toast.error('Please enter a valid Pakistani phone/landline number');
    }
    if (formData.password.length < 8) {
      return toast.error('Password must be at least 8 characters long');
    }
    const bedsPayload = bedsInventory.map((row) => ({
      ward: row.ward,
      totalBeds: Number(row.totalBeds),
      availableBeds: Number(row.availableBeds),
    }));
    const payload = {
      ...formData,
      phone: phoneClean,
      departments,
      bedsInventory: bedsPayload,
      registrationDocuments,
      location: {
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
      },
    };
    delete payload.lat;
    delete payload.lng;

    const result = await register(payload);
    if (result.success) {
      toast.success(result.message || 'Hospital registered! A verification code was sent to your email.', { duration: 6000, icon: '✉️' });
      navigate('/verify-email', { state: { email: result.email || formData.email } });
    } else {
      toast.error(result.message || 'Registration failed');
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm";

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link to="/register" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-4">
          <ArrowLeft size={16} className="mr-1" /> Back to roles
        </Link>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Hospital Registration
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Onboard your facility — departments, beds, and location are required for referrals.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Section 1: Facility Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Facility Details</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital Name</label>
            <input name="hospitalName" type="text" required value={formData.hospitalName}
              onChange={handleChange} className={inputClass} placeholder="City General Hospital" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registration Number</label>
              <input name="registrationNumber" type="text" required value={formData.registrationNumber}
                onChange={handleChange} className={inputClass} placeholder="H-12345" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Admin Full Name</label>
              <input name="name" type="text" required value={formData.name}
                onChange={handleChange} className={inputClass} placeholder="John Admin" />
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
            <p className="text-xs text-slate-400 mt-1">CNIC of the authorized hospital administrator.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital Address</label>
            <input name="address" type="text" required value={formData.address}
              onChange={handleChange} className={inputClass} placeholder="Main Road, Karachi" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Departments Served</label>
            <div className="flex flex-wrap gap-2">
              {DEPT_OPTIONS.map((dept) => (
                <button key={dept} type="button" onClick={() => toggleDepartment(dept)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    departments.includes(dept)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                  }`}>
                  {dept}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Select all departments your hospital accepts for referrals.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital Location</label>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Latitude</label>
                  <input name="lat" type="text" required readOnly value={formData.lat}
                    className={`${inputClass} bg-slate-50 cursor-not-allowed`} placeholder="Not detected" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Longitude</label>
                  <input name="lng" type="text" required readOnly value={formData.lng}
                    className={`${inputClass} bg-slate-50 cursor-not-allowed`} placeholder="Not detected" />
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
            <p className="text-xs text-slate-400 mt-1.5">Tap “Detect Location” to automatically capture your hospital’s coordinates.</p>
          </div>
        </div>

        {/* Section 2: Bed Inventory */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bed Inventory</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Ward</th>
                  <th className="text-left px-4 py-3 font-semibold">Total Beds</th>
                  <th className="text-left px-4 py-3 font-semibold">Available</th>
                </tr>
              </thead>
              <tbody>
                {bedsInventory.map((row) => (
                  <tr key={row.ward} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                        row.ward === 'ICU' || row.ward === 'NICU' || row.ward === 'PICU'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-600'
                      }`}>{row.ward}</span>
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min={0} required value={row.totalBeds}
                        onChange={(e) => updateBed(row.ward, 'totalBeds', e.target.value)}
                        className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min={0} required value={row.availableBeds}
                        onChange={(e) => updateBed(row.ward, 'availableBeds', e.target.value)}
                        className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Supporting Documents */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verification Documents</h3>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>
          <div className="bg-teal-50 rounded-2xl p-5 border border-teal-100 space-y-4">
            <p className="text-xs text-teal-800 font-medium">
              Upload SHCC license, CNIC copy of the representative, and optional rate list. All are reviewed during admin approval.
            </p>

            {['SHCC License', 'CNIC', 'Rate List'].map((docName) => {
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
                      uploaded ? 'border-emerald-500 bg-emerald-50' : 'border-teal-200 group-hover:border-teal-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${uploaded ? 'bg-emerald-100 text-emerald-600' : 'bg-teal-100 text-teal-600'}`}>
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

            {isUploading && (
              <p className="text-xs text-center text-teal-700 font-semibold animate-pulse">Uploading document…</p>
            )}
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
            <input name="email" type="email" required value={formData.email}
              onChange={handleChange} className={inputClass} placeholder="admin@hospital.com" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <input name="phone" type="tel" required value={formData.phone}
                onChange={handleChange} className={inputClass} placeholder="021-3456789" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input name="password" type={showPassword ? "text" : "password"} required value={formData.password}
                  onChange={handleChange} className={`${inputClass} pr-10`} placeholder="••••••••" />
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

        <PolicyAgreement agreed={agreedToPolicy} onChange={setAgreedToPolicy} accent="blue" />

        <button type="submit" disabled={isLoading || departments.length === 0 || !agreedToPolicy}
          className="w-full py-3.5 px-4 border border-transparent rounded-xl shadow-md hover:shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
          {isLoading ? 'Processing...' : 'Register Hospital'}
        </button>
      </form>

      <div className="mt-8 text-center text-sm">
        <span className="text-slate-600">Already have an account? </span>
        <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">Sign in</Link>
      </div>
    </div>
  );
};

export default HospitalRegister;

