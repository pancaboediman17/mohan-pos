import { useState } from 'react';
import { Printer, LockKeyhole, Mail, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import api, { setAuthToken } from '../services/api';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/api/v1/login', {
                email,
                password,
            });

            const data = response.data;

            setAuthToken(data.token);
            onLogin(data.user);

        } catch (err) {
            if (err.response?.status === 422) {
                setError(
                    err.response.data.message ||
                    'Email atau password tidak sesuai.'
                );
            } else if (!err.response) {
                setError('Tidak dapat terhubung ke server. Periksa koneksi.');
            } else {
                setError(
                    err.response.data.message ||
                    'Login gagal. Silakan coba kembali.'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-5">
            <div className="w-full max-w-md">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-600/20">
                        <Printer size={32} className="text-white" />
                    </div>

                    <h1 className="text-3xl font-bold tracking-wider text-white">
                        Mohan<span className="text-red-500">Digital</span>Printing
                    </h1>

                    <p className="text-slate-500 text-sm mt-2">
                        Integrated Printing Management System
                    </p>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-7 shadow-2xl">

                    <div className="mb-7">
                        <h2 className="text-xl font-bold text-white">
                            Selamat Datang
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Silakan login untuk melanjutkan.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-5">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">

                        <div>
                            <label className="block text-sm text-slate-300 mb-2">
                                Email
                            </label>

                            <div className="relative">
                                <Mail
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                                />

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@email.com"
                                    autoComplete="username"
                                    required
                                    className="w-full bg-[#0b1220] border border-slate-700 rounded-lg py-3 pl-11 pr-4 text-white text-sm outline-none focus:border-red-500 transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-300 mb-2">
                                Password
                            </label>

                            <div className="relative">
                                <LockKeyhole
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                                />

                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    autoComplete="current-password"
                                    required
                                    className="w-full bg-[#0b1220] border border-slate-700 rounded-lg py-3 pl-11 pr-12 text-white text-sm outline-none focus:border-red-500 transition"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                    aria-label="Tampilkan password"
                                >
                                    {showPassword
                                        ? <EyeOff size={18} />
                                        : <Eye size={18} />
                                    }
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/10"
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle size={18} className="animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                'Masuk ke Mohan Dashboard'
                            )}
                        </button>

                    </form>

                    <div className="border-t border-slate-800 mt-7 pt-5 text-center">
                        <p className="text-xs text-slate-600">
                            MDP-POS © 2026
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                            Secure Printing Management System
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
