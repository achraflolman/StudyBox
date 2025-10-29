
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI, Chat as GenAIChat, FunctionDeclaration, Tool, Type, GenerateContentResponse, FunctionCall, Part } from '@google/genai';
import { Send, Loader2, Bot, User, X, Settings, Save, History, PlusCircle, ArrowLeft, CheckCircle, Trash2 } from 'lucide-react';
import { Timestamp, db, appId, arrayUnion } from '../../services/firebase';
import type { AppUser, ModalContent, CalendarEvent, StudyPlan, ChatMessage, ChatHistory } from '../../types';
import { marked } from 'marked';

interface AIChatViewProps {
    user: AppUser;
    userId: string;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    onClose: () => void;
    addCalendarEvent: (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => Promise<string>;
    removeCalendarEvent: (title: string, date: string) => Promise<string>;
    getStudyPlans: () => Promise<string>;
    getStudyPlanDetails: (title: string) => Promise<string>;
    deleteStudyPlan: (title: string) => Promise<string>;
    userEvents: CalendarEvent[];
    userStudyPlans: StudyPlan[];
    onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
    chat: GenAIChat | null;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatHistories: ChatHistory[];
    currentChatSessionId: string | null;
    setCurrentChatSessionId: (id: string | null) => void;
    resetAIChat: () => void;
    onDeleteAllChats: () => Promise<void>;
    loadChatHistory: (history: ChatHistory) => void;
}

const AISettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: AppUser;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
}> = ({ isOpen, onClose, user, t, getThemeClasses, onProfileUpdate }) => {
  const [tempBotName, setTempBotName] = useState(user.aiBotName || 'AI Assistent');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onProfileUpdate({
        aiBotName: tempBotName.trim() || 'AI Assistent',
        aiBotAvatarUrl: null, // Always set to null
      });
      onClose();
    } catch (error) {
      console.error("Failed to save AI settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{t('customize_ai_title')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-800 text-sm font-bold mb-2">{t('bot_name_placeholder')}</label>
            <input
              type="text"
              value={tempBotName}
              onChange={(e) => setTempBotName(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
          <button onClick={handleSave} disabled={isSaving} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-32 flex items-center justify-center`}>
            {isSaving ? <Loader2 className="animate-spin" /> : t('save_avatar_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatBubble: React.FC<{
    msg: ChatMessage;
    isTyping: boolean;
    getThemeClasses: (variant: string) => string;
    user: AppUser;
}> = ({ msg, isTyping, getThemeClasses, user }) => {
    const [displayedText, setDisplayedText] = useState(isTyping ? '' : msg.text);

    useEffect(() => {
        if (isTyping) {
            let index = 0;
            const textToType = msg.text || '';
            setDisplayedText(''); // Reset before typing
            const intervalId = setInterval(() => {
                setDisplayedText(currentText => {
                    if (index >= textToType.length) {
                        clearInterval(intervalId);
                        return currentText;
                    }
                    index++;
                    // Use slice which handles unicode characters correctly
                    return textToType.slice(0, index);
                });
            }, 15); // Adjust typing speed
            return () => clearInterval(intervalId);
        } else {
            setDisplayedText(msg.text);
        }
    }, [isTyping, msg.text]);
    
    const bubbleContent = useMemo(() => {
        return { __html: marked.parse(displayedText || '', { gfm: true, breaks: true }) };
    }, [displayedText]);

    return (
        <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
                <img src="https://i.imgur.com/Lsutr8n.png" alt="Studycat" className="w-8 h-8 rounded-full"/>
            )}
            <div
                className={`prose max-w-xs p-3 rounded-xl ${msg.role === 'model' ? 'bg-gray-100' : `${getThemeClasses('bg')} text-white`}`}
                dangerouslySetInnerHTML={bubbleContent}
            ></div>
            {msg.role === 'user' && (
                user.profilePictureUrl && user.profilePictureUrl !== 'NONE' 
                    ? <img src={user.profilePictureUrl} className="w-8 h-8 rounded-full object-cover"/> 
                    : <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200"><User size={20}/></div>
            )}
        </div>
    );
};


const AIChatView: React.FC<AIChatViewProps> = ({
    user, userId, t, tSubject, getThemeClasses, showAppModal, onClose,
    addCalendarEvent, removeCalendarEvent, getStudyPlans, getStudyPlanDetails, deleteStudyPlan,
    userEvents, userStudyPlans, onProfileUpdate, chat, messages, setMessages, chatHistories,
    currentChatSessionId, setCurrentChatSessionId, resetAIChat, onDeleteAllChats, loadChatHistory
}) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const generateTitleForChat = useCallback(async (chatMessages: ChatMessage[]): Promise<string> => {
        if (!process.env.API_KEY) return t('new_chat');

        const fallbackTitle = () => {
            const firstUserMessage = chatMessages.find(m => m.role === 'user')?.text;
            if (firstUserMessage) {
                return firstUserMessage.substring(0, 35) + (firstUserMessage.length > 35 ? '...' : '');
            }
            return t('new_chat');
        };

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const conversationSnippet = chatMessages.slice(1, 4).map(m => `${m.role}: ${m.text}`).join('\n');
            const prompt = t('ai_title_generation_prompt') + conversationSnippet;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            let title = response.text.trim().replace(/["']/g, '');
            if (title.toLowerCase().startsWith('title:')) {
                title = title.substring(6).trim();
            }
            if (!title) {
                return fallbackTitle();
            }
            return title;
        } catch (error) {
            console.error("Title generation failed:", error);
            return fallbackTitle();
        }
    }, [t]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);
    
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        
        if (user.uid !== 'guest-user') {
            db.collection('aiUsageLogs').add({
                userId: user.uid,
                timestamp: Timestamp.now(),
                chatSessionId: currentChatSessionId
            }).catch(err => console.error("Failed to log AI usage:", err));
        }

        if (!chat) {
            setMessages(prev => [...prev, { role: 'model', text: t('ai_chat_welcome', { userName: user.userName.split(' ')[0], botName: user.aiBotName || 'Studycat' }) + '\n\n' + (user.languagePreference === 'nl' ? 'AI is nog niet geconfigureerd. Voeg je Gemini API key toe om deze functie te gebruiken (README stap: GEMINI_API_KEY in .env.local).' : 'AI is not configured yet. Add your Gemini API key to enable this feature (README step: set GEMINI_API_KEY in .env.local).') }]);
            return;
        }

        setIsLoading(true);

        try {
            let response: GenerateContentResponse = await chat.sendMessage({ message: userMessage.text });

            while (response.functionCalls && response.functionCalls.length > 0) {
                const functionResponseParts: Part[] = [];
                for (const funcCall of response.functionCalls) {
                    let result: any;
                    switch (funcCall.name) {
                        case 'addCalendarEvent': {
                            // FIX: Add type assertion to funcCall.args to resolve 'unknown' type errors.
                            const { title, date, time, subject, type } = funcCall.args as { title: string; date: string; time: string; subject: string; type: CalendarEvent['type']; };
                            const start = new Date(`${date}T${time}`);
                            const end = new Date(start.getTime() + 60 * 60 * 1000);
                            result = await addCalendarEvent({ title, start: Timestamp.fromDate(start), end: Timestamp.fromDate(end), subject, type });
                            break;
                        }
                        case 'removeCalendarEvent':
                            // FIX: Add type assertion to funcCall.args properties to resolve 'unknown' type errors.
                            result = await removeCalendarEvent(funcCall.args.title as string, funcCall.args.date as string);
                            break;
                        case 'getCalendarEvents': {
                            // FIX: Add type assertion to funcCall.args.date to resolve 'unknown' type error.
                            const date = new Date((funcCall.args.date as string) + "T00:00:00");
                            const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59);
                            const events = userEvents
                                .filter(e => e.start.toDate() >= date && e.start.toDate() <= endOfDay)
                                .sort((a, b) => a.start.toMillis() - b.start.toMillis());

                            if (events.length > 0) {
                                result = `Here are the events for ${funcCall.args.date}:\n` + 
                                         events.map(e => `- ${e.start.toDate().toLocaleTimeString(user.languagePreference || 'nl-NL', {hour: '2-digit', minute:'2-digit'})}: ${e.title} (${tSubject(e.subject)})`).join('\n');
                            } else {
                                result = `There are no events scheduled for ${funcCall.args.date}.`;
                            }
                            break;
                        }
                        case 'getStudyPlans':
                            result = await getStudyPlans();
                            break;
                        case 'getStudyPlanDetails':
                            // FIX: Add type assertion to funcCall.args.title to resolve 'unknown' type error.
                            result = await getStudyPlanDetails(funcCall.args.title as string);
                            break;
                        case 'deleteStudyPlan':
                            // FIX: Add type assertion to funcCall.args.title to resolve 'unknown' type error.
                            result = await deleteStudyPlan(funcCall.args.title as string);
                            break;
                        default: result = { error: "Unknown function" };
                    }
                     functionResponseParts.push({
                        functionResponse: {
                            name: funcCall.name,
                            response: { result: result },
                        },
                    });
                }
                response = await chat.sendMessage({ message: functionResponseParts });
            }
            
            setIsLoading(false);
            const modelMessage: ChatMessage = { role: 'model', text: response.text || "Sorry, I received an empty response." };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            setIsLoading(false);
            setMessages(prev => [...prev, { role: 'model', text: `Sorry, something went wrong. Error: ${(error as Error).message}` }]);
        }
    };
    
    useEffect(() => {
        const saveHistory = async (currentMessages: ChatMessage[]) => {
            if (currentChatSessionId) {
                const historyItem = chatHistories.find(h => h.id === currentChatSessionId);
                const shouldUpdateTitle = historyItem && historyItem.title === t('new_chat') && currentMessages.length > 2;
                const titleUpdate = shouldUpdateTitle ? { title: await generateTitleForChat(currentMessages) } : {};

                await db.doc(`users/${userId}/chatHistories/${currentChatSessionId}`).update({
                    messages: currentMessages,
                    updatedAt: Timestamp.now(),
                    ...titleUpdate
                });
            } else {
                const title = currentMessages.length > 2 ? await generateTitleForChat(currentMessages) : t('new_chat');
                const newDocRef = await db.collection(`users/${userId}/chatHistories`).add({
                    userId, title, messages: currentMessages, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
                });
                setCurrentChatSessionId(newDocRef.id);
            }
        };

        if (messages.length > 1 && messages[messages.length - 1].role === 'model') {
            saveHistory(messages);
        }
    }, [messages, currentChatSessionId, userId, generateTitleForChat, t, setCurrentChatSessionId, chatHistories]);
    
    const handleHistorySelect = (history: ChatHistory) => {
        loadChatHistory(history);
        setIsHistoryOpen(false);
    };

    const handleNewChat = () => {
        resetAIChat();
        setIsHistoryOpen(false);
    };

    const handleDeleteChat = (chatId: string) => {
        showAppModal({
            text: t('confirm_delete_chat'),
            confirmAction: async () => {
                await db.doc(`users/${userId}/chatHistories/${chatId}`).delete();
                if (chatId === currentChatSessionId) {
                    handleNewChat();
                }
                showAppModal({ text: t('chat_deleted_success') });
            },
            cancelAction: () => {}
        });
    };

    const handleDeleteAllClick = () => {
        showAppModal({
            text: t('confirm_delete_all_chats'),
            confirmAction: () => {
                onDeleteAllChats();
                setIsHistoryOpen(false);
            },
            cancelAction: () => {}
        });
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] sm:w-96 h-[70vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-fade-in-up">
            <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} {...{ user, t, getThemeClasses, onProfileUpdate }}/>
            <header className={`p-4 rounded-t-2xl flex justify-between items-center text-white ${getThemeClasses('bg')}`}>
                <div className="flex items-center gap-3">
                    <Bot className="w-6 h-6"/>
                    <h3 className="font-bold text-lg">{user.aiBotName || 'AI Assistant'}</h3>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="p-2 rounded-full hover:bg-white/20"><History size={20}/></button>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-white/20"><Settings size={20}/></button>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20"><X size={20}/></button>
                </div>
            </header>

            {isHistoryOpen && (
                <div className="absolute inset-0 bg-white z-10 flex flex-col p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-lg">{t('chat_history_title')}</h4>
                        <button onClick={() => setIsHistoryOpen(false)} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft/></button>
                    </div>
                     <div className="flex gap-2 mb-4">
                        <button onClick={handleNewChat} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg ${getThemeClasses('bg')}`}>
                            <PlusCircle size={18}/> {t('new_chat')}
                        </button>
                        <button onClick={handleDeleteAllClick} title={t('delete_all_button')} className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 flex-shrink-0">
                            <Trash2 size={18}/>
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-2">
                        {chatHistories.map(h => (
                            <div key={h.id} className={`p-3 rounded-lg flex justify-between items-center ${currentChatSessionId === h.id ? getThemeClasses('bg-light') : 'bg-gray-100 hover:bg-gray-200'}`}>
                                <div onClick={() => handleHistorySelect(h)} className="cursor-pointer flex-grow truncate pr-2">
                                    <p className="font-semibold truncate">{h.title}</p>
                                    <p className="text-xs text-gray-500">{(h.updatedAt as any).toDate().toLocaleString()}</p>
                                </div>
                                <button onClick={() => handleDeleteChat(h.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full flex-shrink-0">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                   <ChatBubble 
                        key={index}
                        msg={msg}
                        isTyping={msg.role === 'model' && index === messages.length - 1 && !isLoading}
                        getThemeClasses={getThemeClasses}
                        user={user}
                   />
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full flex-shrink-0 text-white ${getThemeClasses('bg')}`}><Bot size={16}/></div>
                        <div className="p-3 rounded-xl bg-gray-100"><Loader2 className="animate-spin" /></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t('ai_chat_placeholder', { botName: user.aiBotName || 'AI' })} className="flex-grow p-2 border rounded-lg"/>
                    <button type="submit" disabled={isLoading} className={`p-3 rounded-lg text-white ${getThemeClasses('bg')} disabled:opacity-50`}>
                        {isLoading ? <Loader2 className="animate-spin"/> : <Send/>}
                    </button>
                </form>
            </div>
             <style>{`.animate-fade-in-up { animation: fadeInUp 0.3s ease-out; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; translateY(0); } }`}</style>
        </div>
    );
};

export default AIChatView;
