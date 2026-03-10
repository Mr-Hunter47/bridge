import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { bridgeApi } from '../api/bridgeApi';

const ROLE_PREVIEWS = {
    general: {
        icon: '👤',
        title: 'General User',
        desc: 'Full access to text, voice, and sign language features with a balanced interface.',
    },
    deaf: {
        icon: '🦻',
        title: 'Deaf / Hard of Hearing',
        desc: 'Visual-first experience. Incoming messages auto-convert to sign language avatar videos.',
    },
    blind: {
        icon: '👁️',
        title: 'Blind / Low Vision',
        desc: 'Audio-first with keyboard shortcuts. Messages read aloud automatically. High contrast mode enabled.',
    },
    mute: {
        icon: '🤐',
        title: 'Mute / Non-Speaking',
        desc: 'Sign video input is front and center. Record or upload sign language videos to send as text.',
    },
};

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [profile, setProfile] = useState('general');
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        // If already authenticated, go to chat
        const token = sessionStorage.getItem('bridge_jwt');
        if (token) navigate('/chat');
    }, [navigate]);

    // Auto-select high contrast theme for blind profile
    useEffect(() => {
        if (profile === 'blind') {
            document.documentElement.setAttribute('data-theme', 'high-contrast');
        } else {
            const saved = localStorage.getItem('bridge_theme') || 'midnight';
            document.documentElement.setAttribute('data-theme', saved);
        }
    }, [profile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) return;

        setLoading(true);
        setError('');

        try {
            let data;
            if (isLogin) {
                data = await bridgeApi.login(username.trim(), password);
            } else {
                data = await bridgeApi.register(username.trim(), password, profile);
            }

            // Store JWT + user info
            sessionStorage.setItem('bridge_jwt', data.access_token);
            sessionStorage.setItem('bridge_user_id', data.user_id);
            sessionStorage.setItem('bridge_username', data.username);
            sessionStorage.setItem('bridge_user_profile', profile);

            // Set theme for blind users
            if (profile === 'blind') {
                localStorage.setItem('bridge_theme', 'high-contrast');
            }

            navigate('/chat');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Something went wrong. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const preview = ROLE_PREVIEWS[profile];

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="glass-panel">
                    {/* Logo + Title */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div className="login-logo">
                            <Shield size={32} />
                        </div>
                        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
                            Bridge Platform
                        </h1>
                        <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
                            Secure, Accessible Messaging for Everyone.
                        </p>
                    </div>

                    {/* Login / Register Toggle */}
                    <div className="auth-toggle">
                        <button
                            className={isLogin ? 'active' : ''}
                            onClick={() => { setIsLogin(true); setError(''); }}
                        >
                            Sign In
                        </button>
                        <button
                            className={!isLogin ? 'active' : ''}
                            onClick={() => { setIsLogin(false); setError(''); }}
                        >
                            Register
                        </button>
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: 'rgba(255, 107, 107, 0.1)',
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--error)',
                            fontSize: '0.85rem',
                            marginBottom: '1rem',
                            animation: 'fadeInUp 0.3s ease-out',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Username */}
                        <div className="input-group">
                            <label className="input-label">Username</label>
                            <input
                                type="text"
                                className="text-input"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                aria-label="Username"
                            />
                        </div>

                        {/* Password */}
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="text-input"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    aria-label="Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                    }}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Profile Selector (only for register) */}
                        {!isLogin && (
                            <div className="input-group">
                                <label className="input-label">Accessibility Profile</label>
                                <select
                                    className="text-input"
                                    value={profile}
                                    onChange={(e) => setProfile(e.target.value)}
                                    aria-label="Select your accessibility profile"
                                >
                                    <option value="general">👤 General (Standard)</option>
                                    <option value="deaf">🦻 Deaf (Sign Language Avatar)</option>
                                    <option value="blind">👁️ Blind (Audio + Keyboard)</option>
                                    <option value="mute">🤐 Mute (Sign Video Input)</option>
                                </select>
                            </div>
                        )}

                        {/* Role Preview Card */}
                        {!isLogin && preview && (
                            <div className="role-preview" key={profile}>
                                <div className="role-preview-icon">{preview.icon}</div>
                                <div>
                                    <h4>{preview.title}</h4>
                                    <p>{preview.desc}</p>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                fontSize: '1rem',
                                padding: '1rem',
                                borderRadius: '24px',
                                marginTop: '1.5rem',
                            }}
                            disabled={!username.trim() || !password.trim() || loading}
                        >
                            {loading ? (
                                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                            ) : (
                                isLogin ? 'Sign In' : 'Create Account'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
