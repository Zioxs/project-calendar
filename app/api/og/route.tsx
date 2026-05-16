import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
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

// Global Logo Loading
const logoPath = path.join(process.cwd(), 'public', 'logo.png');
const logoData = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;

const parseDate = (s: string) => {
    const [d, m, y] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        let startDateStr = searchParams.get('startDate') || '01-04-2026';
        let startObj = parseDate(startDateStr);
        let projectStartObj = new Date(startObj); // Used specifically for progress percentage

        const goalMap: Record<string, any[]> = {};
        const goalsList: any[] = [];

        if (userId) {
            const account = await prisma.account.findFirst({
                where: { userId: userId, provider: 'google' }
            });

            if (!account || !account.refresh_token) {
                return new Response("Not authenticated or missing refresh token.", { status: 401 });
            }

            const oauth2Client = new google.auth.OAuth2(
                process.env.AUTH_GOOGLE_ID,
                process.env.AUTH_GOOGLE_SECRET
            );
            oauth2Client.setCredentials({ refresh_token: account.refresh_token });
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
                    color: color,
                    position: task.position || ""
                };
                if (!goalMap[dStr]) goalMap[dStr] = [];
                goalMap[dStr].push(g);
                goalsList.push(g);
            });

            // Sort tasks to match chronological order (closest due date first), falling back to Google Tasks position
            goalsList.sort((a, b) => {
                if (a.dateObj.getTime() !== b.dateObj.getTime()) {
                    return a.dateObj.getTime() - b.dateObj.getTime();
                }
                return a.position.localeCompare(b.position);
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
                if (!goalMap[g.dateStr]) goalMap[g.dateStr] = [];
                goalMap[g.dateStr].push(g);
                goalsList.push(g);
                i++;
            }
        }

        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
        today.setHours(0, 0, 0, 0);
        const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        let endObj = new Date(startObj);
        if (goalsList.length) {
            const timeStamps = goalsList.map(g => g.dateObj.getTime());
            endObj = new Date(Math.max(...timeStamps));
        }

        // We want the total number of days (dots) to be a perfect multiple of 7 (full rows).
        // We also want a minimum of 14 days. This keeps the visual grid perfectly aligned.
        const diffTime = endObj.getTime() - startObj.getTime();
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const currentDots = diffDays + 1;
        
        const targetDots = Math.max(14, Math.ceil(currentDots / 7) * 7);
        
        // Always anchor the start date relative to the end date to guarantee the last dot is exactly endObj
        // and that we bypass any timezone-midnight truncation bugs.
        startObj = new Date(endObj);
        startObj.setDate(startObj.getDate() - (targetDots - 1));

        // 1. Generate exactly targetDots days
        const allDays = [];
        let curr = new Date(startObj);
        for (let i = 0; i < targetDots; i++) {
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
                                    const isToday = day.dateStr === todayStr;
                                    const goalMatches = goalMap[day.dateStr] || [];
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
                                            {goalMatches.length > 0 && !isToday && (
                                                <div style={{
                                                    display: 'flex', gap: '6px', position: 'absolute', bottom: '12px',
                                                }}>
                                                    {goalMatches.slice(0, 3).map((match, i) => (
                                                        <div key={i} style={{
                                                            width: '12px', height: '12px', borderRadius: '50%',
                                                            backgroundColor: match.color
                                                        }} />
                                                    ))}
                                                    {goalMatches.length > 3 && (
                                                        <div style={{
                                                            width: '12px', height: '12px', borderRadius: '50%',
                                                            backgroundColor: THEME.muted
                                                        }} />
                                                    )}
                                                </div>
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
                                const total = g.dateObj.getTime() - projectStartObj.getTime();
                                const elapsed = today.getTime() - projectStartObj.getTime();
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

                    {/* Bottom Logo */}
                    {logoData && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
                            <img
                                src={logoData}
                                width={56}
                                height={56}
                                style={{ borderRadius: '14px', objectFit: 'cover', opacity: 0.6 }}
                            />
                        </div>
                    )}
                </div>
            ),
            { 
                width: WIDTH, 
                height: HEIGHT, 
                fonts: fontData ? [{ name: 'JetBrains Mono', data: fontData, style: 'normal', weight: 500 }] : [],
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                }
            }
        );
    } catch (e: any) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
}