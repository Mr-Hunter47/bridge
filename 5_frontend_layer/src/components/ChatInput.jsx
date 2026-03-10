import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send, Mic, Video as VideoIcon, Square, X, Upload, Camera } from 'lucide-react';
import { bridgeApi } from '../api/bridgeApi';

const ChatInput = forwardRef(({ onSendMessage, userProfile }, ref) => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    // Media Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingType, setRecordingType] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showVideoOptions, setShowVideoOptions] = useState(false);

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const liveVideoRef = useRef(null);
    const fileInputRef = useRef(null);
    const videoOptionsRef = useRef(null);

    // Expose methods for blind keyboard shortcuts
    useImperativeHandle(ref, () => ({
        startVoiceRecording: () => startRecording('audio'),
        stopVoiceRecording: () => stopRecording(),
    }));

    useEffect(() => {
        return () => stopMediaTracks();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (videoOptionsRef.current && !videoOptionsRef.current.contains(e.target)) {
                setShowVideoOptions(false);
            }
        };
        if (showVideoOptions) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showVideoOptions]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const stopMediaTracks = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        clearInterval(timerRef.current);
    };

    const startRecording = async (type) => {
        try {
            const constraints = type === 'video'
                ? { video: true, audio: false }
                : { audio: true, video: false };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;

            if (type === 'video' && liveVideoRef.current) {
                liveVideoRef.current.srcObject = stream;
            }

            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                handleRecordedMedia(blob, type);
                stopMediaTracks();
            };

            mediaRecorderRef.current.start();
            setRecordingType(type);
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Camera/Mic access denied", err);
            alert('Could not access Camera/Microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => { stopMediaTracks(); };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingType(null);
        }
    };

    const handleRecordedMedia = async (blob, type) => {
        setLoading(true);
        setRecordingType(null);
        try {
            const file = new File([blob], `recording.webm`, { type: blob.type });

            if (type === 'audio') {
                const response = await bridgeApi.speechToText(file);
                if (response.status === 'success') {
                    onSendMessage({
                        sender: 'me',
                        text: response.transcribed_text,
                        metadata: { inputType: 'audio' },
                        timestamp: Date.now()
                    });
                }
            } else {
                const response = await bridgeApi.signVideoToTranscript(file);
                if (response.status === 'success' && response.transcript) {
                    onSendMessage({
                        sender: 'me',
                        text: response.transcript,
                        metadata: { inputType: 'sign_video' },
                        timestamp: Date.now()
                    });
                }
            }
        } catch (err) {
            console.error(err);
            alert('AI Processing failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleVideoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const ext = file.name.split('.').pop().toLowerCase();
        if (!['mp4', 'webm', 'avi'].includes(ext)) {
            alert('Unsupported format. Please upload .mp4, .webm, or .avi');
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            alert('File too large. Maximum 100MB.');
            return;
        }

        setLoading(true);
        try {
            const response = await bridgeApi.signVideoToTranscript(file);
            if (response.status === 'success' && response.transcript) {
                onSendMessage({
                    sender: 'me',
                    text: response.transcript,
                    metadata: { inputType: 'sign_video' },
                    timestamp: Date.now()
                });
            } else {
                alert('Could not generate transcript from video.');
            }
        } catch (err) {
            console.error(err);
            alert('Sign language processing failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendText = () => {
        if (!text.trim()) return;
        onSendMessage({
            sender: 'me',
            text: text,
            timestamp: Date.now()
        });
        setText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendText();
        }
    };

    // Role-based input visibility
    const showAudioInput = userProfile === 'General' || userProfile === 'Blind';
    const showVideoInput = userProfile === 'Deaf' || userProfile === 'Mute' || userProfile === 'General';
    const isMuteMode = userProfile === 'Mute';

    return (
        <div className="chat-input-area" style={{ position: 'relative' }}>

            {/* Live Video Preview */}
            {isRecording && recordingType === 'video' && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '2rem', zIndex: 10 }}>
                    <video
                        ref={liveVideoRef}
                        autoPlay
                        muted
                        style={{ width: '200px', borderRadius: 'var(--radius-md)', border: '2px solid var(--error)', backgroundColor: '#000' }}
                    />
                </div>
            )}

            {/* Mute Mode: Large Record Button (above input) */}
            {isMuteMode && !isRecording && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button
                        className="mute-record-btn"
                        onClick={() => startRecording('video')}
                        disabled={loading}
                        aria-label="Record sign language video"
                    >
                        <Camera size={20} />
                        <span>Record Sign Language</span>
                    </button>
                    <button
                        className="mute-record-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        aria-label="Upload sign language video"
                        style={{ opacity: 0.8 }}
                    >
                        <Upload size={18} />
                        <span>Upload Video</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp4,.webm,.avi"
                        style={{ display: 'none' }}
                        onChange={handleVideoUpload}
                    />
                </div>
            )}

            <div className="chat-input-container">
                {isRecording ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', minHeight: '48px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--error)', animation: 'pulse 1.5s infinite' }} />
                            <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>
                                Recording {recordingType === 'video' ? 'Sign Language' : 'Voice'}... {formatTime(recordingTime)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button title="Cancel" type="button" className="action-btn" onClick={cancelRecording} aria-label="Cancel recording">
                                <X size={20} />
                            </button>
                            <button title="Stop & Send" type="button" className="action-btn primary" onClick={stopRecording} style={{ backgroundColor: 'var(--error)' }} aria-label="Stop recording and send">
                                <Square size={16} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Action Buttons */}
                        <div className="action-buttons">
                            {showAudioInput && (
                                <button
                                    type="button"
                                    title="Record Voice (Alt+M for Blind)"
                                    className={`action-btn ${loading ? 'pulse' : ''}`}
                                    onClick={() => startRecording('audio')}
                                    disabled={loading}
                                    aria-label="Record voice message"
                                    style={{ background: userProfile === 'Blind' ? 'rgba(var(--glow-rgb), 0.2)' : 'transparent' }}
                                >
                                    <Mic size={20} />
                                </button>
                            )}

                            {showVideoInput && !isMuteMode && (
                                <div style={{ position: 'relative' }} ref={videoOptionsRef}>
                                    <button
                                        type="button"
                                        title="Sign Language Video"
                                        className={`action-btn ${loading ? 'pulse' : ''}`}
                                        onClick={() => setShowVideoOptions(prev => !prev)}
                                        disabled={loading}
                                        aria-label="Sign language video options"
                                    >
                                        <VideoIcon size={20} />
                                    </button>

                                    {showVideoOptions && (
                                        <div className="video-options-popup">
                                            <button type="button" className="video-option-item" onClick={() => { setShowVideoOptions(false); fileInputRef.current?.click(); }}>
                                                <Upload size={18} /><span>Upload Video</span>
                                            </button>
                                            <button type="button" className="video-option-item" onClick={() => { setShowVideoOptions(false); startRecording('video'); }}>
                                                <Camera size={18} /><span>Record Video</span>
                                            </button>
                                        </div>
                                    )}

                                    {!isMuteMode && (
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".mp4,.webm,.avi"
                                            style={{ display: 'none' }}
                                            onChange={handleVideoUpload}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        <textarea
                            placeholder={
                                loading ? "Processing..."
                                    : isMuteMode ? "Type a message or use buttons above to sign..."
                                        : userProfile === 'Blind' ? "Type a message (Alt+M for voice)..."
                                            : "Type a message..."
                            }
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            rows={1}
                            aria-label="Message input"
                        />

                        <div className="action-buttons">
                            {text.trim() ? (
                                <button title="Send" type="button" className="action-btn primary" onClick={handleSendText} disabled={loading} aria-label="Send message">
                                    <Send size={18} />
                                </button>
                            ) : (
                                <div style={{ width: '38px' }}></div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
