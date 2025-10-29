
import React, { useState } from 'react';
import { db, Timestamp } from '../../../services/firebase';
import type { AppUser, Note } from '../../../types';
import { Loader2, Share2 } from 'lucide-react';

interface ShareNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note;
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    showAppModal: (content: { text: string }) => void;
    getThemeClasses: (variant: string) => string;
}

const ShareNoteModal: React.FC<ShareNoteModalProps> = ({ isOpen, onClose, note, user, t, getThemeClasses, showAppModal }) => {
    const [email, setEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            showAppModal({ text: t('error_share_invalid_email') });
            return;
        }
        if (email.toLowerCase() === user.email.toLowerCase()) {
            showAppModal({ text: t('error_cannot_share_with_self') });
            return;
        }

        setIsSharing(true);
        try {
            const usersRef = db.collection(`users`);
            const userQuery = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();

            if (userQuery.empty) {
                showAppModal({ text: t('error_user_not_found', { email }) });
                setIsSharing(false);
                return;
            }

            const noteDataToShare = {
                title: note.title,
                content: note.content,
                subject: note.subject,
                noteType: note.noteType,
                background: note.background,
                sharerId: user.uid,
                sharerName: user.userName,
                recipientEmail: email.toLowerCase(),
                sharedAt: Timestamp.now(),
            };

            await db.collection('sharedNotes').add(noteDataToShare);
            
            showAppModal({ text: t('share_note_success', { email }) });
            onClose();

        } catch (error) {
            console.error("Note sharing failed:", error);
            showAppModal({ text: t('error_share_note_failed') });
        } finally {
            setIsSharing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2 truncate">{t('share_note_title', { title: note.title })}</h3>
                <form onSubmit={handleShare}>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        {t('share_with_email')}
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('placeholder_email')}
                        className={`w-full p-2 border rounded-lg border-gray-300`}
                        required
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                        <button type="submit" disabled={isSharing} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 transition-colors active:scale-95 w-32 flex items-center justify-center`}>
                            {isSharing ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Share2 size={16} className="mr-2"/>{t('share_button')}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShareNoteModal;
