import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, storage } from '../../services/firebase';
import type { AppUser, FileData, ModalContent, AdminSettings } from '../../types';
import { LogOut, Send, Users, RefreshCw, UserCheck, UserX, Search, MessageCircle, Settings, BarChart3, Menu, Trash2 } from 'lucide-react';
import AdminSettingsView from './admin/AdminSettingsView';
import AdminBroadcastView from './admin/AdminBroadcastView';
import AdminFeedbackView from './admin/AdminFeedbackView';
import AdminAnalyticsView from './admin/AdminAnalyticsView';

interface AdminViewProps {
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    handleLogout: () => void;
    showAppModal: (content: ModalContent) => void;
    onUserClick: (user: AppUser) => void;
    adminSettings: AdminSettings;
    onAdminSettingsUpdate: (updatedData: Partial<AdminSettings>) => Promise<void>;
    onPinDisableRequest: () => void;
}

const AdminView: React.FC<AdminViewProps> = ({ user, t, tSubject, getThemeClasses, handleLogout, showAppModal, onUserClick, adminSettings, onAdminSettingsUpdate, onPinDisableRequest }) => {
    const [activeTab, setActiveTab] = useState('users');
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const usersSnapshot = await db.collection('users').get();
            const users = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser));
            const adminEmails = ['af@studybox.com', 'ma@studybox.com'];
            setAllUsers(users.filter(u => !adminEmails.includes(u.email.toLowerCase())));
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchData();
        }
    }, [activeTab, fetchData]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return allUsers;
        return allUsers.filter(u => 
            u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allUsers, searchQuery]);

    const handleUserStatusToggle = (targetUser: AppUser) => {
        const action = targetUser.disabled ? 'enable' : 'disable';
        showAppModal({
            text: t(action === 'enable' ? 'confirm_enable_user' : 'confirm_disable_user', { name: targetUser.userName }),
            confirmAction: async () => {
                try {
                    await db.doc(`users/${targetUser.uid}`).update({ disabled: !targetUser.disabled });
                    showAppModal({ text: t('user_status_updated') });
                    fetchData(); // Refresh data
                } catch (error) {
                    showAppModal({ text: t('error_user_status_update') });
                }
            },
            cancelAction: () => {}
        });
    };
    
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
    
    const handleUserDelete = (targetUser: AppUser) => {
        showAppModal({
            text: t('confirm_delete_user', { name: targetUser.userName }),
            confirmAction: async () => {
                showAppModal({ text: t('deleting_user_progress', { name: targetUser.userName }), confirmAction: undefined, cancelAction: undefined });
                try {
                    await cleanupUserData(targetUser.uid);
                    await db.doc(`users/${targetUser.uid}`).delete();
                    showAppModal({ text: t('user_deleted_success', { name: targetUser.userName }) });
                    fetchData(); // Refresh list
                } catch (error) {
                    showAppModal({ text: t('user_deleted_fail', { name: targetUser.userName }) + `: ${(error as Error).message}`});
                }
            },
            cancelAction: () => {}
        });
    };

    const renderUsers = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-full max-w-xs">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('admin_search_placeholder')} className="w-full p-2 pl-8 border rounded-lg"/>
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                <button onClick={fetchData} className="p-2 bg-gray-200 rounded-lg"><RefreshCw className={isLoading ? 'animate-spin' : ''} /></button>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('last_login')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map(u => (
                        <tr key={u.uid} onClick={() => onUserClick(u)} className="hover:bg-gray-50 cursor-pointer">
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="ml-4"><div className="text-sm font-medium text-gray-900">{u.userName}</div><div className="text-sm text-gray-500">{u.email}</div></div></div></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.lastLoginDate?.toDate().toLocaleDateString() || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{u.disabled ? t('disabled') : t('active')}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleUserStatusToggle(u)} className={`p-2 rounded-full ${u.disabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{u.disabled ? <UserCheck size={16}/> : <UserX size={16}/>}</button>
                                <button onClick={() => handleUserDelete(u)} className="p-2 ml-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                 </table>
            </div>
        </div>
    );
    
    const tabs = [
        { id: 'users', label: t('users'), icon: Users },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'broadcasts', label: t('broadcasts'), icon: Send },
        { id: 'feedback', label: t('admin_feedback_dashboard'), icon: MessageCircle },
        { id: 'settings', label: t('settings'), icon: Settings }
    ];

    const renderContent = () => {
        switch(activeTab) {
            case 'analytics': return <AdminAnalyticsView {...{t, getThemeClasses, showAppModal}} />;
            case 'users': return renderUsers();
            case 'broadcasts': return <AdminBroadcastView {...{t, getThemeClasses, showAppModal}} />;
            case 'feedback': return <AdminFeedbackView {...{t, getThemeClasses, showAppModal, user}} />;
            case 'settings': return <AdminSettingsView t={t} getThemeClasses={getThemeClasses} settings={adminSettings} onUpdate={onAdminSettingsUpdate} onPinDisableRequest={onPinDisableRequest} />;
            default: return null;
        }
    };

    return (
        <div className="relative flex min-h-screen bg-gray-50">
            {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
            
            <nav className={`fixed inset-y-0 left-0 w-60 bg-white shadow-lg p-4 flex flex-col z-40 transform transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="mb-8">
                    <h1 className={`text-2xl font-bold ${getThemeClasses('text-logo')}`}>StudyBox Admin</h1>
                    <p className="text-sm text-gray-500">Welcome, {user.userName}</p>
                </div>
                <div className="flex-grow space-y-2">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => { setActiveTab(tab.id); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-lg font-semibold text-left transition-colors duration-200 ${activeTab === tab.id ? `${getThemeClasses('bg')} text-white shadow` : `text-gray-600 hover:${getThemeClasses('bg-light')} hover:${getThemeClasses('text')}`}`}
                        >
                            <tab.icon size={20}/> {tab.label}
                        </button>
                    ))}
                </div>
                <div className="mt-auto">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 py-2.5 px-4 rounded-lg font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors duration-200">
                        <LogOut size={20}/> {t('logout_button')}
                    </button>
                </div>
            </nav>
            
            <div className="flex-1 flex flex-col md:pl-60">
                <header className="md:hidden p-2 bg-white/80 backdrop-blur-lg sticky top-0 z-20 border-b flex justify-between items-center">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2">
                        <Menu />
                    </button>
                    <h1 className={`text-xl font-bold ${getThemeClasses('text-logo')}`}>{tabs.find(t => t.id === activeTab)?.label}</h1>
                    <div className="w-9 h-9"></div> {/* for alignment */}
                </header>
                <main className="flex-1 p-6 overflow-y-auto">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

export default AdminView;