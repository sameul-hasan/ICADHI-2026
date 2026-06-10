import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Mail, Lock, User, ShieldCheck } from "lucide-react";

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !fullName)) {
      showToast("Please fill in all fields", "warning");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        showToast("Logged in successfully!", "success");
      } else {
        await register(email, password, fullName);
        showToast("Account created successfully!", "success");
      }
      navigate("/");
    } catch (err) {
      console.error(err);
      let errorMsg = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/email-already-in-use") {
        errorMsg = "This email is already in use.";
      } else if (err.code === "auth/invalid-credential") {
        errorMsg = "Invalid email or password.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "Password should be at least 6 characters.";
      }
      showToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 relative overflow-hidden transition-colors duration-200">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-800/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />

      {/* Main Auth Panel */}
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ICADHI 2026 Logo" className="h-16 mx-auto object-contain mb-4" />
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            ICADHI 2026
          </h2>
          <p className="text-sm font-semibold tracking-wider text-slate-500 dark:text-slate-400 mt-1 uppercase">
            Event Registration & Check-in Portal
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl dark:shadow-none">
          <div className="flex gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-2">
            <button
              onClick={() => { setIsLogin(true); setFullName(""); }}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                isLogin 
                  ? "border-primary-800 text-primary-800 dark:text-primary-300" 
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                !isLogin 
                  ? "border-primary-800 text-primary-800 dark:text-primary-300" 
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                icon={<User className="h-4 w-4" />}
                required
              />
            )}

            <Input
              label="Email Address"
              placeholder="name@institution.org"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <Input
              label="Password"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3"
              loading={loading}
            >
              {isLogin ? "Log In to Portal" : "Create Account"}
            </Button>
          </form>

          {/* Setup Tip */}
          {!isLogin && (
            <div className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Access Control:</span>
                Newly registered accounts will default to a restricted user role and require promotion by a Super Admin to view console data.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
