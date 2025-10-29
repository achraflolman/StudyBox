

import React, { useState, useEffect, useMemo } from 'react';
import type { AppUser, ModalContent } from '../../types';
import { auth } from '../../services/firebase';
import { allSubjects, availableThemeColors, educationLevels, availableFonts } from '../../constants';
// FIX: Add missing lucide-react icons
import { User, Palette, Info, HelpCircle, Shield, GripVertical, Plus, Bell, Type, AlertTriangle, LifeBuoy, Trash2, Bot, Vibrate, BookOpen, Languages, X } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SettingsViewProps {
  user: AppUser;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  getThemeClasses: (variant: string) => string;
  language: 'nl' | 'en';
  setLanguage: (lang: 'nl' | 'en') => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  showAppModal: (content: ModalContent) => void;
  tSubject: (key: string) => string;
  setCurrentView: (view: string) => void;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
  onDeleteAccountRequest: () => void;
  onCleanupAccountRequest: () => void;
  onClearCalendarRequest: () => void;
  setIsAvatarModalOpen: (isOpen: boolean) => void;
}

const SortableItem: React.FC<{ id: string, t: any }> = React.memo(({ id, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 0.2s ease',
        zIndex: isDragging ? 10 : 'auto',
    };

    const widgetNames: { [key: string]: string } = {
        agenda: t('widget_agenda'),
        files: t('widget_files'),
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`p-3 bg-white rounded-lg shadow-sm flex items-center justify-between touch-none`}>
            <span className="font-semibold">{widgetNames[id] || id}</span>
            <GripVertical className="text-gray-400 cursor-grab" />
        </div>
    );
});

const SettingSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    getThemeClasses: (variant: string) => string;
    children: React.ReactNode;
}> = ({ title, children, icon, getThemeClasses }) => (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg animate-fade-in">
        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${getThemeClasses('text-strong')}`}>
            {icon}
            {title}
        </h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);


const SettingsView: React.FC<SettingsViewProps> = ({ user, t, getThemeClasses, language, setLanguage, themeColor, setThemeColor, fontFamily, setFontFamily, showAppModal, tSubject, setCurrentView, onProfileUpdate, onDeleteAccountRequest, onCleanupAccountRequest, onClearCalendarRequest, setIsAvatarModalOpen }) => {
  const [activeTab, setActiveTab] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
      userName: user.userName || '',
      schoolName: user.schoolName || '',
      className: user.className || '',
      educationLevel: user.educationLevel || '',
      aiBotName: user.aiBotName || '',
  });

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(user.selectedSubjects || []);
  const [homeLayout, setHomeLayout] = useState<string[]>(user.homeLayout || ['agenda', 'files']);
  const [customSubjects, setCustomSubjects] = useState<string[]>(user.customSubjects || []);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.notificationsEnabled ?? true);
  const [hapticsEnabled, setHapticsEnabled] = useState(user.hapticsEnabled ?? true);

  useEffect(() => {
    setFormData({
      userName: user.userName || '',
      schoolName: user.schoolName || '',
      className: user.className || '',
      educationLevel: user.educationLevel || '',
      aiBotName: user.aiBotName || '',
    });
    setSelectedSubjects(user.selectedSubjects || []);
    setHomeLayout(user.homeLayout || ['agenda', 'files']);
    setCustomSubjects(user.customSubjects || []);
    setNotificationsEnabled(user.notificationsEnabled ?? true);
    setHapticsEnabled(user.hapticsEnabled ?? true);
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const allDisplaySubjects = useMemo(() => [...allSubjects, ...customSubjects], [customSubjects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = homeLayout.indexOf(String(active.id));
        const newIndex = homeLayout.indexOf(String(over.id));
        const newOrder = arrayMove(homeLayout, oldIndex, newIndex);
        setHomeLayout(newOrder); 
        onProfileUpdate({ homeLayout: newOrder });
    }
  };

  const colorClasses: {[key: string]: string} = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
    amber: 'bg-amber-500',
  };

  const handleProfileSave = () => {
    const originalSubjects = user.selectedSubjects || [];
    const subjectsToRemove = originalSubjects.filter(s => !selectedSubjects.includes(s));

    const performSave = async () => {
        setIsSaving(true);
        await onProfileUpdate({
            ...formData,
            aiBotName: formData.aiBotName.trim() || 'Studycat',
            selectedSubjects,
            customSubjects,
        });
        showAppModal({ text: t('success_settings_saved') });
        setIsSaving(false);
    };

    if (subjectsToRemove.length > 0 && user.uid !== 'guest-user') {
        showAppModal({
            text: t('confirm_remove_subjects_warning'),
            confirmAction: performSave,
            cancelAction: () => {}
        });
    } else {
        performSave();
    }
  };

  const handlePasswordReset = async () => {
    if(!auth.currentUser || user.uid === 'guest-user') {
        showAppModal({ text: t('error_guest_action_not_allowed')});
        return;
    }
    try {
        await auth.sendPasswordResetEmail(auth.currentUser.email!);
        showAppModal({text: t('password_reset_sent', {email: auth.currentUser.email!})});
    } catch (error) {
        showAppModal({text: t('error_password_reset_failed')});
    }
  };
  
  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects(prev => prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]);
  };
  
  const handleThemeChange = (color: string) => {
    setThemeColor(color);
    onProfileUpdate({ themePreference: color });
  }

  const handleLangChange = (lang: 'nl' | 'en') => {
    setLanguage(lang);
    onProfileUpdate({ languagePreference: lang });
  }
  
  const handleFontChange = (font: string) => {
    setFontFamily(font);
    onProfileUpdate({ fontPreference: font });
  };
  
  const handleAddCustomSubject = () => {
    const newSubjectKey = customSubjectInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!newSubjectKey) {
        showAppModal({ text: t('error_subject_empty') });
        return;
    }
    if (allDisplaySubjects.includes(newSubjectKey)) {
        showAppModal({ text: t('error_subject_exists') });
        return;
    }
    const newCustomSubjects = [...customSubjects, newSubjectKey];
    setCustomSubjects(newCustomSubjects);
    setSelectedSubjects(prev => [...prev, newSubjectKey]);
    setCustomSubjectInput('');
  };

  const handleRemoveCustomSubject = (subjectToRemove: string) => {
    setCustomSubjects(prev => prev.filter(s => s !== subjectToRemove));
    setSelectedSubjects(prev => prev.filter(s => s !== subjectToRemove));
  }
  
  const handleNotificationToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    onProfileUpdate({ notificationsEnabled: enabled });
  }

  const handleHapticsToggle = (enabled: boolean) => {
    setHapticsEnabled(enabled);
    onProfileUpdate({ hapticsEnabled: enabled });
  }

  const tabs = [
    { id: 'account', label: t('settings_account_section'), icon: <User />},
    { id: 'appearance', label: t('settings_appearance_section'), icon: <Palette />},
    { id: 'privacy', label: t('settings_privacy_section'), icon: <Shield />},
    { id: 'info', label: t('settings_help_info_section'), icon: <Info />},
  ];

  return (
    <div className="space-y-6">
        <h2 className={`text-3xl font-bold text-center ${getThemeClasses('text-strong')}`}>{t('settings_title')}</h2>

        <div className="hidden sm:block border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap pb-3 px-1 border-b-2 font-semibold text-sm sm:text-base flex items-center gap-2 ${activeTab === tab.id
                                ? `${getThemeClasses('border')} ${getThemeClasses('text')}`
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </nav>
        </div>
         <div className="sm:hidden grid grid-cols-2 gap-3">
            {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`p-3 rounded-lg font-semibold flex flex-col items-center gap-2 transition-colors ${activeTab === tab.id ? getThemeClasses('bg-light') + ' ' + getThemeClasses('text') : 'bg-gray-100 text-gray-600'}`}>
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>
        
        <div className="mt-6">
            {activeTab === 'account' && (
                <div className="space-y-6">
                    <SettingSection title={t('profile_section')} icon={<User />} getThemeClasses={getThemeClasses}>
                        <div className="flex items-center gap-4">
                            <p className="font-semibold">{t('profile_picture_current')}:</p>
                            <button onClick={() => setIsAvatarModalOpen(true)} className={`font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('change_avatar_button')}</button>
                        </div>
                        <input type="text" name="userName" value={formData.userName} onChange={handleInputChange} placeholder={t('your_name')} className="w-full p-2 border rounded-lg" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <input type="text" name="schoolName" value={formData.schoolName} onChange={handleInputChange} placeholder={t('school_name')} className="p-2 border rounded-lg" />
                           <input type="text" name="className" value={formData.className} onChange={handleInputChange} placeholder={t('class_name')} className="p-2 border rounded-lg" />
                        </div>
                        <select name="educationLevel" value={formData.educationLevel} onChange={handleInputChange} className="w-full p-2 border rounded-lg bg-white">
                            <option value="">{t('select_level')}</option>
                            {educationLevels.map(level => <option key={level} value={level}>{tSubject(level)}</option>)}
                        </select>
                    </SettingSection>
                    <SettingSection title={t('my_subjects')} icon={<BookOpen />} getThemeClasses={getThemeClasses}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {allSubjects.map(subject => (
                                <button key={subject} onClick={() => handleSubjectToggle(subject)} className={`p-2 rounded-md border-2 transition-colors ${selectedSubjects.includes(subject) ? `${getThemeClasses('bg')} text-white border-transparent shadow-sm` : 'bg-gray-100 border-gray-100 hover:bg-gray-200'}`}>{tSubject(subject)}</button>
                            ))}
                        </div>
                        <div className="pt-2 border-t mt-4">
                          <p className="font-semibold mb-2">{t('add_custom_subject')}</p>
                           <div className="flex gap-2">
                               <input type="text" value={customSubjectInput} onChange={e => setCustomSubjectInput(e.target.value)} placeholder={t('custom_subject_placeholder')} className="flex-grow p-2 border rounded-lg" />
                               <button onClick={handleAddCustomSubject} className={`p-2 rounded-lg text-white ${getThemeClasses('bg')}`}><Plus/></button>
                           </div>
                           <div className="flex flex-wrap gap-2 mt-2">
                            {customSubjects.map(subject => (
                                <div key={subject} className="bg-gray-200 text-gray-800 text-sm font-semibold pl-3 pr-1 py-1 rounded-full flex items-center gap-1">
                                    {subject.charAt(0).toUpperCase() + subject.slice(1).replace(/_/g, ' ')}
                                    <button onClick={() => handleRemoveCustomSubject(subject)} className="bg-gray-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-500"><X size={12}/></button>
                                </div>
                            ))}
                        </div>
                        </div>
                    </SettingSection>
                     <SettingSection title={t('customize_ai_title')} icon={<Bot />} getThemeClasses={getThemeClasses}>
                        <input type="text" name="aiBotName" value={formData.aiBotName} onChange={handleInputChange} placeholder={t('bot_name_placeholder')} className="w-full p-2 border rounded-lg" />
                     </SettingSection>
                    <button onClick={handleProfileSave} disabled={isSaving} className={`w-full font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{isSaving ? t('saving') : t('save_profile_info_button')}</button>
                </div>
            )}

            {activeTab === 'appearance' && (
                <div className="space-y-6">
                    <SettingSection title={t('choose_theme')} icon={<Palette />} getThemeClasses={getThemeClasses}>
                        <div className="flex flex-wrap gap-3">
                            {availableThemeColors.map(color => (
                                <button key={color} onClick={() => handleThemeChange(color)} className={`w-10 h-10 rounded-full transition-transform duration-200 hover:scale-110 active:scale-100 ${colorClasses[color]} ${themeColor === color ? `ring-2 ring-offset-2 ${getThemeClasses('ring')}` : ''}`}/>
                            ))}
                        </div>
                    </SettingSection>
                    <SettingSection title={t('font_preference')} icon={<Type />} getThemeClasses={getThemeClasses}>
                        <div className="flex flex-wrap gap-2">
                            {availableFonts.map(font => (
                                <button key={font.id} onClick={() => handleFontChange(font.id)} className={`py-2 px-4 rounded-lg border-2 transition-all ${fontFamily === font.id ? getThemeClasses('border') + ' ' + getThemeClasses('bg-light') : 'bg-white border-gray-200 hover:border-gray-400'}`}>
                                    <span className={`${font.className} text-lg`}>{font.name}</span>
                                </button>
                            ))}
                        </div>
                    </SettingSection>
                     <SettingSection title={t('language_preference')} icon={<Languages />} getThemeClasses={getThemeClasses}>
                        <div className="flex gap-2">
                            <button onClick={() => handleLangChange('nl')} className={`py-2 px-4 rounded-lg border-2 flex-1 ${language === 'nl' ? getThemeClasses('border') + ' ' + getThemeClasses('bg-light') : 'bg-white'}`}>Nederlands</button>
                            <button onClick={() => handleLangChange('en')} className={`py-2 px-4 rounded-lg border-2 flex-1 ${language === 'en' ? getThemeClasses('border') + ' ' + getThemeClasses('bg-light') : 'bg-white'}`}>English</button>
                        </div>
                    </SettingSection>
                    <SettingSection title={t('home_layout_title')} icon={<GripVertical />} getThemeClasses={getThemeClasses}>
                        <p className="text-sm text-gray-600 -mt-2">{t('home_layout_description')}</p>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={homeLayout} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">{homeLayout.map(id => <SortableItem key={id} id={id} t={t} />)}</div>
                            </SortableContext>
                        </DndContext>
                    </SettingSection>
                </div>
            )}

            {activeTab === 'privacy' && (
                 <div className="space-y-6">
                    <SettingSection title={t('notifications_settings_title')} icon={<Bell />} getThemeClasses={getThemeClasses}>
                        <div className="flex items-center justify-between">
                            <label htmlFor="notif-toggle" className="font-semibold text-gray-700">{t('enable_notifications')}</label>
                            <button onClick={() => handleNotificationToggle(!notificationsEnabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${notificationsEnabled ? getThemeClasses('bg') : 'bg-gray-300'}`}>
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`}/>
                            </button>
                        </div>
                    </SettingSection>
                    <SettingSection title={t('haptics_feedback_title')} icon={<Vibrate />} getThemeClasses={getThemeClasses}>
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-700">{t('haptics_feedback_description')}</p>
                             <button onClick={() => handleHapticsToggle(!hapticsEnabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${hapticsEnabled ? getThemeClasses('bg') : 'bg-gray-300'}`}>
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${hapticsEnabled ? 'translate-x-6' : 'translate-x-1'}`}/>
                            </button>
                        </div>
                    </SettingSection>
                    <SettingSection title={t('settings_privacy_section')} icon={<Shield />} getThemeClasses={getThemeClasses}>
                        <p className="text-sm text-gray-600">{t('privacy_policy_content')}</p>
                    </SettingSection>
                    <SettingSection title={t('danger_zone_title')} icon={<AlertTriangle className="text-red-500" />} getThemeClasses={getThemeClasses}>
                        <div className="space-y-4">
                             <div>
                                <h4 className="font-bold">{t('cleanup_account_section_title')}</h4>
                                <p className="text-sm text-gray-600 mb-2">{t('cleanup_account_section_description')}</p>
                                <button onClick={onCleanupAccountRequest} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg">{t('cleanup_account_button')}</button>
                            </div>
                            <div>
                                <h4 className="font-bold">{t('clear_calendar_section_title')}</h4>
                                <p className="text-sm text-gray-600 mb-2">{t('clear_calendar_section_description')}</p>
                                <button onClick={onClearCalendarRequest} className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">{t('clear_calendar_button')}</button>
                            </div>
                             <div>
                                <h4 className="font-bold">{t('delete_account_section_title')}</h4>
                                <p className="text-sm text-gray-600 mb-2">{t('delete_account_section_description')}</p>
                                <button onClick={onDeleteAccountRequest} className="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg">{t('delete_account_button')}</button>
                            </div>
                        </div>
                    </SettingSection>
                </div>
            )}
            
            {activeTab === 'info' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={() => setCurrentView('appInfo')} className="p-4 bg-white rounded-lg shadow-md text-left font-semibold flex items-center gap-3 hover:bg-gray-50"><Info className={getThemeClasses('text')} /> {t('app_info')}</button>
                        <button onClick={() => setCurrentView('faq')} className="p-4 bg-white rounded-lg shadow-md text-left font-semibold flex items-center gap-3 hover:bg-gray-50"><HelpCircle className={getThemeClasses('text')} /> {t('faq')}</button>
                        <button onClick={() => setCurrentView('feedback')} className="p-4 bg-white rounded-lg shadow-md text-left font-semibold flex items-center gap-3 hover:bg-gray-50"><LifeBuoy className={getThemeClasses('text')} /> {t('feedback_support')}</button>
                    </div>
                </div>
            )}
        </div>
      </div>
  );
};
export default SettingsView;