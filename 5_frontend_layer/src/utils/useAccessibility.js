import { useCallback, useEffect } from 'react';

/**
 * Expanded accessibility hook — TTS + keyboard shortcuts for Blind users.
 * Provides `speak()` for any profile, and global keyboard bindings.
 */
export const useAccessibility = (userProfile, actions = {}) => {
    // TTS speak — works for blind users, optional for others
    const speak = useCallback((text, force = false) => {
        if (userProfile !== 'Blind' && !force) return;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    }, [userProfile]);

    // Global keyboard shortcut handler (Blind mode)
    useEffect(() => {
        if (userProfile !== 'Blind') return;

        const handleKeyDown = (e) => {
            // Only handle Alt+ combos
            if (!e.altKey) return;

            switch (e.key.toLowerCase()) {
                case 'm': // Alt+M → Start recording mic
                    e.preventDefault();
                    if (actions.onStartRecording) {
                        actions.onStartRecording();
                        speak('Recording voice message', true);
                    }
                    break;

                case 's': // Alt+S → Stop recording / Send
                    e.preventDefault();
                    if (actions.onStopRecording) {
                        actions.onStopRecording();
                        speak('Stopped recording, sending', true);
                    }
                    break;

                case 'r': // Alt+R → Read last message
                    e.preventDefault();
                    if (actions.onReadLastMessage) {
                        actions.onReadLastMessage();
                    }
                    break;

                case 'n': // Alt+N → Read all new messages
                    e.preventDefault();
                    if (actions.onReadNewMessages) {
                        actions.onReadNewMessages();
                    }
                    break;

                case 'c': // Alt+C → Announce current contact
                    e.preventDefault();
                    if (actions.onAnnounceContact) {
                        actions.onAnnounceContact();
                    }
                    break;

                case 'arrowup': // Alt+↑ → Previous contact
                    e.preventDefault();
                    if (actions.onPrevContact) {
                        actions.onPrevContact();
                    }
                    break;

                case 'arrowdown': // Alt+↓ → Next contact
                    e.preventDefault();
                    if (actions.onNextContact) {
                        actions.onNextContact();
                    }
                    break;

                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [userProfile, actions, speak]);

    return { speak };
};
