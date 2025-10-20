import React, { useMemo } from 'react';
import type { AppUser } from '../../../types';
import { Award, Flame, Loader2 } from 'lucide-react';

interface AdminLeaderboardViewProps {
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    allUsers: AppUser[];
    isLoading: boolean;
}

const AdminLeaderboardView: React.FC<AdminLeaderboardViewProps> = ({ t, getThemeClasses, allUsers, isLoading }) => {

    const leaderboard = useMemo(() => {
        return allUsers
            .filter(u => u.streakCount && u.streakCount > 0)
            .sort((a, b) => (b.streakCount || 0) - (a.streakCount || 0));
    }, [allUsers]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Award /> {t('admin_streak_leaderboard')}
            </h3>
            {isLoading ? <Loader2 className="animate-spin" /> :
                leaderboard.length === 0 ? <p className="text-gray-500 italic">{t('no_streak_users')}</p> :
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Streak</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('last_login')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leaderboard.map((user, index) => (
                                <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-lg">{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{user.userName}</div>
                                        <div className="text-sm text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 font-bold text-orange-600">
                                            <Flame size={18} /> {user.streakCount}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{user.lastLoginDate?.toDate().toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        </div>
    );
};

export default AdminLeaderboardView;