import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: `${BASE_URL}/api`,
});

const authApi = axios.create({
    baseURL: BASE_URL,
});

// Attach JWT token to AI service requests
api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('bridge_jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Attach JWT to auth-protected requests
authApi.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('bridge_jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const bridgeApi = {
    // ── Auth Endpoints ───────────────────────────────────
    register: async (username, password, profileType) => {
        const response = await authApi.post('/auth/register', {
            username,
            password,
            profile_type: profileType.toLowerCase(),
        });
        return response.data;
    },

    login: async (username, password) => {
        const response = await authApi.post('/auth/login', {
            username,
            password,
        });
        return response.data;
    },

    getMe: async () => {
        const response = await authApi.get('/auth/me');
        return response.data;
    },

    // ── AI Service Endpoints ────────────────────────────

    speechToText: async (audioFile) => {
        const formData = new FormData();
        formData.append('audio', audioFile);
        const response = await api.post('/speech-to-text', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    signVideoToTranscript: async (videoFile) => {
        try {
            const formData = new FormData();
            formData.append('file', videoFile);
            const response = await api.post('/sign-to-text', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
            });
            return response.data;
        } catch (error) {
            console.error("Sign-Video-to-Transcript failed:", error);
            throw error;
        }
    },

    textToSign: async (text) => {
        try {
            const response = await api.post('/text-to-sign',
                { text },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return { video_url: response.data.video_url };
        } catch (error) {
            console.error("Text-to-Sign failed:", error);
            throw error;
        }
    },

    textToSpeech: async (text) => {
        try {
            const response = await api.post('/text-to-speech',
                { text, language: "en", voice: "default", speed: 1.0 },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return { audio_url: response.data.audio_url };
        } catch (error) {
            console.error("Text-to-Speech failed:", error);
            throw error;
        }
    },

    // ── WebSocket (JWT-authenticated) ───────────────────
    connectWebSocket: (onMessageReceived) => {
        const token = sessionStorage.getItem('bridge_jwt');
        const wsBase = BASE_URL.replace('http', 'ws');
        const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => console.log('WebSocket connected (JWT auth)');
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (onMessageReceived) onMessageReceived(data);
            } catch (err) {
                console.error("Failed to parse incoming WS message:", err);
            }
        };
        socket.onerror = (error) => console.error('WebSocket Error:', error);

        return socket;
    }
};
