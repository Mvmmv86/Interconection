'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, User, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

type AuthMode = 'login' | 'register';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const { login, register, isLoading: authLoading, error: authError } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const success = await login(email, password);
        if (success) {
          onLoginSuccess?.();
        } else {
          setError(authError || 'E-mail ou senha inválidos');
        }
      } else {
        // Validate register fields
        if (name.length < 2) {
          setError('O nome deve ter pelo menos 2 caracteres');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 8) {
          setError('A senha deve ter pelo menos 8 caracteres');
          setIsSubmitting(false);
          return;
        }
        if (organizationName.length < 2) {
          setError('O nome da organização deve ter pelo menos 2 caracteres');
          setIsSubmitting(false);
          return;
        }

        const success = await register(email, password, name, organizationName);
        if (success) {
          onLoginSuccess?.();
        } else {
          setError(authError || 'Falha no cadastro');
        }
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = isSubmitting || authLoading;

  const isLogin = mode === 'login';

  const canSubmit = isLogin
    ? email && password
    : email && password && name && organizationName;

  const inputClass = 'w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#8b5cf6]/50 focus:ring-1 focus:ring-[#8b5cf6]/30 transition-all';
  const inputPasswordClass = 'w-full pl-11 pr-12 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#8b5cf6]/50 focus:ring-1 focus:ring-[#8b5cf6]/30 transition-all';

  return (
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Card with glassmorphism + rotating border glow */}
      <div className="relative group">
        {/* Animated gradient border */}
        <div
          className="absolute -inset-[1px] rounded-[20px] opacity-40 blur-[1px]"
          style={{
            background: 'conic-gradient(from var(--border-angle, 0deg), #8b5cf6, #3b82f6, #06b6d4, #8b5cf6)',
            animation: 'rotateBorder 6s linear infinite',
          }}
        />

        {/* Glass card */}
        <div className="relative rounded-[20px] bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 md:p-10 shadow-2xl">
          {/* Header */}
          <div className="mb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
                </h2>
                <p className="text-white/40 text-sm">
                  {isLogin ? 'Acesse sua conta de tesouraria' : 'Configure sua gestão de tesouraria'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* Name (register only) */}
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-xs text-white/50 uppercase tracking-wider font-medium">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome completo"
                        required
                        minLength={2}
                        maxLength={255}
                        className={inputClass}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs text-white/50 uppercase tracking-wider font-medium">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      className={inputClass}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs text-white/50 uppercase tracking-wider font-medium">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isLogin ? '••••••••' : 'Mín. 8 caracteres'}
                      required
                      minLength={isLogin ? undefined : 8}
                      maxLength={100}
                      className={inputPasswordClass}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Organization (register only) */}
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label htmlFor="organization" className="text-xs text-white/50 uppercase tracking-wider font-medium">
                      Organização
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        id="organization"
                        type="text"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Nome da sua empresa"
                        required
                        minLength={2}
                        maxLength={255}
                        className={inputClass}
                        autoComplete="organization"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Remember me + Forgot (login only) */}
            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] text-[#8b5cf6] focus:ring-[#8b5cf6]/30 focus:ring-offset-0"
                  />
                  <span className="text-xs text-white/40">Lembrar de mim</span>
                </label>
                <button
                  type="button"
                  className="text-xs text-[#8b5cf6]/70 hover:text-[#8b5cf6] transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            {/* Error */}
            {(error || authError) && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error || authError}
              </motion.div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="relative w-full py-3.5 rounded-xl font-semibold text-sm text-white overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed group/btn transition-all"
            >
              {/* Button gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] transition-all" />
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] opacity-0 group-hover/btn:opacity-100 blur-xl transition-opacity" />
              {/* Content */}
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Entrar' : 'Criar Conta'}
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-white/25">ou continue com</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* SSO placeholders */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-xs cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Em breve
            </button>
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-xs cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Em breve
            </button>
          </div>

          {/* Footer — toggle mode */}
          <p className="mt-7 text-center text-xs text-white/25">
            {isLogin ? (
              <>
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-[#8b5cf6]/70 hover:text-[#8b5cf6] transition-colors"
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[#8b5cf6]/70 hover:text-[#8b5cf6] transition-colors"
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>

    </motion.div>
  );
}
