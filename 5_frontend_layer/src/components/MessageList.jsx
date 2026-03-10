import React, { useEffect, useRef, useState } from 'react';
import { bridgeApi } from '../api/bridgeApi';
import { PlayCircle, Video as VideoIcon, X } from 'lucide-react';

const DynamicMessageBubble = ({ msg, userProfile, onTranslate, onExpandVideo }) => {
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [autoTranslated, setAutoTranslated] = useState(false);

    // Auto-translate for Deaf users (text → sign avatar)
    useEffect(() => {
        if (
            userProfile === 'Deaf' &&
            msg.sender !== 'me' &&
            msg.text &&
            !msg.mediaUrl &&
            !autoTranslated
        ) {
            setAutoTranslated(true);
            handleTranslateOutput('video');
        }
    }, [msg, userProfile, autoTranslated]);

    // Auto-TTS for Blind users (text → speech)
    useEffect(() => {
        if (
            userProfile === 'Blind' &&
            msg.sender !== 'me' &&
            msg.text &&
            !msg.mediaUrl &&
            !autoTranslated
        ) {
            setAutoTranslated(true);
            // Use browser TTS for instant feedback
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    `${msg.sender} says: ${msg.text}`
                );
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [msg, userProfile, autoTranslated]);

    const handleTranslateOutput = async (type) => {
        setLoadingMedia(true);
        try {
            if (type === 'audio') {
                const res = await bridgeApi.textToSpeech(msg.text);
                if (onTranslate) onTranslate(msg, 'audio', res.audio_url);
            } else if (type === 'video') {
                const res = await bridgeApi.textToSign(msg.text);
                if (onTranslate) onTranslate(msg, 'video', res.video_url);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMedia(false);
        }
    };

    return (
        <div
            className={`message-wrapper ${msg.sender === 'me' ? 'sent' : 'received'}`}
            role="article"
            aria-label={`${msg.sender === 'me' ? 'You' : msg.sender} said: ${msg.text || 'media message'}`}
        >
            <div className="message-bubble">
                {msg.text && (
                    <div style={{
                        whiteSpace: 'pre-wrap',
                        marginBottom: '0',
                        fontStyle: msg.mediaUrl ? 'italic' : 'normal',
                        opacity: msg.mediaUrl ? 0.7 : 1,
                    }}>
                        {msg.text}
                    </div>
                )}

                {/* Action buttons for manual translation (non-auto profiles) */}
                {msg.sender !== 'me' && !msg.mediaUrl && userProfile !== 'Deaf' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {(userProfile === 'Blind' || userProfile === 'General') && (
                            <button
                                className="action-btn"
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.3rem 0.6rem',
                                    background: 'rgba(var(--glow-rgb), 0.08)',
                                    color: 'var(--accent-secondary)',
                                    borderRadius: '12px',
                                }}
                                onClick={() => handleTranslateOutput('audio')}
                                aria-label="Convert to audio"
                            >
                                <PlayCircle size={14} style={{ marginRight: '0.25rem' }} /> Audio
                            </button>
                        )}

                        {(userProfile === 'Mute' || userProfile === 'General') && (
                            <button
                                className="action-btn"
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.3rem 0.6rem',
                                    background: 'rgba(var(--glow-rgb), 0.08)',
                                    color: 'var(--accent-secondary)',
                                    borderRadius: '12px',
                                }}
                                onClick={() => handleTranslateOutput('video')}
                                aria-label="Convert to sign video"
                            >
                                <VideoIcon size={14} style={{ marginRight: '0.25rem' }} /> Sign-Video
                            </button>
                        )}
                    </div>
                )}

                {loadingMedia && (
                    <div style={{
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        marginTop: '0.5rem',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        Translating...
                    </div>
                )}

                {msg.mediaType === 'audio' && (
                    <div style={{
                        marginTop: msg.text ? '0.75rem' : '0',
                        background: 'var(--bg-secondary)',
                        padding: '0.25rem',
                        borderRadius: '24px',
                        display: 'inline-flex',
                    }}>
                        <audio controls src={msg.mediaUrl} style={{ height: '36px', width: '250px', outline: 'none' }} />
                    </div>
                )}

                {msg.mediaType === 'video' && (
                    <div
                        className="sign-video-thumb"
                        style={{ marginTop: msg.text ? '0.5rem' : '0' }}
                        onClick={() => onExpandVideo && onExpandVideo(msg.mediaUrl)}
                        title="Click to enlarge"
                    >
                        <video
                            src={msg.mediaUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{ width: '260px', borderRadius: '8px', display: 'block', objectFit: 'cover', pointerEvents: 'none' }}
                        />
                        <div className="sign-video-expand-hint">
                            <span>▶ Click to enlarge</span>
                        </div>
                    </div>
                )}

                {msg.metadata?.inputType === 'sign_video' && (
                    <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem', color: 'var(--success)' }}>
                        (Sent via Sign Video)
                    </span>
                )}
                {msg.metadata?.inputType === 'audio' && (
                    <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem', color: 'var(--success)' }}>
                        (Sent via Voice)
                    </span>
                )}

                <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};

const MessageList = ({ messages, userProfile, onTranslate }) => {
    const bottomRef = useRef(null);
    const [expandedVideoUrl, setExpandedVideoUrl] = useState(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') setExpandedVideoUrl(null); };
        if (expandedVideoUrl) document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [expandedVideoUrl]);

    return (
        <div className="message-list" role="log" aria-label="Message history">
            {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', animation: 'fadeInUp 0.5s ease-out' }}>
                    <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {userProfile === 'Deaf' ? '🤟' : userProfile === 'Blind' ? '🎧' : userProfile === 'Mute' ? '📹' : '💬'}
                    </p>
                    <p>No messages yet. Start chatting using your preferred method!</p>
                    <div style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
                        <p>🔒 Messages are Encrypted · <b>{userProfile}</b> Mode Active</p>
                    </div>
                </div>
            ) : (
                messages.map((msg, index) => (
                    <DynamicMessageBubble
                        key={index}
                        msg={msg}
                        userProfile={userProfile}
                        onTranslate={onTranslate}
                        onExpandVideo={setExpandedVideoUrl}
                    />
                ))
            )}
            <div ref={bottomRef} />

            {/* Fullscreen Video Lightbox */}
            {expandedVideoUrl && (
                <div className="video-lightbox-overlay" onClick={() => setExpandedVideoUrl(null)}>
                    <button
                        className="video-lightbox-close"
                        onClick={() => setExpandedVideoUrl(null)}
                        title="Close (Esc)"
                        aria-label="Close video lightbox"
                    >
                        <X size={24} />
                    </button>
                    <div className="video-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <video src={expandedVideoUrl} autoPlay loop muted playsInline controls />
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageList;
