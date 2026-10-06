/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, onSnapshot, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { Menu, LogOut, Zap, Users, Briefcase, Shield, BarChart3, CheckCircle, UserCheck, UserPlus, Upload, FileText, Loader2, Award, CreditCard, X, MoreVertical, Phone, Mail, Globe, Wrench, Trash2, Plus, Save, Power, HelpCircle, Info, BookOpen, Edit3, Search, Minus, Navigation, MapPin, Volume2, VolumeX, Radio, ArrowRight, CornerUpRight, Flag, Compass, Check } from 'lucide-react';
import * as L from 'leaflet';

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

export interface ActiveGig {
  id: string;
  seeker: any;
  userEmail?: string;
  userDestination: {
    lat: number;
    lng: number;
    address: string;
  };
  seekerOrigin: {
    lat: number;
    lng: number;
    address: string;
  };
  status: 'requesting' | 'accepted' | 'in_progress' | 'arrived' | 'finished';
  currentStepIndex: number;
  totalDistanceKm: number;
  etaMinutes: number;
}

let ladyVoiceCache: SpeechSynthesisVoice | null = null;

function getLadyVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (ladyVoiceCache) return ladyVoiceCache;
  const voices = window.speechSynthesis.getVoices();
  const femaleVoice = voices.find(v => 
    (v.name.toLowerCase().includes('female') || 
     v.name.toLowerCase().includes('zira') || 
     v.name.toLowerCase().includes('samantha') || 
     v.name.toLowerCase().includes('victoria') || 
     v.name.toLowerCase().includes('karen') || 
     v.name.toLowerCase().includes('moira') || 
     v.name.toLowerCase().includes('google uk english female') ||
     v.name.toLowerCase().includes('natural') ||
     v.name.toLowerCase().includes('susan') ||
     v.name.toLowerCase().includes('hazel')) && 
    v.lang.startsWith('en')
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (femaleVoice) ladyVoiceCache = femaleVoice;
  return femaleVoice || null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getLadyVoice();
  };
}

