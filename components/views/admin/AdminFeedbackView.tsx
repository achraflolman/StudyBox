

import React, { useState, useEffect } from 'react';
import { db, Timestamp, arrayUnion } from '../../../services/firebase';
import type { Feedback, FeedbackReply, AppUser, ModalContent } from '../../../types';
import { Loader2, Send, User, Shield, Trash2 } from 'lucide-react';

interface AdminFeedbackViewProps {
    t: (key: string, replacements?: any) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    user: AppUser;
}

const AdminFeedbackView: React.FC<AdminFeedbackViewProps> = ({ t, getThemeClasses, showAppModal, user }) => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    useEffect(() => {
        const unsubscribe = db.collection('feedback').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setFeedbacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback)));
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFeedback || !replyText.trim()) return;

        setIsReplying(true);
        const newReply: FeedbackReply = {
            text: replyText,
            repliedAt: Timestamp.now(),
            repliedBy: user.userName,
            isAdminReply: true,
        };
        
        try {
            await db.doc(`feedback/${selectedFeedback.id}`).update({
                status: 'replied',
                replies: arrayUnion(newReply),
            });
            setReplyText('');
            showAppModal({ text: t('reply_sent_success') });
        } catch (error) {
            showAppModal({ text: t('error_reply_failed') });
        } finally {
            setIsReplying(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[70vh]">
            <div className="md:col-span-1 bg-white p-4 rounded-lg shadow-md overflow-y-auto h-[40vh] md:h-full">
                <h3 className="text-lg font-bold mb-4 sticky top-0 bg-white py-2">Feedback Inbox</h3>
                {isLoading ? <Loader2 className="animate-spin" /> :
                    <ul className="space-y-2">
                        {feedbacks.map(f => (
                            <li key={f.id} onClick={() => setSelectedFeedback(f)} className={`p-3 rounded-lg cursor-pointer border-l-4 ${selectedFeedback?.id === f.id ? getThemeClasses('border') + ' bg-gray-100' : 'border-transparent hover:bg-gray-50'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-grow">
                                        <p className="font-semibold truncate">{f.subject}</p>
                                        <p className="text-sm text-gray-600 truncate">{f.userName}</p>
                                        <p className="text-xs text-gray-400">{f.createdAt.toDate().toLocaleDateString()}</p>
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.status === 'replied' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{t(`status_${f.status}`)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                }
            </div>
            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md flex flex-col h-auto md:h-full">
                {selectedFeedback ? (
                    <>
                        <div className="flex-grow overflow-y-auto mb-4 pr-2">
                            <h3 className="font-bold text-xl">{selectedFeedback.subject}</h3>
                            <p className="text-sm text-gray-500 mb-4">From: {selectedFeedback.userName} ({selectedFeedback.userEmail})</p>
                            
                             <div className="space-y-4">
                                <div className="flex items-start gap-2.5">
                                    <div className="p-2 bg-gray-200 rounded-full"><User size={16} /></div>
                                    <div className="flex flex-col w-full max-w-lg leading-1.5 p-3 border-gray-200 bg-gray-100 rounded-e-xl rounded-es-xl">
                                        <p className="text-sm font-normal text-gray-900">{selectedFeedback.message}</p>
                                    </div>
                                </div>
                                {selectedFeedback.replies?.map((reply, index) => (
                                    <div key={index} className={`flex items-start gap-2.5 ${reply.isAdminReply ? 'justify-end' : ''}`}>
                                        {reply.isAdminReply && <div className={`flex flex-col w-full max-w-lg leading-1.5 p-3 rounded-s-xl rounded-ee-xl ${getThemeClasses('bg-light')}`}><p className="text-sm font-normal text-gray-900">{reply.text}</p></div>}
                                        <div className={`p-2 rounded-full ${reply.isAdminReply ? getThemeClasses('bg') : 'bg-gray-200'}`}>{reply.isAdminReply ? <Shield size={16} className="text-white"/> : <User size={16}/>}</div>
                                        {!reply.isAdminReply && <div className="flex flex-col w-full max-w-lg leading-1.5 p-3 bg-gray-100 rounded-e-xl rounded-es-xl"><p className="text-sm font-normal text-gray-900">{reply.text}</p></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <form onSubmit={handleReply} className="mt-auto pt-4 border-t">
                            <h4 className="font-semibold mb-2">{t('reply_to_feedback')}</h4>
                            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} placeholder={t('your_reply_placeholder')} className="w-full p-2 border rounded-lg" required />
                            <button type="submit" disabled={isReplying} className={`w-full mt-2 flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                                {isReplying ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                                {t('send_reply_button')}
                            </button>
                        </form>
                    </>
                ) : <p className="text-center text-gray-500 my-auto">{t('admin_select_feedback')}</p>}
            </div>
        </div>
    );
};

export default AdminFeedbackView;
