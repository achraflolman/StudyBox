import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, Timestamp } from '../../../services/firebase';
import type { AIUsageLog, AppUser, FlashcardSet } from '../../../types';
import { Loader2, BarChart3, Users, Bot, Layers, CalendarDays } from 'lucide-react';

const BarChart: React.FC<{
    data: { label: string; value: number }[];
    label: string;
    getThemeClasses: (variant: string) => string;
}> = ({ data, label, getThemeClasses }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    return (
        <div>
            <h4 className="font-semibold mb-2">{label}</h4>
            <div className="h-48 flex items-end gap-2 p-2 border-l border-b border-gray-200">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="relative w-full h-full flex items-end">
                            <div
                                className={`w-full ${getThemeClasses('bg')}`}
                                style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                            ></div>
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold bg-gray-700 text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.value}
                            </span>
                        </div>
                        <span className="text-xs text-gray-500">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-full">{icon}</div>
            <div>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-sm text-gray-500">{title}</p>
            </div>
        </div>
    </div>
);


const AdminAnalyticsView: React.FC<{
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: { text: string }) => void;
}> = ({ t, getThemeClasses, showAppModal }) => {
    const [days, setDays] = useState(7);
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);

    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(end.getDate() - (days - 1));
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: end };
    }, [days]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);

        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);

        try {
            // New Users
            const newUsersQuery = db.collection('users').where('createdAt', '>=', startTimestamp).where('createdAt', '<=', endTimestamp);
            const newUsersSnapshot = await newUsersQuery.get();
            const newUsers = newUsersSnapshot.docs.map(doc => doc.data() as AppUser);

            // Logins
            const loginsQuery = db.collection('users').where('lastLoginDate', '>=', startTimestamp).where('lastLoginDate', '<=', endTimestamp);
            const loginsSnapshot = await loginsQuery.get();
            const logins = loginsSnapshot.docs.map(doc => doc.data() as AppUser);
            
            // AI Usage
            const aiQuery = db.collection('aiUsageLogs').where('timestamp', '>=', startTimestamp).where('timestamp', '<=', endTimestamp);
            const aiSnapshot = await aiQuery.get();
            const aiUsages = aiSnapshot.docs.map(doc => doc.data() as AIUsageLog);

            setData({ newUsers, logins, aiUsages });

        } catch (error: any) {
            showAppModal({ text: `Failed to fetch analytics: ${error.message}`});
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, showAppModal]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const chartData = useMemo(() => {
        if (!data) return null;

        const dateLabels: string[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            dateLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        }

        const loginsByDay = dateLabels.map(label => ({ label, value: 0 }));
        data.logins.forEach((user: AppUser) => {
            const dateStr = user.lastLoginDate?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const dayData = loginsByDay.find(d => d.label === dateStr);
            if (dayData) dayData.value++;
        });
        
        const aiUsagesByDay = dateLabels.map(label => ({ label, value: 0 }));
        data.aiUsages.forEach((log: AIUsageLog) => {
            const dateStr = log.timestamp.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const dayData = aiUsagesByDay.find(d => d.label === dateStr);
            if (dayData) dayData.value++;
        });

        return { loginsByDay, aiUsagesByDay };

    }, [data, days, startDate]);


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-bold">Date Range</h3>
                <div className="flex items-center gap-2">
                    {[7, 14, 30].map(d => (
                        <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 text-sm font-semibold rounded-lg ${days === d ? `${getThemeClasses('bg')} text-white` : 'bg-gray-200 hover:bg-gray-300'}`}>
                            {d} days
                        </button>
                    ))}
                </div>
                 <button onClick={fetchData} disabled={isLoading} className="p-2 bg-gray-200 rounded-lg ml-auto"><Loader2 className={isLoading ? 'animate-spin' : ''} /></button>
            </div>

            {isLoading ? <div className="text-center p-8"><Loader2 size={32} className="animate-spin mx-auto" /></div> : data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard title="Logins" value={data.logins.length} icon={<CalendarDays />} />
                        <StatCard title="New Users" value={data.newUsers.length} icon={<Users />} />
                        <StatCard title="AI Interactions" value={data.aiUsages.length} icon={<Bot />} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded-lg shadow-md">
                            {chartData && <BarChart data={chartData.loginsByDay} label="Logins Per Day" getThemeClasses={getThemeClasses} />}
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-md">
                            {chartData && <BarChart data={chartData.aiUsagesByDay} label="AI Usage Per Day" getThemeClasses={getThemeClasses} />}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h3 className="font-bold mb-2">New Users</h3>
                        {data.newUsers.length > 0 ? (
                             <ul className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
                                {data.newUsers.map((u: AppUser) => (
                                    <li key={u.uid} className="py-2 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{u.userName}</p>
                                            <p className="text-sm text-gray-500">{u.email}</p>
                                        </div>
                                        <p className="text-sm text-gray-400">{u.createdAt?.toDate().toLocaleDateString()}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500 italic">No new users in this period.</p>}
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminAnalyticsView;