



import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Menu, LogOut, Camera, Bell, Flame, Loader2, Bot, X, AlertTriangle } from 'lucide-react';
// FIX: Rename Chat to avoid conflict with local types if any, and be more specific.
import { GoogleGenAI, Chat as GenAIChat, FunctionDeclaration, Tool, Type } from '@google/genai';

import { auth, db, appId, storage, EmailAuthProvider, Timestamp, arrayUnion, increment } from './services/firebase';
import { translations, subjectDisplayTranslations, defaultHomeLayout } from './constants';
import type { AppUser, FileData, CalendarEvent, ModalContent, Notification, BroadcastData, ToDoTask, AdminSettings, Note, FlashcardSet, StudyPlan, StudySession, SyncedCalendar, ChatMessage, ChatHistory } from './types';

import CustomModal from './components/ui/Modal';
import BroadcastModal from './components/new/BroadcastModal';
import AuthView from './components/views/AuthView';
import HomeView from './components/views/HomeView';
import SubjectView from './components/views/SubjectView';
import CalendarView from './components/views/CalendarView';
import SettingsView from './components/views/SettingsView';
import InfoView from './components/views/InfoView';
import FaqView from './components/views/FaqView';
import ToolsView from './components/views/ToolsView';
import Sidebar from './components/ui/Sidebar';
import OfflineIndicator from './components/ui/OfflineIndicator';
import NotesView from './components/views/tools/NotesView';
import AdminView from './components/views/AdminView';
import NotificationsView from './components/views/NotificationsView';
import EmailVerificationView from './components/views/EmailVerificationView';
import FeedbackView from './components/new/FeedbackView';
import UserDetailModal from './components/views/admin/UserDetailModal';
import AdminPinView from './components/views/admin/AdminPinView';
import PinVerificationModal from './components/views/admin/PinVerificationModal';
import AvatarSelectionModal from './components/ui/AvatarSelectionModal';
import ProgressView from './components/views/ProgressView';
import StudyPlannerView from './components/views/StudyPlannerView';
import AIChatView from './components/views/AIChatView';
import AISetupView from './components/views/AISetupView';
import SubjectSelectionView from './components/views/SubjectSelectionView';
import MainAppLayout from './components/views/MainAppLayout';
import TypingWelcomeView from './components/views/TypingWelcomeView';
import IntroTutorialView from './components/views/IntroTutorialView';
import LogoutAnimationView from './components/views/LogoutAnimationView';

// FIX: Removed incorrect global declaration for 'lottie-player' which was causing all other JSX intrinsic elements to be unrecognized.
// The widespread "Property 'div' does not exist" errors were due to this declaration overwriting React's default types.


type AppStatus = 'initializing' | 'unauthenticated' | 'authenticated' | 'awaiting-verification' | 'error';
type Unsubscribe = () => void;

// --- Fuzzy Search Utility ---
const fuzzyMatch = (query: string, text: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    let queryIndex = 0;
    let textIndex = 0;
    while (queryIndex < lowerQuery.length && textIndex < lowerText.length) {
        if (lowerQuery[queryIndex] === lowerText[textIndex]) {
            queryIndex++;
        }
        textIndex++;
    }
    return queryIndex === lowerQuery.length;
};


const loadingMessagesNl = [
    'De bits en bytes aan het sorteren...',
    'Koffie aan het zetten voor je studiesessie...',
    'Je verloren sokken aan het zoeken... grapje, je bestanden laden!',
    'Magie aan het toevoegen aan je huiswerk...',
    'De ultieme studiespot aan het voorbereiden...',
    'De hamsters wakker maken...'
];

const loadingMessagesEn = [
    'Sorting the bits and bytes...',
    'Brewing coffee for your study session...',
    'Finding your lost socks... just kidding, loading your files!',
    'Adding magic to your homework...',
    'Prepping the ultimate study spot...',
    'Waking up the hamsters...'
];


// --- Loading Screen Component ---
const LoadingScreen: React.FC<{ getThemeClasses: (variant: string) => string; }> = ({ getThemeClasses }) => {
    return (
        <div className={`fixed inset-0 flex flex-col items-center justify-center ${getThemeClasses('bg')} z-50`}>
           <img src="https://i.imgur.com/J9xgXED.png" alt="StudyBox Logo" className="h-auto" style={{ maxWidth: '180px' }} />
       </div>
    );
};

const showNativeNotification = async (title: string, options: NotificationOptions = {}) => {
    if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notification');
        return;
    }

    if (Notification.permission === 'granted') {
        new Notification(title, { icon: '/apple-touch-icon.png', ...options });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification(title, { icon: '/apple-touch-icon.png', ...options });
        }
    }
};

const ReauthModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    title?: string;
    description?: string;
    confirmButtonText?: string;
    confirmButtonColor?: string;
}> = ({ isOpen, onClose, onSuccess, t, getThemeClasses, title, description, confirmButtonText, confirmButtonColor = 'bg-red-600 hover:bg-red-700' }) => {
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser?.email) return;

        setIsVerifying(true);
        setError(null);

        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
            await auth.currentUser.reauthenticateWithCredential(credential);
            onSuccess();
            onClose();
        } catch (error) {
            setError(t('error_reauth_failed'));
        } finally {
            setIsVerifying(false);
        }
    };
    
    useEffect(() => {
        if (!isOpen) {
            setPassword('');
            setError(null);
            setIsVerifying(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2 text-gray-800">{title || t('reauth_modal_title')}</h3>
                <p className="text-gray-600 mb-4">{description || t('reauth_modal_description')}</p>
                <form onSubmit={handleConfirm}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('password')}
                        className={`w-full p-2 border rounded-lg ${error ? 'border-red-500' : 'border-gray-300'}`}
                        required
                    />
                    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                        <button type="submit" disabled={isVerifying} className={`py-2 px-4 rounded-lg text-white font-bold ${confirmButtonColor} disabled:opacity-50 transition-colors active:scale-95 w-52 flex items-center justify-center`}>
                             {isVerifying ? <Loader2 className="w-5 h-5 animate-spin"/> : (confirmButtonText || t('confirm_delete_account_button'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    // Top-level app state
    const [user, setUser] = useState<AppUser | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [appStatus, setAppStatus] = useState<AppStatus>('initializing');
    const [modalContent, setModalContent] = useState<ModalContent | null>(null);
    const [themeColor, setThemeColor] = useState(localStorage.getItem('themeColor') || 'blue');
    const [language, setLanguage] = useState<'nl' | 'en'>((localStorage.getItem('appLanguage') as 'nl' | 'en') || 'nl');
    const [fontFamily, setFontFamily] = useState(localStorage.getItem('fontFamily') || 'inter');
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
    const [isCleanupReauthModalOpen, setIsCleanupReauthModalOpen] = useState(false);
    const [isClearCalendarReauthModalOpen, setIsClearCalendarReauthModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastData | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showIntro, setShowIntro] = useState(false);
    const [introChecked, setIntroChecked] = useState(false);
    const [introStage, setIntroStage] = useState<'typing' | 'tutorial' | 'done'>('typing');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
    const [selectedUserForDetail, setSelectedUserForDetail] = useState<AppUser | null>(null);
    const [isPinVerificationModalOpen, setIsPinVerificationModalOpen] = useState(false);
    const [verificationSkipped, setVerificationSkipped] = useState(sessionStorage.getItem('studybox_verification_skipped') === 'true');
    const [showAiSetup, setShowAiSetup] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loginError, setLoginError] = useState<string | null>(null);

    
    // Admin specific state
    const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
    const [isPinVerified, setIsPinVerified] = useState(false);

    // Lifted state from MainAppLayout
    const [currentView, setCurrentView] = useState('home');
    const [currentSubject, setCurrentSubject] = useState<string | null>(null);
    const [allSubjectFiles, setAllSubjectFiles] = useState<FileData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [userEvents, setUserEvents] = useState<CalendarEvent[]>([]);
    const [syncedEvents, setSyncedEvents] = useState<CalendarEvent[]>([]);
    const [userStudyPlans, setUserStudyPlans] = useState<StudyPlan[]>([]);
    const [recentFiles, setRecentFiles] = useState<FileData[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
    
    // Data for Progress View & Home View Dashboard
    const [allUserFiles, setAllUserFiles] = useState<FileData[]>([]);
    const [allUserNotes, setAllUserNotes] = useState<Note[]>([]);
    const [allUserFlashcardSets, setAllUserFlashcardSets] = useState<FlashcardSet[]>([]);
    const [allUserTasks, setAllUserTasks] = useState<ToDoTask[]>([]);
    const [allStudySessions, setAllStudySessions] = useState<StudySession[]>([]);

    // Persistent Study Timer State
    const [focusMinutes, setFocusMinutes] = useState(25);
    const [breakMinutes, setBreakMinutes] = useState(5);
    const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [selectedTaskForTimer, setSelectedTaskForTimer] = useState<ToDoTask | null>(null);
    const timerAudioRef = useRef<HTMLAudioElement | null>(null);

    // AI Chat State
    const [aiChat, setAiChat] = useState<GenAIChat | null>(null);
    const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([]);
    const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
    const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null);


    // Initial Loading states
    const [isAppReadyForDisplay, setIsAppReadyForDisplay] = useState(false);
    const [isMinLoadingTimePassed, setIsMinLoadingTimePassed] = useState(false);
    
    const allEvents = useMemo(() => [...userEvents, ...syncedEvents], [userEvents, syncedEvents]);
    
    const triggerHapticFeedback = useCallback((pattern: number | number[] = 50) => {
        if (user?.hapticsEnabled && 'vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                console.warn("Haptic feedback failed", e);
            }
        }
    }, [user?.hapticsEnabled]);


    // Memoized theme and translation functions
    const themeStyles: { [color: string]: { [variant: string]: string } } = {
        emerald: { bg: 'bg-gradient-to-br from-emerald-500 to-teal-500', 'hover-bg': 'hover:from-emerald-600 hover:to-teal-600', text: 'text-teal-700', 'text-strong': 'text-teal-800', border: 'border-teal-500', ring: 'focus:ring-teal-500', 'bg-light': 'bg-emerald-50', 'border-light': 'border-emerald-100', 'text-logo': 'text-teal-600' },
        blue: { bg: 'bg-gradient-to-br from-sky-500 to-indigo-500', 'hover-bg': 'hover:from-sky-600 hover:to-indigo-600', text: 'text-indigo-600', 'text-strong': 'text-indigo-800', border: 'border-indigo-500', ring: 'focus:ring-indigo-500', 'bg-light': 'bg-blue-50', 'border-light': 'border-blue-100', 'text-logo': 'text-indigo-600' },
        rose: { bg: 'bg-gradient-to-br from-rose-500 to-pink-500', 'hover-bg': 'hover:from-rose-600 hover:to-pink-600', text: 'text-pink-700', 'text-strong': 'text-pink-800', border: 'border-pink-500', ring: 'focus:ring-pink-500', 'bg-light': 'bg-rose-50', 'border-light': 'border-rose-100', 'text-logo': 'text-pink-600' },
        purple: { bg: 'bg-gradient-to-br from-purple-500 to-violet-500', 'hover-bg': 'hover:from-purple-600 hover:to-violet-600', text: 'text-violet-700', 'text-strong': 'text-violet-800', border: 'border-violet-500', ring: 'focus:ring-violet-500', 'bg-light': 'bg-purple-50', 'border-light': 'border-purple-100', 'text-logo': 'text-violet-600' },
        pink: { bg: 'bg-gradient-to-br from-pink-500 to-fuchsia-500', 'hover-bg': 'hover:from-pink-600 hover:to-fuchsia-600', text: 'text-fuchsia-700', 'text-strong': 'text-fuchsia-800', border: 'border-fuchsia-500', ring: 'focus:ring-fuchsia-500', 'bg-light': 'bg-pink-50', 'border-light': 'border-pink-100', 'text-logo': 'text-fuchsia-600' },
        indigo: { bg: 'bg-gradient-to-br from-indigo-500 to-blue-500', 'hover-bg': 'hover:from-indigo-600 hover:to-blue-600', text: 'text-blue-700', 'text-strong': 'text-blue-800', border: 'border-blue-500', ring: 'focus:ring-blue-500', 'bg-light': 'bg-indigo-50', 'border-light': 'border-indigo-100', 'text-logo': 'text-blue-600' },
        teal: { bg: 'bg-gradient-to-br from-teal-500 to-cyan-500', 'hover-bg': 'hover:from-teal-600 hover:to-cyan-600', text: 'text-cyan-700', 'text-strong': 'text-cyan-800', border: 'border-cyan-500', ring: 'focus:ring-cyan-500', 'bg-light': 'bg-teal-50', 'border-light': 'border-teal-100', 'text-logo': 'text-cyan-600' },
        amber: { bg: 'bg-gradient-to-br from-amber-500 to-orange-500', 'hover-bg': 'hover:from-amber-600 hover:to-orange-600', text: 'text-orange-700', 'text-strong': 'text-orange-800', border: 'border-orange-500', ring: 'focus:ring-orange-500', 'bg-light': 'bg-amber-50', 'border-light': 'border-amber-100', 'text-logo': 'text-orange-600' }
    };
    
    const fontClasses: { [key: string]: string } = {
        inter: 'font-inter',
        poppins: 'font-poppins',
        lato: 'font-lato',
        'roboto-slab': 'font-roboto-slab',
        lora: 'font-lora',
    };

    const getThemeClasses = useCallback((variant: string): string => {
        const currentTheme = isAdmin ? adminSettings?.themePreference : themeColor;
        return (themeStyles[currentTheme || 'blue']?.[variant]) || themeStyles['blue'][variant] || '';
    }, [themeColor, isAdmin, adminSettings]);
    
    const getAuthThemeClasses = useCallback((variant: string): string => {
        // Auth view should always be the default theme
        return (themeStyles['blue']?.[variant]) || '';
    }, []);

    const t = useCallback((key: string, replacements: { [key: string]: string | number } = {}): string => {
        let text = translations[language]?.[key] || translations['nl']?.[key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, String(replacements[placeholder]));
        }
        return text;
    }, [language]);

    const tSubject = useCallback((subjectKey: string): string => {
        const lang = language as keyof typeof subjectDisplayTranslations;
        if (!subjectKey) return ''; // Guard against null/undefined keys
        const lowerKey = subjectKey.toLowerCase();
        return subjectDisplayTranslations[lang]?.[lowerKey] || subjectDisplayTranslations['nl']?.[lowerKey] || lowerKey.charAt(0).toUpperCase() + lowerKey.slice(1).replace(/_/g, ' ');
    }, [language]);

    const showAppModal = useCallback((content: ModalContent) => setModalContent(content), []);
    const closeAppModal = useCallback(() => setModalContent(null), []);
    
    // Refs for robust listeners that don't cause re-renders
    const latestUser = useRef(user);
    const tRef = useRef(t);
    const tSubjectRef = useRef(tSubject);
    
    // Refs for robust calendar sync
    const isSyncingCalendar = useRef(false);
    const syncFailureCount = useRef(0);
    const isSyncOnCooldown = useRef(false);

    const showBroadcastModal = useCallback(async (broadcastId: string) => {
        const broadcastDocRef = db.doc(`broadcasts/${broadcastId}`);
        const broadcastDoc = await broadcastDocRef.get();
        if (broadcastDoc.exists) {
            setSelectedBroadcast(broadcastDoc.data() as BroadcastData);
            setIsBroadcastModalOpen(true);
        }
    }, []);
    
    const handleUserDetailClick = (user: AppUser) => {
        setSelectedUserForDetail(user);
        setIsUserDetailModalOpen(true);
    };

    const handleIntroFinish = useCallback(() => {
        try {
            localStorage.setItem('studybox_intro_seen', 'true');
        } catch (error) {
            console.error("Could not set localStorage item:", error);
        }
        setShowIntro(false);
        setIntroStage('done');
    }, []);

    const handleSkipVerification = () => {
        sessionStorage.setItem('studybox_verification_skipped', 'true');
        setVerificationSkipped(true);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMinLoadingTimePassed(true);
        }, 1500); // Reduced loading time
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (appStatus === 'initializing' || appStatus === 'error') {
            setIsAppReadyForDisplay(false);
        } else if (introChecked) {
            setIsAppReadyForDisplay(true);
        }
    }, [appStatus, introChecked]);


    useEffect(() => {
        timerAudioRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-clear-announce-tones-2861.mp3');
    }, []);

    const switchTimerMode = useCallback((completedMode: 'focus' | 'break') => {
        if (timerAudioRef.current) {
            timerAudioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }

        if (user?.notificationsEnabled) {
            showNativeNotification(
                t(completedMode === 'focus' ? 'notification_focus_complete_title' : 'notification_break_complete_title'),
                { body: t(completedMode === 'focus' ? 'notification_focus_complete_body' : 'notification_break_complete_body') }
            );
        }
        
        showAppModal({ text: t(completedMode === 'focus' ? 'focus_session_complete' : 'break_session_complete')});
        
        if (completedMode === 'focus' && user?.uid && user.uid !== 'guest-user') {
            db.collection(`users/${user.uid}/studySessions`).add({
                userId: user.uid,
                date: Timestamp.now(),
                durationMinutes: focusMinutes,
                taskId: selectedTaskForTimer?.id || null,
            }).catch(error => console.error("Failed to log study session:", error));
        }

        const newMode = completedMode === 'focus' ? 'break' : 'focus';
        setTimerMode(newMode);
        setIsTimerActive(false); 
    }, [showAppModal, t, user?.uid, user?.notificationsEnabled, focusMinutes, selectedTaskForTimer]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isTimerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(time => time - 1);
            }, 1000);
        } else if (isTimerActive && timeLeft === 0) {
            switchTimerMode(timerMode);
        }
        return () => { if (interval) clearInterval(interval) };
    }, [isTimerActive, timeLeft, switchTimerMode, timerMode]);

    useEffect(() => {
        if (!isTimerActive) {
          setTimeLeft(timerMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
        }
    }, [focusMinutes, breakMinutes, timerMode, isTimerActive]);


    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            showAppModal({ text: t('app_back_online_message') });
        };
        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [t, showAppModal]);
    
    // Effect to update current time every minute for "in progress" badges
    useEffect(() => {
        const timerId = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timerId);
    }, []);

    const handleLogout = useCallback(() => {
        showAppModal({
            text: t('confirm_logout'),
            confirmAction: () => {
                triggerHapticFeedback();
                setIsLoggingOut(true);
            },
            cancelAction: () => {}
        });
    }, [showAppModal, t, triggerHapticFeedback]);

    const handleGoHome = useCallback(() => {
        setCurrentView('home');
        setCurrentSubject(null);
    }, []);

    // --- iCal Parsing Logic ---
    const parseIcsDate = (dateString: string): Date | null => {
        const match = dateString.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/);
        if (match) {
            const [, year, month, day, hour, minute, second] = match;
            return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10)));
        }
        const dateOnlyMatch = dateString.match(/(\d{4})(\d{2})(\d{2})/);
        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
        }
        return null;
    };
      
    const parseIcs = useCallback((icsData: string, calendarInfo: SyncedCalendar, localUser: AppUser): CalendarEvent[] => {
        const events: CalendarEvent[] = [];
        const eventBlocks = icsData.split('BEGIN:VEVENT').slice(1);
  
        const keywordMap: { [key: string]: CalendarEvent['type'] } = {
          'huiswerk': 'homework', 'homework': 'homework', 'opdracht': 'homework', 'assignment': 'homework',
          'toets': 'test', 'test': 'test', 'examen': 'test', 'exam': 'test', 'proefwerk': 'test',
          'presentatie': 'presentation', 'presentation': 'presentation',
          'mondeling': 'oral', 'oral': 'oral',
          'werk': 'work', 'work': 'work',
          'school': 'school', 'les': 'school', 'college': 'school'
        };
  
        const userSubjects = Array.from(new Set([...(localUser.selectedSubjects || []), ...(localUser.customSubjects || [])]));
  
        for (const block of eventBlocks) {
            const lines = block.split(/\r\n|\n|\r/);
            const eventData: any = {};
            lines.forEach(line => {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':');
                if (key.startsWith('SUMMARY')) eventData.summary = value;
                if (key.startsWith('DTSTART')) eventData.dtstart = value;
                if (key.startsWith('DTEND')) eventData.dtend = value;
                if (key.startsWith('DESCRIPTION')) eventData.description = value.replace(/\\n/g, '\n');
                if (key.startsWith('RRULE')) eventData.rrule = value;
            });
  
            const start = parseIcsDate(eventData.dtstart);
            let end = parseIcsDate(eventData.dtend);
            if (!start) continue;
            if (!end) {
                end = new Date(start.getTime() + 60 * 60 * 1000); // Default to 1 hour
            }
  
            const titleLower = (eventData.summary || '').toLowerCase();
          
            let eventType: CalendarEvent['type'] = 'other';
            for (const keyword in keywordMap) {
                if (titleLower.includes(keyword)) {
                    eventType = keywordMap[keyword];
                    break;
                }
            }
            
            let matchedSubject = 'algemeen';
            for (const sub of userSubjects) {
                if (titleLower.includes(sub.toLowerCase()) || titleLower.includes(tSubject(sub).toLowerCase())) {
                    matchedSubject = sub;
                    break;
                }
            }
  
            const baseEvent: Omit<CalendarEvent, 'id' | 'createdAt'> = {
                title: eventData.summary || 'No Title',
                description: eventData.description || '',
                start: Timestamp.fromDate(start),
                end: Timestamp.fromDate(end),
                subject: matchedSubject,
                type: eventType,
                ownerId: localUser.uid,
                isSynced: true,
                sourceCalendar: { name: calendarInfo.name, provider: calendarInfo.provider }
            };
  
            events.push({ ...baseEvent, id: `synced-${start.getTime()}-${Math.random()}`, createdAt: Timestamp.now() });
  
            if (eventData.rrule && eventData.rrule.includes('FREQ=WEEKLY')) {
                let untilDate: Date | null = null;
                const untilMatch = eventData.rrule.match(/UNTIL=([0-9T-Z]+)/);
                if (untilMatch) untilDate = parseIcsDate(untilMatch[1]);
                
                let currentStart = new Date(start);
                const duration = end.getTime() - start.getTime();
                
                const maxRecurrence = 52;
                for (let i = 0; i < maxRecurrence; i++) {
                    currentStart.setDate(currentStart.getDate() + 7);
                    if (untilDate && currentStart > untilDate) break;
  
                    const newStart = new Date(currentStart);
                    const newEnd = new Date(newStart.getTime() + duration);
                    
                     events.push({ 
                         ...baseEvent,
                         id: `synced-${newStart.getTime()}-${Math.random()}`, 
                         start: Timestamp.fromDate(newStart),
                         end: Timestamp.fromDate(newEnd),
                         createdAt: Timestamp.now()
                     });
                }
            }
        }
        return events;
    }, [tSubject]);
  
    const fetchAndParseCalendars = useCallback(async (localUser: AppUser) => {
        if (!localUser || localUser.uid === 'guest-user' || isSyncingCalendar.current || isSyncOnCooldown.current) {
            return;
        }
        isSyncingCalendar.current = true;
        let hasFailedInRun = false;
        const errors: { name: string, message: string }[] = [];
        
        try {
            const calendarsToSync = localUser.syncedCalendars?.filter(c => c.enabled);
            if (!calendarsToSync || calendarsToSync.length === 0) {
                setSyncedEvents([]);
                return;
            }
      
            let allParsedEvents: CalendarEvent[] = [];
            
            for (const cal of calendarsToSync) {
                try {
                    const targetUrl = cal.url.replace(/^webcal:\/\//i, 'https://');
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(response.statusText);
                    const icsData = await response.text();
                    const parsed = parseIcs(icsData, cal, localUser);
                    allParsedEvents = [...allParsedEvents, ...parsed];
                } catch (error) {
                    const calendarName = (typeof cal.name === 'string' && cal.name) ? cal.name : 'Unknown Calendar';
                    const errorMessage = (error instanceof Error) ? error.message : String(error);
                    console.error(`Error syncing calendar "${calendarName}":`, error);
                    hasFailedInRun = true;
                    errors.push({ name: calendarName, message: errorMessage === 'Failed to fetch' ? 'Failed to fetch. Check iCal URL and network connection.' : errorMessage });
                }
            }
            setSyncedEvents(allParsedEvents);
        } finally {
            isSyncingCalendar.current = false;
            if (hasFailedInRun) {
                syncFailureCount.current++;

                if (syncFailureCount.current === 1 && errors.length > 0) {
                    const errorText = errors.map(e => t('error_sync_calendar_description', { name: e.name, error: e.message })).join('\n\n');
                    showAppModal({ text: errorText });
                }
    
                if (syncFailureCount.current >= 3) {
                    console.warn('Calendar sync failed repeatedly. Starting 1-minute cooldown.');
                    isSyncOnCooldown.current = true;
                    setTimeout(() => {
                        console.log('Calendar sync cooldown finished. Resuming sync.');
                        isSyncOnCooldown.current = false;
                        syncFailureCount.current = 0;
                    }, 60000); // 1 minute cooldown
                }
            } else {
                syncFailureCount.current = 0; // Reset counter on success
            }
        }
    }, [parseIcs, showAppModal, t]);

    // Keep refs updated to be used in stable-dependency useEffects
    useEffect(() => {
        latestUser.current = user;
    }, [user]);

    useEffect(() => {
        tRef.current = t;
    }, [t]);

    useEffect(() => {
        tSubjectRef.current = tSubject;
    }, [tSubject]);
    
    // Data fetching effect, with stable dependencies
    useEffect(() => {
        const currentUid = user?.uid;
    
        // Abort if no user is logged in
        if (!currentUid || currentUid === 'guest-user') {
            setUserEvents([]);
            setRecentFiles([]);
            setNotifications([]);
            setAllUserFiles([]);
            setAllUserNotes([]);
            setAllUserFlashcardSets([]);
            setUserStudyPlans([]);
            setAllUserTasks([]);
            setAllStudySessions([]);
            setSyncedEvents([]);
            setChatHistories([]);
            return;
        }
    
        const unsubscribers: Unsubscribe[] = [];
        
        // Profile listener (for BOTH regular users and admin)
        const userDocRef = db.doc(`users/${currentUid}`);
        unsubscribers.push(userDocRef.onSnapshot(doc => {
            if (doc.exists) {
                setUser(prevUser => {
                    if (!prevUser) return null;
                    const newUserData = doc.data() as AppUser;
                    return { ...prevUser, ...newUserData };
                });
            }
        }));
    
        // If user is admin, we are done after setting up the profile listener.
        // We also clear out any lingering data from a previous non-admin session.
        if (isAdmin) {
            setUserEvents([]);
            setRecentFiles([]);
            setNotifications([]);
            setAllUserFiles([]);
            setAllUserNotes([]);
            setAllUserFlashcardSets([]);
            setUserStudyPlans([]);
            setAllUserTasks([]);
            setAllStudySessions([]);
            setSyncedEvents([]);
            setChatHistories([]);
            return () => unsubscribers.forEach(unsub => unsub());
        }
    
        // --- From here on, it's REGULAR USER data fetching ---
    
        const eventsQuery = db.collection(`users/${currentUid}/calendarEvents`).orderBy('start', 'asc');
        unsubscribers.push(eventsQuery.onSnapshot((snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
            setUserEvents(fetchedEvents);
        }));
        
        const plansQuery = db.collection(`users/${currentUid}/studyPlans`).orderBy('createdAt', 'desc');
        unsubscribers.push(plansQuery.onSnapshot((snapshot) => {
            const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyPlan));
            setUserStudyPlans(fetchedPlans);
        }));
    
        const filesQuery = db.collection(`files`).where('ownerId', '==', currentUid).orderBy('createdAt', 'desc').limit(5);
        unsubscribers.push(filesQuery.onSnapshot((snapshot) => {
            const fetchedFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData));
            setRecentFiles(fetchedFiles);
        }));
        
        const notifsQuery = db.collection(`users/${currentUid}/notifications`).orderBy('createdAt', 'desc').limit(50);
        unsubscribers.push(notifsQuery.onSnapshot(snapshot => {
            const fetchedNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(fetchedNotifs);
        }));
    
        // Listen for new broadcasts
        const broadcastQuery = db.collection(`broadcasts`).orderBy('createdAt', 'desc').limit(10);
        unsubscribers.push(broadcastQuery.onSnapshot(async (broadcastSnapshot) => {
            const localUser = latestUser.current;
            if (broadcastSnapshot.empty || !localUser?.uid || isAdmin) return;
    
            const userNotifsRef = db.collection(`users/${localUser.uid}/notifications`);
            const existingBroadcastNotifsQuery = userNotifsRef.where('broadcastId', '!=', null);
            const existingBroadcastNotifsSnapshot = await existingBroadcastNotifsQuery.get();
            const existingBroadcastIds = new Set(existingBroadcastNotifsSnapshot.docs.map(doc => doc.data().broadcastId));
            const dismissedBroadcastIds = localUser.dismissedBroadcastIds || [];
    
            const batch = db.batch();
            let hasNewBroadcasts = false;
            
            broadcastSnapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const broadcastDoc = change.doc;
                const broadcastId = broadcastDoc.id;
                if (!existingBroadcastIds.has(broadcastId) && !dismissedBroadcastIds.includes(broadcastId)) {
                    const broadcastData = broadcastDoc.data();
                    if (localUser.createdAt && broadcastData.createdAt.toMillis() > localUser.createdAt.toMillis()) {
                        const newNotifRef = userNotifsRef.doc();
                        batch.set(newNotifRef, {
                            title: broadcastData.title,
                            text: broadcastData.message,
                            type: 'admin', read: false,
                            createdAt: broadcastData.createdAt,
                            broadcastId: broadcastId,
                        });
                        hasNewBroadcasts = true;
                        if (localUser.notificationsEnabled) {
                            showNativeNotification(broadcastData.title, { body: broadcastData.message });
                        }
                    }
                }
              }
            });
    
            if (hasNewBroadcasts) await batch.commit();
        }));
        
        // Listen for feedback replies
        const feedbackQuery = db.collection(`feedback`).where('userId', '==', currentUid);
        unsubscribers.push(feedbackQuery.onSnapshot(async (feedbackSnapshot) => {
            const localUser = latestUser.current;
            if (!localUser?.uid) return;
            const userNotifsRef = db.collection(`users/${localUser.uid}/notifications`);
            const existingFeedbackNotifsQuery = userNotifsRef.where('feedbackId', '!=', null);
            const existingNotifsSnapshot = await existingFeedbackNotifsQuery.get();
            const existingFeedbackIds = new Set(existingNotifsSnapshot.docs.map(doc => doc.data().feedbackId));
            const dismissedFeedbackIds = localUser.dismissedFeedbackIds || [];
    
            const batch = db.batch();
            let hasNewReplies = false;
            feedbackSnapshot.docs.forEach(doc => {
                const feedbackData = doc.data();
                const feedbackId = doc.id;
                if(feedbackData.status === 'replied' && !existingFeedbackIds.has(feedbackId) && !dismissedFeedbackIds.includes(feedbackId)){
                    const newNotifRef = userNotifsRef.doc();
                    const title = tRef.current('feedback_reply_notification_title');
                    const text = tRef.current('feedback_reply_notification_text', { subject: feedbackData.subject });
                    batch.set(newNotifRef, {
                        title, text, type: 'feedback_reply', read: false,
                        createdAt: Timestamp.now(), feedbackId: feedbackId,
                    });
                    hasNewReplies = true;
                    if (localUser.notificationsEnabled) {
                        showNativeNotification(title, { body: text });
                    }
                }
            });
    
            if (hasNewReplies) await batch.commit();
        }));
    
        // Listen for new shared plans to create notifications
        const sharedPlansQuery = db.collection(`sharedPlans`).where('recipientEmail', '==', latestUser.current?.email);
        unsubscribers.push(sharedPlansQuery.onSnapshot(async (snapshot) => {
            const localUser = latestUser.current;
            if (snapshot.empty || !localUser?.uid) return;
        
            const userNotifsRef = db.collection(`users/${localUser.uid}/notifications`);
            const existingPlanNotifsQuery = userNotifsRef.where('planId', '!=', null);
            const existingNotifsSnapshot = await existingPlanNotifsQuery.get();
            const existingPlanIds = new Set(existingNotifsSnapshot.docs.map(doc => doc.data().planId));
        
            const batch = db.batch();
            let hasNewShares = false;
        
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const shareData = change.doc.data();
                    const planId = change.doc.id;
                    if (!existingPlanIds.has(planId)) {
                        const newNotifRef = userNotifsRef.doc();
                        const title = tRef.current('notification_plan_share_title');
                        const text = tRef.current('notification_plan_share_text', { name: shareData.sharerName, planName: shareData.title });
                        batch.set(newNotifRef, {
                            title, text, type: 'plan_share', read: false,
                            createdAt: shareData.createdAt, planId: planId,
                        });
                        hasNewShares = true;
                        if (localUser.notificationsEnabled) {
                            showNativeNotification(title, { body: text });
                        }
                    }
                }
            });
            if (hasNewShares) await batch.commit();
        }));
    
        // Listen for new shared sets to create notifications
        const sharedSetsQuery = db.collection(`sharedSets`).where('recipientEmail', '==', latestUser.current?.email);
        unsubscribers.push(sharedSetsQuery.onSnapshot(async (snapshot) => {
            const localUser = latestUser.current;
            if (snapshot.empty || !localUser?.uid) return;
        
            const userNotifsRef = db.collection(`users/${localUser.uid}/notifications`);
            const existingSetNotifsQuery = userNotifsRef.where('flashcardSetId', '!=', null);
            const existingNotifsSnapshot = await existingSetNotifsQuery.get();
            const existingSetIds = new Set(existingNotifsSnapshot.docs.map(doc => doc.data().flashcardSetId));
        
            const batch = db.batch();
            let hasNewShares = false;
        
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const shareData = change.doc.data();
                    const setId = change.doc.id;
                    if (!existingSetIds.has(setId)) {
                        const newNotifRef = userNotifsRef.doc();
                        const title = tRef.current('notification_flashcard_share_title');
                        const text = tRef.current('notification_flashcard_share_text', { name: shareData.sharerName, setName: shareData.name, subject: tSubjectRef.current(shareData.subject) });
                        batch.set(newNotifRef, {
                            title, text, type: 'flashcard_share', read: false,
                            createdAt: shareData.sharedAt || Timestamp.now(), // Fallback to prevent crash
                            flashcardSetId: setId,
                            subject: shareData.subject
                        });
                        hasNewShares = true;
                        if (localUser.notificationsEnabled) {
                            showNativeNotification(title, { body: text });
                        }
                    }
                }
            });
            if (hasNewShares) await batch.commit();
        }));

        // Listen for new shared notes to create notifications
        const sharedNotesQuery = db.collection(`sharedNotes`).where('recipientEmail', '==', latestUser.current?.email);
        unsubscribers.push(sharedNotesQuery.onSnapshot(async (snapshot) => {
            const localUser = latestUser.current;
            if (snapshot.empty || !localUser?.uid) return;
        
            const userNotifsRef = db.collection(`users/${localUser.uid}/notifications`);
            const existingNoteNotifsQuery = userNotifsRef.where('noteId', '!=', null);
            const existingNotifsSnapshot = await existingNoteNotifsQuery.get();
            const existingNoteIds = new Set(existingNotifsSnapshot.docs.map(doc => doc.data().noteId));
        
            const batch = db.batch();
            let hasNewShares = false;
        
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const shareData = change.doc.data();
                    const noteId = change.doc.id;
                    if (!existingNoteIds.has(noteId)) {
                        const newNotifRef = userNotifsRef.doc();
                        const title = tRef.current('notification_note_share_title');
                        const text = tRef.current('notification_note_share_text', { name: shareData.sharerName, noteTitle: shareData.title });
                        batch.set(newNotifRef, {
                            title, text, type: 'note_share', read: false,
                            createdAt: shareData.sharedAt || Timestamp.now(),
                            noteId: noteId,
                            subject: shareData.subject
                        });
                        hasNewShares = true;
                        if (localUser.notificationsEnabled) {
                            showNativeNotification(title, { body: text });
                        }
                    }
                }
            });
            if (hasNewShares) await batch.commit();
        }));

        // Fetch all data for progress view & home dashboard
        const allFilesQuery = db.collection(`files`).where('ownerId', '==', currentUid);
        unsubscribers.push(allFilesQuery.onSnapshot((snapshot) => setAllUserFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData)))));
    
        const allNotesQuery = db.collection(`users/${currentUid}/notes`);
        unsubscribers.push(allNotesQuery.onSnapshot((snapshot) => setAllUserNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)))));
    
        const allSetsQuery = db.collection(`users/${currentUid}/flashcardDecks`);
        unsubscribers.push(allSetsQuery.onSnapshot((snapshot) => setAllUserFlashcardSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashcardSet)))));
    
        const allTasksQuery = db.collection(`users/${currentUid}/tasks`);
        unsubscribers.push(allTasksQuery.onSnapshot((snapshot) => setAllUserTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ToDoTask)))));
    
        const allSessionsQuery = db.collection(`users/${currentUid}/studySessions`);
        unsubscribers.push(allSessionsQuery.onSnapshot((snapshot) => setAllStudySessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession)))));
        
        const historiesQuery = db.collection(`users/${currentUid}/chatHistories`).orderBy('updatedAt', 'desc');
        unsubscribers.push(historiesQuery.onSnapshot(snapshot => setChatHistories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatHistory)))));
    
        return () => unsubscribers.forEach(unsub => unsub());
    }, [user?.uid, isAdmin]);
    

    // Effect for periodic calendar sync - decoupled from re-renders
    useEffect(() => {
        if (!user?.uid || user.uid === 'guest-user' || isAdmin) return;
        const runSync = () => { if (latestUser.current) fetchAndParseCalendars(latestUser.current); };
        runSync();
        const intervalId = setInterval(runSync, 20000);
        return () => clearInterval(intervalId);
    }, [user?.uid, isAdmin, fetchAndParseCalendars]);

    // Effect for proactive notifications
    useEffect(() => {
        if (!user?.uid || user.uid === 'guest-user' || !user.notificationsEnabled) return;
    
        const checkProactiveNotifications = () => {
            const now = new Date();
    
            // --- Motivational Check-in ---
            const lastMotivationDate = localStorage.getItem('studybox_last_motivation');
            const daysSinceMotivation = lastMotivationDate ? (now.getTime() - new Date(lastMotivationDate).getTime()) / (1000 * 3600 * 24) : Infinity;
    
            if (daysSinceMotivation > 2.5) { // Every 2-3 days
                const motivationalMessages = [1, 2, 3, 4];
                const randIndex = Math.floor(Math.random() * motivationalMessages.length);
                const msgNum = motivationalMessages[randIndex];
                showNativeNotification(
                    tRef.current(`notification_motivation_${msgNum}_title`, { name: user.userName.split(' ')[0] }),
                    { body: tRef.current(`notification_motivation_${msgNum}_body`) }
                );
                localStorage.setItem('studybox_last_motivation', now.toISOString());
            }
    
            // --- Test Reminders ---
            const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            const twoDaysFromNowStr = twoDaysFromNow.toISOString().split('T')[0];
    
            const upcomingTests = allEvents.filter(event => 
                event.type === 'test' &&
                event.start.toDate().toISOString().split('T')[0] === twoDaysFromNowStr
            );
    
            upcomingTests.forEach(test => {
                const notifiedKey = `studybox_notified_test_${test.id}`;
                if (!localStorage.getItem(notifiedKey)) {
                    showNativeNotification(
                        tRef.current('notification_test_reminder_title'),
                        { body: tRef.current('notification_test_reminder_body', {
                            subject: tSubjectRef.current(test.subject),
                            date: test.start.toDate().toLocaleDateString()
                        })}
                    );
                    localStorage.setItem(notifiedKey, 'true');
                }
            });
        };
    
        // Run check once a day.
        const lastCheckDate = localStorage.getItem('studybox_last_proactive_check');
        const todayStr = new Date().toISOString().split('T')[0];
        if (lastCheckDate !== todayStr) {
            const timer = setTimeout(checkProactiveNotifications, 10000); // Run after a short delay
            localStorage.setItem('studybox_last_proactive_check', todayStr);
            return () => clearTimeout(timer);
        }
    }, [user, allEvents]);


    useEffect(() => {
        if (!user?.uid || !currentSubject || user.uid === 'guest-user') {
            setAllSubjectFiles([]);
            return;
        }

        const filesQuery = db.collection(`files`)
          .where('ownerId', '==', user.uid)
          .where('subject', '==', currentSubject)
          .orderBy('createdAt', 'desc');

        const unsubscribe = filesQuery.onSnapshot((snapshot) => {
            const fetchedFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData));
            setAllSubjectFiles(fetchedFiles);
        }, (error) => {
             console.error(`Error fetching files for subject ${currentSubject}:`, error);
        });

        return () => unsubscribe();
    }, [user?.uid, currentSubject]);
    
    const subjectFiles = useMemo(() => {
        if (searchQuery.trim() === '') return allSubjectFiles;
        return allSubjectFiles.filter(file => 
            fuzzyMatch(searchQuery, file.title) ||
            (file.description && fuzzyMatch(searchQuery, file.description))
        );
    }, [allSubjectFiles, searchQuery]);
    
    const handleProfileUpdate = useCallback(async (updatedData: Partial<AppUser>) => {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;
        
        try {
            const userDocRef = db.doc(`users/${uid}`);
            await userDocRef.update(updatedData);
        } catch (error) {
            showAppModal({ text: t('error_save_settings_failed') });
        }
    }, [showAppModal, t]);
    
    const debouncedUpdateData = useRef<Partial<AppUser>>({});
    const debouncedUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleProfileUpdateWithDebounce = useCallback((updatedData: Partial<AppUser>) => {
        if (user?.uid === 'guest-user') return;

        debouncedUpdateData.current = { ...debouncedUpdateData.current, ...updatedData };

        if (debouncedUpdateTimer.current) {
            clearTimeout(debouncedUpdateTimer.current);
        }

        debouncedUpdateTimer.current = setTimeout(() => {
            handleProfileUpdate(debouncedUpdateData.current);
            debouncedUpdateData.current = {};
        }, 1500);
    }, [handleProfileUpdate, user?.uid]);
    
    const handleFocusMinutesChange = (m: number) => {
        const newMinutes = Math.max(1, m);
        setFocusMinutes(newMinutes);
        handleProfileUpdateWithDebounce({ focusDuration: newMinutes });
    };

    const handleBreakMinutesChange = (m: number) => {
        const newMinutes = Math.max(1, m);
        setBreakMinutes(newMinutes);
        handleProfileUpdateWithDebounce({ breakDuration: newMinutes });
    };


    const handleAdminSettingsUpdate = useCallback(async (updatedData: Partial<AdminSettings>) => {
        setAdminSettings(currentSettings => currentSettings ? { ...currentSettings, ...updatedData } : null);
        try {
            const settingsDocRef = db.doc(`adminSettings/global`);
            await settingsDocRef.update(updatedData);
        } catch (error) {
            console.error("Failed to save admin settings", error);
            showAppModal({ text: t('error_failed_to_save_admin_settings') });
        }
    }, [showAppModal, t]);

    const handlePinDisableRequest = () => setIsPinVerificationModalOpen(true);
    const handlePinDisableConfirm = () => {
        handleAdminSettingsUpdate({ pinProtectionEnabled: false });
        setIsPinVerificationModalOpen(false);
    };

    const handleAvatarSave = useCallback(async (url: string | null) => {
        if (!user || user.uid === 'guest-user') return;
        
        const profilePictureUrl = url === null ? 'NONE' : url;
        
        try {
            await handleProfileUpdate({ profilePictureUrl });
            showAppModal({ text: t('profile_picture_upload_success') });
        } catch (error) {
            console.error("Avatar update error:", error);
            showAppModal({ text: t('error_profile_pic_upload_failed') });
        }
    }, [user, handleProfileUpdate, showAppModal, t]);
    
    const cleanupUserData = async (uid: string) => {
        const batchDelete = async (query: any) => {
            const snapshot = await query.get();
            if (snapshot.size === 0) return;
            const batch = db.batch();
            snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
            await batch.commit();
        };
    
        // Delete user files from storage and firestore
        const filesQuery = db.collection(`files`).where('ownerId', '==', uid);
        const filesSnapshot = await filesQuery.get();
        if (!filesSnapshot.empty) {
            const deletePromises = filesSnapshot.docs.map(doc => {
                const fileData = doc.data() as FileData;
                if (fileData.storagePath) {
                    return storage.ref(fileData.storagePath).delete().catch(err => console.error(`Failed to delete storage file:`, err));
                }
                return Promise.resolve();
            });
            await Promise.all(deletePromises);
            await batchDelete(filesQuery);
        }
    
        // Delete all private user collections
        const userRoot = `users/${uid}`;
        const collectionsToDelete = ['calendarEvents', 'notes', 'tasks', 'notifications', 'studyPlans', 'studySessions', 'chatHistories'];
        for (const coll of collectionsToDelete) {
            await batchDelete(db.collection(`${userRoot}/${coll}`));
        }
    
        // Special handling for flashcard decks (with subcollections)
        const decksRef = db.collection(`${userRoot}/flashcardDecks`);
        const decksSnapshot = await decksRef.get();
        if (!decksSnapshot.empty) {
            for (const deckDoc of decksSnapshot.docs) {
                await batchDelete(deckDoc.ref.collection('cards'));
                await deckDoc.ref.delete();
            }
        }
    
        // Delete user's feedback
        await batchDelete(db.collection(`feedback`).where('userId', '==', uid));
    };

    const handleCleanupAccount = async () => {
        if (!auth.currentUser) return;
        const currentUser = auth.currentUser;
        
        showAppModal({ text: t('cleanup_account_progress'), confirmAction: undefined, cancelAction: undefined });

        try {
            await cleanupUserData(currentUser.uid);
            showAppModal({ text: t('success_account_cleaned') });
            // Reset local state if necessary
            setRecentFiles([]);
            setUserEvents([]);
            setAllSubjectFiles([]);
            setNotifications([]);
            setUserStudyPlans([]);
        } catch (error) {
            console.error("Account cleanup failed:", error);
            showAppModal({ text: t('error_account_cleanup_failed')});
        } finally {
            setIsCleanupReauthModalOpen(false);
        }
    };
    
    const handleClearCalendar = async () => {
        if (!auth.currentUser) return;
        
        showAppModal({ text: t('clear_calendar_progress'), confirmAction: undefined, cancelAction: undefined });
    
        try {
            const calendarRef = db.collection(`users/${auth.currentUser.uid}/calendarEvents`);
            const snapshot = await calendarRef.get();
            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            showAppModal({ text: t('success_calendar_cleared') });
        } catch (error) {
            console.error("Calendar clearing failed:", error);
            showAppModal({ text: t('error_calendar_clear_failed')});
        } finally {
            setIsClearCalendarReauthModalOpen(false);
        }
    };

    const deleteUserData = async (uid: string) => {
        await cleanupUserData(uid); // Use the same cleanup logic
        await db.doc(`users/${uid}`).delete(); // Then delete the user doc
    };

    const handleDeleteAccount = async () => {
        if (!auth.currentUser) return;
        const currentUser = auth.currentUser;
        
        showAppModal({ text: t('deleting_account_progress'), confirmAction: undefined, cancelAction: undefined });

        try {
            await deleteUserData(currentUser.uid);
            await currentUser.delete();
            showAppModal({ text: t('success_account_deleted') });
        } catch (error) {
            console.error("Account deletion failed:", error);
            showAppModal({ text: t('error_account_deletion_failed')});
        } finally {
            setIsReauthModalOpen(false);
        }
    };

    const addCalendarEventFromAI = useCallback(async (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>): Promise<string> => {
        if (!user?.uid) {
            return "Error: User not found.";
        }
        try {
            const docRef = await db.collection(`users/${user.uid}/calendarEvents`).add({
                ...eventData,
                ownerId: user.uid,
                createdAt: Timestamp.now(),
            });
            return `Event "${eventData.title}" was successfully added to your calendar.`;
        } catch (error) {
            console.error("Failed to add calendar event from AI:", error);
            return `Sorry, I failed to add the event. Please try again. Error: ${(error as Error).message}`;
        }
    }, [user?.uid]);
    
    const removeCalendarEventFromAI = useCallback(async (title: string, date: string): Promise<string> => {
        if (!user?.uid) {
            return "Error: User not found.";
        }
        try {
            const eventsRef = db.collection(`users/${user.uid}/calendarEvents`);

            // Create a date range for the entire day
            const startOfDay = new Date(`${date}T00:00:00`);
            const endOfDay = new Date(`${date}T23:59:59`);

            if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
                return `Sorry, the date format "${date}" is invalid. Please use YYYY-MM-DD.`;
            }

            const q = eventsRef
                .where('title', '==', title)
                .where('start', '>=', Timestamp.fromDate(startOfDay))
                .where('start', '<=', Timestamp.fromDate(endOfDay));

            const querySnapshot = await q.get();

            if (querySnapshot.empty) {
                return `I couldn't find an event named "${title}" on ${date}.`;
            }

            // Delete all found events that match (in case of duplicates)
            const batch = db.batch();
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            const eventCount = querySnapshot.size;
            return `Successfully removed ${eventCount} event(s) named "${title}" from your calendar on ${date}.`;

        } catch (error) {
            console.error("Failed to remove calendar event from AI:", error);
            return `Sorry, I failed to remove the event. Please try again. Error: ${(error as Error).message}`;
        }
    }, [user?.uid]);
    
    const getStudyPlansFromAI = useCallback(async (): Promise<string> => {
        if (userStudyPlans.length === 0) {
            return "The user currently has no study plans.";
        }
        const plansSummary = userStudyPlans.map(p => `- Title: "${p.title}", Test Date: ${p.testDate.toDate().toISOString().split('T')[0]}`);
        return `Here is a list of the user's study plans:\n${plansSummary.join('\n')}`;
    }, [userStudyPlans]);
    
    const getStudyPlanDetailsFromAI = useCallback(async (title: string): Promise<string> => {
        const plan = userStudyPlans.find(p => p.title.toLowerCase() === title.toLowerCase());
        if (!plan) {
            return `I could not find a study plan with the title "${title}".`;
        }
        const scheduleDetails = plan.schedule.map(item => `- On ${item.day} at ${item.time}, the task is to study ${item.subject}: ${item.task}. The tip for this is: ${item.tip}`);
        return `Details for study plan "${plan.title}":\n${scheduleDetails.join('\n')}`;
    }, [userStudyPlans]);

    const deleteStudyPlanFromAI = useCallback(async (title: string): Promise<string> => {
        if (!user?.uid) {
            return "Error: User not found.";
        }
        const planToDelete = userStudyPlans.find(p => p.title.toLowerCase() === title.toLowerCase());
        if (!planToDelete) {
            return t('delete_study_plan_from_ai_not_found', { title });
        }

        try {
            const batch = db.batch();
            // Delete the plan itself
            const planRef = db.doc(`users/${user.uid}/studyPlans/${planToDelete.id}`);
            batch.delete(planRef);

            // Delete associated calendar events
            const eventsQuery = db.collection(`users/${user.uid}/calendarEvents`).where('studyPlanId', '==', planToDelete.id);
            const eventsSnapshot = await eventsQuery.get();
            eventsSnapshot.forEach(doc => batch.delete(doc.ref));

            await batch.commit();
            return t('delete_study_plan_from_ai_success', { title });
        } catch (error) {
            console.error("Failed to delete study plan from AI:", error);
            return t('delete_study_plan_from_ai_fail', { title });
        }
    }, [user?.uid, userStudyPlans, t]);

     const modifyCalendarEventFromAI = useCallback(async (originalTitle: string, updates: { newTitle?: string, newDate?: string, newTime?: string, newSubject?: string, newType?: CalendarEvent['type'] }): Promise<string> => {
        if (!user?.uid) return "Error: User not found.";
        try {
            const eventsRef = db.collection(`users/${user.uid}/calendarEvents`);
            const q = eventsRef
                .where('title', '==', originalTitle)
                .where('start', '>=', Timestamp.now())
                .orderBy('start', 'asc')
                .limit(1);
            
            const querySnapshot = await q.get();
    
            if (querySnapshot.empty) {
                return `I couldn't find an upcoming event named "${originalTitle}".`;
            }
            
            const eventDoc = querySnapshot.docs[0];
            const eventData = eventDoc.data() as CalendarEvent;
            
            const updatesToApply: Partial<CalendarEvent> = {};
            if (updates.newTitle) updatesToApply.title = updates.newTitle;
            if (updates.newSubject) updatesToApply.subject = updates.newSubject;
            if (updates.newType) updatesToApply.type = updates.newType;
            
            let newStart = eventData.start.toDate();
            let newEnd = eventData.end.toDate();
            const duration = newEnd.getTime() - newStart.getTime();
    
            if (updates.newDate) {
                const [year, month, day] = updates.newDate.split('-').map(Number);
                newStart.setFullYear(year, month - 1, day);
            }
            if (updates.newTime) {
                const [hour, minute] = updates.newTime.split(':').map(Number);
                newStart.setHours(hour, minute, 0, 0);
            }
            newEnd = new Date(newStart.getTime() + duration);
            
            updatesToApply.start = Timestamp.fromDate(newStart);
            updatesToApply.end = Timestamp.fromDate(newEnd);
            
            await eventDoc.ref.update(updatesToApply);
    
            return `OK, I've updated the event "${originalTitle}" to "${updatesToApply.title || originalTitle}".`;
    
        } catch (error) {
            console.error("Failed to modify event from AI:", error);
            return `Sorry, I failed to modify the event. Error: ${(error as Error).message}`;
        }
    }, [user?.uid]);

    const initializeAIChat = useCallback((history?: ChatMessage[]) => {
        const localUser = latestUser.current;
        if (localUser && !isAdmin && process.env.API_KEY) {
            const availableSubjects = [...(localUser.selectedSubjects || []), ...(localUser.customSubjects || [])];

            const addEventTool: FunctionDeclaration = { name: "addCalendarEvent", description: "Adds a new event to the user's calendar. Use the current year for dates unless another year is specified. Today's date is " + new Date().toISOString().split('T')[0], parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, time: { type: Type.STRING }, subject: { type: Type.STRING, description: `Must be one of: ${availableSubjects.join(', ')}` }, type: { type: Type.STRING, description: "Must be one of: 'test', 'presentation', 'homework', 'oral', 'other', 'work', 'school'." } }, required: ["title", "date", "time", "subject", "type"] } };
            const removeEventTool: FunctionDeclaration = { name: "removeCalendarEvent", description: "Removes an event from the user's calendar.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING } }, required: ["title", "date"] } };
            const getEventsTool: FunctionDeclaration = { name: "getCalendarEvents", description: "Retrieves all calendar events for a specific date.", parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING, description: "YYYY-MM-DD format" } }, required: ["date"] } };
            const getStudyPlansTool: FunctionDeclaration = { name: "getStudyPlans", description: "Retrieves an overview of all the user's study plans.", parameters: { type: Type.OBJECT, properties: {} } };
            const getStudyPlanDetailsTool: FunctionDeclaration = { name: "getStudyPlanDetails", description: "Retrieves the detailed schedule for a specific study plan by its title.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ["title"] } };
            const deleteStudyPlanTool: FunctionDeclaration = { name: "deleteStudyPlan", description: "Deletes a study plan by its title. The user must be asked for confirmation for this action.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ["title"] } };
            const modifyEventTool: FunctionDeclaration = { name: "modifyCalendarEvent", description: "Modifies an existing calendar event. You must provide the original title to find the event. You can provide any of the new properties to update.", parameters: { type: Type.OBJECT, properties: { originalTitle: { type: Type.STRING }, updates: { type: Type.OBJECT, properties: { newTitle: { type: Type.STRING }, newDate: { type: Type.STRING, description: "YYYY-MM-DD format" }, newTime: { type: Type.STRING, description: "HH:mm format" }, newSubject: { type: Type.STRING, description: `Must be one of: ${availableSubjects.join(', ')}` }, newType: { type: Type.STRING, description: "Must be one of: 'test', 'presentation', 'homework', 'oral', 'other', 'work', 'school'." } } } }, required: ["originalTitle", "updates"] } };

            const tools: Tool[] = [{ functionDeclarations: [addEventTool, removeEventTool, getEventsTool, getStudyPlansTool, getStudyPlanDetailsTool, deleteStudyPlanTool, modifyEventTool] }];
            const todayString = new Date().toISOString().split('T')[0];
            const systemInstructionText = tRef.current('ai_system_instruction', { botName: localUser.aiBotName || 'Studycat', userName: localUser.userName, subjects: availableSubjects.join(', '), todayDate: todayString });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const chatInstance = ai.chats.create({ model: 'gemini-2.5-flash', history, config: { systemInstruction: systemInstructionText, tools: tools } });
            
            setAiChat(chatInstance);
            if (history) {
                setAiChatMessages(history);
            } else {
                setAiChatMessages([{ role: 'model', text: tRef.current('ai_chat_welcome', { userName: localUser.userName.split(' ')[0], botName: localUser.aiBotName || 'Studycat' }) }]);
                setCurrentChatSessionId(null);
            }
        } else {
             setAiChat(null);
             setAiChatMessages([]);
             setCurrentChatSessionId(null);
        }
    }, [isAdmin]);

    const loadChatHistory = useCallback((history: ChatHistory) => {
        initializeAIChat(history.messages);
        setCurrentChatSessionId(history.id);
    }, [initializeAIChat]);

    const resetAIChat = useCallback(() => {
        initializeAIChat();
    }, [initializeAIChat]);

    // FIX: Add ref for resetAIChat to fix stale closure in auth effect.
    const resetAIChatRef = useRef(resetAIChat);
    useEffect(() => {
        resetAIChatRef.current = resetAIChat;
    }, [resetAIChat]);

    const handleDeleteAllChats = useCallback(async () => {
        if (!user?.uid) return;
    
        const chatHistoryRef = db.collection(`users/${user.uid}/chatHistories`);
        try {
            const snapshot = await chatHistoryRef.get();
            if (snapshot.empty) return;
    
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
    
            initializeAIChat();
            showAppModal({ text: t('all_chats_deleted_success') });
        } catch (error) {
            console.error("Failed to delete all chats:", error);
            showAppModal({ text: t('error_delete_all_chats_failed') });
        }
    }, [user?.uid, initializeAIChat, showAppModal, t]);


    // FIX: Add a ref to prevent the login update logic from running multiple times if onAuthStateChanged fires repeatedly.
    const loginUpdatePerformed = useRef(false);

    // Main authentication and profile loading effect
    useEffect(() => {
        const authSubscriber = auth.onAuthStateChanged(async (firebaseUser) => {
            if (!firebaseUser) {
                loginUpdatePerformed.current = false; // Reset on logout
                sessionStorage.removeItem('studybox_verification_skipped');
                setVerificationSkipped(false);
                setUser(null);
                setIsAdmin(false);
                setAdminSettings(null);
                resetAIChatRef.current();
                setAppStatus('unauthenticated');
                setLoginError(null);
                return;
            }
            
            if (loginUpdatePerformed.current) {
                return;
            }
            loginUpdatePerformed.current = true;

            setAppStatus('initializing');
            const userDocRef = db.doc(`users/${firebaseUser.uid}`);

            try {
                const docSnap = await userDocRef.get();
                if (docSnap.exists) {
                    const userData = docSnap.data() as AppUser;
                    if (userData.disabled) {
                        await auth.signOut();
                        setLoginError(tRef.current('error_account_disabled'));
                        setAppStatus('error');
                        return;
                    }
                    
                    const profileUpdate: Partial<AppUser> = {};
                    if (firebaseUser.emailVerified && !userData.isVerifiedByEmail) {
                        profileUpdate.isVerifiedByEmail = true;
                    }
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const lastLoginDate = userData.lastLoginDate?.toDate();
                    if (lastLoginDate) {
                        lastLoginDate.setHours(0, 0, 0, 0);
                    }
            
                    // Only update streak if it's the first login of the day
                    if (!lastLoginDate || lastLoginDate.getTime() < today.getTime()) {
                        const yesterday = new Date(today);
                        yesterday.setDate(today.getDate() - 1);
                        
                        const currentStreak = userData.streakCount || 0;
                        let newStreak = 1; 
                        
                        if (lastLoginDate && lastLoginDate.getTime() === yesterday.getTime()) {
                            newStreak = currentStreak + 1;
                        } 
                        else if (lastLoginDate && lastLoginDate.getTime() < yesterday.getTime()) {
                            if (currentStreak > 0) {
                                db.collection(`users/${firebaseUser.uid}/notifications`).add({
                                    title: tRef.current('streak_lost_notification_title'),
                                    text: tRef.current('streak_lost_notification_text', { count: currentStreak }),
                                    type: 'streak', read: false, createdAt: Timestamp.now()
                                });
                            }
                            newStreak = 1;
                        }
            
                        profileUpdate.streakCount = newStreak;
                        profileUpdate.lastLoginDate = Timestamp.fromDate(today);
                    }


                    if (Object.keys(profileUpdate).length > 0) {
                       await userDocRef.update(profileUpdate);
                    }
                    
                    const finalUser: AppUser = { ...userData, ...profileUpdate, uid: firebaseUser.uid, email: userData.email || firebaseUser.email || '' };
                    setUser(finalUser);
                    
                    db.collection(`users/${firebaseUser.uid}/chatHistories`).where('updatedAt', '<', Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
                        .get().then(s => { if (!s.empty) { const b = db.batch(); s.docs.forEach(d => b.delete(d.ref)); b.commit(); }});

                    setShowAiSetup(finalUser.hasCompletedOnboarding === false);
                    if (finalUser.focusDuration) setFocusMinutes(finalUser.focusDuration);
                    if (finalUser.breakDuration) setBreakMinutes(finalUser.breakDuration);

                } else {
                    const finalUser: AppUser = {
                        uid: firebaseUser.uid, email: firebaseUser.email || '', userName: firebaseUser.displayName || tRef.current('guest_fallback_name'),
                        profilePictureUrl: firebaseUser.photoURL || 'NONE', createdAt: Timestamp.now(), selectedSubjects: [], customSubjects: [],
                        schoolName: '', className: '', educationLevel: '', languagePreference: language, themePreference: themeColor,
                        fontPreference: 'inter',
                        homeLayout: defaultHomeLayout, streakCount: 1, lastLoginDate: Timestamp.now(),
                        notificationsEnabled: true, disabled: false, isVerifiedByEmail: true,
                        focusDuration: 25, breakDuration: 5, dismissedBroadcastIds: [], dismissedFeedbackIds: [],
                        aiBotName: 'Studycat', aiBotAvatarUrl: null, hasCompletedOnboarding: false, goals: [], syncedCalendars: [],
                    };
                    await userDocRef.set(finalUser, { merge: true });
                    setUser(finalUser);
                }
                
                const adminEmails = ['af@studybox.com', 'ma@studybox.com'];
                if (adminEmails.includes(firebaseUser.email?.toLowerCase() ?? '')) {
                    setIsAdmin(true);
                    const settingsDoc = await db.doc(`adminSettings/global`).get();
                    if (settingsDoc.exists) {
                        setAdminSettings(settingsDoc.data() as AdminSettings);
                    } else {
                         const defaultAdminSettings: AdminSettings = { themePreference: 'blue', pinProtectionEnabled: true, fontPreference: 'inter' };
                         await db.doc(`adminSettings/global`).set(defaultAdminSettings);
                         setAdminSettings(defaultAdminSettings);
                    }
                }
                
                setAppStatus('authenticated');
            } catch (error: any) {
                console.error("Auth state change error:", error);
                setLoginError(error.message);
                setAppStatus('error');
            }
        });

        return () => authSubscriber();
    }, []);


     // Effect to initialize AI Chat
     useEffect(() => {
        if (user && !isAdmin) {
            initializeAIChat();
        }
    }, [user?.uid, isAdmin, initializeAIChat]);

    // Effect to sync user preferences to app state
    useEffect(() => {
        if (user && !isAdmin) {
            if (user.themePreference && user.themePreference !== themeColor) {
                setThemeColor(user.themePreference);
            }
            if (user.languagePreference && user.languagePreference !== language) {
                setLanguage(user.languagePreference);
            }
            if (user.fontPreference && user.fontPreference !== fontFamily) {
                setFontFamily(user.fontPreference);
            }
        } else if (isAdmin && adminSettings) {
             if (adminSettings.themePreference && adminSettings.themePreference !== themeColor) {
                setThemeColor(adminSettings.themePreference);
            }
             if (adminSettings.fontPreference && adminSettings.fontPreference !== fontFamily) {
                setFontFamily(adminSettings.fontPreference);
            }
        }
    }, [user, isAdmin, adminSettings, themeColor, language, fontFamily]);

    const copyTextToClipboard = useCallback((text: string, title: string = '') => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                 showAppModal({ text: t('share_link_copied', { title }) });
            }).catch(() => {
                 showAppModal({ text: t('error_copy_share_link') });
            });
            return true;
        }
        return false;
    }, [showAppModal, t]);
    
    useEffect(() => {
        try {
            const introSeen = localStorage.getItem('studybox_intro_seen');
            if (introSeen !== 'true') {
                setShowIntro(true);
                setIntroStage('typing'); // Reset stage when intro is needed
            }
        } catch (error) {
            setShowIntro(false);
        } finally {
            setIntroChecked(true);
        }
    }, []);

    const appFontFamily = isAdmin ? (adminSettings?.fontPreference || 'inter') : fontFamily;
    const activeFontClass = appStatus === 'authenticated' ? (fontClasses[appFontFamily] || 'font-inter') : 'font-inter';
    const appContainerClasses = `min-h-screen ${activeFontClass} antialiased`;

    const authContainerClasses = (appStatus === 'unauthenticated' || appStatus === 'initializing' || appStatus === 'awaiting-verification' || (showIntro && !user) || appStatus === 'error') ? getAuthThemeClasses('bg') : '';

    const mainAppLayoutProps = { user, t, getThemeClasses, showAppModal, closeAppModal, tSubject, copyTextToClipboard, setIsAvatarModalOpen, language, setLanguage, themeColor, setThemeColor, fontFamily, setFontFamily, handleLogout, handleGoHome, currentView, setCurrentView, currentSubject, setCurrentSubject, subjectFiles, searchQuery, setSearchQuery, allEvents, userStudyPlans, recentFiles, onProfileUpdate: handleProfileUpdate, onDeleteAccountRequest: () => setIsReauthModalOpen(true), onCleanupAccountRequest: () => setIsCleanupReauthModalOpen(true), onClearCalendarRequest: () => setIsClearCalendarReauthModalOpen(true), notifications, unreadCount, showBroadcast: showBroadcastModal, focusMinutes, setFocusMinutes: handleFocusMinutesChange, breakMinutes, setBreakMinutes: handleBreakMinutesChange, timerMode, setTimerMode, timeLeft, setTimeLeft, isTimerActive, setIsTimerActive, selectedTaskForTimer, setSelectedTaskForTimer, allUserFiles, allUserNotes, allUserFlashcardSets, allUserTasks, allStudySessions, addCalendarEvent: addCalendarEventFromAI, removeCalendarEvent: removeCalendarEventFromAI, getStudyPlans: getStudyPlansFromAI, getStudyPlanDetails: getStudyPlanDetailsFromAI, deleteStudyPlan: deleteStudyPlanFromAI, currentTime, aiChat: aiChat, aiChatMessages, setAiChatMessages, resetAIChat, chatHistories, currentChatSessionId, setCurrentChatSessionId, onDeleteAllChats: handleDeleteAllChats, loadChatHistory, triggerHapticFeedback, modifyCalendarEvent: modifyCalendarEventFromAI };
    
    const isLoading = !isAppReadyForDisplay || !isMinLoadingTimePassed;
    
    if (loginError) {
        return (
            <div className={`min-h-screen w-full flex items-center justify-center p-4 ${getAuthThemeClasses('bg')}`}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                    <h2 className="text-2xl font-bold mb-3 text-red-700">Login Error</h2>
                    <p className="text-gray-600 mb-4">
                        An unexpected error occurred while loading your profile. This might be due to a network issue or a problem with your account data.
                    </p>
                    <p className="text-sm text-gray-500 mb-6 bg-gray-100 p-2 rounded-md">
                        <strong>Details:</strong> {loginError}
                    </p>
                    <button
                        onClick={handleLogout}
                        className={`w-full font-bold py-3 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}
                    >
                        {t('logout_button')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`${appContainerClasses} ${authContainerClasses}`}>
             <style>{`
                 @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes fadeInSlower { from { opacity: 0; } to { opacity: 1; } }
                 @keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-10px); } }
                 .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                 .animate-fade-in-slow { animation: fadeInSlower 0.5s ease-out forwards; }
                 .animate-fade-out { animation: fadeOut 0.3s ease-out forwards; }
                 .prose { word-break: break-word; color: #374151; font-size: 0.9rem; }
                 .prose h1, .prose h2, .prose h3 { font-weight: 700; margin-top: 1.2em; margin-bottom: 0.6em; }
                 .prose h1 { font-size: 1.5em; } .prose h2 { font-size: 1.25em; } .prose h3 { font-size: 1.1em; }
                 .prose p { margin-top: 0.5em; margin-bottom: 0.5em; line-height: 1.4; }
                 .prose code { background-color: #e5e7eb; padding: 0.2em 0.4em; margin: 0; font-size: 85%; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
                 .prose pre { background-color: #1f2937; color: #f3f4f6; padding: 1em; border-radius: 0.5em; overflow-x: auto; }
                 .prose pre code { background-color: transparent; padding: 0; color: inherit; }
                 .prose ul, .prose ol { margin-top: 0.8em; margin-bottom: 0.8em; padding-left: 1.5rem; }
                 .prose ul { list-style-type: disc; }
                 .prose ol { list-style-type: decimal; }
                 .prose li > p { margin-top: 0.4em; margin-bottom: 0.4em; }
                 .prose blockquote { border-left: 4px solid #ccc; padding-left: 1em; margin-left: 0; font-style: italic; color: #6b7280; }
                 .prose strong { font-weight: 600; }
                 .prose a { color: #2563eb; text-decoration: underline; }
                 .ai-chat-button { transition: bottom 0.3s ease-in-out; }
                 body.drawing-editor-active .ai-chat-button { bottom: 6.5rem; }
             `}</style>
            {modalContent && <CustomModal {...{ ...modalContent, onClose: closeAppModal, t, getThemeClasses, triggerHapticFeedback }} />}
            <BroadcastModal isOpen={isBroadcastModalOpen} onClose={() => setIsBroadcastModalOpen(false)} broadcast={selectedBroadcast} t={t} getThemeClasses={getThemeClasses} />
            {user && <AvatarSelectionModal isOpen={isAvatarModalOpen} onClose={() => setIsAvatarModalOpen(false)} onSave={handleAvatarSave} currentUser={user} t={t} getThemeClasses={getThemeClasses}/>}
            <ReauthModal isOpen={isReauthModalOpen} onClose={() => setIsReauthModalOpen(false)} onSuccess={handleDeleteAccount} t={t} getThemeClasses={getThemeClasses} />
            <ReauthModal
                isOpen={isCleanupReauthModalOpen}
                onClose={() => setIsCleanupReauthModalOpen(false)}
                onSuccess={handleCleanupAccount}
                t={t}
                getThemeClasses={getThemeClasses}
                title={t('reauth_modal_title_cleanup')}
                description={t('reauth_modal_description_cleanup')}
                confirmButtonText={t('confirm_cleanup_account_button')}
                confirmButtonColor="bg-orange-600 hover:bg-orange-700"
            />
            <ReauthModal
                isOpen={isClearCalendarReauthModalOpen}
                onClose={() => setIsClearCalendarReauthModalOpen(false)}
                onSuccess={handleClearCalendar}
                t={t}
                getThemeClasses={getThemeClasses}
                title={t('reauth_modal_title_clear_calendar')}
                description={t('reauth_modal_description_clear_calendar')}
                confirmButtonText={t('confirm_clear_calendar_button')}
                confirmButtonColor="bg-red-600 hover:bg-red-700"
            />
            <UserDetailModal isOpen={isUserDetailModalOpen} onClose={() => setIsUserDetailModalOpen(false)} user={selectedUserForDetail} {...{t, tSubject, getThemeClasses, showAppModal}} />
            <PinVerificationModal isOpen={isPinVerificationModalOpen} onClose={() => setIsPinVerificationModalOpen(false)} onSuccess={handlePinDisableConfirm} t={t} getThemeClasses={getThemeClasses} />
            
            {isLoggingOut ? (
                <LogoutAnimationView 
                    getThemeClasses={getAuthThemeClasses}
                    onAnimationEnd={() => {
                        auth.signOut().then(() => {
                            setIsLoggingOut(false);
                        });
                    }}
                    t={t}
                    userName={user?.userName || ''}
                    triggerHapticFeedback={triggerHapticFeedback}
                />
            ) : isLoading ? (
                <LoadingScreen getThemeClasses={getAuthThemeClasses} />
            ) : (
              <>
                {appStatus === 'awaiting-verification' && user && !verificationSkipped && !user.isVerifiedByEmail && (
                     <EmailVerificationView 
                        user={user}
                        t={t}
                        getThemeClasses={getAuthThemeClasses}
                        handleLogout={handleLogout}
                        onSkip={handleSkipVerification}
                     />
                )}

                {(appStatus === 'unauthenticated' || (appStatus === 'awaiting-verification' && verificationSkipped) || (appStatus === 'awaiting-verification' && user?.isVerifiedByEmail)) && introChecked && (
                    showIntro ? (
                         <div className={`relative w-full h-screen overflow-hidden ${getAuthThemeClasses('bg')}`}>
                            <div className={`absolute inset-0 transition-all duration-500 ease-in-out flex items-center justify-center ${introStage === 'typing' ? 'opacity-100 transform-none pointer-events-auto' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
                                <TypingWelcomeView
                                    onContinue={() => {
                                        triggerHapticFeedback();
                                        setIntroStage('tutorial');
                                    }}
                                    t={t}
                                    getThemeClasses={getAuthThemeClasses}
                                    triggerHapticFeedback={triggerHapticFeedback}
                                />
                            </div>
                            <div className={`absolute inset-0 transition-all duration-500 ease-in-out flex items-center justify-center ${introStage === 'tutorial' ? 'opacity-100 transform-none pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
                                <IntroTutorialView
                                    onFinish={handleIntroFinish}
                                    onBack={() => {
                                        triggerHapticFeedback(30);
                                        setIntroStage('typing');
                                    }}
                                    t={t}
                                    getThemeClasses={getAuthThemeClasses}
                                    triggerHapticFeedback={triggerHapticFeedback}
                                />
                            </div>
                        </div>
                    ) : (
                        <AuthView {...{ showAppModal, t, getThemeClasses: getAuthThemeClasses, tSubject }} />
                    )
                )}
                
                {appStatus === 'authenticated' && user && (
                     showAiSetup ? (
                        <AISetupView 
                            user={user}
                            onFinish={() => setShowAiSetup(false)}
                            onProfileUpdate={handleProfileUpdate}
                            t={t}
                            getThemeClasses={getThemeClasses}
                        />
                     ) : isAdmin && adminSettings ? (
                        adminSettings.pinProtectionEnabled && !isPinVerified ? (
                            <AdminPinView 
                                user={user}
                                onSuccess={() => setIsPinVerified(true)}
                                t={t}
                                getThemeClasses={getThemeClasses}
                            />
                        ) : (
                            <AdminView 
                                user={user} 
                                t={t} 
                                handleLogout={handleLogout} 
                                getThemeClasses={getThemeClasses} 
                                showAppModal={showAppModal} 
                                tSubject={tSubject} 
                                onUserClick={handleUserDetailClick}
                                adminSettings={adminSettings}
                                onAdminSettingsUpdate={handleAdminSettingsUpdate}
                                onPinDisableRequest={handlePinDisableRequest}
                             />
                        )
                     ) : user && !isAdmin ? (
                        <MainAppLayout {...mainAppLayoutProps} />
                    ) : <LoadingScreen getThemeClasses={getAuthThemeClasses} />
                )}
              </>
            )}
            <OfflineIndicator isOnline={isOnline} t={t} />
        </div>
    );
};

export default App;