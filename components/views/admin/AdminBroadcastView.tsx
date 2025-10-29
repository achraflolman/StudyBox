

import React, { useState, useEffect } from 'react';
import { db, Timestamp } from '../../../services/firebase';
import type { BroadcastData, ModalContent } from '../../../types';
import { Send, Loader2, Trash2 } from 'lucide-react';

interface AdminBroadcastViewProps {
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
}

const AdminBroadcastView: React.FC<AdminBroadcastViewProps> = ({ t, getThemeClasses, showAppModal }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [pastBroadcasts, setPastBroadcasts] = useState<BroadcastData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = db.collection('broadcasts').orderBy('createdAt', 'desc').limit(20)
            .onSnapshot(snapshot => {
                setPastBroadcasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BroadcastData)));
                setIsLoading(false);
            });
        return () => unsubscribe();
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            showAppModal({ text: t('error_broadcast_empty') });
            return;
        }
        setIsSending(true);
        try {
            await db.collection('broadcasts').add({
                title,
                message,
                sender: 'Admin',
                createdAt: Timestamp.now(),
            });
            showAppModal({ text: t('broadcast_success') });
            setTitle('');
            setMessage('');
        } catch (error) {
            showAppModal({ text: t('error_broadcast_failed') });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleDelete = (id: string) => {
        showAppModal({
            text: 'Are you sure you want to delete this broadcast?',
            confirmAction: async () => {
                await db.doc(`broadcasts/${id}`).delete();
            },
            cancelAction: () => {},
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-4">{t('send_broadcast')}</h3>
                <form onSubmit={handleSend} className="space-y-4">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('broadcast_title_placeholder')} className="w-full p-2 border rounded-lg" required />
                    <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('broadcast_message_placeholder')} rows={6} className="w-full p-2 border rounded-lg" required />
                    <button type="submit" disabled={isSending} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                        {isSending ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                        {isSending ? t('sending') : t('send_message_button')}
                    </button>
                </form>
            </div>
            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-4">{t('past_broadcasts')}</h3>
                {isLoading ? <Loader2 className="animate-spin" /> :
                 pastBroadcasts.length === 0 ? <p className="text-gray-500 italic">{t('no_past_broadcasts')}</p> :
                 <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {pastBroadcasts.map(b => (
                        <li key={b.id} className="p-3 bg-gray-50 rounded-lg border">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{b.title}</p>
                                    <p className="text-xs text-gray-500">{b.createdAt.toDate().toLocaleString()}</p>
                                </div>
                                <button onClick={() => handleDelete(b.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><Trash2 size={14}/></button>
                            </div>
                            <p className="text-sm mt-2 whitespace-pre-wrap">{b.message}</p>
                        </li>
                    ))}
                 </ul>
                }
            </div>
        </div>
    );
};

export default AdminBroadcastView;
