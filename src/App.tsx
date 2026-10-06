/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Menu, LogOut, Zap, Users, Briefcase, Shield, BarChart3, CheckCircle, UserCheck, UserPlus, Upload, FileText, Loader2, Award, CreditCard, X, MoreVertical, Phone, Mail, Globe, Wrench, Trash2, Plus, Save, Power, HelpCircle, Info, BookOpen, Edit3 } from 'lucide-react';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AuthLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative p-4">
      <div className="absolute inset-0 bg-gray-100 backdrop-blur-sm -z-10" />
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function CountdownTimer() {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    // Expiration targets 30 days from now (static ticking clock for verification)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 29);
    targetDate.setHours(23, 59, 59, 0);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        setTimeString("Expired");
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeString(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
      <span>{timeString}</span>
    </div>
  );
}

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError(null);
    if (!terms) {
      setError('Please accept the terms and conditions');
      return;
    }
    try {
      const queryParams = new URLSearchParams(window.location.search);
      const joinedViaAdminRef = queryParams.get('ref') === 'admin' || sessionStorage.getItem('ref') === 'admin';

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), { 
        uid: cred.user.uid, 
        email, 
        termsAccepted: true, 
        activated: false, 
        activationStep: 'choose',
        tenantPopStep: 'unpaid',
        userPopStep: 'unpaid',
        joinedViaAdminRef: joinedViaAdminRef
      });
      navigate('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
    }
  };

  return (
    <AuthLayout title="Create Account">
      <div className="space-y-4">
        {error && <div className="text-red-500 text-sm bg-red-100 p-3 rounded-lg border border-red-200">{error}</div>}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-300 rounded-lg p-3"/>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full border border-gray-300 rounded-lg p-3"/>
        <label className="flex items-center text-sm text-gray-600">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mr-2" /> 
          I accept the terms and conditions
        </label>
        <button onClick={handleRegister} className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700">Register</button>
        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account? <button onClick={() => navigate('/login')} className="text-blue-600 font-semibold">Login</button>
        </p>
      </div>
    </AuthLayout>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (error) {
      setError('Login failed. Please check your credentials.');
    }
  };

  return (
    <AuthLayout title="Login">
      <div className="space-y-4">
        {error && <div className="text-red-500 text-sm bg-red-100 p-3 rounded-lg border border-red-200">{error}</div>}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-300 rounded-lg p-3"/>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full border border-gray-300 rounded-lg p-3"/>
        <button onClick={handleLogin} className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700">Login</button>
        <p className="text-center text-sm text-gray-600 mt-4">
          Don't have an account? <button onClick={() => navigate('/register')} className="text-blue-600 font-semibold">Register</button>
        </p>
      </div>
    </AuthLayout>
  );
}

