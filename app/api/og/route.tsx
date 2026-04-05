import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { auth } from '@/auth';
import { google } from 'googleapis';

export const runtime = 'nodejs';

const WIDTH = 1170;
const HEIGHT = 2532;
const PADDING = 90;
const MAX_USABLE_HEIGHT = HEIGHT - (PADDING * 2);

const THEME = {
    bg: '#121212',
    card: '#1e1e1e',
    text: '#ffffff',
    muted: '#9e9e9e',
    primary: '#90caf9',
    border: '#333333',
};

// Global Font Loading
const fontPath = path.join(process.cwd(), 'public', 'fonts', 'JetBrainsMono-Medium.ttf');
const fontData = fs.existsSync(fontPath) ? fs.readFileSync(fontPath) : null;

const parseDate = (s: string) => {
    const [d, m, y] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const source = searchParams.get('source');

        let startDateStr = searchParams.get('startDate') || '01-04-2026';
        let startObj = parseDate(startDateStr);

        const goalMap: Record<string, any> = {};
        const goalsList: any[] = [];

        if (source === 'google') {
            const session = await auth();
            // @ts-ignore
            const accessToken = session?.accessToken;
            if (!session || !accessToken) {
                return new Response("Not authenticated or missing access token. Please view this URL in a browser where you are logged in.", { status: 401 });
            }

            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: accessToken as string });
            const tasksService = google.tasks({ version: "v1", auth: oauth2Client });
            
            const response = await tasksService.tasks.list({
                tasklist: "@default",
                showCompleted: false,
            });

            const tasks = response.data.items || [];
            
            // Set startDate to today for live mode
            const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
            startObj = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
            startDateStr = `${String(todayDate.getDate()).padStart(2, '0')}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${todayDate.getFullYear()}`;

            const pastelColors = [
                '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', 
                '#e8baff', '#ffd1dc', '#d4f0f0', '#f4e1d2', '#e2f0cb'
            ];

            tasks.forEach((task) => {
                const dateObj = task.due ? new Date(task.due) : new Date(startObj);
                const dStr = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
                
                // Pick a stable random pastel color based on task ID to prevent flickering
                const colorHash = task.id ? task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1) : Math.floor(Math.random() * 100);
                const color = pastelColors[colorHash % pastelColors.length];

                const g = {
                    title: task.title || "Untitled Task",
                    dateStr: dStr,
                    dateObj: dateObj,
                    color: color
                };
                goalMap[dStr] = g;
                goalsList.push(g);
            });
        } else {
            let i = 0;
            while (searchParams.has(`goal[${i}][title]`)) {
                const g = {
                    title: searchParams.get(`goal[${i}][title]`),
                    dateStr: searchParams.get(`goal[${i}][goalDate]`) || '',
                    dateObj: parseDate(searchParams.get(`goal[${i}][goalDate]`) || ''),
                    color: decodeURIComponent(searchParams.get(`goal[${i}][goalColor]`) || THEME.primary),
                };
                goalMap[g.dateStr] = g;
                goalsList.push(g);
                i++;
            }
        }

        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
        today.setHours(0, 0, 0, 0);

        let endObj = new Date(startObj);
        if (goalsList.length) {
            const timeStamps = goalsList.map(g => g.dateObj.getTime());
            endObj = new Date(Math.max(...timeStamps));
        }

        // 1. Generate Days
        const allDays = [];
        let curr = new Date(startObj);
        while (curr <= endObj) {
            allDays.push({
                dayNum: curr.getDate(),
                timestamp: curr.getTime(),
                dateStr: `${String(curr.getDate()).padStart(2, '0')}-${String(curr.getMonth() + 1).padStart(2, '0')}-${curr.getFullYear()}`
            });
            curr.setDate(curr.getDate() + 1);
        }

        // 2. Vertical Space Culling
        let currentY = 0;
        const circleSize = 124;
        const gap = 20;
        const rowHeight = circleSize + gap;

        const weeks: any[][] = [];
        for (let j = 0; j < allDays.length; j += 7) {
            if (currentY + rowHeight > MAX_USABLE_HEIGHT * 0.6) break;
            weeks.push(allDays.slice(j, j + 7));
            currentY += rowHeight;
        }

        currentY += 80; // Space between grid and card

        const visibleGoals = [];
        const goalItemHeight = 220;
        for (const goal of goalsList) {
            if (currentY + goalItemHeight > MAX_USABLE_HEIGHT) break;
            visibleGoals.push(goal);
            currentY += goalItemHeight;
        }

        return new ImageResponse(
            (
                <div style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: THEME.bg,
                    color: THEME.text,
                    padding: `${PADDING}px`,
                    fontFamily: fontData ? '"JetBrains Mono"' : 'sans-serif',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>

                    {/* Calendar Grid Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, marginBottom: '80px' }}>
                        {weeks.map((week, wIdx) => (
                            <div key={wIdx} style={{ display: 'flex', gap: `${gap}px` }}>
                                {week.map((day, dIdx) => {
                                    const isToday = day.timestamp === today.getTime();
                                    const goalMatch = goalMap[day.dateStr];
                                    return (
                                        <div key={dIdx} style={{
                                            width: `${circleSize}px`, height: `${circleSize}px`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '50%', fontSize: '44px', fontWeight: 600,
                                            backgroundColor: isToday ? THEME.primary : THEME.card,
                                            color: isToday ? THEME.bg : THEME.text,
                                            border: isToday ? 'none' : `1px solid ${THEME.border}`,
                                            position: 'relative',
                                            boxShadow: isToday ? `0 4px 12px ${THEME.primary}40` : 'none',
                                        }}>
                                            {day.dayNum}
                                            {goalMatch && !isToday && (
                                                <div style={{
                                                    width: '16px', height: '16px', borderRadius: '50%',
                                                    backgroundColor: goalMatch.color, position: 'absolute', bottom: '12px',
                                                    display: 'flex' // Explicit flex for children
                                                }} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        {weeks.length * 7 < allDays.length && (
                            <div style={{ display: 'flex', color: THEME.muted, fontSize: 24, justifyContent: 'center', width: '990px' }}>
                                + {allDays.length - (weeks.length * 7)} more days...
                            </div>
                        )}
                    </div>

                    {/* Unified Progress Card Section */}
                    {visibleGoals.length > 0 && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', width: '990px',
                            backgroundColor: THEME.card, padding: '50px', borderRadius: '24px', 
                            border: `1px solid ${THEME.border}`,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}>
                            {visibleGoals.map((g, idx) => {
                                const total = g.dateObj.getTime() - startObj.getTime();
                                const elapsed = today.getTime() - startObj.getTime();
                                const percent = total > 0 ? Math.min(100, Math.max(0, Math.floor((elapsed / total) * 100))) : (elapsed >= 0 ? 100 : 0);

                                return (
                                    <div key={idx} style={{
                                        display: 'flex', flexDirection: 'column', width: '100%',
                                        marginTop: idx === 0 ? '0' : '40px',
                                        paddingTop: idx === 0 ? '0' : '40px',
                                        borderTop: idx === 0 ? 'none' : `1px solid ${THEME.border}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                                            <span style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>{g.title}</span>
                                            <span style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: g.color }}>{percent}%</span>
                                        </div>
                                        <div style={{ display: 'flex', height: 16, backgroundColor: THEME.bg, borderRadius: 8, overflow: 'hidden' }}>
                                            <div style={{ display: 'flex', width: `${percent}%`, backgroundColor: g.color, height: '100%', borderRadius: 8 }} />
                                        </div>
                                        <div style={{ display: 'flex', marginTop: '20px', fontSize: 24, color: THEME.muted }}>
                                            Due: {g.dateStr}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ),
            { width: WIDTH, height: HEIGHT, fonts: fontData ? [{ name: 'JetBrains Mono', data: fontData, style: 'normal', weight: 500 }] : [] }
        );
    } catch (e: any) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
}