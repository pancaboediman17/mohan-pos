import { useState } from 'react';
import { LockKeyhole, Mail, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import api, { setAuthToken } from '../services/api';
import BrandLogo from './BrandLogo';

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
        <div className="login-page">
            <main className="login-container">
                <div className="login-brand-block">
                    <BrandLogo className="login-logo" />
                    <p className="login-brand-caption">
                        MOHAN Digital Lab's
                    </p>
                </div>

                <section className="login-card">
                    <div className="login-heading">
                        <h2 className="login-title">
                            Selamat Datang
                        </h2>
                        <p className="login-description">
                            Silakan login untuk melanjutkan.
                        </p>
                    </div>

                    {error && (
                        <div className="login-error" role="alert">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="login-field">
                            <label className="login-label" htmlFor="login-email">
                                Email
                            </label>

                            <div className="login-input-wrap">
                                <Mail
                                    size={18}
                                    className="login-field-icon"
                                />

                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@email.com"
                                    autoComplete="username"
                                    required
                                    className="login-input"
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <label className="login-label" htmlFor="login-password">
                                Password
                            </label>

                            <div className="login-input-wrap">
                                <LockKeyhole
                                    size={18}
                                    className="login-field-icon"
                                />

                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    autoComplete="current-password"
                                    required
                                    className="login-input login-input-password"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="login-password-toggle"
                                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                    aria-pressed={showPassword}
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
                            className="login-submit"
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle size={18} className="animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                "Masuk ke dashboard"
                            )}
                        </button>

                    </form>

                    <footer className="login-footer">
                        <p>
                            MOHAN Digital Lab's © 2026
                        </p>
                        <p>
                            Secure Printing Management System
                        </p>
                    </footer>
                </section>
            </main>
        </div>
    );
}