function Activation({ onUpdate }: { onUpdate?: () => void }) {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState<'choose' | 'upload' | 'review' | 'approved' | 'rejected'>('choose');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [checkingLimits, setCheckingLimits] = useState(false);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.activationStep) {
            setStep(data.activationStep);
          }
          if (data.activationOption) {
            setSelectedOption(data.activationOption);
          }
          if (data.referredBy) {
            setReferredBy(data.referredBy);
          }
        }
      });
    }
  }, [user]);

  const handleChooseOption = async (option: string) => {
    setCheckingLimits(true);
    try {
      // Fetch spot limits
      const limitsSnap = await getDoc(doc(db, 'settings', 'limits'));
      let maxTenants = 100;
      let maxSubscribers = 100;
      if (limitsSnap.exists()) {
        const d = limitsSnap.data();
        if (d.maxTenants !== undefined) maxTenants = d.maxTenants;
        if (d.maxSubscribers !== undefined) maxSubscribers = d.maxSubscribers;
      }

      // Fetch all users to count approved
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsersList: any[] = [];
      usersSnap.forEach(d => {
        allUsersList.push(d.data());
      });

      const approvedTenantsCount = allUsersList.filter(u => u.activationOption === 'Become a tenant' && u.activationStep === 'approved').length;
      const approvedSubsCount = allUsersList.filter(u => u.activationOption === 'User Subscription' && u.activationStep === 'approved').length;

      if (option === 'Become a tenant') {
        if (approvedTenantsCount >= maxTenants) {
          alert(`Unable to choose: All ${maxTenants} tenant spots are full!`);
          setCheckingLimits(false);
          return;
        }

        if (referredBy) {
          const referrerDoc = allUsersList.find(u => u.uid === referredBy);
          if (referrerDoc) {
            const tenantQuota = referrerDoc.maxReferredTenants !== undefined ? Number(referrerDoc.maxReferredTenants) : 10;
            const referredTenants = allUsersList.filter(u => 
              u.referredBy === referredBy && 
              u.activationOption === 'Become a tenant' && 
              u.activationStep === 'approved'
            ).length;

            if (referredTenants >= tenantQuota) {
              alert(`Unable to choose: Referrer's tenant sign-up quota (${tenantQuota} tenants maximum) has been reached!`);
              setCheckingLimits(false);
              return;
            }
          }
        }
      } else if (option === 'User Subscription') {
        if (approvedSubsCount >= maxSubscribers) {
          alert(`Unable to choose: All ${maxSubscribers} subscription user spots are full!`);
          setCheckingLimits(false);
          return;
        }

        if (referredBy) {
          const referrerDoc = allUsersList.find(u => u.uid === referredBy);
          if (referrerDoc) {
            const subQuota = referrerDoc.maxReferredSubscribers !== undefined ? Number(referrerDoc.maxReferredSubscribers) : 100;
            const referredSubs = allUsersList.filter(u => 
              u.referredBy === referredBy && 
              u.activationOption === 'User Subscription' && 
              u.activationStep === 'approved'
            ).length;

            if (referredSubs >= subQuota) {
              alert(`Unable to choose: Referrer's subscription user sign-up quota (${subQuota} subscriptions maximum) has been reached!`);
              setCheckingLimits(false);
              return;
            }
          }
        }
      }

      setSelectedOption(option);
      setStep('upload');
    } catch (e) {
      console.error(e);
      alert('Failed to verify spot availability. Please try again.');
    } finally {
      setCheckingLimits(false);
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePic(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIdDoc(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdDocPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDocs = async () => {
    if (!user) return;
    if (!profilePic || !idDoc) {
      alert('Please upload both your profile picture and ID document.');
      return;
    }
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        activated: true,
        activationOption: selectedOption,
        activationStep: 'review',
        profilePicName: profilePic.name,
        idDocName: idDoc.name,
        profilePicData: profilePicPreview,
        idDocData: idDocPreview
      }, { merge: true });
      setStep('review');
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
      alert('Failed to submit activation request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'review') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
        <div className="relative flex items-center justify-center mb-6">
          <Loader2 className="text-blue-600 h-20 w-20 animate-spin" />
          <Zap className="text-yellow-500 h-8 w-8 absolute animate-pulse" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Review in Progress</h3>
        <p className="text-gray-500 max-w-sm mb-4 text-sm leading-relaxed">
          Thank you for submitting your activation documents for <span className="font-semibold text-blue-600">{selectedOption}</span>.
        </p>
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-4 py-3.5 rounded-xl max-w-xs mx-auto mb-6 shadow-inner">
          Review takes about 15 to 25 minutes.
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full flex items-center gap-1.5 border border-yellow-200 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 animate-ping"></span> Under Review
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="p-4 space-y-6 max-w-md mx-auto">
        <div className="text-center">
          <button onClick={() => setStep('choose')} className="text-xs text-blue-600 hover:underline mb-2 inline-block font-semibold">← Back to Options</button>
          <h3 className="text-xl font-bold text-gray-800">Verification Documents</h3>
          <p className="text-xs text-gray-500 mt-1">Provide the following files to activate your {selectedOption} account.</p>
        </div>

        <div className="space-y-4">
          <div className="border border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50 flex flex-col items-center text-center hover:border-blue-400 transition-colors">
            <Upload size={24} className="text-gray-400 mb-2" />
            <span className="text-sm font-semibold text-gray-700 mb-1">Profile Picture (Face Only)</span>
            <span className="text-xs text-gray-500 mb-3">Ensure your face is clearly visible</span>
            <input type="file" accept="image/*" onChange={handleProfilePicChange} className="hidden" id="profile-pic-upload" />
            <label htmlFor="profile-pic-upload" className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-gray-50 cursor-pointer">
              {profilePic ? 'Change Image' : 'Select Photo'}
            </label>
            {profilePicPreview && (
              <img src={profilePicPreview} alt="Profile preview" className="mt-3 h-16 w-16 rounded-full object-cover border-2 border-blue-500 shadow-md" />
            )}
          </div>

          <div className="border border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50 flex flex-col items-center text-center hover:border-blue-400 transition-colors">
            <FileText size={24} className="text-gray-400 mb-2" />
            <span className="text-sm font-semibold text-gray-700 mb-1">ID Document</span>
            <span className="text-xs text-gray-500 mb-3">Passport, National ID or Driver's License</span>
            <input type="file" accept="image/*,application/pdf" onChange={handleIdDocChange} className="hidden" id="id-doc-upload" />
            <label htmlFor="id-doc-upload" className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-gray-50 cursor-pointer">
              {idDoc ? 'Change Document' : 'Select Document'}
            </label>
            {idDoc && (
              <span className="text-xs text-green-600 font-semibold mt-2 flex items-center gap-1">✓ {idDoc.name}</span>
            )}
          </div>

          <button 
            onClick={handleSubmitDocs} 
            disabled={submitting}
            className="w-full bg-blue-600 text-white rounded-xl p-3.5 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Verification'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-center max-w-sm mx-auto">
        <h3 className="text-lg font-bold text-gray-800 mb-0.5">Select Activation Mode</h3>
        <p className="text-[11px] text-gray-500">Choose an option to lock to your account.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        <button 
          onClick={() => handleChooseOption('Become a tenant')} 
          className="relative h-40 rounded-xl p-4 text-left flex flex-col justify-between overflow-hidden shadow border transition-all duration-300 hover:scale-[1.01] hover:shadow-md active:scale-95 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-900 text-white"
        >
          <div className="flex justify-between items-start w-full">
            <span className="text-[10px] uppercase tracking-widest font-semibold opacity-75">Tenant Mode</span>
            <Briefcase size={18} className="opacity-80" />
          </div>
          <div>
            <div className="text-base font-bold">Become a tenant</div>
            <p className="text-[10px] opacity-80 mt-1 leading-normal">
              Become a tenant and earn a passive monthly income from user subscriptions.
            </p>
          </div>
        </button>

        <button 
          onClick={() => handleChooseOption('User Subscription')} 
          className="relative h-40 rounded-xl p-4 text-left flex flex-col justify-between overflow-hidden shadow border transition-all duration-300 hover:scale-[1.01] hover:shadow-md active:scale-95 bg-gradient-to-br from-indigo-950 to-indigo-850 border-indigo-950 text-white"
        >
          <div className="flex justify-between items-start w-full">
            <span className="text-[10px] uppercase tracking-widest font-semibold opacity-75">Subscription Mode</span>
            <Users size={18} className="opacity-80" />
          </div>
          <div>
            <div className="text-base font-bold">User Subscription</div>
            <p className="text-[10px] opacity-80 mt-1 leading-normal">
              User subscription to pay a monthly fee to use the app.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

interface VerificationUser {
  uid: string;
  email: string;
  activationOption: string;
  activationStep: string;
  profilePicData?: string;
  idDocData?: string;
  tenantPopStep?: string;
  tenantPopData?: string;
  userPopStep?: string;
  userPopData?: string;
}

function Admin({ 
  adminSub, 
  isAdmin, 
  maxTenants, 
  maxSubscribers, 
  onRefresh 
}: { 
  adminSub: string; 
  isAdmin: boolean; 
  maxTenants: number; 
  maxSubscribers: number; 
  onRefresh?: () => void 
}) {
  const [users, setUsers] = useState<VerificationUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeDetailsModal, setActiveDetailsModal] = useState<'tenant' | 'user' | null>(null);

  // Tenant Referral Quotas & Subscription Settings Editing States
  const [editingTenantQuota, setEditingTenantQuota] = useState<any | null>(null);
  const [tenantMaxTenants, setTenantMaxTenants] = useState(10);
  const [tenantMaxSubs, setTenantMaxSubs] = useState(100);
  const [tenantMonthlySubFee, setTenantMonthlySubFee] = useState(120);
  const [tenantTrialDays, setTenantTrialDays] = useState(7);
  const [savingQuota, setSavingQuota] = useState(false);

  const handleOpenEditQuota = (tenant: any) => {
    setEditingTenantQuota(tenant);
    setTenantMaxTenants(tenant.maxReferredTenants !== undefined ? Number(tenant.maxReferredTenants) : 10);
    setTenantMaxSubs(tenant.maxReferredSubscribers !== undefined ? Number(tenant.maxReferredSubscribers) : 100);
    setTenantMonthlySubFee(tenant.monthlySubFee !== undefined ? Number(tenant.monthlySubFee) : 120);
    setTenantTrialDays(tenant.trialDays !== undefined ? Number(tenant.trialDays) : 7);
  };

  const handleSaveTenantQuota = async () => {
    if (!editingTenantQuota?.uid) return;
    setSavingQuota(true);
    try {
      await setDoc(doc(db, 'users', editingTenantQuota.uid), {
        maxReferredTenants: Number(tenantMaxTenants),
        maxReferredSubscribers: Number(tenantMaxSubs),
        monthlySubFee: Number(tenantMonthlySubFee),
        trialDays: Number(tenantTrialDays)
      }, { merge: true });
      alert(`Tenant settings updated for ${editingTenantQuota.email}!`);
      setEditingTenantQuota(null);
      getDocs(collection(db, 'users')).then(snap => {
        const list: any[] = [];
        snap.forEach(d => list.push(d.data()));
        setAllUsers(list);
      });
    } catch (e) {
      console.error(e);
      alert('Failed to update tenant settings.');
    } finally {
      setSavingQuota(false);
    }
  };

  const fetchUsers = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: VerificationUser[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (adminSub === 'Verification' && data.activationStep === 'review') {
          list.push({
            uid: data.uid,
            email: data.email,
            activationOption: data.activationOption,
            activationStep: data.activationStep,
            profilePicData: data.profilePicData,
            idDocData: data.idDocData
          });
        } else if (adminSub === 'Tenant PoP' && data.tenantPopStep === 'review') {
          list.push({
            uid: data.uid,
            email: data.email,
            activationOption: data.activationOption || 'Become a tenant',
            activationStep: data.activationStep || 'approved',
            tenantPopStep: data.tenantPopStep,
            tenantPopData: data.tenantPopData
          });
        } else if (adminSub === 'User PoP' && data.userPopStep === 'review') {
          list.push({
            uid: data.uid,
            email: data.email,
            activationOption: data.activationOption || 'User Subscription',
            activationStep: data.activationStep || 'approved',
            tenantPopStep: data.userPopStep,
            tenantPopData: data.userPopData
          });
        }
      });
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminSub === 'Verification' || adminSub === 'Tenant PoP' || adminSub === 'User PoP' || adminSub === 'Overview') {
      fetchUsers();
    }
  }, [adminSub]);

  const handleAction = async (uid: string, step: 'approved' | 'rejected') => {
    try {
      await setDoc(doc(db, 'users', uid), { activationStep: step, activated: step === 'approved' }, { merge: true });
      alert(`User has been successfully ${step}!`);
      fetchUsers();
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      alert('Action failed.');
    }
  };

  const handlePopAction = async (uid: string, popStatus: 'approved' | 'rejected', type: 'tenant' | 'user') => {
    try {
      const field = type === 'tenant' ? 'tenantPopStep' : 'userPopStep';
      await setDoc(doc(db, 'users', uid), { [field]: popStatus }, { merge: true });
      alert(`Proof of payment has been ${popStatus}!`);
      fetchUsers();
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      alert('Action failed.');
    }
  };

  // State to fetch all registered users for Overview calculations
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    if (adminSub === 'Overview') {
      getDocs(collection(db, 'users')).then(snap => {
        const list: any[] = [];
        snap.forEach(d => {
          list.push(d.data());
        });
        setAllUsers(list);
      });
    }
  }, [adminSub]);

  if (adminSub === 'Overview') {
    const allTenantsApproved = allUsers.filter(u => u.activationOption === 'Become a tenant' && u.activationStep === 'approved');
    const allSubsApproved = allUsers.filter(u => u.activationOption === 'User Subscription' && u.activationStep === 'approved');

    // Filter list based on isAdmin
    const tenantsList = isAdmin ? allTenantsApproved : allTenantsApproved.filter(u => !u.deactivated);
    const subUsersList = isAdmin ? allSubsApproved : allSubsApproved.filter(u => !u.deactivated);

    const activeTenants = allTenantsApproved.filter(u => !u.deactivated);
    const activeSubscribers = allSubsApproved.filter(u => !u.deactivated);

    const tenantProfit = activeTenants.length * 250; // R250/mo per active tenant
    const userProfit = activeSubscribers.length * 120; // R120/mo per active subscriber
    const totalProfit = tenantProfit + userProfit;

    return (
      <div className="p-4 space-y-6 max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[50vh]">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Platform Overview</h3>
          <p className="text-xs text-gray-500">Live statistics and registered business tenant listings. Click Tenant or User Profit boxes to view active listings.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            onClick={() => setActiveDetailsModal('tenant')}
            className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl text-left cursor-pointer hover:shadow-md transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Tenant Profit</span>
            <span className="text-xl font-black text-blue-900 mt-1 block">R{tenantProfit}</span>
            <span className="text-[10px] text-blue-600 block mt-0.5">R250/mo each</span>
          </div>

          <div 
            onClick={() => setActiveDetailsModal('user')}
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 p-4 rounded-xl text-left cursor-pointer hover:shadow-md transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">User Profit</span>
            <span className="text-xl font-black text-indigo-900 mt-1 block">R{userProfit}</span>
            <span className="text-[10px] text-indigo-600 block mt-0.5">R120/mo each</span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-left">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">Total Tenants</span>
            <span className="text-xl font-black text-gray-800 mt-1 block">{tenantsList.length} / {maxTenants}</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">Approved business modes</span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-left">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">Subscription Users</span>
            <span className="text-xl font-black text-gray-800 mt-1 block">{subUsersList.length} / {maxSubscribers}</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">Approved standard modes</span>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-800 text-sm">Active Tenant Directory</h4>
            <div className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full border">
              Total Monthly Profit: <span className="text-blue-600 font-bold">R{totalProfit}</span>
            </div>
          </div>

          {tenantsList.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-xs border rounded-xl bg-gray-50">
              No approved tenants found.
            </div>
          ) : (
            <div className="grid gap-3">
              {tenantsList.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 bg-white shadow-sm transition-all flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    {u.profilePicData ? (
                      <img src={u.profilePicData} alt="Profile" className="h-10 w-10 rounded-full object-cover border border-blue-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border">
                        T
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-gray-800">{u.email}</div>
                      <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1 items-center">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold text-[8px] uppercase tracking-wider">
                          Quota: {u.maxReferredTenants !== undefined ? u.maxReferredTenants : 10}T / {u.maxReferredSubscribers !== undefined ? u.maxReferredSubscribers : 100}S | Fee: R{u.monthlySubFee !== undefined ? u.monthlySubFee : 120} | Trial: {u.trialDays !== undefined ? u.trialDays : 7}d
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button 
                        onClick={() => handleOpenEditQuota(u)} 
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border border-blue-200 transition-colors"
                      >
                        <Edit3 size={12} />
                        <span>Edit Settings</span>
                      </button>
                    )}
                    <div className="text-right">
                      {u.deactivated ? (
                        <>
                          <span className="text-xs font-bold text-red-500 block uppercase tracking-wider text-[10px]">Deactivated</span>
                          <span className="text-[9px] text-gray-400 block font-semibold">Offline State</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-black text-green-600 block font-mono">+R250</span>
                          <span className="text-[9px] text-gray-400 block font-semibold">Monthly Income</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full-screen Details Modal */}
        {activeDetailsModal && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 border animate-scale-up max-h-[85vh] flex flex-col">
              <button 
                onClick={() => setActiveDetailsModal(null)} 
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

              <div className="border-b pb-3">
                <h4 className="text-lg font-bold text-gray-800">
                  {activeDetailsModal === 'tenant' ? 'All Active Tenants' : 'All Subscription Users'}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Showing verified {activeDetailsModal === 'tenant' ? 'tenants contributing R250/mo' : 'subscription accounts paying R120/mo'}.
                </p>
              </div>

              <div className="flex-grow overflow-y-auto space-y-3 pr-1">
                {(activeDetailsModal === 'tenant' ? tenantsList : subUsersList).length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No accounts found in this category.</div>
                ) : (
                  (activeDetailsModal === 'tenant' ? tenantsList : subUsersList).map(u => (
                    <div key={u.uid} className="flex items-center justify-between p-3 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {u.profilePicData ? (
                          <img src={u.profilePicData} alt="Profile" className="h-10 w-10 rounded-full object-cover border border-blue-200" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border">
                            {activeDetailsModal === 'tenant' ? 'T' : 'S'}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-gray-800 truncate max-w-[180px]">{u.email}</div>
                          {activeDetailsModal === 'tenant' && (
                            <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
                              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold text-[8px] uppercase tracking-wider">
                                Quota: {u.maxReferredTenants !== undefined ? u.maxReferredTenants : 10} Tenants / {u.maxReferredSubscribers !== undefined ? u.maxReferredSubscribers : 100} Subs
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && activeDetailsModal === 'tenant' && (
                          <button 
                            onClick={() => handleOpenEditQuota(u)} 
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border border-blue-200 transition-colors"
                          >
                            <Edit3 size={12} />
                            <span>Edit Quota</span>
                          </button>
                        )}
                        <div className="text-right">
                          {u.deactivated ? (
                            <>
                              <span className="text-xs font-bold text-red-500 block uppercase tracking-wider text-[10px]">Deactivated</span>
                              <span className="text-[9px] text-gray-400 block font-semibold">Offline State</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-black text-green-600 block">
                                {activeDetailsModal === 'tenant' ? 'R250/mo' : 'R120/mo'}
                              </span>
                              <span className="text-[9px] text-gray-400 block font-semibold">Active State</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t pt-3 flex justify-between items-center text-xs font-bold text-gray-700">
                <span>Total Accounts: {(activeDetailsModal === 'tenant' ? tenantsList : subUsersList).length}</span>
                <span className="text-blue-600">
                  Total Value: R{activeDetailsModal === 'tenant' ? tenantProfit : userProfit}/mo
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Edit Tenant Quota Modal (Admin Only) */}
        {editingTenantQuota && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative space-y-4 border animate-scale-up text-left">
              <button 
                onClick={() => setEditingTenantQuota(null)} 
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

              <div className="border-b pb-3">
                <h4 className="text-base font-bold text-gray-800">Set Tenant Quotas & Subscription</h4>
                <p className="text-xs text-blue-600 font-semibold truncate mt-0.5">{editingTenantQuota.email}</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block uppercase">Max Ref Tenants</label>
                    <input 
                      type="number" 
                      value={tenantMaxTenants} 
                      onChange={e => setTenantMaxTenants(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block uppercase">Max Ref Subs</label>
                    <input 
                      type="number" 
                      value={tenantMaxSubs} 
                      onChange={e => setTenantMaxSubs(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block uppercase">Sub Fee (R)</label>
                    <input 
                      type="number" 
                      value={tenantMonthlySubFee} 
                      onChange={e => setTenantMonthlySubFee(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block uppercase">Trial Days</label>
                    <input 
                      type="number" 
                      value={tenantTrialDays} 
                      onChange={e => setTenantTrialDays(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleSaveTenantQuota}
                  disabled={savingQuota}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs shadow transition-colors disabled:opacity-50"
                >
                  {savingQuota ? 'Saving...' : 'Save Tenant Settings'}
                </button>
                <button 
                  onClick={() => setEditingTenantQuota(null)}
                  className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  if (adminSub === 'Verification') {
    return (
      <div className="p-4 space-y-6 max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[50vh]">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Verification Requests</h3>
            <p className="text-xs text-gray-500">View, approve or reject document verification entries. Click any image to view full screen.</p>
          </div>
          <button onClick={fetchUsers} className="bg-gray-100 hover:bg-gray-200 text-xs px-3 py-1.5 rounded-lg border">Refresh</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <div className="text-center p-12 text-gray-400">No verification requests found under review.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {users.map(u => (
              <div key={u.uid} className="border rounded-2xl p-4 space-y-4 bg-gray-50 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="font-semibold text-gray-800 text-sm truncate">{u.email}</div>
                  <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block mt-1 font-medium">{u.activationOption}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block mb-1">PROFILE PICTURE</span>
                    {u.profilePicData ? (
                      <img src={u.profilePicData} alt="Profile" onClick={() => setPreviewImage(u.profilePicData!)} className="h-28 w-full object-cover rounded-xl border cursor-pointer hover:opacity-90 transition-opacity" />
                    ) : (
                      <div className="h-28 w-full bg-gray-200 flex items-center justify-center text-xs rounded-xl">No image</div>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block mb-1">ID DOCUMENT</span>
                    {u.idDocData ? (
                      <img src={u.idDocData} alt="ID Document" onClick={() => setPreviewImage(u.idDocData!)} className="h-28 w-full object-cover rounded-xl border cursor-pointer hover:opacity-90 transition-opacity" />
                    ) : (
                      <div className="h-28 w-full bg-gray-200 flex items-center justify-center text-xs rounded-xl">No document</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleAction(u.uid, 'approved')} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-green-700 transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handleAction(u.uid, 'rejected')} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-red-700 transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
              <X size={28} />
            </button>
            <img src={previewImage} alt="Fullscreen Preview" className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" />
          </div>
        )}
      </div>
    );
  }

  if (adminSub === 'Tenant PoP') {
    return (
      <div className="p-4 space-y-6 max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[50vh]">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Tenant PoP Verifications</h3>
            <p className="text-xs text-gray-500">View and approve uploaded subscription Proof of Payment documents. Click any document to view full screen.</p>
          </div>
          <button onClick={fetchUsers} className="bg-gray-100 hover:bg-gray-200 text-xs px-3 py-1.5 rounded-lg border">Refresh</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <div className="text-center p-12 text-gray-400">No Proof of Payment submissions found under review.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {users.map(u => (
              <div key={u.uid} className="border rounded-2xl p-4 space-y-4 bg-gray-50 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="font-semibold text-gray-800 text-sm truncate">{u.email}</div>
                  <div className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded inline-block mt-1 font-medium">Tenant Proof of Payment</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold block mb-1">POP DOCUMENT</span>
                  {u.tenantPopData ? (
                    <img src={u.tenantPopData} alt="Proof of Payment" onClick={() => setPreviewImage(u.tenantPopData!)} className="h-36 w-full object-cover rounded-xl border cursor-pointer hover:opacity-90 transition-opacity" />
                  ) : (
                    <div className="h-36 w-full bg-gray-200 flex items-center justify-center text-xs rounded-xl">No document available</div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => handlePopAction(u.uid, 'approved', 'tenant')} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-green-700 transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handlePopAction(u.uid, 'rejected', 'tenant')} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-red-700 transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
              <X size={28} />
            </button>
            <img src={previewImage} alt="Fullscreen Preview" className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" />
          </div>
        )}
      </div>
    );
  }

  if (adminSub === 'User PoP') {
    return (
      <div className="p-4 space-y-6 max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[50vh]">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">User PoP Verifications</h3>
            <p className="text-xs text-gray-500">View and approve uploaded subscription Proof of Payment documents. Click any document to view full screen.</p>
          </div>
          <button onClick={fetchUsers} className="bg-gray-100 hover:bg-gray-200 text-xs px-3 py-1.5 rounded-lg border">Refresh</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <div className="text-center p-12 text-gray-400">No Proof of Payment submissions found under review.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {users.map(u => (
              <div key={u.uid} className="border rounded-2xl p-4 space-y-4 bg-gray-50 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="font-semibold text-gray-800 text-sm truncate">{u.email}</div>
                  <div className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded inline-block mt-1 font-medium">User Proof of Payment</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold block mb-1">POP DOCUMENT</span>
                  {u.tenantPopData ? (
                    <img src={u.tenantPopData} alt="Proof of Payment" onClick={() => setPreviewImage(u.tenantPopData!)} className="h-36 w-full object-cover rounded-xl border cursor-pointer hover:opacity-90 transition-opacity" />
                  ) : (
                    <div className="h-36 w-full bg-gray-200 flex items-center justify-center text-xs rounded-xl">No document available</div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => handlePopAction(u.uid, 'approved', 'user')} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-green-700 transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handlePopAction(u.uid, 'rejected', 'user')} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-red-700 transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
              <X size={28} />
            </button>
            <img src={previewImage} alt="Fullscreen Preview" className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white text-center p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="text-2xl font-bold text-gray-800 mb-2">{adminSub}</div>
      <p className="text-sm text-gray-500 max-w-sm">
        This is a clean, white template view for the <span className="font-semibold text-blue-600">{adminSub}</span> management dashboard.
      </p>
    </div>
  );
}

function UserPortal({ userDetails, onLogout }: { userDetails: any; onLogout: () => void }) {
  const [dotsMenuOpen, setDotsMenuOpen] = useState(false);
  const [userPopModalOpen, setUserPopModalOpen] = useState(false);
  const [popStep, setPopStep] = useState<'unpaid' | 'review' | 'approved' | 'rejected'>('unpaid');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popFilePreview, setPopFilePreview] = useState<string | null>(null);
  const [submittingPop, setSubmittingPop] = useState(false);

  // Profile Editor States
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [tradeSkills, setTradeSkills] = useState('');
  const [motivationLetter, setMotivationLetter] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivated, setDeactivated] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    if (userDetails) {
      setPhone(userDetails.phone || '');
      setContactEmail(userDetails.contactEmail || userDetails.email || '');
      setSocialLinks(userDetails.socialLinks || []);
      setTradeSkills(userDetails.tradeSkills || '');
      setMotivationLetter(userDetails.motivationLetter || '');
      setDeactivated(userDetails.deactivated || false);
      if (userDetails?.userPopStep) {
        setPopStep(userDetails.userPopStep);
      }
      // Lock if profile was previously saved with some data
      if (userDetails.phone || userDetails.tradeSkills || userDetails.motivationLetter) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    }
  }, [userDetails]);

  const handleToggleDeactivate = async () => {
    if (!userDetails?.uid) return;
    const targetState = !deactivated;
    try {
      await setDoc(doc(db, 'users', userDetails.uid), {
        deactivated: targetState
      }, { merge: true });
      setDeactivated(targetState);
      alert(`Account has been successfully ${targetState ? 'deactivated' : 'activated'}!`);
      setDotsMenuOpen(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update account state.');
    }
  };

  const handleAddSocial = () => {
    if (!newLink.trim()) return;
    let formatted = newLink.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    setSocialLinks([...socialLinks, formatted]);
    setNewLink('');
  };

  const handleRemoveSocial = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const handleSaveProfile = async () => {
    if (!userDetails?.uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', userDetails.uid), {
        phone,
        contactEmail,
        socialLinks,
        tradeSkills,
        motivationLetter
      }, { merge: true });
      alert('Profile updated successfully!');
      setIsLocked(true);
    } catch (e) {
      console.error(e);
      alert('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handlePopFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPopFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPopFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPop = async () => {
    if (!userDetails?.uid || !popFilePreview) return;
    setSubmittingPop(true);
    try {
      await setDoc(doc(db, 'users', userDetails.uid), {
        userPopStep: 'review',
        userPopData: popFilePreview,
        userPopName: popFile?.name || 'pop_document'
      }, { merge: true });
      setPopStep('review');
      alert('Proof of payment submitted successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to submit proof of payment.');
    } finally {
      setSubmittingPop(false);
    }
  };

  if (deactivated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] bg-white text-center p-6 relative w-full overflow-y-auto max-w-lg mx-auto space-y-6">
        {/* Top Corner Action Controls */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button 
            onClick={() => setDotsMenuOpen(!dotsMenuOpen)} 
            className="p-2 bg-gray-50 border border-gray-150 rounded-full hover:bg-gray-100 transition-colors shadow-sm flex items-center justify-center"
          >
            <MoreVertical size={18} className="text-gray-600" />
          </button>

          {dotsMenuOpen && (
            <div className="absolute top-11 right-0 bg-white shadow-xl border rounded-xl p-1 z-30 w-44 animate-fade-in text-left">
              <button 
                onClick={handleToggleDeactivate} 
                className="flex items-center gap-2 p-2.5 text-sm text-green-600 hover:bg-green-50 rounded-lg w-full transition-colors font-semibold"
              >
                <Power size={16} /> Reactivate Account
              </button>
              <button 
                onClick={onLogout} 
                className="flex items-center gap-2 p-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg w-full transition-colors font-semibold border-t mt-1 pt-1"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center space-y-4 max-w-xs mx-auto py-12">
          <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-150 shadow-sm animate-pulse">
            <Power size={32} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">Account Deactivated</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your profile and active subscription features are currently deactivated. You can click below to reactivate your account at any time to resume.
          </p>
          <button 
            onClick={handleToggleDeactivate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99]"
          >
            <Power size={16} />
            <span>Reactivate My Account</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[75vh] bg-white p-4 relative w-full overflow-y-auto max-w-lg mx-auto space-y-6">
      {/* Top Corner Action Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button 
          onClick={() => setUserPopModalOpen(true)} 
          className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
          title="Subscription Payment"
        >
          <CreditCard size={18} />
        </button>

        <button 
          onClick={() => setDotsMenuOpen(!dotsMenuOpen)} 
          className="p-2 bg-gray-50 border border-gray-150 rounded-full hover:bg-gray-100 transition-colors shadow-sm flex items-center justify-center"
        >
          <MoreVertical size={18} className="text-gray-600" />
        </button>

        {dotsMenuOpen && (
          <div className="absolute top-11 right-0 bg-white shadow-xl border rounded-xl p-1 z-30 w-44 animate-fade-in text-left">
            <button 
              onClick={handleToggleDeactivate} 
              className="flex items-center gap-2 p-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors font-semibold"
            >
              <Power size={16} /> Deactivate Account
            </button>
            <button 
              onClick={onLogout} 
              className="flex items-center gap-2 p-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg w-full transition-colors font-semibold border-t mt-1 pt-1"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center w-full space-y-4 pt-4">
        {userDetails?.profilePicData ? (
          <img src={userDetails.profilePicData} alt="Profile" className="h-24 w-24 rounded-full object-cover border-4 border-blue-500 shadow-lg" />
        ) : (
          <div className="h-24 w-24 rounded-full bg-blue-50 border-4 border-blue-500 flex items-center justify-center text-blue-600 font-bold text-3xl shadow-lg">
            {userDetails?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        )}

        <div className="space-y-1 text-center">
          <h3 className="text-xl font-bold text-gray-800 truncate max-w-[280px]">{userDetails?.email}</h3>
          <div className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200 inline-block font-bold uppercase tracking-wider">
            {userDetails?.activationOption || 'User Subscription'} Account
          </div>
        </div>
      </div>

      {/* Account Info Box (Compact details) */}
      <div className="bg-gray-50 border rounded-2xl p-4 w-full text-left space-y-2.5 shadow-sm text-xs">
        <div className="flex justify-between border-b pb-1.5 font-bold text-[9px] text-gray-400 tracking-wider">
          <span>ACCOUNT STATUS</span>
          <span className="text-green-600">VERIFIED ACTIVE</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">User ID</span>
          <span className="font-mono text-gray-700 truncate max-w-[180px]">{userDetails?.uid}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Plan Mode</span>
          <span className="font-semibold text-gray-700">SUB-120 (R120/mo)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Billing Cycle</span>
          <span className="font-semibold text-gray-700">Monthly</span>
        </div>
      </div>

      {/* Profile Form Editor */}
      <div className="w-full text-left space-y-5">
        <div className="flex justify-between items-center border-b pb-1">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Professional Profile</h4>
          {isLocked && (
            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded border uppercase tracking-wider">Locked</span>
          )}
        </div>

        {/* Contact Info */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            <Phone size={14} className="text-gray-400" />
            <span>Contact Number</span>
          </label>
          <input 
            type="tel" 
            value={phone} 
            onChange={e => setPhone(e.target.value)} 
            placeholder="e.g. +27 82 123 4567" 
            disabled={isLocked}
            className={`w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              isLocked ? 'bg-gray-55 text-gray-500 cursor-not-allowed border-gray-100' : 'bg-gray-5/50'
            }`}
          />
        </div>

        {/* Email Info */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            <Mail size={14} className="text-gray-400" />
            <span>Contact Email Address</span>
          </label>
          <input 
            type="email" 
            value={contactEmail} 
            onChange={e => setContactEmail(e.target.value)} 
            placeholder="e.g. user@example.com" 
            disabled={isLocked}
            className={`w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              isLocked ? 'bg-gray-55 text-gray-500 cursor-not-allowed border-gray-100' : 'bg-gray-5/50'
            }`}
          />
        </div>

        {/* Trade Skills */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            <Wrench size={14} className="text-gray-400" />
            <span>Trade Skills</span>
          </label>
          <input 
            type="text" 
            value={tradeSkills} 
            onChange={e => setTradeSkills(e.target.value)} 
            placeholder="e.g. Plumbing, Electrical Installation, Tiling" 
            disabled={isLocked}
            className={`w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              isLocked ? 'bg-gray-55 text-gray-500 cursor-not-allowed border-gray-100' : 'bg-gray-5/50'
            }`}
          />
        </div>

        {/* Motivation Letter */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            <FileText size={14} className="text-gray-400" />
            <span>Motivation Letter</span>
          </label>
          <textarea 
            value={motivationLetter} 
            onChange={e => setMotivationLetter(e.target.value)} 
            placeholder="Tell us about your professional background and why you are applying..." 
            rows={4}
            disabled={isLocked}
            className={`w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y transition-colors ${
              isLocked ? 'bg-gray-55 text-gray-500 cursor-not-allowed border-gray-100' : 'bg-gray-5/50'
            }`}
          />
        </div>

        {/* Social Links */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            <Globe size={14} className="text-gray-400" />
            <span>Social Links</span>
          </label>
          
          {/* List of current social links */}
          {socialLinks.length > 0 && (
            <div className="space-y-2">
              {socialLinks.map((link, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-xl text-xs">
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[260px]">
                    {link}
                  </a>
                  {!isLocked && (
                    <button 
                      onClick={() => handleRemoveSocial(idx)} 
                      className="p-1 hover:text-red-500 text-gray-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input to add more social links */}
          {!isLocked && (
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newLink} 
                onChange={e => setNewLink(e.target.value)} 
                placeholder="e.g. linkedin.com/in/username" 
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
              />
              <button 
                onClick={handleAddSocial} 
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1 border transition-colors"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>
          )}
        </div>

        {/* Action Toggle Button */}
        {isLocked ? (
          <button 
            onClick={() => setIsLocked(false)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99]"
          >
            <Plus size={16} />
            <span>Edit Profile Information</span>
          </button>
        ) : (
          <div className="flex gap-2 w-full">
            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold p-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Profile</span>
                </>
              )}
            </button>
            <button 
              onClick={() => {
                setPhone(userDetails?.phone || '');
                setContactEmail(userDetails?.contactEmail || userDetails?.email || '');
                setSocialLinks(userDetails?.socialLinks || []);
                setTradeSkills(userDetails?.tradeSkills || '');
                setMotivationLetter(userDetails?.motivationLetter || '');
                setIsLocked(true);
              }}
              className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* User proof of payment activation modal */}
      {userPopModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative space-y-4 border animate-scale-up text-left">
            <button onClick={() => setUserPopModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            {popStep === 'review' ? (
              <div className="text-center py-6 space-y-4">
                <Loader2 className="text-blue-600 h-16 w-16 animate-spin mx-auto" />
                <h4 className="text-xl font-bold text-gray-800">Payment Under Review</h4>
                <p className="text-xs text-gray-500">We are currently verifying your proof of payment document.</p>
                <div className="bg-blue-50 text-blue-700 text-xs font-semibold p-3 rounded-xl inline-block">
                  Review takes about 15 to 25 minutes.
                </div>
              </div>
            ) : popStep === 'approved' ? (
              <div className="text-center py-6 space-y-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-xl font-bold text-gray-800">Subscription Active</h4>
                <p className="text-xs text-gray-500">Your bank transfer payment has been approved and activated.</p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h4 className="text-lg font-bold text-gray-800">Activate User Subscription</h4>
                  <p className="text-xs text-gray-500 mt-1">Please make a bank transfer and upload proof of payment.</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs space-y-2">
                  <div className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">BANK DETAILS</div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bank Name</span>
                    <span className="font-bold text-gray-800">Capitec</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account Name</span>
                    <span className="font-bold text-gray-800">Matthews</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account Number</span>
                    <span className="font-bold text-gray-800">1334067366</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-bold text-blue-600">Ten29</span>
                  </div>
                </div>

                <div className="border border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50 flex flex-col items-center text-center">
                  <Upload size={20} className="text-gray-400 mb-1.5" />
                  <span className="text-xs font-semibold text-gray-700">Proof of Payment</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handlePopFileChange} className="hidden" id="user-pop-file-upload" />
                  <label htmlFor="user-pop-file-upload" className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:bg-gray-50 cursor-pointer mt-2">
                    {popFile ? 'Change Document' : 'Upload File'}
                  </label>
                  {popFile && <span className="text-[10px] text-green-600 font-semibold mt-1.5">✓ {popFile.name}</span>}
                </div>

                <button 
                  onClick={handleSubmitPop}
                  disabled={submittingPop || !popFilePreview}
                  className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingPop ? 'Submitting...' : 'Submit Payment'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TenantPortal({ userData, onLogout }: { userData: any; onLogout: () => void }) {
  const { user } = useContext(AuthContext);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.uid) {
      getDocs(collection(db, 'users')).then(snap => {
        const list: any[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.referredBy === user.uid) {
            list.push(data);
          }
        });
        setReferredUsers(list);
      }).catch(e => console.error(e));
    }
  }, [user]);

  const activeReferredTenants = referredUsers.filter(u => u.activationOption === 'Become a tenant' && u.activationStep === 'approved' && !u.deactivated);
  const activeReferredSubs = referredUsers.filter(u => u.activationOption === 'User Subscription' && u.activationStep === 'approved' && !u.deactivated);

  const subFee = userData?.monthlySubFee !== undefined ? Number(userData.monthlySubFee) : 120;
  const trialDays = userData?.trialDays !== undefined ? Number(userData.trialDays) : 7;
  const monthlyProfit = (activeReferredTenants.length * 250) + (activeReferredSubs.length * subFee);

  return (
    <div className="flex flex-col items-center justify-start min-h-[75vh] bg-white p-4 relative w-full overflow-y-auto max-w-lg mx-auto space-y-6">
      <div className="flex flex-col items-center w-full space-y-3 pt-4">
        {userData?.profilePicData ? (
          <img src={userData.profilePicData} alt="Profile" className="h-24 w-24 rounded-full object-cover border-4 border-blue-500 shadow-lg" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-24 w-24 rounded-full bg-blue-50 border-4 border-blue-500 flex items-center justify-center text-blue-600 font-bold text-3xl shadow-lg">
            T
          </div>
        )}
        <div className="space-y-1 text-center">
          <h3 className="text-xl font-bold text-gray-800 truncate max-w-[280px]">{userData?.email}</h3>
          <div className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200 inline-block font-bold uppercase tracking-wider">
            Verified Business Tenant
          </div>
        </div>
      </div>

      {/* Tenant Profit & Referral Stats Grid */}
      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-2xl text-left shadow-sm">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Your Monthly Earnings</span>
          <span className="text-2xl font-black text-blue-900 mt-1 block">R{monthlyProfit}</span>
          <span className="text-[10px] text-blue-600 block mt-0.5">Passive Referral Income</span>
        </div>

        <div className="bg-gray-50 border p-4 rounded-2xl text-left space-y-1 shadow-sm">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Referral Signup Quotas</span>
          <div className="text-xs font-bold text-gray-800">
            Tenants: <span className="text-blue-600">{activeReferredTenants.length} / {userData?.maxReferredTenants !== undefined ? userData.maxReferredTenants : 10}</span>
          </div>
          <div className="text-xs font-bold text-gray-800">
            Subscribers: <span className="text-indigo-600">{activeReferredSubs.length} / {userData?.maxReferredSubscribers !== undefined ? userData.maxReferredSubscribers : 100}</span>
          </div>
        </div>
      </div>

      {/* Tenant Custom Subscription Fee & Trial Days Card */}
      <div className="bg-gray-50 border rounded-2xl p-4 w-full text-left space-y-2 shadow-sm">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <CreditCard size={16} className="text-blue-600" />
            <span>Your Custom Pricing & Trial Offer</span>
          </span>
          <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
            Configurable via 3-Bar Menu
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-white border p-2.5 rounded-xl">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Monthly Fee</span>
            <span className="text-base font-black text-blue-600 mt-0.5 block">
              R{subFee} / mo
            </span>
          </div>
          <div className="bg-white border p-2.5 rounded-xl">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Free Trial Days</span>
            <span className="text-base font-black text-indigo-600 mt-0.5 block">
              {trialDays} Days
            </span>
          </div>
        </div>
      </div>

      {/* Tenant Shareable Referral Link */}
      <div className="bg-gray-50 border rounded-2xl p-4 w-full text-left space-y-3 shadow-sm">
        <div>
          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Globe size={16} className="text-blue-600" />
            <span>Your Shareable Tenant Link</span>
          </h4>
          <p className="text-[10px] text-gray-500 mt-0.5">Share this link to invite users under your referral quota.</p>
        </div>
        <div className="flex gap-2 items-center bg-white border p-2 rounded-xl text-xs font-mono select-all overflow-x-auto">
          <span className="text-gray-600 truncate flex-1">{`${window.location.origin}?ref=${user?.uid}`}</span>
        </div>
        <button 
          onClick={() => {
            if (user?.uid) {
              navigator.clipboard.writeText(`${window.location.origin}?ref=${user.uid}`);
              alert('Copied referral link to clipboard!');
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow transition-colors w-full"
        >
          Copy Shareable Referral Link
        </button>
      </div>

      {/* Active Referral List */}
      <div className="w-full text-left space-y-3">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Active Referrals</h4>
        {referredUsers.length === 0 ? (
          <div className="text-center p-6 text-gray-400 text-xs border rounded-2xl bg-gray-50">
            No referrals signed up yet. Share your link above to get started!
          </div>
        ) : (
          <div className="space-y-2">
            {referredUsers.map((refUser, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-gray-50 text-xs">
                <div>
                  <div className="font-bold text-gray-800">{refUser.email}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Mode: {refUser.activationOption}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    {refUser.deactivated ? 'Offline' : 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('Activation');
  const [adminSub, setAdminSub] = useState('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [activationOption, setActivationOption] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  
  // Platform Limits & Fee Settings
  const [maxTenants, setMaxTenants] = useState(100);
  const [maxSubscribers, setMaxSubscribers] = useState(100);
  const [maxTenantsInput, setMaxTenantsInput] = useState(100);
  const [maxSubscribersInput, setMaxSubscribersInput] = useState(100);
  const [defaultSubFeeInput, setDefaultSubFeeInput] = useState(120);
  const [defaultTrialDaysInput, setDefaultTrialDaysInput] = useState(7);

  // Tenant Pricing & Trial Settings
  const [tenantSubFeeInput, setTenantSubFeeInput] = useState(120);
  const [tenantTrialDaysInput, setTenantTrialDaysInput] = useState(7);
  const [savingTenantSettings, setSavingTenantSettings] = useState(false);

  // Help & About Modal States
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  // Popover / Activation modal states
  const [popModalOpen, setPopModalOpen] = useState(false);
  const [popStep, setPopStep] = useState<'unpaid' | 'review' | 'approved' | 'rejected'>('unpaid');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popFilePreview, setPopFilePreview] = useState<string | null>(null);
  const [submittingPop, setSubmittingPop] = useState(false);

  // Stats / Badges counts
  const [overviewCount, setOverviewCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [tenantPopCount, setTenantPopCount] = useState(0);
  const [userPopCount, setUserPopCount] = useState(0);
  const navigate = useNavigate();

  const isAdmin = user?.email === 'timegig2026@gmail.com';

  const syncUserStep = async () => {
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          if (data.activationOption) {
            setActivationOption(data.activationOption);
          }
          if (data.activationStep === 'approved') {
            setIsApproved(true);
          } else {
            setIsApproved(false);
          }
          if (data.profilePicData) {
            setUserProfilePic(data.profilePicData);
          }
          if (data.tenantPopStep) {
            setPopStep(data.tenantPopStep);
          }
          if (data.monthlySubFee !== undefined) {
            setTenantSubFeeInput(data.monthlySubFee);
          }
          if (data.trialDays !== undefined) {
            setTenantTrialDaysInput(data.trialDays);
          }
        } else {
          // Initialize user document if missing
          const queryParams = new URLSearchParams(window.location.search);
          const joinedViaAdminRef = queryParams.get('ref') === 'admin' || sessionStorage.getItem('ref') === 'admin';
          const ref = queryParams.get('ref') || sessionStorage.getItem('ref');
          const defaultDoc = {
            uid: user.uid,
            email: user.email,
            termsAccepted: true,
            activated: false,
            activationStep: 'choose',
            tenantPopStep: 'unpaid',
            userPopStep: 'unpaid',
            joinedViaAdminRef: joinedViaAdminRef,
            referredBy: (ref && ref !== 'admin') ? ref : null
          };
          await setDoc(doc(db, 'users', user.uid), defaultDoc, { merge: true });
          setUserData(defaultDoc);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveTenantSettings = async () => {
    if (!user) return;
    setSavingTenantSettings(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        monthlySubFee: Number(tenantSubFeeInput),
        trialDays: Number(tenantTrialDaysInput)
      }, { merge: true });
      alert('Monthly subscription fee and trial days saved successfully!');
      syncUserStep();
    } catch (e) {
      console.error(e);
      alert('Failed to save settings.');
    } finally {
      setSavingTenantSettings(false);
    }
  };

  const fetchDashboardStats = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, 'users'));
      let total = 0;
      let review = 0;
      let tenants = 0;
      let usersSub = 0;

      snap.forEach(d => {
        const data = d.data();
        total++;
        if (data.activationStep === 'review') {
          review++;
        }
        if (data.tenantPopStep === 'review') {
          tenants++;
        }
        if (data.userPopStep === 'review') {
          usersSub++;
        }
      });

      setOverviewCount(total);
      setReviewCount(review);
      setTenantPopCount(tenants);
      setUserPopCount(usersSub);
    } catch (e) {
      console.error(e);
    }
  };

  // Load limits and sync user details
  useEffect(() => {
    if (user) {
      syncUserStep();
      getDoc(doc(db, 'settings', 'limits')).then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.maxTenants !== undefined) {
            setMaxTenants(d.maxTenants);
            setMaxTenantsInput(d.maxTenants);
          }
          if (d.maxSubscribers !== undefined) {
            setMaxSubscribers(d.maxSubscribers);
            setMaxSubscribersInput(d.maxSubscribers);
          }
          if (d.defaultSubFee !== undefined) {
            setDefaultSubFeeInput(d.defaultSubFee);
          }
          if (d.defaultTrialDays !== undefined) {
            setDefaultTrialDaysInput(d.defaultTrialDays);
          }
        }
      }).catch(e => console.error('Error loading settings:', e));
    }
  }, [user]);

  useEffect(() => {
    if (user && (activeTab === 'Admin' || activeTab === 'Tenant Portal')) {
      fetchDashboardStats();
    }
  }, [user, activeTab]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handlePopFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPopFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPopFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPop = async () => {
    if (!user || !popFilePreview) return;
    setSubmittingPop(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        tenantPopStep: 'review',
        tenantPopData: popFilePreview,
        tenantPopName: popFile?.name || 'pop_document'
      }, { merge: true });
      setPopStep('review');
      alert('Proof of payment submitted successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to submit proof of payment.');
    } finally {
      setSubmittingPop(false);
    }
  };

  // Determine correct Tab labels based on approval and mode chosen
  const firstTabName = !isApproved 
    ? 'Activation' 
    : (activationOption === 'Become a tenant' ? 'Tenant Portal' : 'User Portal');

  const navItems = [
    { name: firstTabName, icon: isApproved ? Award : Zap },
    { name: 'Seekers', icon: Users },
    { name: 'GiGs', icon: Briefcase },
    ...(isAdmin ? [{ name: 'Admin', icon: Shield }] : []),
  ];

  const adminSubItems = isAdmin ? [
    { name: 'Overview', icon: BarChart3, count: overviewCount },
    { name: 'Verification', icon: CheckCircle, count: reviewCount },
    { name: 'Tenant PoP', icon: UserCheck, count: tenantPopCount },
    { name: 'User PoP', icon: UserPlus, count: userPopCount },
  ] : [];

  const showMenu = activeTab !== 'User Portal';

  if (userData?.deactivated) {
    return (
      <div className="min-h-screen flex flex-col bg-white justify-center items-center p-6 text-center relative w-full">
        {/* Top corner 3-bar menu so they can logout or reactivate */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="absolute top-4 left-4 z-20 p-2 bg-white rounded-full shadow-lg border border-gray-100 transition-transform active:scale-95">
          <Menu />
        </button>
        {menuOpen && (
          <div className="absolute top-16 left-4 bg-white shadow-xl border rounded-2xl p-2 z-20 w-56 space-y-1 animate-fade-in text-left">
            <button 
              onClick={async () => {
                if (!user) return;
                try {
                  await setDoc(doc(db, 'users', user.uid), { deactivated: false }, { merge: true });
                  alert('Account has been reactivated!');
                  syncUserStep();
                  setMenuOpen(false);
                } catch (e) {
                  console.error(e);
                }
              }}
              className="flex items-center gap-2 p-2 w-full text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors font-semibold"
            >
              <Power size={16} /> Reactivate Account
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 p-2 w-full text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium border-t pt-1 mt-1">
              <LogOut size={16}/> Logout
            </button>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4 max-w-xs mx-auto py-12">
          <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-150 shadow-sm animate-pulse">
            <Power size={32} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">Account Deactivated</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your account is currently deactivated and is offline. You can reactivate it at any time to resume using your profile and active subscription features.
          </p>
          <button 
            onClick={async () => {
              if (!user) return;
              try {
                await setDoc(doc(db, 'users', user.uid), { deactivated: false }, { merge: true });
                alert('Account has been reactivated!');
                syncUserStep();
              } catch (e) {
                console.error(e);
                alert('Failed to reactivate account.');
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99]"
          >
            <Power size={16} />
            <span>Reactivate My Account</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white pb-16 relative">
      {showMenu && (
        <>
          <button onClick={() => setMenuOpen(!menuOpen)} className="absolute top-4 left-4 z-20 p-2 bg-white rounded-full shadow-lg border border-gray-100 transition-transform active:scale-95">
            <Menu />
          </button>
          {menuOpen && (
            <div className="absolute top-16 left-4 bg-white shadow-xl border rounded-2xl p-2 z-20 w-64 space-y-1 animate-fade-in">
              <div className="text-[10px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">Features</div>
              {adminSubItems.map(item => (
                <button
                  key={item.name}
                  onClick={() => {
                    setAdminSub(item.name);
                    if (activeTab !== 'Admin' && activeTab !== 'Tenant Portal') {
                      setActiveTab('Admin');
                    }
                    setMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-2 w-full text-sm rounded-lg transition-colors ${
                    adminSub === item.name && (activeTab === 'Admin' || activeTab === 'Tenant Portal')
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <item.icon size={16} />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </button>
              ))}

              {/* Shareable Link and Spot Limits inside Menu */}
              <div className="border-t my-1.5 pt-2 px-3 space-y-2 text-left">
                {isAdmin ? (
                  <>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Shareable Admin Link</span>
                      <div className="text-[10px] text-gray-500 font-mono truncate bg-gray-50 p-1.5 rounded border select-all">
                        {`${window.location.origin}?ref=admin`}
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}?ref=admin`);
                          alert('Copied Admin Referral Link to clipboard!');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] py-1 rounded shadow-sm transition-colors"
                      >
                        Copy Admin Link
                      </button>
                    </div>

                    <div className="space-y-1.5 border-t pt-2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Configure Limits & Default Fee Settings</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Max Tenants</label>
                          <input 
                            type="number" 
                            value={maxTenantsInput} 
                            onChange={e => setMaxTenantsInput(Math.max(0, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Max Subs</label>
                          <input 
                            type="number" 
                            value={maxSubscribersInput} 
                            onChange={e => setMaxSubscribersInput(Math.max(0, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Default Fee (R)</label>
                          <input 
                            type="number" 
                            value={defaultSubFeeInput} 
                            onChange={e => setDefaultSubFeeInput(Math.max(0, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Default Trial (d)</label>
                          <input 
                            type="number" 
                            value={defaultTrialDaysInput} 
                            onChange={e => setDefaultTrialDaysInput(Math.max(0, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            await setDoc(doc(db, 'settings', 'limits'), {
                              maxTenants: Number(maxTenantsInput),
                              maxSubscribers: Number(maxSubscribersInput),
                              defaultSubFee: Number(defaultSubFeeInput),
                              defaultTrialDays: Number(defaultTrialDaysInput)
                            }, { merge: true });
                            setMaxTenants(Number(maxTenantsInput));
                            setMaxSubscribers(Number(maxSubscribersInput));
                            alert('Platform limits, fee, and trial settings saved successfully!');
                          } catch (e) {
                            console.error(e);
                            alert('Failed to save settings.');
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-[10px] py-1 rounded shadow-sm transition-colors"
                      >
                        Save Settings
                      </button>
                    </div>
                  </>
                ) : (
                  (activationOption === 'Become a tenant' || activeTab === 'Tenant Portal') && (
                    <div className="space-y-2 text-left">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Your Referral Link</span>
                        <div className="text-[10px] text-gray-500 font-mono truncate bg-gray-50 p-1.5 rounded border select-all">
                          {`${window.location.origin}?ref=${user?.uid}`}
                        </div>
                        <button 
                          onClick={() => {
                            if (user?.uid) {
                              navigator.clipboard.writeText(`${window.location.origin}?ref=${user.uid}`);
                              alert('Copied your referral link to clipboard!');
                            }
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] py-1 rounded shadow-sm transition-colors"
                        >
                          Copy Referral Link
                        </button>
                      </div>

                      {/* Tenant Subscription Fee & Trial Days Controls */}
                      <div className="space-y-1.5 border-t pt-2">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Subscription & Trial Settings</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[8px] font-bold text-gray-500 block uppercase">Monthly Fee (R)</label>
                            <input 
                              type="number" 
                              value={tenantSubFeeInput} 
                              onChange={e => setTenantSubFeeInput(Math.max(0, Number(e.target.value)))} 
                              className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="120"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-gray-500 block uppercase">Trial Days</label>
                            <input 
                              type="number" 
                              value={tenantTrialDaysInput} 
                              onChange={e => setTenantTrialDaysInput(Math.max(0, Number(e.target.value)))} 
                              className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="7"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={handleSaveTenantSettings}
                          disabled={savingTenantSettings}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-[10px] py-1 rounded shadow-sm transition-colors disabled:opacity-50"
                        >
                          {savingTenantSettings ? 'Saving...' : 'Save Fee & Trial Days'}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="border-t my-1 pt-1 space-y-1">
                <button 
                  onClick={() => {
                    setHelpModalOpen(true);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 p-2 w-full text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-semibold"
                >
                  <HelpCircle size={16} /> How It Works (Help)
                </button>
                <button 
                  onClick={() => {
                    setAboutModalOpen(true);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 p-2 w-full text-sm text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors font-semibold"
                >
                  <Info size={16} /> About Tenant Portal
                </button>
                <button 
                  onClick={async () => {
                    if (!user) return;
                    const targetState = !userData?.deactivated;
                    try {
                      await setDoc(doc(db, 'users', user.uid), { deactivated: targetState }, { merge: true });
                      alert(`Account has been successfully ${targetState ? 'deactivated' : 'activated'}!`);
                      syncUserStep();
                      setMenuOpen(false);
                    } catch (e) {
                      console.error(e);
                      alert('Failed to update account state.');
                    }
                  }} 
                  className={`flex items-center gap-2 p-2 w-full text-sm rounded-lg transition-colors font-semibold ${
                    userData?.deactivated ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  <Power size={14}/> {userData?.deactivated ? 'Reactivate Account' : 'Deactivate Account'}
                </button>
                <button onClick={handleLogout} className="flex items-center gap-2 p-2 w-full text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                  <LogOut size={16}/> Logout
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'Tenant Portal' && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
          <CountdownTimer />
          {/* Activation subscription icon button */}
          <button 
            onClick={() => setPopModalOpen(true)} 
            className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
          >
            <CreditCard size={18} />
          </button>

          {userProfilePic ? (
            <img src={userProfilePic} alt="Profile" className="h-10 w-10 rounded-full object-cover border-2 border-blue-500 shadow-md" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-blue-50 border-2 border-blue-500 flex items-center justify-center text-blue-600 font-bold shadow-md">
              T
            </div>
          )}
        </div>
      )}

      {/* Proof of Payment / Bank Transfer Activation Modal */}
      {popModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative space-y-4 border animate-scale-up text-left">
            <button onClick={() => setPopModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            {popStep === 'review' ? (
              <div className="text-center py-6 space-y-4">
                <Loader2 className="text-blue-600 h-16 w-16 animate-spin mx-auto" />
                <h4 className="text-xl font-bold text-gray-800">Payment Under Review</h4>
                <p className="text-xs text-gray-500">We are currently verifying your proof of payment document.</p>
                <div className="bg-blue-50 text-blue-700 text-xs font-semibold p-3 rounded-xl inline-block">
                  Review takes about 15 to 25 minutes.
                </div>
              </div>
            ) : popStep === 'approved' ? (
              <div className="text-center py-6 space-y-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-xl font-bold text-gray-800">Subscription Active</h4>
                <p className="text-xs text-gray-500">Your bank transfer payment has been approved and activated.</p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h4 className="text-lg font-bold text-gray-800">Activate Tenant Subscription</h4>
                  <p className="text-xs text-gray-500 mt-1">Please make a bank transfer and upload proof of payment.</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs space-y-2">
                  <div className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">BANK DETAILS</div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bank Name</span>
                    <span className="font-bold text-gray-800">Capitec</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account Name</span>
                    <span className="font-bold text-gray-800">Matthews</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account Number</span>
                    <span className="font-bold text-gray-800">1334067366</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-bold text-blue-600">Ten29</span>
                  </div>
                </div>

                <div className="border border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50 flex flex-col items-center text-center">
                  <Upload size={20} className="text-gray-400 mb-1.5" />
                  <span className="text-xs font-semibold text-gray-700">Proof of Payment</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handlePopFileChange} className="hidden" id="pop-file-upload" />
                  <label htmlFor="pop-file-upload" className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:bg-gray-50 cursor-pointer mt-2">
                    {popFile ? 'Change Document' : 'Upload File'}
                  </label>
                  {popFile && <span className="text-[10px] text-green-600 font-semibold mt-1.5">✓ {popFile.name}</span>}
                </div>

                <button 
                  onClick={handleSubmitPop}
                  disabled={submittingPop || !popFilePreview}
                  className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingPop ? 'Submitting...' : 'Submit Payment'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Help Modal (How It Works) */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4 border animate-scale-up text-left max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setHelpModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <div className="border-b pb-3 flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <HelpCircle size={22} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-800">How the Tenant Portal Works</h4>
                <p className="text-xs text-gray-500">Step-by-step guide to managing your business tenancy.</p>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto space-y-3.5 text-xs text-gray-600 pr-1">
              <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-2xl border">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">1</div>
                <div>
                  <div className="font-bold text-gray-800 text-xs">Share Your Unique Referral Link</div>
                  <p className="mt-0.5 text-gray-500 text-[11px] leading-relaxed">
                    Copy your dedicated link (<code className="bg-white px-1 py-0.5 rounded border">?ref={user?.uid}</code>) from your Tenant Portal or menu and share it with partners or users.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-2xl border">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">2</div>
                <div>
                  <div className="font-bold text-gray-800 text-xs">Referral Signup Quotas</div>
                  <p className="mt-0.5 text-gray-500 text-[11px] leading-relaxed">
                    Track your live quota progress set by the platform Admin for referring new Tenants and Subscribers directly on your portal cards.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-2xl border">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">3</div>
                <div>
                  <div className="font-bold text-gray-800 text-xs">Earn Monthly Passive Income</div>
                  <p className="mt-0.5 text-gray-500 text-[11px] leading-relaxed">
                    Earn <span className="font-bold text-blue-700">R250/month</span> for each active referred Tenant and <span className="font-bold text-indigo-700">R120/month</span> for each active referred Subscriber as long as their subscription stays active.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-2xl border">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">4</div>
                <div>
                  <div className="font-bold text-gray-800 text-xs">Monthly Subscription Activation</div>
                  <p className="mt-0.5 text-gray-500 text-[11px] leading-relaxed">
                    Click the credit card icon at the top right to upload your monthly Capitec bank transfer Proof of Payment (PoP) to keep your tenant status active.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-2xl border">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">5</div>
                <div>
                  <div className="font-bold text-gray-800 text-xs">Account Deactivation / Reactivation</div>
                  <p className="mt-0.5 text-gray-500 text-[11px] leading-relaxed">
                    Need to pause? Deactivate your account from the 3-bar menu anytime. Your account stays offline until you choose to reactivate.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setHelpModalOpen(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* About Modal (About Tenant Portal) */}
      {aboutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4 border animate-scale-up text-left max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setAboutModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <div className="border-b pb-3 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Info size={22} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-800">About the Tenant Portal</h4>
                <p className="text-xs text-gray-500">Empowering business partners on TimeGiG.</p>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto space-y-3.5 text-xs text-gray-600 pr-1 leading-relaxed">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl text-gray-800 space-y-1">
                <span className="font-bold text-xs text-blue-900 block">Verified Business Workspace</span>
                <p className="text-[11px] text-gray-600">
                  The Tenant Portal is an exclusive partner environment built for verified business tenants who manage their own micro-network of referrals and earnings.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wider text-[10px]">Key Capabilities</h5>
                
                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Referral Management:</strong> Track all tenants and subscribers who registered through your unique referral link.</span>
                </div>

                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Earnings Breakdown:</strong> Monitor live monthly passive profit calculated automatically from active referred accounts.</span>
                </div>

                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Admin Quota Syncing:</strong> Your signup quotas are configured by Admin and updated dynamically in real-time.</span>
                </div>

                <div className="flex items-start gap-2 text-[11px]">
                  <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Account Flexibility:</strong> Deactivate and reactivate your account at any time without losing your profile configuration.</span>
                </div>
              </div>

              <div className="bg-gray-50 border p-3 rounded-2xl text-[11px] text-gray-500">
                For additional inquiries or support with your Tenant Portal, please reach out to the platform Admin at <span className="font-semibold text-gray-700">timegig2026@gmail.com</span>.
              </div>
            </div>

            <button
              onClick={() => setAboutModalOpen(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main className="flex-grow p-4 pt-16 space-y-4">
        {activeTab === 'Tenant Portal' && userData?.joinedViaAdminRef && (
          <div className="bg-amber-50 border border-orange-200 text-orange-850 rounded-2xl p-4 text-xs text-left max-w-sm mx-auto space-y-1 shadow-sm">
            <span className="font-bold flex items-center gap-1">
              <Shield size={14} className="text-orange-600" />
              <span>Admin Referral Limit Active</span>
            </span>
            <p className="text-gray-700 leading-normal">
              You registered via the shareable Admin link. Your invitation capacity is restricted to a maximum of:
            </p>
            <ul className="list-disc list-inside font-semibold text-orange-950 mt-1">
              <li>10 signup Tenants maximum</li>
              <li>100 signup subscription Users maximum</li>
            </ul>
          </div>
        )}
        {activeTab === 'Activation' && <Activation onUpdate={syncUserStep} />}
        {activeTab === 'Tenant Portal' && <TenantPortal userData={userData} onLogout={handleLogout} />}
        {activeTab === 'User Portal' && <UserPortal userDetails={userData} onLogout={handleLogout} />}
        {activeTab === 'Admin' && isAdmin && <Admin adminSub={adminSub} isAdmin={isAdmin} maxTenants={maxTenants} maxSubscribers={maxSubscribers} onRefresh={syncUserStep} />}
        {activeTab !== 'Activation' && activeTab !== 'Tenant Portal' && activeTab !== 'User Portal' && activeTab !== 'Admin' && (
          <div className="flex-grow bg-white min-h-[75vh]" />
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-around z-10">
        {navItems.map(item => (
          <button 
            key={item.name} 
            onClick={() => {
              setActiveTab(item.name);
              setMenuOpen(false);
            }}
            className={`flex flex-col items-center p-2 rounded-lg ${activeTab === item.name ? 'bg-gray-50' : ''}`}
          >
            <item.icon size={24} />
            <span className="text-xs">{item.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const ref = queryParams.get('ref');
    if (ref) {
      sessionStorage.setItem('ref', ref);
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
