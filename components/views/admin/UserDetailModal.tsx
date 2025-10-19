import React, { useState, useEffect } from 'react';
import { auth, db, Timestamp, increment } from '../../../services/firebase';
import type { AppUser, ModalContent } from '../../../types';
import { User, Palette, Mail, X, KeyRound, School, BookOpen, Type, Send, Loader2, Star, Flame } from 'lucide-react';

const DirectMessageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    user: AppUser;
    // FIX: Update the type for the `t` function to accept replacement arguments.
    t: (key: string, replacements?: any) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
}> = ({ isOpen, onClose, user, t, getThemeClasses, showAppModal }) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        try {
            await db.collection(`users/${user.uid}/notifications`).add({
                title: "Bericht van een beheerder",
                text: message,
                type: 'direct_message',
                read: false,
                createdAt: Timestamp.now(),
            });
            showAppModal({ text: 'Bericht succesvol verzonden.'});
            onClose();
        } catch (error) {
            console.error("Failed to send direct message", error);
            showAppModal({ text: 'Verzenden van bericht mislukt.' });
        } finally {
            setIsSending(false);
            setMessage('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{t('chat_with_user', { name: user.userName })}</h3>
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    className="w-full p-2 border rounded-lg"
                    placeholder={t('type_a_message')}
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 font-semibold">{t('cancel_button')}</button>
                    <button onClick={handleSend} disabled={isSending} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} w-32 flex justify-center`}>
                        {isSending ? <Loader2 className="animate-spin" /> : t('send_message_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
  t: (key: string, replacements?: any) => string;
  tSubject: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
}

const DetailItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p className="text-xs text-gray-500 font-semibold uppercase">{label}</p>
        {children ? children : <p className="text-gray-800">{value || '-'}</p>}
    </div>
);

const UserDetailModal: React.FC<UserDetailModalProps> = ({ isOpen, onClose, user: userProp, t, tSubject, getThemeClasses, showAppModal }) => {
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [starsToAdd, setStarsToAdd] = useState('');
    const [isAddingStars, setIsAddingStars] = useState(false);
    const [currentUser, setCurrentUser] = useState(userProp);

    useEffect(() => {
        setCurrentUser(userProp);
    }, [userProp]);

    if (!isOpen || !currentUser) return null;
    const user = currentUser;

    const handlePasswordReset = () => {
        if (!user.email) return;
        auth.sendPasswordResetEmail(user.email)
            .then(() => {
                showAppModal({ text: t('password_reset_sent', { email: user.email }) });
            })
            .catch(error => {
                showAppModal({ text: t('error_password_reset_failed') + `: ${error.message}` });
            });
    };
    
    const handleAddStars = async () => {
        const stars = parseInt(starsToAdd, 10);
        if (isNaN(stars) || stars === 0) return;
        setIsAddingStars(true);
        try {
            await db.doc(`users/${user.uid}`).update({
                totalStars: increment(stars)
            });
            setCurrentUser(prevUser => prevUser ? { ...prevUser, totalStars: (prevUser.totalStars || 0) + stars } : null);
            showAppModal({ text: t('stars_added_success', { count: stars }) });
            setStarsToAdd('');
        } catch (e) {
            showAppModal({ text: t('stars_added_fail') });
        } finally {
            setIsAddingStars(false);
        }
    };

    return (
        <>
            <DirectMessageModal 
                isOpen={isMessageModalOpen}
                onClose={() => setIsMessageModalOpen(false)}
                user={user}
                t={t}
                getThemeClasses={getThemeClasses}
                showAppModal={showAppModal}
            />
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                            {user.profilePictureUrl && user.profilePictureUrl !== 'NONE' ? (
                                <img src={user.profilePictureUrl} alt={user.userName} className="w-16 h-16 rounded-full object-cover border-2 border-purple-200" />
                            ) : (
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-bold ${getThemeClasses('bg')}`}>{user.userName.charAt(0).toUpperCase()}</div>
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{user.userName}</h3>
                                <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                        {/* Account Details */}
                        <div className="p-4 rounded-lg bg-gray-50">
                            <h4 className="font-bold text-purple-700 flex items-center gap-2 mb-3"><User size={18}/> Account Details</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <DetailItem label={t('school_name')} value={user.schoolName} />
                                <DetailItem label={t('class_name')} value={user.className} />
                                <DetailItem label={t('education_level')} value={tSubject(user.educationLevel)} />
                            </div>
                        </div>

                         {/* User Stats */}
                        <div className="p-4 rounded-lg bg-gray-50">
                            <h4 className="font-bold text-purple-700 flex items-center gap-2 mb-3"><User size={18}/> {t('user_stats')}</h4>
                            <div className="grid grid-cols-2 gap-4">
                                 <DetailItem label={t('streak_days', {count: ''}).trim()}>
                                    <div className="flex items-center gap-1 font-semibold text-orange-600"><Flame size={16}/> {user.streakCount ?? 0}</div>
                                </DetailItem>
                                 <DetailItem label={t('total_stars')}>
                                     <div className="flex items-center gap-1 font-semibold text-yellow-600"><Star size={16} className="fill-current"/> {user.totalStars ?? 0}</div>
                                </DetailItem>
                            </div>
                        </div>

                        {/* Preferences */}
                        <div className="p-4 rounded-lg bg-gray-50">
                            <h4 className="font-bold text-purple-700 flex items-center gap-2 mb-3"><Palette size={18}/> Preferences</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <DetailItem label={t('language_preference')} value={t(user.languagePreference)} />
                                <DetailItem label={t('font_preference')} value={user.fontPreference} />
                                <DetailItem label={t('choose_theme')} value={user.themePreference} />
                            </div>
                        </div>

                        {/* Subjects */}
                        <div className="p-4 rounded-lg bg-gray-50">
                            <h4 className="font-bold text-purple-700 flex items-center gap-2 mb-3"><BookOpen size={18}/> Selected Subjects</h4>
                            <div className="flex flex-wrap gap-2">
                                {(user.selectedSubjects || []).map(s => <span key={s} className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{tSubject(s)}</span>)}
                            </div>
                             <h4 className="font-bold text-purple-700 flex items-center gap-2 mt-4 mb-3"><Type size={18}/> Custom Subjects</h4>
                             <div className="flex flex-wrap gap-2">
                                {(user.customSubjects || []).length > 0 ? user.customSubjects?.map(s => <span key={s} className="bg-gray-200 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{tSubject(s)}</span>) : <p className="text-sm text-gray-500">-</p>}
                            </div>
                        </div>

                        {/* Admin Actions */}
                         <div className="p-4 rounded-lg border-2 border-orange-300 bg-orange-50">
                            <h4 className="font-bold text-orange-700 flex items-center gap-2 mb-3"><KeyRound size={18}/> Admin Actions</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('add_stars')}</label>
                                    <div className="flex gap-2">
                                        <input type="number" placeholder={t('stars_to_add')} value={starsToAdd} onChange={e => setStarsToAdd(e.target.value)} className="flex-grow p-2 border rounded-lg" />
                                        <button onClick={handleAddStars} disabled={isAddingStars} className={`py-2 px-4 rounded-lg text-white font-bold bg-yellow-500 hover:bg-yellow-600 w-32 flex items-center justify-center`}>
                                            {isAddingStars ? <Loader2 className="animate-spin" /> : t('add_button')}
                                        </button>
                                    </div>
                                </div>
                                <button onClick={handlePasswordReset} className="w-full mt-2 py-2 px-4 rounded-lg text-white font-bold bg-orange-500 hover:bg-orange-600 transition-transform active:scale-95 flex items-center justify-center gap-2">
                                    <Mail size={16}/> {t('send_reset_email_button')}
                                </button>
                                 <button onClick={() => setIsMessageModalOpen(true)} className="w-full py-2 px-4 rounded-lg text-white font-bold bg-blue-500 hover:bg-blue-600 transition-transform active:scale-95 flex items-center justify-center gap-2">
                                    <Send size={16}/> {t('send_message')}
                                </button>
                                <p className="text-xs text-orange-800 text-center">Let op: Om veiligheidsredenen kan een admin geen wachtwoord direct instellen, alleen een reset-link sturen.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default UserDetailModal;