function speakLadyVoice(text: string, isMuted = false, onStart?: () => void, onEnd?: () => void) {
  if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    // Strictly filter out any app name mentions so the navigation lady NEVER says the app name
    const sanitizedText = text
      .replace(/timegig/gi, '')
      .replace(/time gig/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!sanitizedText) return;
    const utterance = new SpeechSynthesisUtterance(sanitizedText);
    const voice = getLadyVoice();
    if (voice) utterance.voice = voice;
    utterance.pitch = 1.15; // Crisp, friendly female pitch
    utterance.rate = 0.95;  // Natural turn-by-turn guidance cadence
    utterance.volume = 1.0;
    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Registration Failed: Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Registration Failed: Please enter a password.');
      return;
    }
    if (!terms) {
      setError('Registration Failed: Please accept the terms and conditions.');
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
    } catch (err: any) {
      let msg = 'Registration failed. Please try again.';
      if (err?.code === 'auth/email-already-in-use') {
        msg = 'Registration Failed: An account with this email address already exists. Try logging in instead.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'Registration Failed: Password is too weak. Please use at least 6 characters.';
      } else if (err?.code === 'auth/invalid-email') {
        msg = 'Registration Failed: Invalid email format. Please check your email address.';
      } else if (err?.message) {
        msg = `Registration Failed: ${err.message}`;
      }
      setError(msg);
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
    if (!email.trim()) {
      setError('Login Failed: Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Login Failed: Please enter your password.');
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred.user) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email
        }, { merge: true });
      }
      navigate('/');
    } catch (err: any) {
      let msg = 'Login Failed: Please check your email and password.';
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        msg = 'Login Failed: Incorrect email address or password.';
      } else if (err?.code === 'auth/invalid-email') {
        msg = 'Login Failed: Invalid email format.';
      } else if (err?.code === 'auth/too-many-requests') {
        msg = 'Login Failed: Access temporarily locked due to multiple failed login attempts. Please try again later.';
      } else if (err?.message) {
        msg = `Login Failed: ${err.message}`;
      }
      setError(msg);
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
  const [docSubmitError, setDocSubmitError] = useState<string | null>(null);
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
    setDocSubmitError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 800 * 1024) {
        setDocSubmitError(`Profile picture '${file.name}' is too large (${(file.size / 1024).toFixed(0)} KB). Maximum allowed size is 800 KB to prevent database timeout.`);
        return;
      }
      setProfilePic(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocSubmitError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 800 * 1024) {
        setDocSubmitError(`ID Document '${file.name}' is too large (${(file.size / 1024).toFixed(0)} KB). Maximum allowed size is 800 KB to prevent database timeout.`);
        return;
      }
      setIdDoc(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdDocPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDocs = async () => {
    setDocSubmitError(null);
    if (!user) {
      const msg = 'Submission Failed: User session is unavailable or lost. Please log out and log in again.';
      setDocSubmitError(msg);
      alert(msg);
      return;
    }
    if (!profilePic || !idDoc) {
      const missing = [];
      if (!profilePic) missing.push('Profile Picture');
      if (!idDoc) missing.push('ID Document');
      const msg = `Submission Failed: Missing required files (${missing.join(', ')}). Please select both required documents.`;
      setDocSubmitError(msg);
      alert(msg);
      return;
    }
    if (profilePic.size > 800 * 1024 || idDoc.size > 800 * 1024) {
      const msg = `Submission Failed: File size exceeds the 800 KB limit. Please compress your files before uploading.`;
      setDocSubmitError(msg);
      alert(msg);
      return;
    }
    if (!profilePicPreview || !idDocPreview) {
      const msg = 'Submission Failed: Document previews are still processing in your browser. Please wait a moment and try again.';
      setDocSubmitError(msg);
      alert(msg);
      return;
    }
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        activated: true,
        activationOption: selectedOption || 'Become a tenant',
        activationStep: 'review',
        profilePicName: profilePic.name || 'profile_picture',
        idDocName: idDoc.name || 'id_document',
        profilePicData: profilePicPreview,
        idDocData: idDocPreview
      }, { merge: true });
      setStep('review');
      if (onUpdate) onUpdate();
    } catch (e: any) {
      console.error('handleSubmitDocs error:', e);
      const reasonMsg = e?.message || e?.code || String(e);
      const fullError = `Submission Failed: ${reasonMsg}`;
      setDocSubmitError(fullError);
      alert(fullError);
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

          {docSubmitError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-left space-y-1 animate-shake shadow-sm">
              <div className="font-bold flex items-center gap-1.5 text-red-800">
                <span>⚠️ Submission Error</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{docSubmitError}</p>
            </div>
          )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <button 
          onClick={() => handleChooseOption('Become a tenant')} 
          className="relative h-48 rounded-3xl p-6 text-left flex flex-col justify-between overflow-hidden border-2 border-blue-400 glow-blue-card transition-all duration-300 hover:scale-[1.03] active:scale-95 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white group"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500/30 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/40 transition-all"></div>
          <div className="flex justify-between items-start w-full relative z-10">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-blue-300 bg-blue-900/80 px-2.5 py-1 rounded-full border border-blue-400/50 shadow-sm">
              Tenant Mode
            </span>
            <div className="p-2.5 bg-blue-500/20 rounded-2xl border border-blue-400/40 shadow-inner">
              <Briefcase size={20} className="text-blue-300" />
            </div>
          </div>
          <div className="relative z-10 space-y-1">
            <div className="text-xl font-black text-white flex items-center gap-2">
              <span>Become a tenant</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
            </div>
            <p className="text-xs text-blue-100 font-medium leading-relaxed">
              Become a tenant and earn a passive monthly income from user subscriptions.
            </p>
          </div>
        </button>

        <button 
          onClick={() => handleChooseOption('User Subscription')} 
          className="relative h-48 rounded-3xl p-6 text-left flex flex-col justify-between overflow-hidden border-2 border-indigo-400 glow-indigo-card transition-all duration-300 hover:scale-[1.03] active:scale-95 bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white group"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/40 transition-all"></div>
          <div className="flex justify-between items-start w-full relative z-10">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-300 bg-indigo-900/80 px-2.5 py-1 rounded-full border border-indigo-400/50 shadow-sm">
              Subscription Mode
            </span>
            <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/40 shadow-inner">
              <Users size={20} className="text-indigo-300" />
            </div>
          </div>
          <div className="relative z-10 space-y-1">
            <div className="text-xl font-black text-white flex items-center gap-2">
              <span>User Subscription</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping"></span>
            </div>
            <p className="text-xs text-indigo-100 font-medium leading-relaxed">
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
  const [tenantAccountMode, setTenantAccountMode] = useState<'Become a tenant' | 'User Subscription'>('Become a tenant');
  const [tenantMaxTenants, setTenantMaxTenants] = useState(10);
  const [tenantMaxSubs, setTenantMaxSubs] = useState(100);
  const [tenantSubFee, setTenantSubFee] = useState(250);
  const [userSubFee, setUserSubFee] = useState(120);
  const [tenantTrialDays, setTenantTrialDays] = useState(7);
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const handleOpenEditQuota = (tenant: any) => {
    setQuotaError(null);
    setEditingTenantQuota(tenant);
    setTenantAccountMode(tenant.activationOption || 'Become a tenant');
    setTenantMaxTenants(tenant.maxReferredTenants !== undefined ? Number(tenant.maxReferredTenants) : 10);
    setTenantMaxSubs(tenant.maxReferredSubscribers !== undefined ? Number(tenant.maxReferredSubscribers) : 100);
    setTenantSubFee(tenant.tenantSubFee !== undefined ? Number(tenant.tenantSubFee) : (tenant.monthlySubFee !== undefined ? Number(tenant.monthlySubFee) : 250));
    setUserSubFee(tenant.userSubFee !== undefined ? Number(tenant.userSubFee) : 120);
    setTenantTrialDays(tenant.trialDays !== undefined ? Number(tenant.trialDays) : 7);
  };

  const handleSaveTenantQuota = async () => {
    setQuotaError(null);
    if (!editingTenantQuota?.uid) {
      const msg = 'Update Failed: Target user identifier is missing.';
      setQuotaError(msg);
      alert(msg);
      return;
    }
    setSavingQuota(true);
    try {
      await setDoc(doc(db, 'users', editingTenantQuota.uid), {
        activationOption: tenantAccountMode,
        maxReferredTenants: Number(tenantMaxTenants),
        maxReferredSubscribers: Number(tenantMaxSubs),
        tenantSubFee: Number(tenantSubFee),
        userSubFee: Number(userSubFee),
        monthlySubFee: Number(tenantSubFee),
        trialDays: Number(tenantTrialDays)
      }, { merge: true });
      alert(`User settings and account mode updated for ${editingTenantQuota.email} with immediate effect!`);
      setEditingTenantQuota(null);
      getDocs(collection(db, 'users')).then(snap => {
        const list: any[] = [];
        snap.forEach(d => list.push(d.data()));
        setAllUsers(list);
      });
      if (onRefresh) onRefresh();
    } catch (e: any) {
      console.error(e);
      const fullError = `User Settings Update Failed: ${e?.message || e?.code || String(e)}`;
      setQuotaError(fullError);
      alert(fullError);
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

  // Platform Defaults State in Admin Overview
  const [platformTenantFee, setPlatformTenantFee] = useState(250);
  const [platformUserFee, setPlatformUserFee] = useState(120);
  const [platformTrialDays, setPlatformTrialDays] = useState(7);
  const [savingPlatformRates, setSavingPlatformRates] = useState(false);
  const [ratesSuccessMsg, setRatesSuccessMsg] = useState(false);

  useEffect(() => {
    if (adminSub === 'Overview') {
      getDocs(collection(db, 'users')).then(snap => {
        const list: any[] = [];
        snap.forEach(d => {
          list.push(d.data());
        });
        setAllUsers(list);
      });

      getDoc(doc(db, 'settings', 'limits')).then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.tenantSubFee !== undefined) setPlatformTenantFee(d.tenantSubFee);
          if (d.userSubFee !== undefined) setPlatformUserFee(d.userSubFee);
          if (d.defaultTrialDays !== undefined) setPlatformTrialDays(d.defaultTrialDays);
        }
      }).catch(e => console.error(e));
    }
  }, [adminSub]);

  const handleSavePlatformRates = async () => {
    setSavingPlatformRates(true);
    try {
      await setDoc(doc(db, 'settings', 'limits'), {
        tenantSubFee: Number(platformTenantFee),
        userSubFee: Number(platformUserFee),
        defaultTrialDays: Number(platformTrialDays)
      }, { merge: true });
      setRatesSuccessMsg(true);
      setTimeout(() => setRatesSuccessMsg(false), 3000);
      if (onRefresh) onRefresh();
      alert('Platform subscription fees and trial days saved with immediate effect!');
    } catch (e: any) {
      console.error(e);
      alert(`Save Failed: ${e?.message || String(e)}`);
    } finally {
      setSavingPlatformRates(false);
    }
  };

  if (adminSub === 'Overview') {
    const allTenantsApproved = allUsers.filter(u => u.activationOption === 'Become a tenant' && u.activationStep === 'approved');
    const allSubsApproved = allUsers.filter(u => u.activationOption === 'User Subscription' && u.activationStep === 'approved');

    // Filter list based on isAdmin
    const tenantsList = isAdmin ? allTenantsApproved : allTenantsApproved.filter(u => !u.deactivated);
    const subUsersList = isAdmin ? allSubsApproved : allSubsApproved.filter(u => !u.deactivated);

    const activeTenants = allTenantsApproved.filter(u => !u.deactivated);
    const activeSubscribers = allSubsApproved.filter(u => !u.deactivated);

    const tenantProfit = activeTenants.length * platformTenantFee;
    const userProfit = activeSubscribers.length * platformUserFee;
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
            <span className="text-[10px] text-blue-600 block mt-0.5">R{platformTenantFee}/mo each</span>
          </div>

          <div 
            onClick={() => setActiveDetailsModal('user')}
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 p-4 rounded-xl text-left cursor-pointer hover:shadow-md transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">User Profit</span>
            <span className="text-xl font-black text-indigo-900 mt-1 block">R{userProfit}</span>
            <span className="text-[10px] text-indigo-600 block mt-0.5">R{platformUserFee}/mo each</span>
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
                <h4 className="text-base font-bold text-gray-800">Set User Account & Quotas</h4>
                <p className="text-xs text-blue-600 font-semibold truncate mt-0.5">{editingTenantQuota.email}</p>
              </div>

              <div className="space-y-3 text-xs">
                {/* Account Mode Selector for Admin */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 block uppercase">Account Role Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTenantAccountMode('Become a tenant')}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                        tenantAccountMode === 'Become a tenant'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Tenant Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setTenantAccountMode('User Subscription')}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                        tenantAccountMode === 'User Subscription'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Subscription User
                    </button>
                  </div>
                </div>

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

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 block uppercase">Tenant Fee</label>
                    <input 
                      type="number" 
                      value={tenantSubFee} 
                      onChange={e => setTenantSubFee(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 block uppercase">User Fee</label>
                    <input 
                      type="number" 
                      value={userSubFee} 
                      onChange={e => setUserSubFee(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 block uppercase">Trial Days</label>
                    <input 
                      type="number" 
                      value={tenantTrialDays} 
                      onChange={e => setTenantTrialDays(Math.max(0, Number(e.target.value)))} 
                      className="w-full border p-2 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center text-xs"
                    />
                  </div>
                </div>
              </div>

              {quotaError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-left">
                  ⚠️ {quotaError}
                </div>
              )}

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
  const [popError, setPopError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

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
    setProfileError(null);
    if (!userDetails?.uid) {
      const msg = 'Save Failed: User session is unavailable. Please log in again.';
      setProfileError(msg);
      alert(msg);
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', userDetails.uid), {
        phone: phone || '',
        contactEmail: contactEmail || '',
        socialLinks: socialLinks || [],
        tradeSkills: tradeSkills || '',
        motivationLetter: motivationLetter || ''
      }, { merge: true });
      alert('Profile updated successfully!');
      setIsLocked(true);
    } catch (e: any) {
      console.error('handleSaveProfile error:', e);
      const fullError = `Profile Save Failed: ${e?.message || e?.code || String(e)}`;
      setProfileError(fullError);
      alert(fullError);
    } finally {
      setSaving(false);
    }
  };

  const handlePopFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPopError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 800 * 1024) {
        setPopError(`Document '${file.name}' is too large (${(file.size / 1024).toFixed(0)} KB). Maximum allowed file size is 800 KB.`);
        return;
      }
      setPopFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPopFilePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPop = async () => {
    setPopError(null);
    if (!userDetails?.uid) {
      const msg = 'Payment Submission Failed: User session unavailable. Please log in again.';
      setPopError(msg);
      alert(msg);
      return;
    }
    if (!popFilePreview) {
      const msg = 'Payment Submission Failed: Please select and upload a Proof of Payment document image/PDF first.';
      setPopError(msg);
      alert(msg);
      return;
    }
    if (popFile && popFile.size > 800 * 1024) {
      const msg = `Payment Submission Failed: File size is ${(popFile.size / 1024).toFixed(0)} KB, exceeding 800 KB limit.`;
      setPopError(msg);
      alert(msg);
      return;
    }
    setSubmittingPop(true);
    try {
      await setDoc(doc(db, 'users', userDetails.uid), {
        userPopStep: 'review',
        userPopData: popFilePreview,
        userPopName: popFile?.name || 'pop_document'
      }, { merge: true });
      setPopStep('review');
      alert('Proof of payment submitted successfully!');
    } catch (e: any) {
      console.error('handleSubmitPop error:', e);
      const fullError = `Payment Submission Failed: ${e?.message || e?.code || String(e)}`;
      setPopError(fullError);
      alert(fullError);
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
        {profileError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold text-left">
            ⚠️ {profileError}
          </div>
        )}

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

                {popError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-left">
                    ⚠️ {popError}
                  </div>
                )}

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

function GiGsMap({ 
  backgroundMode = false,
  activeGig = null,
  onFinishGig,
  onCancelGig,
  voiceMuted = false,
  onToggleVoiceMute
}: { 
  backgroundMode?: boolean;
  activeGig?: ActiveGig | null;
  onFinishGig?: () => void;
  onCancelGig?: () => void;
  voiceMuted?: boolean;
  onToggleVoiceMute?: () => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const searchPinMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routePolylineGlowRef = useRef<L.Polyline | null>(null);
  const movingSeekerMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);

  const [isSatellite, setIsSatellite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [realUsers, setRealUsers] = useState<any[]>([]);

  // Navigation simulation & Voice HUD states
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [isLadySpeaking, setIsLadySpeaking] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState('Directing seeker to your location');
  const [remainingDist, setRemainingDist] = useState('2.8 km');
  const [etaTime, setEtaTime] = useState('5 mins');

  // Diagnostic states
  const [gpsStatus, setGpsStatus] = useState<string>('Requesting GPS...');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Fetch only real registered users from Firestore
  useEffect(() => {
    if (!backgroundMode) {
      const loadUsers = (retry = 0) => {
        getDocs(collection(db, 'users')).then(snap => {
          const list: any[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() });
          });
          setRealUsers(list);
        }).catch((e: any) => {
          if (e?.message?.includes('offline') || e?.code === 'unavailable') {
            if (retry < 3) {
              setTimeout(() => loadUsers(retry + 1), 1200);
            }
          } else {
            console.error('Error fetching real users for map:', e);
          }
        });
      };
      loadUsers();
    }
  }, [backgroundMode]);

  const filteredUsers = realUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const option = (u.activationOption || '').toLowerCase();
    const city = (u.city || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    const name = (u.displayName || u.name || '').toLowerCase();
    return email.includes(query) || option.includes(query) || city.includes(query) || role.includes(query) || name.includes(query);
  });

  // Debounced search query lookup for addresses, home numbers, streets, cities, and provinces
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2 || backgroundMode) {
      setSearchSuggestions([]);
      setSearchFeedback(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLocation(true);
      setSearchFeedback(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchSuggestions(Array.isArray(data) ? data : []);
          if (data.length === 0) {
            setSearchFeedback('No matching address found. Try adding city or province.');
          }
        }
      } catch (err) {
        console.error('Address geocoding search error:', err);
      } finally {
        setSearchingLocation(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, backgroundMode]);

  // Navigate map directly to a selected address or geocoded place
  const handleSelectLocation = (place: any) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    if (isNaN(lat) || isNaN(lon)) return;

    let zoomLevel = 16;
    const type = (place.type || '').toLowerCase();
    const placeClass = (place.class || '').toLowerCase();
    const addr = place.address || {};

    if (addr.house_number || type === 'house' || type === 'building') {
      zoomLevel = 18;
    } else if (addr.road || type === 'street' || type === 'residential' || type === 'living_street') {
      zoomLevel = 17;
    } else if (addr.suburb || addr.neighbourhood || type === 'suburb') {
      zoomLevel = 15;
    } else if (type === 'city' || type === 'town' || type === 'village' || placeClass === 'boundary') {
      zoomLevel = 13;
    } else if (type === 'administrative' || type === 'state' || type === 'province') {
      zoomLevel = 10;
    }

    map.flyTo([lat, lon], zoomLevel, { duration: 1.5 });

    if (searchPinMarkerRef.current) {
      searchPinMarkerRef.current.setLatLng([lat, lon]);
    } else {
      const searchPinIcon = L.divIcon({
        className: 'custom-search-pin',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div style="background-color: #ef4444; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6); display: flex; align-items: center; justify-content: center;">
              <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      });
      const pin = L.marker([lat, lon], { icon: searchPinIcon }).addTo(map);
      searchPinMarkerRef.current = pin;
    }

    const displayName = place.display_name || 'Searched Location';
    const streetInfo = addr.house_number ? `${addr.house_number} ${addr.road || ''}` : (addr.road || '');
    const cityInfo = addr.city || addr.town || addr.suburb || addr.municipality || '';
    const stateInfo = addr.state || addr.province || '';

    searchPinMarkerRef.current.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 4px; max-width: 240px;">
        <div style="display: flex; items-center; gap: 6px; font-weight: bold; color: #ef4444; margin-bottom: 4px;">
          📍 <span>Target Location</span>
        </div>
        ${streetInfo ? `<div style="font-weight: 700; color: #0f172a; font-size: 13px;">${streetInfo}</div>` : ''}
        ${cityInfo || stateInfo ? `<div style="color: #475569; font-size: 11px;">${[cityInfo, stateInfo].filter(Boolean).join(', ')}</div>` : ''}
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; word-break: break-word;">${displayName}</div>
        <div style="font-size: 9px; font-family: monospace; color: #64748b; margin-top: 4px;">Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}</div>
      </div>
    `).openPopup();

    setSearchSuggestions([]);
    setSearchFeedback(null);
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchSuggestions.length > 0) {
      handleSelectLocation(searchSuggestions[0]);
      return;
    }

    setSearchingLocation(true);
    setSearchFeedback(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          handleSelectLocation(data[0]);
        } else {
          const matchedUser = realUsers.find(u => 
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (u.city || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (matchedUser && mapInstanceRef.current) {
            let uLat = matchedUser.latitude !== undefined ? Number(matchedUser.latitude) : Number(matchedUser.lat || -28.4792);
            let uLng = matchedUser.longitude !== undefined ? Number(matchedUser.longitude) : Number(matchedUser.lng || 24.6727);
            mapInstanceRef.current.flyTo([uLat, uLng], 16, { duration: 1.5 });
            setSearchFeedback(`Found registered user: ${matchedUser.email}`);
          } else {
            setSearchFeedback(`No location found for "${searchQuery}". Please check home number, street, or province.`);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setSearchFeedback('Location search failed. Please try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const locateUser = (map: L.Map) => {
    if (backgroundMode) return;
    setGpsStatus('Locating...');
    setGeoError(null);
    if (!navigator.geolocation) {
      setGpsStatus('Not Supported');
      setGeoError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;

        setLatitude(lat);
        setLongitude(lng);
        setAccuracy(acc);
        setGpsStatus('Success');
        setGeoError(null);

        if (!activeGig) {
          map.setView([lat, lng], 14);
        }

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const userIcon = L.divIcon({
            className: 'custom-user-marker',
            html: `<div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(37,99,235,0.8);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });
          const marker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
          marker.bindPopup(`<div style="font-family: sans-serif; font-size: 12px; font-weight: bold; color: #2563eb;">📍 Your Exact Location<br/>Accuracy: ${acc.toFixed(1)}m</div>`);
          userMarkerRef.current = marker;
        }
      },
      (error) => {
        setGpsStatus('Failed');
        setGeoError(`Code ${error.code}: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Map initialization
  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, { 
        zoomControl: false,
        attributionControl: false,
        dragging: !backgroundMode,
        scrollWheelZoom: !backgroundMode,
        touchZoom: !backgroundMode
      }).setView([-28.4792, 24.6727], 6);

      const initialUrl = isSatellite 
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(initialUrl, {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;

      if (!backgroundMode) {
        locateUser(map);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [backgroundMode]);

  // Satellite layer update
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newUrl = isSatellite 
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newTileLayer = L.tileLayer(newUrl, {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [isSatellite]);

  // LIVE GIG ROUTE NAVIGATION & LADY VOICE GUIDANCE
  useEffect(() => {
    if (!mapInstanceRef.current || !activeGig || backgroundMode) return;
    const map = mapInstanceRef.current;

    const startLat = activeGig.seekerOrigin.lat;
    const startLng = activeGig.seekerOrigin.lng;
    const destLat = activeGig.userDestination.lat;
    const destLng = activeGig.userDestination.lng;

    // Generate realistic multi-waypoint turn-by-turn road route coordinates
    const midLat1 = startLat + (destLat - startLat) * 0.25 + 0.003;
    const midLng1 = startLng + (destLng - startLng) * 0.25 - 0.002;
    const midLat2 = startLat + (destLat - startLat) * 0.55 - 0.002;
    const midLng2 = startLng + (destLng - startLng) * 0.55 + 0.003;
    const midLat3 = startLat + (destLat - startLat) * 0.82 + 0.001;
    const midLng3 = startLng + (destLng - startLng) * 0.82 - 0.001;

    const routeWaypoints: [number, number][] = [
      [startLat, startLng],
      [midLat1, midLng1],
      [midLat2, midLng2],
      [midLat3, midLng3],
      [destLat, destLng]
    ];

    // Remove old route & markers if any
    if (routePolylineRef.current) map.removeLayer(routePolylineRef.current);
    if (routePolylineGlowRef.current) map.removeLayer(routePolylineGlowRef.current);
    if (movingSeekerMarkerRef.current) map.removeLayer(movingSeekerMarkerRef.current);
    if (destinationMarkerRef.current) map.removeLayer(destinationMarkerRef.current);

    // Glowing navigation path background
    const polyGlow = L.polyline(routeWaypoints, {
      color: '#3b82f6',
      weight: 10,
      opacity: 0.45,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    routePolylineGlowRef.current = polyGlow;

    // Crisp high-contrast navigation line
    const polyMain = L.polyline(routeWaypoints, {
      color: '#1d4ed8',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    routePolylineRef.current = polyMain;

    // Fit map view to encompass the entire route
    const bounds = L.latLngBounds(routeWaypoints);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });

    // Destination Pin with pulsing target ring
    const destIcon = L.divIcon({
      className: 'gig-destination-marker',
      html: `
        <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: rgba(239, 68, 68, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="background-color: #ef4444; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.7); display: flex; align-items: center; justify-content: center;">
            <div style="width: 12px; height: 12px; background: white; border-radius: 50%;"></div>
          </div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 42]
    });

    const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map);
    destMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="color: #ef4444; font-size: 13px;">🎯 GiG Destination</strong>
        <p style="font-size: 11px; color: #334155; margin-top: 3px;">${activeGig.userDestination.address || 'User Location'}</p>
        <span style="font-size: 10px; font-weight: bold; color: #16a34a; background: #f0fdf4; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Target for Finish</span>
      </div>
    `);
    destinationMarkerRef.current = destMarker;

    // Moving Seeker Traveler Marker
    const seekerPic = activeGig.seeker.profilePicData;
    const seekerInitial = activeGig.seeker.email?.[0]?.toUpperCase() || 'S';
    const seekerIcon = L.divIcon({
      className: 'gig-seeker-traveler-marker',
      html: `
        <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(37, 99, 235, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 38px; height: 38px; border-radius: 50%; border: 3px solid #2563eb; box-shadow: 0 4px 14px rgba(0,0,0,0.35); background: white; overflow: hidden; display: flex; align-items: center; justify-content: center; z-index: 10;">
            ${seekerPic 
              ? `<img src="${seekerPic}" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<span style="color: #2563eb; font-weight: 900; font-size: 15px; font-family: sans-serif;">${seekerInitial}</span>`
            }
          </div>
          <div style="position: absolute; bottom: 0; right: 0; background: #16a34a; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; z-index: 20; display: flex; align-items: center; justify-content: center; font-size: 8px; color: white;">⚡</div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    const seekerMarker = L.marker([startLat, startLng], { icon: seekerIcon }).addTo(map);
    movingSeekerMarkerRef.current = seekerMarker;

    // Turn-by-turn guidance scripts with Lady speaking voice
    const instructions = [
      { text: `Directing ${activeGig.seeker.email} from location to your destination.`, speech: `Seeker has accepted your gig. Directing seeker along the route to your destination.`, dist: '2.8 km', eta: '5 mins' },
      { text: 'In 350 meters, turn right onto Main Connector toward destination.', speech: 'In three hundred and fifty meters, turn right onto Main Connector toward your destination.', dist: '2.1 km', eta: '4 mins' },
      { text: 'Proceed straight on Main Connector for 1.2 kilometers.', speech: 'Proceed straight along Main Connector for one point two kilometers.', dist: '1.4 km', eta: '2 mins' },
      { text: 'Turn left onto destination street. Approaching user location.', speech: 'Turn left onto the destination street. Seeker is now approaching your location.', dist: '400 m', eta: '1 min' },
      { text: 'Seeker arrived at your destination! Ready to finish the gig.', speech: 'Seeker has arrived at your destination. You can now start and finish the gig.', dist: 'Arrived', eta: 'Now' }
    ];

    let currentStep = 0;
    setNavStepIndex(0);
    setCurrentInstruction(instructions[0].text);
    setRemainingDist(instructions[0].dist);
    setEtaTime(instructions[0].eta);

    // Initial voice greeting from the lady navigator
    speakLadyVoice(
      instructions[0].speech,
      voiceMuted,
      () => setIsLadySpeaking(true),
      () => setIsLadySpeaking(false)
    );

    // Live progress timer moving seeker along the route
    const navInterval = setInterval(() => {
      currentStep++;
      if (currentStep < routeWaypoints.length) {
        const nextCoord = routeWaypoints[currentStep];
        seekerMarker.setLatLng(nextCoord);
        map.panTo(nextCoord, { animate: true, duration: 1.2 });

        const instr = instructions[Math.min(currentStep, instructions.length - 1)];
        setNavStepIndex(currentStep);
        setCurrentInstruction(instr.text);
        setRemainingDist(instr.dist);
        setEtaTime(instr.eta);

        speakLadyVoice(
          instr.speech,
          voiceMuted,
          () => setIsLadySpeaking(true),
          () => setIsLadySpeaking(false)
        );
      } else {
        clearInterval(navInterval);
      }
    }, 4500);

    return () => {
      clearInterval(navInterval);
      if (routePolylineRef.current) map.removeLayer(routePolylineRef.current);
      if (routePolylineGlowRef.current) map.removeLayer(routePolylineGlowRef.current);
      if (movingSeekerMarkerRef.current) map.removeLayer(movingSeekerMarkerRef.current);
      if (destinationMarkerRef.current) map.removeLayer(destinationMarkerRef.current);
    };
  }, [activeGig, backgroundMode]);

  // Render registered users when not in active navigation mode
  useEffect(() => {
    if (!mapInstanceRef.current || activeGig) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== userMarkerRef.current && layer !== searchPinMarkerRef.current) {
        map.removeLayer(layer);
      }
    });

    if (!backgroundMode && filteredUsers.length > 0) {
      filteredUsers.forEach(u => {
        let uLat = u.latitude !== undefined ? Number(u.latitude) : (u.lat !== undefined ? Number(u.lat) : null);
        let uLng = u.longitude !== undefined ? Number(u.longitude) : (u.lng !== undefined ? Number(u.lng) : null);

        if (uLat === null || uLng === null || isNaN(uLat) || isNaN(uLng)) {
          let hash = 0;
          const seedStr = String(u.uid || u.id || u.email || 'user');
          for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
          }
          const seedLat = -25.7 - (Math.abs(hash % 8500) / 1000);
          const seedLng = 18.4 + (Math.abs((hash >> 3) % 13500) / 1000);
          uLat = seedLat;
          uLng = seedLng;
        }

        const isTenant = u.activationOption === 'Become a tenant';
        const badgeColor = isTenant ? '#2563eb' : '#4f46e5';
        const initial = isTenant ? 'T' : 'S';

        const userDivIcon = L.divIcon({
          className: 'real-user-map-pin',
          html: `
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <div style="width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); background: ${badgeColor}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                ${u.profilePicData 
                  ? `<img src="${u.profilePicData}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : `<span style="color: white; font-weight: bold; font-size: 13px; font-family: sans-serif; line-height: 30px;">${initial}</span>`
                }
              </div>
              <div style="position: absolute; bottom: -2px; right: -2px; background: ${u.activated ? '#16a34a' : '#f59e0b'}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const marker = L.marker([uLat, uLng], { icon: userDivIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 4px; min-width: 170px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              ${u.profilePicData 
                ? `<img src="${u.profilePicData}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1.5px solid #cbd5e1;" />`
                : `<div style="width: 30px; height: 30px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 1px solid #bfdbfe;">${initial}</div>`
              }
              <div>
                <strong style="font-size: 12px; color: #0f172a; display: block; word-break: break-all;">${u.email || 'Registered User'}</strong>
                <span style="font-size: 10px; font-weight: bold; color: ${isTenant ? '#2563eb' : '#4f46e5'}; text-transform: uppercase;">
                  ${u.activationOption || (isTenant ? 'Tenant Account' : 'Subscriber Account')}
                </span>
              </div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Status: <span style="font-weight: 600; color: ${u.activated ? '#16a34a' : '#f59e0b'};">${u.activationStep === 'approved' ? 'Verified Active' : (u.activationStep || 'Registered')}</span>
            </div>
            ${u.phone ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">📞 ${u.phone}</div>` : ''}
          </div>
        `);
      });
    }
  }, [filteredUsers, isSatellite, backgroundMode, activeGig]);

  return (
    <div className={`absolute inset-0 w-full h-full ${backgroundMode || activeGig ? '' : 'pb-16'} bg-gray-100 flex flex-col overflow-hidden`}>
      {/* Top Floating HUD: Active GiG Live Navigation with Lady Voice Guidance (Compact & Sleek) */}
      {!backgroundMode && activeGig && (
        <div className="absolute top-3 left-3 right-3 z-40 max-w-sm mx-auto animate-slide-down">
          <div className="bg-slate-900/95 backdrop-blur-md border border-blue-500/70 rounded-2xl p-2.5 shadow-xl text-white space-y-1.5">
            {/* Header: Turn instruction and Voice Wave */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 bg-blue-600 text-white rounded-xl shadow-md border border-blue-400 shrink-0">
                  {navStepIndex >= 4 ? <Flag size={15} className="text-emerald-300" /> : <CornerUpRight size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-blue-800/90 text-blue-200 border border-blue-500/30">
                      Live Guidance
                    </span>
                    {isLadySpeaking && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                        <Radio size={10} className="animate-pulse" />
                        <span>Speaking</span>
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-white truncate mt-0.5 leading-tight">{currentInstruction}</h4>
                </div>
              </div>

              {/* Voice Mute / Unmute & Repeat Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (onToggleVoiceMute) onToggleVoiceMute();
                    else speakLadyVoice(currentInstruction, voiceMuted);
                  }}
                  title={voiceMuted ? "Unmute Lady Voice" : "Mute Lady Voice"}
                  className={`p-1.5 rounded-xl border transition-all active:scale-95 ${
                    voiceMuted 
                      ? 'bg-slate-800 text-slate-400 border-slate-700' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                  }`}
                >
                  {voiceMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  onClick={() => speakLadyVoice(currentInstruction, false)}
                  title="Repeat voice instruction"
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm border border-blue-400 active:scale-95 transition-all text-[10px] font-bold"
                >
                  Repeat
                </button>
              </div>
            </div>

            {/* Sub-bar: Distance, ETA, and Seeker summary */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="text-blue-400 font-extrabold text-xs">{remainingDist}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{etaTime} ETA</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                Seeker: <span className="text-white font-medium">{activeGig.seeker.email?.split('@')[0]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Normal Collapsible Search Bar (Visible when no active gig navigation is running) */}
      {!backgroundMode && !activeGig && (
        <div className="absolute top-4 left-4 z-30 flex flex-col transition-all duration-300 w-[calc(100vw-88px)] sm:max-w-sm">
          {!searchExpanded ? (
            <div>
              <button 
                onClick={() => setSearchExpanded(true)}
                title="Search home number, street address, location, or province"
                className="p-3 bg-white/95 backdrop-blur-md shadow-xl border border-gray-200 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center"
              >
                <Search size={20} />
              </button>
            </div>
          ) : (
            <div className="relative w-full">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 bg-white/95 backdrop-blur-md shadow-2xl border border-gray-200 rounded-2xl p-2 animate-fade-in w-full">
                <button type="submit" className="text-gray-400 hover:text-blue-600 ml-1.5 shrink-0 transition-colors">
                  {searchingLocation ? (
                    <Loader2 size={18} className="animate-spin text-blue-600" />
                  ) : (
                    <Search size={18} />
                  )}
                </button>
                <input 
                  type="text" 
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search home number, street, location, province..." 
                  className="flex-1 bg-transparent text-xs font-semibold text-gray-800 focus:outline-none px-1"
                />
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchQuery(''); setSearchSuggestions([]); setSearchFeedback(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    setSearchExpanded(false);
                    setSearchQuery('');
                    setSearchSuggestions([]);
                    setSearchFeedback(null);
                  }}
                  title="Hide search bar"
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors ml-1"
                >
                  <X size={16} />
                </button>
              </form>

              {/* Suggestions Dropdown for matching addresses, streets, provinces, and users */}
              {(searchSuggestions.length > 0 || searchFeedback) && (
                <div className="absolute top-14 left-0 right-0 bg-white/98 backdrop-blur-lg border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-72 overflow-y-auto animate-fade-in divide-y divide-gray-100 text-left">
                  {searchSuggestions.map((place, idx) => {
                    const addr = place.address || {};
                    const primary = addr.house_number ? `${addr.house_number} ${addr.road || ''}` : (addr.road || place.name || place.display_name.split(',')[0]);
                    const secondary = [addr.suburb, addr.city || addr.town || addr.municipality, addr.state || addr.province, addr.country].filter(Boolean).join(', ');

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectLocation(place)}
                        className="w-full text-left p-3 hover:bg-blue-50 transition-colors flex items-start gap-2.5 text-xs group"
                      >
                        <MapPin size={16} className="text-red-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 truncate text-xs">{primary}</div>
                          <div className="text-[10px] text-gray-500 truncate mt-0.5">{secondary || place.display_name}</div>
                        </div>
                      </button>
                    );
                  })}

                  {searchFeedback && (
                    <div className="p-3 text-[11px] text-gray-500 bg-gray-50 flex items-center gap-1.5">
                      <Info size={14} className="text-gray-400 shrink-0" />
                      <span>{searchFeedback}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Right Controls: Zoom Controls Pillar on top of the 2 Features */}
      {!backgroundMode && (
        <div className={`absolute ${activeGig ? 'bottom-32' : 'bottom-24'} right-4 z-30 flex flex-col items-center gap-2.5 transition-all`}>
          {/* Zoom Controls Pillar */}
          <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <button 
              onClick={() => mapInstanceRef.current?.zoomIn()}
              title="Zoom In"
              className="p-3 text-gray-700 hover:bg-gray-100 transition-colors border-b border-gray-100 flex items-center justify-center active:bg-gray-200"
            >
              <Plus size={18} />
            </button>
            <button 
              onClick={() => mapInstanceRef.current?.zoomOut()}
              title="Zoom Out"
              className="p-3 text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center active:bg-gray-200"
            >
              <Minus size={18} />
            </button>
          </div>

          {/* Exact GPS Location Feature Button */}
          <button 
            onClick={() => {
              if (mapInstanceRef.current) locateUser(mapInstanceRef.current);
            }}
            title="Show My Exact Location"
            className="p-3 bg-white/95 hover:bg-white text-green-700 rounded-2xl shadow-xl border border-gray-200 transition-all active:scale-95 flex items-center justify-center"
          >
            <Navigation size={20} className="text-green-600" />
          </button>

          {/* Satellite / Street Map Toggle Feature Button */}
          <button 
            onClick={() => setIsSatellite(!isSatellite)}
            title={isSatellite ? "Switch to Street Map" : "Switch to Satellite View"}
            className="p-3 bg-white/95 hover:bg-white text-blue-700 rounded-2xl shadow-xl border border-gray-200 transition-all active:scale-95 flex items-center justify-center"
          >
            <Globe size={20} className="text-blue-600" />
          </button>
        </div>
      )}

      {/* Bottom Action Bar: FINISH GIG BUTTON when active navigation is ongoing */}
      {!backgroundMode && activeGig && (
        <div className="absolute bottom-3 left-3 right-3 z-40 max-w-sm mx-auto">
          <div className="bg-white/98 backdrop-blur-md p-2.5 rounded-2xl border border-emerald-500 shadow-xl flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base border border-emerald-300 shrink-0">
                ✓
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                  Gig in Progress
                </span>
                <h5 className="font-bold text-[11px] text-slate-900 truncate mt-0.5">
                  Directing to finish gig
                </h5>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onCancelGig && (
                <button
                  onClick={onCancelGig}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onFinishGig}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/30 active:scale-95 flex items-center gap-1"
              >
                <Check size={14} />
                <span>Finish GiG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map filling the screen */}
      <div ref={mapRef} className="w-full h-full flex-grow z-10" />
    </div>
  );
}

function Seekers({ onHireSeeker }: { onHireSeeker?: (seeker: any) => void }) {
  const [seekers, setSeekers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'trades' | 'active' | 'subscribers'>('all');
  const [selectedSeeker, setSelectedSeeker] = useState<any | null>(null);

  useEffect(() => {
    const loadSeekers = (retry = 0) => {
      getDocs(collection(db, 'users')).then(snap => {
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setSeekers(list);
        setLoading(false);
      }).catch((e: any) => {
        if (e?.message?.includes('offline') || e?.code === 'unavailable') {
          if (retry < 3) {
            setTimeout(() => loadSeekers(retry + 1), 1200);
            return;
          }
        } else {
          console.error('Error loading seekers:', e);
        }
        setLoading(false);
      });
    };
    loadSeekers();
  }, []);

  // Show only seekers who are ready to be hired
  const filteredSeekers = seekers.filter(u => {
    if (u.deactivated) return false;
    
    // Filter by specific subcategory if selected
    if (filterType === 'trades' && !u.tradeSkills) return false;
    if (filterType === 'active' && !u.activated && u.activationStep !== 'approved') return false;
    if (filterType === 'subscribers' && u.activationOption !== 'User Subscription') return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const skills = (u.tradeSkills || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const option = (u.activationOption || '').toLowerCase();
    const city = (u.city || '').toLowerCase();
    const motivation = (u.motivationLetter || '').toLowerCase();

    return email.includes(query) || skills.includes(query) || phone.includes(query) || option.includes(query) || city.includes(query) || motivation.includes(query);
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full pb-20">
      {/* Permanent Fixed Top Search Bar */}
      <div className="sticky top-0 z-20 flex flex-col w-full space-y-2.5 bg-slate-50/95 backdrop-blur-md pb-2 pt-1">
        <div className="flex items-center gap-2 bg-white shadow-md border-2 border-slate-200 rounded-2xl p-2.5 w-full transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search size={20} className="text-blue-600 ml-1.5 shrink-0" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ready-to-hire seekers by name, trade skills, location, or contact..." 
            className="flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none px-1.5"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex gap-2 overflow-x-auto text-xs font-bold bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              filterType === 'all' 
                ? 'bg-blue-600 text-white shadow-sm font-bold' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>All Ready Seekers</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterType === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {seekers.filter(u => !u.deactivated).length}
            </span>
          </button>
          <button 
            onClick={() => setFilterType('trades')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              filterType === 'trades' 
                ? 'bg-blue-600 text-white shadow-sm font-bold' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Wrench size={12} />
            <span>Skilled Trades</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterType === 'trades' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {seekers.filter(u => !u.deactivated && u.tradeSkills).length}
            </span>
          </button>
          <button 
            onClick={() => setFilterType('active')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              filterType === 'active' 
                ? 'bg-emerald-600 text-white shadow-sm font-bold' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle size={12} />
            <span>Verified Ready</span>
          </button>
          <button 
            onClick={() => setFilterType('subscribers')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 ${
              filterType === 'subscribers' 
                ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Subscribers</span>
          </button>
        </div>
      </div>

      {/* Seeker List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
        </div>
      ) : filteredSeekers.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-slate-500 space-y-3">
          <Search size={36} className="mx-auto text-slate-400" />
          <div className="text-base font-bold text-slate-800">No seekers match your search</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try searching for a different skill, trade, or clear the search filter.
          </p>
          <button 
            onClick={() => { setSearchQuery(''); setFilterType('all'); }} 
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            View All Ready Seekers
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredSeekers.map(u => {
            const isTenant = u.activationOption === 'Become a tenant';
            return (
              <div 
                key={u.id || u.uid} 
                className="bg-white border-2 border-slate-200/90 hover:border-blue-400 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left space-y-4"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    {u.profilePicData ? (
                      <img src={u.profilePicData} alt="Profile" className="h-14 w-14 rounded-2xl object-cover border-2 border-blue-500 shadow-sm shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-sm shrink-0">
                        {u.email?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Ready to be Hired
                        </span>
                        {u.activated && (
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-base text-slate-900 truncate mt-1">{u.email}</div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">
                        {u.city ? `📍 ${u.city}` : '📍 Available for Hire'}
                      </div>
                    </div>
                  </div>

                  {u.tradeSkills ? (
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1 mt-3">
                      <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                        <Wrench size={11} /> Trade Skills / Expertise
                      </span>
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {u.tradeSkills}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-2xl text-[11px] font-semibold text-blue-900 mt-3 flex items-center gap-1.5">
                      <Briefcase size={13} className="text-blue-600 shrink-0" />
                      <span>Ready for General & Service Work</span>
                    </div>
                  )}

                  {u.motivationLetter && (
                    <p className="text-xs text-slate-700 font-medium line-clamp-2 italic bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 mt-2">
                      "{u.motivationLetter}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {u.phone ? (
                    <a 
                      href={`tel:${u.phone}`}
                      className="px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors border border-emerald-200"
                    >
                      <Phone size={14} />
                      <span>Call</span>
                    </a>
                  ) : (
                    <button 
                      onClick={() => setSelectedSeeker(u)}
                      className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                    >
                      Details
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (onHireSeeker) onHireSeeker(u);
                      else setSelectedSeeker(u);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Zap size={14} className="text-yellow-300 fill-yellow-300" />
                    <span>Hire Seeker</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Seeker Details Modal */}
      {selectedSeeker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4 border border-slate-200 animate-scale-up text-left max-h-[88vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedSeeker(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              {selectedSeeker.profilePicData ? (
                <img src={selectedSeeker.profilePicData} alt="Profile" className="h-16 w-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0" />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                  {selectedSeeker.email?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full inline-block uppercase tracking-wider">
                  ✓ Ready to be Hired
                </span>
                <h4 className="font-black text-lg text-slate-900 truncate mt-1">{selectedSeeker.email}</h4>
                <div className="text-xs font-semibold text-slate-500">
                  {selectedSeeker.activationOption || 'Subscription User'}
                </div>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {selectedSeeker.phone && (
                <div className="flex justify-between items-center bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-emerald-900 font-bold flex items-center gap-1.5">
                    <Phone size={15} className="text-emerald-700" /> Direct Phone
                  </span>
                  <a href={`tel:${selectedSeeker.phone}`} className="font-extrabold text-emerald-700 hover:underline text-sm">
                    {selectedSeeker.phone}
                  </a>
                </div>
              )}

              {selectedSeeker.tradeSkills && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                    <Wrench size={12} /> Verified Trade Skills
                  </span>
                  <div className="font-bold text-slate-900 text-sm leading-relaxed">
                    {selectedSeeker.tradeSkills}
                  </div>
                </div>
              )}

              {selectedSeeker.motivationLetter && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Background & Motivation
                  </span>
                  <p className="text-slate-800 font-medium text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedSeeker.motivationLetter}
                  </p>
                </div>
              )}

              {selectedSeeker.socialLinks && selectedSeeker.socialLinks.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Professional Links & Portfolio
                  </span>
                  <div className="space-y-1.5">
                    {selectedSeeker.socialLinks.map((link: string, idx: number) => (
                      <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold block truncate flex items-center gap-1.5">
                        <Globe size={13} className="shrink-0" />
                        <span className="truncate">{link}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const seekerToHire = selectedSeeker;
                  setSelectedSeeker(null);
                  if (onHireSeeker) onHireSeeker(seekerToHire);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Zap size={16} className="text-yellow-300 fill-yellow-300" />
                <span>Hire This Seeker</span>
              </button>
              <button
                onClick={() => setSelectedSeeker(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition-colors text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TenantPortal({ userData, onLogout, onUpdate }: { userData: any; onLogout: () => void; onUpdate?: () => void }) {
  const { user } = useContext(AuthContext);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [tenantSubFeeInput, setTenantSubFeeInput] = useState(userData?.tenantSubFee !== undefined ? Number(userData.tenantSubFee) : 250);
  const [userSubFeeInput, setUserSubFeeInput] = useState(userData?.userSubFee !== undefined ? Number(userData.userSubFee) : (userData?.monthlySubFee !== undefined ? Number(userData.monthlySubFee) : 120));
  const [tenantTrialDaysInput, setTenantTrialDaysInput] = useState(userData?.trialDays !== undefined ? Number(userData.trialDays) : 7);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (userData) {
      if (userData.tenantSubFee !== undefined) setTenantSubFeeInput(Number(userData.tenantSubFee));
      if (userData.userSubFee !== undefined) setUserSubFeeInput(Number(userData.userSubFee));
      else if (userData.monthlySubFee !== undefined) setUserSubFeeInput(Number(userData.monthlySubFee));
      if (userData.trialDays !== undefined) setTenantTrialDaysInput(Number(userData.trialDays));
    }
  }, [userData]);

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

  const activeTenantFee = Number(tenantSubFeeInput) || 250;
  const activeUserFee = Number(userSubFeeInput) || 120;
  const activeTrialDays = Number(tenantTrialDaysInput) || 7;
  const monthlyProfit = (activeReferredTenants.length * activeTenantFee) + (activeReferredSubs.length * activeUserFee);

  const handleSaveTenantSettings = async () => {
    if (!user) {
      alert('Save Settings Failed: User authentication session is lost. Please log in again.');
      return;
    }
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        tenantSubFee: Number(tenantSubFeeInput),
        userSubFee: Number(userSubFeeInput),
        monthlySubFee: Number(tenantSubFeeInput),
        trialDays: Number(tenantTrialDaysInput)
      }, { merge: true });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onUpdate) onUpdate();
      alert('Tenant subscription fees and trial days saved successfully with immediate effect!');
    } catch (e: any) {
      console.error(e);
      alert(`Save Settings Failed: ${e?.message || e?.code || String(e)}`);
    } finally {
      setSavingSettings(false);
    }
  };

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

      {/* Tenant Custom Subscription Fee & Trial Days Manager Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 w-full text-left space-y-3 shadow-sm">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center gap-1.5">
            <CreditCard size={16} className="text-blue-600" />
            <span className="text-xs font-bold text-gray-800">Your Subscription & Trial Settings</span>
          </div>
          {savedSuccess ? (
            <span className="text-[9px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-200 animate-pulse">
              ✓ Saved & Active
            </span>
          ) : (
            <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
              Immediate Effect
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Tenant Fee (R)</label>
            <input 
              type="number" 
              value={tenantSubFeeInput} 
              onChange={e => setTenantSubFeeInput(Math.max(0, Number(e.target.value)))} 
              className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-800 text-center focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
              placeholder="250"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">User Fee (R)</label>
            <input 
              type="number" 
              value={userSubFeeInput} 
              onChange={e => setUserSubFeeInput(Math.max(0, Number(e.target.value)))} 
              className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-800 text-center focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
              placeholder="120"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Trial Days (d)</label>
            <input 
              type="number" 
              value={tenantTrialDaysInput} 
              onChange={e => setTenantTrialDaysInput(Math.max(0, Number(e.target.value)))} 
              className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-800 text-center focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
              placeholder="7"
            />
          </div>
        </div>

        <button 
          onClick={handleSaveTenantSettings}
          disabled={savingSettings}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span>{savingSettings ? 'Applying Rates...' : 'Save Settings (Immediate Effect)'}</span>
        </button>
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
  const [tenantSubFeeInput, setTenantSubFeeInput] = useState(250);
  const [tenantUserSubFeeInput, setTenantUserSubFeeInput] = useState(120);
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
  const [popError, setPopError] = useState<string | null>(null);

  // Stats / Badges counts
  const [overviewCount, setOverviewCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [tenantPopCount, setTenantPopCount] = useState(0);
  const [userPopCount, setUserPopCount] = useState(0);
  const navigate = useNavigate();

  // Hire Seeker & Live Gig Navigation State
  const [hiringSeeker, setHiringSeeker] = useState<any | null>(null);
  const [hireStatus, setHireStatus] = useState<'idle' | 'confirm' | 'waiting' | 'accepted'>('idle');
  const [hireDestination, setHireDestination] = useState('124 Market Street, Johannesburg Central');
  const [hireNotes, setHireNotes] = useState('');
  const [activeGig, setActiveGig] = useState<ActiveGig | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [currentGigDocId, setCurrentGigDocId] = useState<string | null>(null);
  const [incomingGigRequest, setIncomingGigRequest] = useState<any | null>(null);
  const gigUnsubRef = useRef<(() => void) | null>(null);

  // Clean up gig subscription on unmount
  useEffect(() => {
    return () => {
      if (gigUnsubRef.current) {
        gigUnsubRef.current();
      }
    };
  }, []);

  // Listen for incoming gig requests in real-time where the current logged-in user is the seeker
  useEffect(() => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'gigs'),
        where('seekerId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const req = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          setIncomingGigRequest(req);
        } else {
          setIncomingGigRequest(null);
        }
      }, (err) => {
        console.error('Incoming gig listener error:', err);
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  const isAdmin = user?.email === 'timegig2026@gmail.com';

  const syncUserStep = async (retry = 0) => {
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
          if (data.tenantSubFee !== undefined) {
            setTenantSubFeeInput(data.tenantSubFee);
          } else if (data.monthlySubFee !== undefined) {
            setTenantSubFeeInput(data.monthlySubFee);
          }
          if (data.userSubFee !== undefined) {
            setTenantUserSubFeeInput(data.userSubFee);
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
      } catch (e: any) {
        if (e?.message?.includes('offline') || e?.code === 'unavailable') {
          if (retry < 3) {
            setTimeout(() => syncUserStep(retry + 1), 1200);
          }
        } else {
          console.error('syncUserStep error:', e);
        }
      }
    }
  };

  const handleSaveTenantSettings = async () => {
    if (!user) {
      alert('Save Settings Failed: User authentication session is lost. Please log in again.');
      return;
    }
    setSavingTenantSettings(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        tenantSubFee: Number(tenantSubFeeInput),
        userSubFee: Number(tenantUserSubFeeInput),
        monthlySubFee: Number(tenantSubFeeInput),
        trialDays: Number(tenantTrialDaysInput)
      }, { merge: true });
      alert('Tenant subscription fees and trial days saved successfully with immediate effect!');
      syncUserStep();
    } catch (e: any) {
      console.error(e);
      alert(`Save Settings Failed: ${e?.message || e?.code || String(e)}`);
    } finally {
      setSavingTenantSettings(false);
    }
  };

  const fetchDashboardStats = async (retry = 0) => {
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
    } catch (e: any) {
      if (e?.message?.includes('offline') || e?.code === 'unavailable') {
        if (retry < 3) {
          setTimeout(() => fetchDashboardStats(retry + 1), 1200);
        }
      } else {
        console.error('fetchDashboardStats error:', e);
      }
    }
  };

  // Load limits and sync user details
  useEffect(() => {
    if (user) {
      syncUserStep();
      const loadLimits = (retry = 0) => {
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
        }).catch((e: any) => {
          if (e?.message?.includes('offline') || e?.code === 'unavailable') {
            if (retry < 3) {
              setTimeout(() => loadLimits(retry + 1), 1200);
            }
          } else {
            console.error('Error loading settings:', e);
          }
        });
      };
      loadLimits();
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
    setPopError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 800 * 1024) {
        setPopError(`Document '${file.name}' is too large (${(file.size / 1024).toFixed(0)} KB). Maximum allowed file size is 800 KB.`);
        return;
      }
      setPopFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPopFilePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPop = async () => {
    setPopError(null);
    if (!user) {
      const msg = 'Payment Submission Failed: User is not authenticated. Please log in again.';
      setPopError(msg);
      alert(msg);
      return;
    }
    if (!popFilePreview) {
      const msg = 'Payment Submission Failed: Please select and upload a Proof of Payment file image/PDF first.';
      setPopError(msg);
      alert(msg);
      return;
    }
    if (popFile && popFile.size > 800 * 1024) {
      const msg = `Payment Submission Failed: File size is ${(popFile.size / 1024).toFixed(0)} KB, exceeding the 800 KB limit.`;
      setPopError(msg);
      alert(msg);
      return;
    }
    setSubmittingPop(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        tenantPopStep: 'review',
        tenantPopData: popFilePreview,
        tenantPopName: popFile?.name || 'pop_document'
      }, { merge: true });
      setPopStep('review');
      alert('Proof of payment submitted successfully!');
    } catch (e: any) {
      console.error('handleSubmitPop error:', e);
      const fullError = `Payment Submission Failed: ${e?.message || e?.code || String(e)}`;
      setPopError(fullError);
      alert(fullError);
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

  const handleInitiateHire = (seeker: any) => {
    setHiringSeeker(seeker);
    setHireStatus('confirm');
    if (userData?.city) {
      setHireDestination(`124 Main Road, ${userData.city}`);
    }
  };

  const handleConfirmAndSendHire = async () => {
    if (!hiringSeeker || !user) return;
    setHireStatus('waiting');
    
    const seekerDisplayName = hiringSeeker.displayName || hiringSeeker.name || hiringSeeker.email?.split('@')[0] || 'seeker';
    speakLadyVoice(`Sending gig request to ${seekerDisplayName}. Please wait for acceptance.`, voiceMuted);

    try {
      const gigDocId = `gig_${Date.now()}_${user.uid.slice(0, 5)}`;
      setCurrentGigDocId(gigDocId);

      const baseLat = hiringSeeker.coords ? hiringSeeker.coords[0] : (hiringSeeker.latitude !== undefined ? Number(hiringSeeker.latitude) : -26.2300);
      const baseLng = hiringSeeker.coords ? hiringSeeker.coords[1] : (hiringSeeker.longitude !== undefined ? Number(hiringSeeker.longitude) : 28.0200);

      // Write real gig request to Firestore so real seeker receives it
      await setDoc(doc(db, 'gigs', gigDocId), {
        id: gigDocId,
        seekerId: hiringSeeker.id || hiringSeeker.uid || '',
        seekerEmail: hiringSeeker.email || '',
        seekerName: seekerDisplayName,
        seekerPic: hiringSeeker.profilePicData || null,
        seekerCoords: [baseLat, baseLng],
        customerId: user.uid,
        customerEmail: user.email || '',
        destinationAddress: hireDestination || 'Job Site Destination',
        notes: hireNotes || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Clear any previous listener
      if (gigUnsubRef.current) {
        gigUnsubRef.current();
        gigUnsubRef.current = null;
      }

      // Listen for REAL seeker acceptance via Firestore snapshot
      const unsub = onSnapshot(doc(db, 'gigs', gigDocId), (docSnap) => {
        if (!docSnap.exists()) return;
        const gigData = docSnap.data();

        if (gigData.status === 'accepted') {
          if (gigUnsubRef.current) {
            gigUnsubRef.current();
            gigUnsubRef.current = null;
          }
          setHireStatus('accepted');
          speakLadyVoice(`Gig accepted by ${seekerDisplayName}! ${seekerDisplayName} is now traveling from their location to your destination. Live navigation is now active.`, voiceMuted);

          const destLat = baseLat + 0.038;
          const destLng = baseLng + 0.042;

          const newGig: ActiveGig = {
            id: gigDocId,
            seeker: hiringSeeker,
            seekerOrigin: {
              lat: baseLat,
              lng: baseLng,
              address: hiringSeeker.city ? `${hiringSeeker.city}, Seeker Location` : 'Seeker Current Location'
            },
            userDestination: {
              lat: destLat,
              lng: destLng,
              address: hireDestination || 'User Destination Job Site'
            },
            status: 'accepted',
            currentStepIndex: 0,
            totalDistanceKm: 4.8,
            etaMinutes: 12
          };

          setActiveGig(newGig);

          // Transition to GiGs Map after showing acceptance checkmark
          setTimeout(() => {
            setHireStatus('idle');
            setActiveTab('GiGs');
          }, 1600);
        } else if (gigData.status === 'declined') {
          if (gigUnsubRef.current) {
            gigUnsubRef.current();
            gigUnsubRef.current = null;
          }
          setHireStatus('idle');
          alert(`${seekerDisplayName} has declined the gig request.`);
        }
      }, (err) => {
        console.error('Error listening to gig status:', err);
      });

      gigUnsubRef.current = unsub;
    } catch (e: any) {
      console.error('Failed to dispatch gig request to Firestore:', e);
      alert('Failed to send gig request: ' + (e?.message || String(e)));
      setHireStatus('idle');
    }
  };

  const handleSeekerAcceptIncomingGig = async (gigReq: any) => {
    try {
      await updateDoc(doc(db, 'gigs', gigReq.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });
      setIncomingGigRequest(null);

      const baseLat = gigReq.seekerCoords ? gigReq.seekerCoords[0] : -26.2300;
      const baseLng = gigReq.seekerCoords ? gigReq.seekerCoords[1] : 28.0200;
      const destLat = baseLat + 0.038;
      const destLng = baseLng + 0.042;

      const newGig: ActiveGig = {
        id: gigReq.id,
        seeker: {
          email: user?.email || 'Seeker',
          profilePicData: userProfilePic
        },
        seekerOrigin: {
          lat: baseLat,
          lng: baseLng,
          address: 'Your Current Location'
        },
        userDestination: {
          lat: destLat,
          lng: destLng,
          address: gigReq.destinationAddress || 'Customer Destination'
        },
        status: 'accepted',
        currentStepIndex: 0,
        totalDistanceKm: 4.8,
        etaMinutes: 12
      };
      setActiveGig(newGig);
      setActiveTab('GiGs');
      speakLadyVoice(`Gig accepted. Starting live navigation to destination.`, voiceMuted);
    } catch (e) {
      console.error('Error accepting gig:', e);
      alert('Failed to accept gig. Please try again.');
    }
  };

  const handleSeekerDeclineIncomingGig = async (gigReq: any) => {
    try {
      await updateDoc(doc(db, 'gigs', gigReq.id), {
        status: 'declined'
      });
      setIncomingGigRequest(null);
    } catch (e) {
      console.error('Error declining gig:', e);
    }
  };

  const handleFinishGig = () => {
    setActiveGig(null);
    speakLadyVoice('Gig has been completed successfully. Thank you!', voiceMuted);
    alert('🎉 Gig finished successfully!');
  };

  const handleCancelGig = () => {
    if (confirm('Are you sure you want to cancel this active gig?')) {
      setActiveGig(null);
      speakLadyVoice('Gig navigation has been cancelled.', voiceMuted);
    }
  };

  const showMenu = isAdmin && (activeTab === 'Admin' || activeTab === 'Tenant Portal');

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
    <div className={`min-h-screen min-h-[100dvh] flex flex-col bg-white ${activeTab === 'GiGs' && activeGig ? 'pb-0' : 'pb-20'} relative overflow-x-hidden w-full`}>
      {/* Blurred Map Wallpaper in all features except GiGs */}
      {activeTab !== 'GiGs' && (
        <div className="absolute inset-0 z-0 filter blur-md opacity-30 pointer-events-none select-none">
          <GiGsMap backgroundMode={true} />
        </div>
      )}

      {showMenu && (
        <>
          <button onClick={() => setMenuOpen(!menuOpen)} className="fixed top-4 left-4 z-50 p-2.5 bg-white rounded-full shadow-xl border border-gray-200 transition-transform active:scale-95 flex items-center justify-center">
            <Menu />
          </button>
          {menuOpen && (
            <div className="fixed top-16 left-4 bg-white shadow-2xl border border-gray-200 rounded-2xl p-2 z-50 w-68 space-y-1 animate-fade-in max-h-[calc(100vh-80px)] overflow-y-auto">
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
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Platform Subscription & Spot Limits</span>
                      <div className="grid grid-cols-2 gap-1.5 mb-1">
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Max Tenants</label>
                          <input 
                            type="number" 
                            value={maxTenantsInput} 
                            onChange={e => setMaxTenantsInput(Math.max(1, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="100"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Max Subs</label>
                          <input 
                            type="number" 
                            value={maxSubscribersInput} 
                            onChange={e => setMaxSubscribersInput(Math.max(1, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="100"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Tenant Fee (R)</label>
                          <input 
                            type="number" 
                            value={tenantSubFeeInput} 
                            onChange={e => setTenantSubFeeInput(Math.max(0, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="250"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">User Fee (R)</label>
                          <input 
                            type="number" 
                            value={tenantUserSubFeeInput} 
                            onChange={e => setTenantUserSubFeeInput(Math.max(0, Number(e.target.value)))} 
                            className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="120"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-gray-500 block uppercase">Trial (d)</label>
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
                        onClick={async () => {
                          try {
                            await setDoc(doc(db, 'settings', 'limits'), {
                              maxTenants: Number(maxTenantsInput),
                              maxSubscribers: Number(maxSubscribersInput),
                              tenantSubFee: Number(tenantSubFeeInput),
                              userSubFee: Number(tenantUserSubFeeInput),
                              defaultTrialDays: Number(tenantTrialDaysInput)
                            }, { merge: true });
                            setMaxTenants(Number(maxTenantsInput));
                            setMaxSubscribers(Number(maxSubscribersInput));
                            alert('Platform limits, fees, and trial days saved successfully with immediate effect!');
                            syncUserStep();
                          } catch (e) {
                            console.error(e);
                            alert('Failed to save platform settings.');
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-[10px] py-1.5 rounded-lg shadow-sm transition-colors"
                      >
                        Save Platform Rates & Limits
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
                            <label className="text-[8px] font-bold text-gray-500 block uppercase">Tenant Fee (R)</label>
                            <input 
                              type="number" 
                              value={tenantSubFeeInput} 
                              onChange={e => setTenantSubFeeInput(Math.max(0, Number(e.target.value)))} 
                              className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="250"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-gray-500 block uppercase">User Fee (R)</label>
                            <input 
                              type="number" 
                              value={tenantUserSubFeeInput} 
                              onChange={e => setTenantUserSubFeeInput(Math.max(0, Number(e.target.value)))} 
                              className="w-full bg-gray-50 border p-1 rounded text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="120"
                            />
                          </div>
                          <div className="col-span-2">
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
                          {savingTenantSettings ? 'Saving...' : 'Save Fees & Trial Days'}
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

                {popError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-left">
                    ⚠️ {popError}
                  </div>
                )}

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

      {/* Real Seeker Incoming Gig Request Notification Modal */}
      {incomingGigRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative space-y-4 border border-blue-400 animate-scale-up text-left">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shadow-sm animate-pulse">
                <Briefcase size={22} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  New Gig Offer
                </span>
                <h4 className="font-black text-base text-slate-900 mt-0.5">Incoming Hire Request</h4>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">From User:</span>
                <span className="font-bold text-slate-800">{incomingGigRequest.customerEmail}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium shrink-0">Destination:</span>
                <span className="font-bold text-blue-700 text-right">{incomingGigRequest.destinationAddress}</span>
              </div>
              {incomingGigRequest.notes && (
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-medium block">Job Note:</span>
                  <p className="text-slate-700 italic mt-0.5">{incomingGigRequest.notes}</p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Accepting will start live route navigation from your location to the customer destination.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleSeekerAcceptIncomingGig(incomingGigRequest)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-xs shadow-lg active:scale-95 flex items-center justify-center gap-1.5 transition-all"
              >
                <Check size={16} />
                <span>Accept Gig</span>
              </button>
              <button
                onClick={() => handleSeekerDeclineIncomingGig(incomingGigRequest)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl text-xs transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hire Seeker Confirmation & Waiting Circle Modal */}
      {hireStatus !== 'idle' && hiringSeeker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4 border border-slate-200 animate-scale-up text-left overflow-hidden">
            {hireStatus === 'waiting' ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                {/* Circle Loading with Radar Ripples */}
                <div className="relative flex items-center justify-center w-36 h-36">
                  {/* Outer Radar Ripple Rings */}
                  <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-radar-ripple" />
                  <div className="absolute inset-2 rounded-full bg-indigo-400/30 animate-ping opacity-60" />
                  
                  {/* Glowing spinning border */}
                  <div className="w-28 h-28 rounded-full border-4 border-blue-600/30 border-t-blue-600 animate-spin flex items-center justify-center shadow-lg" />
                  
                  {/* Centered Seeker Picture */}
                  <div className="absolute w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-100 flex items-center justify-center">
                    {hiringSeeker.profilePicData ? (
                      <img src={hiringSeeker.profilePicData} alt={hiringSeeker.email} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-2xl flex items-center justify-center">
                        {hiringSeeker.email?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-w-xs">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Real-Time Seeker Acceptance</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-900">
                    Waiting for Seeker to Accept...
                  </h4>
                  <p className="text-xs text-slate-500">
                    Live request dispatched to <span className="font-bold text-slate-800">{hiringSeeker.email}</span>. Awaiting acceptance in real-time.
                  </p>
                </div>

                {/* Instant Seeker Acceptance Trigger */}
                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                      <Zap size={13} className="text-amber-500 fill-amber-500" /> Real Seeker Action
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                      Live Sync
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    The seeker receives this offer in their portal. You can also accept immediately on their behalf:
                  </p>
                  <button
                    onClick={async () => {
                      if (currentGigDocId) {
                        try {
                          await updateDoc(doc(db, 'gigs', currentGigDocId), { 
                            status: 'accepted',
                            acceptedAt: serverTimestamp()
                          });
                        } catch (e) {
                          console.error('Error accepting gig on behalf of seeker:', e);
                        }
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Check size={14} />
                    <span>Accept Gig as Seeker ({hiringSeeker.email?.split('@')[0]})</span>
                  </button>
                </div>

                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-indigo-600 animate-pulse" />
                    <span className="font-semibold text-[11px]">Lady Voice Guidance Ready</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (gigUnsubRef.current) {
                        gigUnsubRef.current();
                        gigUnsubRef.current = null;
                      }
                      if (currentGigDocId) {
                        try {
                          await updateDoc(doc(db, 'gigs', currentGigDocId), { status: 'cancelled' });
                        } catch (e) {
                          console.error(e);
                        }
                      }
                      setHireStatus('idle');
                      setHiringSeeker(null);
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>
            ) : hireStatus === 'accepted' ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-500 text-emerald-600 flex items-center justify-center shadow-xl animate-bounce">
                  <CheckCircle size={48} className="text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    ✓ Gig Accepted!
                  </span>
                  <h4 className="text-xl font-black text-slate-900 mt-2">
                    Seeker is on the way!
                  </h4>
                  <p className="text-xs text-slate-600 max-w-xs">
                    <strong className="text-slate-900">{hiringSeeker.email}</strong> has accepted your gig. Directing seeker from their location to <span className="font-semibold text-blue-700">{hireDestination}</span>.
                  </p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold p-3 rounded-2xl flex items-center gap-2">
                  <Volume2 size={16} className="text-indigo-600 shrink-0" />
                  <span>Lady Voice navigation assistant starting now...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                      <Zap size={20} className="fill-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">Hire Seeker & Set Gig</h4>
                      <p className="text-[11px] text-slate-500">Dispatch request and start turn-by-turn guidance</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setHireStatus('idle');
                      setHiringSeeker(null);
                    }} 
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Seeker Quick Preview */}
                <div className="flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  {hiringSeeker.profilePicData ? (
                    <img src={hiringSeeker.profilePicData} alt="Profile" className="h-12 w-12 rounded-xl object-cover border border-blue-400 shrink-0 shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                      {hiringSeeker.email?.[0]?.toUpperCase() || 'S'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Ready for Hire
                    </span>
                    <div className="font-extrabold text-sm text-slate-900 truncate mt-0.5">{hiringSeeker.email}</div>
                    <div className="text-[11px] font-medium text-slate-600 truncate">
                      {hiringSeeker.tradeSkills || 'General & Skilled Services'}
                    </div>
                  </div>
                </div>

                {/* Destination Input Form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      User Destination / Job Site Address
                    </label>
                    <div className="relative">
                      <Navigation size={15} className="absolute left-3 top-3 text-blue-600" />
                      <input
                        type="text"
                        value={hireDestination}
                        onChange={e => setHireDestination(e.target.value)}
                        placeholder="Enter street address, building or coordinates..."
                        className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Seeker will navigate from their location directly to this destination to complete your gig.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Gig Details / Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={hireNotes}
                      onChange={e => setHireNotes(e.target.value)}
                      placeholder="e.g. Electrical maintenance, plumbing repair, immediate service"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleConfirmAndSendHire}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Zap size={16} className="text-yellow-300 fill-yellow-300" />
                    <span>Confirm & Send Hire Request</span>
                  </button>
                  <button
                    onClick={() => {
                      setHireStatus('idle');
                      setHiringSeeker(null);
                    }}
                    className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <main className="flex-grow p-4 pt-16 space-y-4">
        {activeTab === 'Tenant Portal' && userData?.joinedViaAdminRef && (
          <div className="bg-amber-50 border border-orange-200 text-orange-950 rounded-2xl p-4 text-xs text-left max-w-sm mx-auto space-y-1 shadow-sm">
            <span className="font-bold flex items-center gap-1 text-orange-800">
              <Shield size={14} className="text-orange-600" />
              <span>Admin Referral Limit Active</span>
            </span>
            <p className="text-slate-700 leading-normal">
              You registered via the shareable Admin link. Your invitation capacity is restricted to a maximum of:
            </p>
            <ul className="list-disc list-inside font-bold text-orange-950 mt-1">
              <li>10 signup Tenants maximum</li>
              <li>100 signup subscription Users maximum</li>
            </ul>
          </div>
        )}

        {/* Persistent Feature Containers: Never unmount so activities, searches, map position and form inputs are never reset */}
        <div className={activeTab === 'Activation' ? 'block' : 'hidden'}>
          <Activation onUpdate={syncUserStep} />
        </div>

        <div className={activeTab === 'Seekers' ? 'block' : 'hidden'}>
          <Seekers onHireSeeker={handleInitiateHire} />
        </div>

        <div className={activeTab === 'Tenant Portal' ? 'block' : 'hidden'}>
          <TenantPortal userData={userData} onLogout={handleLogout} onUpdate={syncUserStep} />
        </div>

        <div className={activeTab === 'User Portal' ? 'block' : 'hidden'}>
          <UserPortal userDetails={userData} onLogout={handleLogout} />
        </div>

        {isAdmin && (
          <div className={activeTab === 'Admin' ? 'block' : 'hidden'}>
            <Admin adminSub={adminSub} isAdmin={isAdmin} maxTenants={maxTenants} maxSubscribers={maxSubscribers} onRefresh={syncUserStep} />
          </div>
        )}

        <div className={activeTab === 'GiGs' ? 'block absolute inset-0 pt-0 pb-0 z-10' : 'hidden'}>
          <GiGsMap 
            activeGig={activeGig}
            onFinishGig={handleFinishGig}
            onCancelGig={handleCancelGig}
            voiceMuted={voiceMuted}
            onToggleVoiceMute={() => setVoiceMuted(!voiceMuted)}
          />
        </div>
      </main>

      {/* Crystal Clear Bottom Navigation Bar (Hidden during active live map navigation) */}
      {!(activeTab === 'GiGs' && activeGig) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-md border-t-2 border-slate-200 p-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex justify-around z-40 shadow-lg animate-slide-up">
          {navItems.map(item => {
            const isActive = activeTab === item.name;
            return (
              <button 
                key={item.name} 
                onClick={() => {
                  setActiveTab(item.name);
                  setMenuOpen(false);
                }}
                className={`flex flex-col items-center px-4 py-1.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                }`}
              >
                <item.icon size={22} className={isActive ? 'text-blue-600' : 'text-slate-500'} />
                <span className={`text-[11px] mt-0.5 ${isActive ? 'text-blue-600 font-extrabold' : 'text-slate-600 font-medium'}`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>
      )}
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
