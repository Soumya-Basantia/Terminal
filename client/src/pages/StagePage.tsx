import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { StagePanel, Countdown } from '../components/ui/Stage';

const StageTimer = ({ startTime, timeLimit }: { startTime: any, timeLimit?: number }) => {
  const [timeLeft, setTimeLeft] = useState('--:--');
  
  useEffect(() => {
    if (!startTime || !timeLimit) {
      setTimeLeft('--:--');
      return;
    }
    
    const tick = () => {
      const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
      const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
      setTimeLeft(remaining.toString().padStart(2, '0'));
    };
    
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [startTime, timeLimit]);

  return <>{timeLeft}</>;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function StagePage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionCode) return;

    const newSocket = io(API_URL, {
      auth: { isStage: true }
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('stage:join', { roomCode: sessionCode });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('session_state_update', (data) => {
      setSessionData(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionCode]);

  if (!sessionData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-base)] text-white font-mono scanlines grid-overlay">
        <StagePanel>
          <div className="text-4xl text-[var(--accent-primary)] animate-pulse">CONNECTING TO TERMINAL...</div>
        </StagePanel>
      </div>
    );
  }

  const { session, event, currentGame, playerCount, teamCount } = sessionData;
  const stageMode = session.stageMode || 'LOBBY';

  const renderLobby = () => (
    <div className="text-center flex flex-col items-center">
      <h3 className="text-4xl tracking-[0.3em] text-[var(--accent-primary)] font-mono font-bold mb-4">TERMINAL</h3>
      <h1 className="text-8xl font-black mb-16 uppercase drop-shadow-[0_0_15px_rgba(0,255,204,0.4)]">
        {event.name}
      </h1>
      
      <StagePanel className="w-full max-w-4xl mx-auto flex items-center gap-16 justify-between text-left">
        <div className="flex flex-col gap-6">
          <div className="text-3xl text-[var(--text-secondary)] font-mono">ROOM CODE</div>
          <div className="text-[7rem] leading-none font-black text-[var(--accent-primary)] tracking-wider">
            {session.roomCode}
          </div>
          <div className="text-4xl mt-4 font-mono text-[var(--text-primary)]">
            Type <strong className="text-[var(--accent-primary)] bg-[rgba(0,255,204,0.1)] px-4 py-2 rounded border border-[var(--accent-primary)]">battle {session.roomCode}</strong>
          </div>
          <div className="text-2xl text-[var(--text-secondary)] mt-2 font-mono">
            at {window.location.host}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shrink-0">
          <QRCodeSVG value={`${window.location.origin}/terminal`} size={240} />
        </div>
      </StagePanel>

      <div className="flex gap-20 mt-20">
        <div className="text-4xl font-mono text-[var(--text-secondary)]">
          <strong className="text-[var(--accent-secondary)] text-6xl mr-4">{playerCount}</strong> PLAYERS
        </div>
        <div className="text-4xl font-mono text-[var(--text-secondary)]">
          <strong className="text-[var(--accent-secondary)] text-6xl mr-4">{teamCount}</strong> TEAMS
        </div>
      </div>

      <div className="mt-24 text-3xl text-[var(--text-muted)] animate-pulse font-mono tracking-widest">
        WAITING FOR GAME MASTER
      </div>
    </div>
  );

  const renderAnnouncement = () => (
    <div className="text-center w-full">
      <StagePanel className="inline-block max-w-[80vw]">
        <h2 className="text-4xl text-[var(--accent-primary)] font-mono mb-8 tracking-widest">UP NEXT</h2>
        <h1 className="text-9xl font-black my-12 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          {currentGame ? currentGame.name : event.name}
        </h1>
        <h3 className="text-6xl text-[var(--accent-secondary)] animate-pulse font-mono mt-8">GET READY</h3>
      </StagePanel>
    </div>
  );

  const renderCountdown = () => (
    <div className="text-center w-full flex justify-center">
      <StagePanel>
        <Countdown seconds={3} label="PREPARE" />
      </StagePanel>
    </div>
  );

  const renderQuestion = () => {
    if (currentGame?.template === 'CHAIN_REACTION' || currentGame?.template === 'DATA_HUNT') {
      const challenges = currentGame?.challenges || [];
      const totalChallenges = challenges.length;
      const entities = Object.keys(sessionData.chainProgress || {});
      const totalEntities = Math.max(entities.length, sessionData.teamCount || sessionData.playerCount);
      
      const advancedEntities = entities.filter(e => sessionData.chainProgress[e] !== challenges[0]?.id).length;
      const solvingEntities = totalEntities - advancedEntities;
      const completedEntities = entities.filter(e => sessionData.chainProgress[e] === 'COMPLETED').length;

      return (
        <div className="w-full max-w-[90vw] mx-auto text-center">
          <div className="text-5xl font-black text-[var(--accent-primary)] mb-16 uppercase">{currentGame?.name}</div>
          <StagePanel>
            <h1 className="text-7xl font-black mb-8 tracking-widest text-[var(--text-muted)]">
              {currentGame?.template === 'DATA_HUNT' ? 'STORY INVESTIGATION' : 'CHAIN PROGRESSION'}
            </h1>
            
            <div className="grid grid-cols-2 gap-12 mt-16">
              <div className="bg-[rgba(63,185,80,0.1)] border-2 border-[var(--success)] rounded-xl p-12 shadow-[0_0_20px_rgba(63,185,80,0.2)]">
                <div className="text-[10rem] font-black font-mono text-[var(--success)] drop-shadow-[0_0_15px_rgba(63,185,80,0.5)]">
                  {completedEntities}
                </div>
                <div className="text-5xl font-sans font-bold text-[var(--text-secondary)] mt-4">COMPLETED</div>
              </div>

              <div className="bg-[rgba(0,255,204,0.1)] border-2 border-[var(--accent-primary)] rounded-xl p-12 shadow-[0_0_20px_rgba(0,255,204,0.2)]">
                <div className="text-[10rem] font-black font-mono text-[var(--accent-primary)] drop-shadow-[0_0_15px_rgba(0,255,204,0.5)]">
                  {solvingEntities}
                </div>
                <div className="text-5xl font-sans font-bold text-[var(--text-secondary)] mt-4">SOLVING</div>
              </div>
            </div>
          </StagePanel>
        </div>
      );
    }

    if (currentGame?.template === 'BUG_HUNT') {
      const challenges = currentGame?.challenges || [];
      const currentCase = challenges.find((c: any) => c.id === session.currentChallengeId) || challenges[0];
      const caseConfig = currentCase?.config || {};
      const repro = caseConfig.reproduction || {};
      const totalInvestigators = sessionData.playerCount || 0;
      const lb = sessionData.leaderboard || [];

      return (
        <div className="w-full max-w-[95vw] mx-auto text-center">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 border-b-2 border-[var(--border-subtle)] pb-6">
            <div className="text-left">
              <div className="text-5xl font-black text-[var(--warning)] uppercase tracking-wider flex items-center gap-4">
                <span>🐛</span> {currentGame?.name || 'DEAD CODE: THE BUG HUNT'}
              </div>
              <div className="text-2xl text-[var(--text-muted)] font-mono tracking-[0.25em] mt-1">
                SYSTEM INVESTIGATION UNIT · ACTIVE INCIDENT
              </div>
            </div>
            {session.challengeStartTime && currentCase?.timeLimit && (
              <div className="text-5xl font-black font-mono text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                ⏱ <StageTimer startTime={session.challengeStartTime} timeLimit={currentCase.timeLimit} />
              </div>
            )}
          </div>

          {/* Incident Banner */}
          <div className="mb-10 p-6 bg-[rgba(255,180,0,0.06)] border-2 border-[var(--warning)] rounded-xl inline-block shadow-[0_0_20px_rgba(255,180,0,0.15)] text-left max-w-4xl w-full">
            <div className="text-sm font-mono font-bold text-[var(--warning)] uppercase tracking-widest mb-1">
              {caseConfig.title || currentCase?.prompt || 'ACTIVE MALFUNCTION REPORT'}
            </div>
            <div className="text-2xl font-sans font-bold text-[var(--text-primary)]">
              {caseConfig.system ? `Target System: ${caseConfig.system}` : currentCase?.prompt}
            </div>
            {repro.expected && (
              <div className="mt-4 pt-4 border-t border-[rgba(255,180,0,0.2)] grid grid-cols-3 gap-6 font-mono text-center">
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase">FAULT INPUT</div>
                  <div className="text-xl font-bold text-[var(--accent-primary)] mt-1">
                    {Object.entries(repro.input || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '72%'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase">EXPECTED OUTPUT</div>
                  <div className="text-xl font-bold text-[var(--success)] mt-1">{repro.expected}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase">ACTUAL SYSTEM OUTPUT</div>
                  <div className="text-xl font-bold text-[var(--error)] mt-1">{repro.actual} (DEFECT)</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left 8 cols: Investigation Metrics */}
            <div className="col-span-8">
              <StagePanel>
                <div className="grid grid-cols-3 gap-8">
                  {/* Total Cases */}
                  <div className="bg-[rgba(0,212,170,0.05)] border-2 border-[var(--accent-primary)] rounded-xl p-8 shadow-[0_0_20px_rgba(0,212,170,0.15)]">
                    <div className="text-[6rem] font-black font-mono text-[var(--accent-primary)]">
                      {challenges.length}
                    </div>
                    <div className="text-2xl font-sans font-bold text-[var(--text-secondary)] mt-2">TOTAL CASES</div>
                  </div>

                  {/* Active Investigators */}
                  <div className="bg-[rgba(255,180,0,0.08)] border-2 border-[var(--warning)] rounded-xl p-8 shadow-[0_0_20px_rgba(255,180,0,0.15)]">
                    <div className="text-[6rem] font-black font-mono text-[var(--warning)]">
                      {totalInvestigators}
                    </div>
                    <div className="text-2xl font-sans font-bold text-[var(--text-secondary)] mt-2">INVESTIGATING</div>
                  </div>

                  {/* Submissions Verified */}
                  <div className="bg-[rgba(63,185,80,0.1)] border-2 border-[var(--success)] rounded-xl p-8 shadow-[0_0_20px_rgba(63,185,80,0.2)]">
                    <div className="text-[6rem] font-black font-mono text-[var(--success)]">
                      {sessionData.answersCount || 0}
                    </div>
                    <div className="text-2xl font-sans font-bold text-[var(--text-secondary)] mt-2">PATCHES TESTED</div>
                  </div>
                </div>
              </StagePanel>
            </div>

            {/* Right 4 cols: Live Leaderboard */}
            <div className="col-span-4">
              <StagePanel>
                <div className="text-2xl font-black font-mono text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>🏆 TOP SQUASHERS</span>
                  <span className="text-sm text-[var(--text-muted)]">SCORE</span>
                </div>
                <div className="flex flex-col gap-3">
                  {lb.map((entry: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-lg">
                      <span className="font-mono text-[var(--text-muted)] font-bold mr-3">#{idx + 1}</span>
                      <span className="font-bold flex-1 truncate text-left">{entry.name}</span>
                      <span className="font-mono font-bold text-[var(--accent-primary)]">{entry.score} pts</span>
                    </div>
                  ))}
                  {lb.length === 0 && (
                    <div className="text-center py-6 font-mono text-sm text-[var(--text-muted)]">
                      STANDBY FOR FIRST PATCH...
                    </div>
                  )}
                </div>
              </StagePanel>
            </div>
          </div>
        </div>
      );
    }

    if (currentGame?.template === 'ROGUE_SCANNER') {
      const challenges = currentGame?.challenges || [];
      const currentChal = challenges.find((c: any) => c.id === session.currentChallengeId) || challenges[0];
      const chalConfig = currentChal?.config || {};
      const events = chalConfig.events || [];
      const sp = sessionData.scannerProgress || {
        scenarioTitle: chalConfig.scenarioTitle || currentChal?.prompt || 'ROGUE SCANNER TELEMETRY',
        missionBrief: chalConfig.missionBrief,
        totalEvents: events.length || 22,
        totalAnalysts: sessionData.playerCount || 1,
        solvedCount: 0,
        clearedFalsePositivesCount: 0,
        recentProbes: [],
        activeAnalysts: [],
      };
      const lb = sessionData.leaderboard || [];

      return (
        <div className="w-full max-w-[95vw] mx-auto text-center font-mono">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 border-b-2 border-[var(--border-subtle)] pb-6">
            <div className="text-left">
              <div className="text-5xl font-black text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-4">
                <span>📡</span> {currentGame?.name || 'ROGUE SCANNER'}
              </div>
              <div className="text-2xl text-[var(--text-muted)] tracking-[0.25em] mt-1 uppercase">
                AIERA TELEMETRY CLUSTER • MULTI-VARIABLE CORRELATION FORENSICS
              </div>
            </div>
            {session.challengeStartTime && currentChal?.timeLimit && (
              <div className="text-5xl font-black text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                ⏱ <StageTimer startTime={session.challengeStartTime} timeLimit={currentChal.timeLimit} />
              </div>
            )}
          </div>

          {/* Scenario Banner */}
          <div className="mb-10 p-6 bg-[rgba(0,255,204,0.06)] border-2 border-[var(--accent-primary)] rounded-xl inline-block shadow-[0_0_25px_rgba(0,255,204,0.15)] text-left max-w-5xl w-full">
            <div className="text-sm font-bold text-[var(--accent-primary)] uppercase tracking-widest mb-1">
              SCENARIO: {sp.scenarioTitle}
            </div>
            {sp.missionBrief && (
              <div className="text-xl text-[var(--text-primary)] leading-relaxed">
                {sp.missionBrief}
              </div>
            )}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left 8 cols: Investigation Metrics & Recent Probes */}
            <div className="col-span-8 flex flex-col gap-6">
              <StagePanel>
                <div className="grid grid-cols-4 gap-6">
                  {/* Total Events */}
                  <div className="bg-[rgba(255,255,255,0.04)] border-2 border-[var(--border-subtle)] rounded-xl p-6 shadow-md">
                    <div className="text-[5rem] font-black text-white leading-none">
                      {sp.totalEvents}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">TOTAL EVENTS</div>
                  </div>

                  {/* Active Analysts */}
                  <div className="bg-[rgba(0,255,204,0.08)] border-2 border-[var(--accent-primary)] rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,204,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--accent-primary)] leading-none">
                      {sp.totalAnalysts}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">ANALYSTS</div>
                  </div>

                  {/* Cleared False Positives */}
                  <div className="bg-[rgba(235,160,0,0.08)] border-2 border-[var(--warning)] rounded-xl p-6 shadow-[0_0_20px_rgba(235,160,0,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--warning)] leading-none">
                      {sp.clearedFalsePositivesCount}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">FALSE POSITIVES CLEARED</div>
                  </div>

                  {/* Verified Anomalies */}
                  <div className="bg-[rgba(63,185,80,0.1)] border-2 border-[var(--success)] rounded-xl p-6 shadow-[0_0_20px_rgba(63,185,80,0.2)]">
                    <div className="text-[5rem] font-black text-[var(--success)] leading-none">
                      {sp.solvedCount}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">ANOMALIES VERIFIED</div>
                  </div>
                </div>
              </StagePanel>

              {/* Investigation Pipeline / Stages Ticker */}
              <StagePanel>
                <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl font-mono text-sm font-bold">
                  <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-ping" />
                    <span>LIVE EVENT STREAM</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-[var(--warning)]">
                    <span>SUSPICIOUS SIGNAL</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-white">
                    <span>PATTERN OVERLAY</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-[var(--accent-secondary)]">
                    <span>VERIFICATION</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className={`flex items-center gap-2 ${sp.solvedCount > 0 ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                    <span>ANOMALY CONFIRMED</span>
                  </div>
                </div>
              </StagePanel>

              {/* Recent Dispatched Probes Ticker */}
              <StagePanel>
                <div className="text-2xl font-black text-left text-white uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>📡 LIVE CLUSTER PROBE ACTIVITY</span>
                  <span className="text-sm text-[var(--accent-primary)]">{sp.recentProbes.length} PROBES LOGGED</span>
                </div>
                {sp.recentProbes.length === 0 ? (
                  <div className="text-center py-8 text-xl text-[var(--text-muted)] uppercase">
                    AWAITING FIRST TELEMETRY PROBE DISPATCH...
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 text-left">
                    {sp.recentProbes.slice(0, 5).map((p: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between font-mono">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[var(--accent-primary)]">[{p.playerName}]</span>
                          <span className="text-base text-white">{p.summary}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="px-3 py-1 rounded font-bold text-xs uppercase bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)] border border-[var(--accent-primary)]">
                            {p.action}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </StagePanel>
            </div>

            {/* Right 4 cols: Live Leaderboard */}
            <div className="col-span-4">
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>🏆 LEAD FORENSIC ANALYSTS</span>
                  <span className="text-sm text-[var(--text-muted)]">SCORE</span>
                </div>
                <div className="flex flex-col gap-3">
                  {lb.map((entry: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-lg">
                      <span className="text-[var(--text-muted)] font-bold mr-3">#{idx + 1}</span>
                      <span className="font-bold flex-1 truncate text-left">{entry.name}</span>
                      <span className="font-bold text-[var(--accent-primary)]">{entry.score} pts</span>
                    </div>
                  ))}
                  {lb.length === 0 && (
                    <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                      STANDBY FOR FIRST ACCUSATION...
                    </div>
                  )}
                </div>
              </StagePanel>
            </div>
          </div>
        </div>
      );
    }

    if (currentGame?.template === 'THE_WITNESS') {
      const challenges = currentGame?.challenges || [];
      const currentChal = challenges.find((c: any) => c.id === session.currentChallengeId) || challenges[0];
      const chalConfig = currentChal?.config || {};
      const suspects = chalConfig.suspects || [];
      const wp = sessionData.witnessProgress || {
        caseTitle: chalConfig.caseTitle || currentChal?.prompt || 'ACTIVE INVESTIGATION',
        missionBrief: chalConfig.missionBrief,
        totalSuspects: suspects.length,
        totalInvestigators: sessionData.playerCount || 0,
        solvedCount: 0,
        recentTestimonies: [],
        activeInvestigators: [],
      };
      const lb = sessionData.leaderboard || [];

      return (
        <div className="w-full max-w-[95vw] mx-auto text-center font-mono">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 border-b-2 border-[var(--border-subtle)] pb-6">
            <div className="text-left">
              <div className="text-5xl font-black text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-4">
                <span>🕵️</span> {currentGame?.name || 'THE WITNESS'}
              </div>
              <div className="text-2xl text-[var(--text-muted)] tracking-[0.25em] mt-1 uppercase">
                FORENSIC LOGGING SUB-SYSTEM · LIVE INTERROGATION
              </div>
            </div>
            {session.challengeStartTime && currentChal?.timeLimit && (
              <div className="text-5xl font-black text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                ⏱ <StageTimer startTime={session.challengeStartTime} timeLimit={currentChal.timeLimit} />
              </div>
            )}
          </div>

          {/* Incident Banner */}
          <div className="mb-10 p-6 bg-[rgba(0,255,204,0.06)] border-2 border-[var(--accent-primary)] rounded-xl inline-block shadow-[0_0_25px_rgba(0,255,204,0.15)] text-left max-w-5xl w-full">
            <div className="text-sm font-bold text-[var(--accent-primary)] uppercase tracking-widest mb-1">
              CASE: {wp.caseTitle}
            </div>
            {wp.missionBrief && (
              <div className="text-xl text-[var(--text-primary)] leading-relaxed">
                {wp.missionBrief}
              </div>
            )}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left 8 cols: Investigation Metrics & Recent Testimonies */}
            <div className="col-span-8 flex flex-col gap-6">
              <StagePanel>
                <div className="grid grid-cols-3 gap-8">
                  {/* Total Suspects */}
                  <div className="bg-[rgba(255,255,255,0.04)] border-2 border-[var(--border-subtle)] rounded-xl p-8 shadow-md">
                    <div className="text-[6rem] font-black text-white">
                      {wp.totalSuspects}
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-secondary)] mt-2 uppercase">TOTAL SUSPECTS</div>
                  </div>

                  {/* Active Investigators */}
                  <div className="bg-[rgba(0,255,204,0.08)] border-2 border-[var(--accent-primary)] rounded-xl p-8 shadow-[0_0_20px_rgba(0,255,204,0.15)]">
                    <div className="text-[6rem] font-black text-[var(--accent-primary)]">
                      {wp.totalInvestigators}
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-secondary)] mt-2 uppercase">INVESTIGATING</div>
                  </div>

                  {/* Solved Cases */}
                  <div className="bg-[rgba(63,185,80,0.1)] border-2 border-[var(--success)] rounded-xl p-8 shadow-[0_0_20px_rgba(63,185,80,0.2)]">
                    <div className="text-[6rem] font-black text-[var(--success)]">
                      {wp.solvedCount}
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-secondary)] mt-2 uppercase">CASES CRACKED</div>
                  </div>
                </div>
              </StagePanel>

              {/* Recent Dispatched Inquiries Ticker */}
              <StagePanel>
                <div className="text-2xl font-black text-left text-white uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>📡 LIVE WITNESS TESTIMONY TICKER</span>
                  <span className="text-sm text-[var(--accent-primary)]">{wp.recentTestimonies.length} RECENT INQUIRIES</span>
                </div>
                {wp.recentTestimonies.length === 0 ? (
                  <div className="text-center py-8 text-xl text-[var(--text-muted)] uppercase">
                    AWAITING FIRST INQUIRY DISPATCH FROM DETECTIVES...
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 text-left">
                    {wp.recentTestimonies.slice(0, 5).map((t: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[var(--accent-primary)]">[{t.playerName}]</span>
                          <span className="text-lg text-white">"{t.questionText}"</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded font-black text-sm uppercase ${
                            t.verdict ? 'bg-[rgba(63,185,80,0.2)] text-[var(--success)]' : 'bg-[rgba(248,81,73,0.2)] text-[var(--error)]'
                          }`}>
                            {t.verdict ? 'VERIFIED' : 'CONTRADICTED'}
                          </span>
                          <span className="text-sm text-[var(--text-muted)] font-mono">
                            {t.eliminatedCount} Exonerated
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </StagePanel>
            </div>

            {/* Right 4 cols: Live Leaderboard */}
            <div className="col-span-4">
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>🏆 LEAD DETECTIVES</span>
                  <span className="text-sm text-[var(--text-muted)]">SCORE</span>
                </div>
                <div className="flex flex-col gap-3">
                  {lb.map((entry: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-lg">
                      <span className="text-[var(--text-muted)] font-bold mr-3">#{idx + 1}</span>
                      <span className="font-bold flex-1 truncate text-left">{entry.name}</span>
                      <span className="font-bold text-[var(--accent-primary)]">{entry.score} pts</span>
                    </div>
                  ))}
                  {lb.length === 0 && (
                    <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                      STANDBY FOR FIRST ACCUSATION...
                    </div>
                  )}
                </div>
              </StagePanel>
            </div>
          </div>
        </div>
      );
    }

    if (currentGame?.template === 'SILENT_MISSION') {
      const challenges = currentGame?.challenges || [];
      const currentChal = challenges.find((c: any) => c.id === session.currentChallengeId) || challenges[0];
      const chalConfig = currentChal?.config || {};
      const mp = sessionData.missionProgress || {
        scenarioTitle: chalConfig.scenarioTitle || chalConfig.title || currentChal?.prompt || 'CLASSIFIED INFILTRATION',
        missionBrief: chalConfig.missionBrief || '',
        operationId: chalConfig.operationId || 'OP-1',
        batteryCapacity: chalConfig.batteryCapacity || 100,
        totalAgents: sessionData.playerCount || 1,
        plansExecutedCount: 0,
        successfulInfiltrations: 0,
        activeFailures: 0,
        recentExecutions: [],
      };
      const lb = sessionData.leaderboard || [];

      return (
        <div className="w-full max-w-[95vw] mx-auto text-center font-mono">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 border-b-2 border-[var(--border-subtle)] pb-6">
            <div className="text-left">
              <div className="text-5xl font-black text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-4">
                <span>⚡</span> {currentGame?.name || 'SILENT MISSION'}
              </div>
              <div className="text-2xl text-[var(--text-muted)] tracking-[0.25em] mt-1 uppercase">
                DIRECTED ACYCLIC GRAPH PLANNING ENGINE · TACTICAL FACILITY BREACH
              </div>
            </div>
            {session.challengeStartTime && currentChal?.timeLimit && (
              <div className="text-5xl font-black text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                ⏱ <StageTimer startTime={session.challengeStartTime} timeLimit={currentChal.timeLimit} />
              </div>
            )}
          </div>

          {/* Scenario Banner */}
          <div className="mb-10 p-6 bg-[rgba(0,255,204,0.06)] border-2 border-[var(--accent-primary)] rounded-xl inline-block shadow-[0_0_25px_rgba(0,255,204,0.15)] text-left max-w-5xl w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-[var(--accent-primary)] uppercase tracking-widest">
                OPERATION: {mp.operationId} — {mp.scenarioTitle}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-[rgba(0,255,204,0.2)] text-[var(--accent-primary)] font-bold">
                MAX POWER: {mp.batteryCapacity} ⚡
              </span>
            </div>
            {mp.missionBrief && (
              <div className="text-xl text-[var(--text-primary)] leading-relaxed font-sans">
                {mp.missionBrief}
              </div>
            )}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left 8 cols: Investigation Metrics & Recent Executions */}
            <div className="col-span-8 flex flex-col gap-6">
              <StagePanel>
                <div className="grid grid-cols-4 gap-6">
                  {/* Total Agents */}
                  <div className="bg-[rgba(255,255,255,0.04)] border-2 border-[var(--border-subtle)] rounded-xl p-6 shadow-md">
                    <div className="text-[5rem] font-black text-white leading-none">
                      {mp.totalAgents}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">AGENTS IN FIELD</div>
                  </div>

                  {/* Plans Executed */}
                  <div className="bg-[rgba(0,255,204,0.08)] border-2 border-[var(--accent-primary)] rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,204,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--accent-primary)] leading-none">
                      {mp.plansExecutedCount}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">PLANS ENGAGED</div>
                  </div>

                  {/* Active Failures / Splicing */}
                  <div className="bg-[rgba(235,160,0,0.08)] border-2 border-[var(--warning)] rounded-xl p-6 shadow-[0_0_20px_rgba(235,160,0,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--warning)] leading-none">
                      {mp.activeFailures}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">ALARMS / SPLICING</div>
                  </div>

                  {/* Successful Infiltrations */}
                  <div className="bg-[rgba(63,185,80,0.1)] border-2 border-[var(--success)] rounded-xl p-6 shadow-[0_0_20px_rgba(63,185,80,0.2)]">
                    <div className="text-[5rem] font-black text-[var(--success)] leading-none">
                      {mp.successfulInfiltrations}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">EXTRACTIONS</div>
                  </div>
                </div>
              </StagePanel>

              {/* Planning Lifecycle Pipeline */}
              <StagePanel>
                <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl font-mono text-sm font-bold">
                  <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-ping" />
                    <span>DAG ANALYSIS</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-cyan-400">
                    <span>MAGNETIC DOCK SLOTS</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-yellow-400">
                    <span>BATTERY CONSTRAINT</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-[var(--accent-secondary)]">
                    <span>EXECUTE PLAN</span>
                  </div>
                  <span className="text-[var(--text-muted)]">➔</span>
                  <div className="flex items-center gap-2 text-[var(--success)]">
                    <span>CLEAN EXTRACTION</span>
                  </div>
                </div>
              </StagePanel>

              {/* Live Mission Transmissions */}
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>⚡ REAL-TIME CORRIDOR TRANSMISSIONS</span>
                  <span className="text-xs text-[var(--text-muted)]">LIVE FLEET TELEMETRY</span>
                </div>
                {mp.recentExecutions.length === 0 ? (
                  <div className="text-center py-10 text-lg text-[var(--text-muted)] font-mono animate-pulse">
                    AWAITING INITIAL PLAN LOCK &amp; EXECUTION FROM FLEET AGENTS...
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {mp.recentExecutions.map((exec: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between font-mono">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[var(--accent-primary)]">[{exec.playerName}]</span>
                          <span className="text-sm text-[var(--text-muted)]">OP: {exec.operationId}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-500/30">
                            ⚡ {exec.batteryUsed} ENERGY
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-cyan-300 border border-cyan-500/30">
                            {exec.stepsCount} STEPS
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          {exec.isCorrect ? (
                            <span className="px-3 py-1 rounded font-bold text-xs uppercase bg-[rgba(63,185,80,0.15)] text-[var(--success)] border border-[var(--success)]">
                              EXTRACTION CONFIRMED ✓
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded font-bold text-xs uppercase bg-[rgba(235,160,0,0.15)] text-[var(--warning)] border border-[var(--warning)]">
                              CAUSAL FAILURE · SPLICING
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </StagePanel>
            </div>

            {/* Right 4 cols: Live Leaderboard */}
            <div className="col-span-4">
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>🏆 TACTICAL OPERATIVES</span>
                  <span className="text-sm text-[var(--text-muted)]">SCORE</span>
                </div>
                <div className="flex flex-col gap-3">
                  {lb.map((entry: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-lg">
                      <span className="text-[var(--text-muted)] font-bold mr-3">#{idx + 1}</span>
                      <span className="font-bold flex-1 truncate text-left">{entry.name}</span>
                      <span className="font-bold text-[var(--accent-primary)]">{entry.score} pts</span>
                    </div>
                  ))}
                  {lb.length === 0 && (
                    <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                      STANDBY FOR FIRST INFILTRATION...
                    </div>
                  )}
                </div>
              </StagePanel>
            </div>
          </div>
        </div>
      );
    }

    if (currentGame?.template === 'SIGNAL_ROUTER') {
      const challenges = currentGame?.challenges || [];
      const currentChal = challenges.find((c: any) => c.id === session.currentChallengeId) || challenges[0];
      const chalConfig = currentChal?.config || {};
      const stream = chalConfig.stream || {};
      const graph = chalConfig.graph || { nodes: [], links: [], sourceNodeId: 'NODE_TX', targetNodeId: 'NODE_RX' };
      const nodes: any[] = Array.isArray(graph.nodes) ? graph.nodes : [];
      const links: any[] = Array.isArray(graph.links) ? graph.links : [];

      const rp = sessionData.routerProgress || {
        scenarioTitle: chalConfig.scenarioTitle || currentChal?.prompt || 'SUBNET TRAFFIC CONTROL',
        missionBrief: chalConfig.missionBrief || '',
        streamVolumeGbps: Number(stream.payloadVolumeGbps || 4.5),
        slaMaxLatencyMs: Number(stream.slaMaxLatencyMs || 80),
        slaMaxLossPercent: Number(stream.slaMaxLossPercent ?? 0.0),
        totalControllers: sessionData.playerCount || 1,
        transmissionsCount: 0,
        successfulDeliveries: 0,
        activeCongestions: 0,
        recentTransmissions: [],
        activeControllers: [],
      };
      const lb = sessionData.leaderboard || [];

      return (
        <div className="w-full max-w-[95vw] mx-auto text-center font-mono">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 border-b-2 border-[var(--border-subtle)] pb-6">
            <div className="text-left">
              <div className="text-5xl font-black text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-4">
                <span>🌐</span> {currentGame?.name || 'SIGNAL ROUTER'}
              </div>
              <div className="text-2xl text-[var(--text-muted)] tracking-[0.25em] mt-1 uppercase">
                GRAPH ROUTING &amp; CAPACITY CONSTRAINTS · REAL-TIME CONGESTION CONTROL
              </div>
            </div>
            {session.challengeStartTime && currentChal?.timeLimit && (
              <div className="text-5xl font-black text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                ⏱ <StageTimer startTime={session.challengeStartTime} timeLimit={currentChal.timeLimit} />
              </div>
            )}
          </div>

          {/* Scenario Banner */}
          <div className="mb-10 p-6 bg-[rgba(0,255,204,0.06)] border-2 border-[var(--accent-primary)] rounded-xl inline-block shadow-[0_0_25px_rgba(0,255,204,0.15)] text-left max-w-5xl w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-[var(--accent-primary)] uppercase tracking-widest">
                SCENARIO: {rp.scenarioTitle}
              </span>
              <div className="flex gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded bg-[rgba(0,255,204,0.2)] text-[var(--accent-primary)] font-bold">
                  STREAM: {rp.streamVolumeGbps} Gbps
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  LATENCY SLA: &le; {rp.slaMaxLatencyMs}ms
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                  LOSS SLA: {rp.slaMaxLossPercent === 0 ? '0% (ZERO LOSS)' : `${rp.slaMaxLossPercent}%`}
                </span>
              </div>
            </div>
            {rp.missionBrief && (
              <div className="text-xl text-[var(--text-primary)] leading-relaxed font-sans mt-2">
                {rp.missionBrief}
              </div>
            )}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left 8 cols: Telemetry Counters, Topology Canvas, & Real-Time Dispatches */}
            <div className="col-span-8 flex flex-col gap-6">
              {/* Telemetry Stat Cards */}
              <StagePanel>
                <div className="grid grid-cols-4 gap-6">
                  {/* Controllers */}
                  <div className="bg-[rgba(255,255,255,0.04)] border-2 border-[var(--border-subtle)] rounded-xl p-6 shadow-md">
                    <div className="text-[5rem] font-black text-white leading-none">
                      {rp.totalControllers}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">CONTROLLERS ACTIVE</div>
                  </div>

                  {/* Transmissions */}
                  <div className="bg-[rgba(0,255,204,0.08)] border-2 border-[var(--accent-primary)] rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,204,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--accent-primary)] leading-none">
                      {rp.transmissionsCount}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">DISPATCHES</div>
                  </div>

                  {/* Deliveries */}
                  <div className="bg-[rgba(63,185,80,0.08)] border-2 border-[var(--success)] rounded-xl p-6 shadow-[0_0_20px_rgba(63,185,80,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--success)] leading-none">
                      {rp.successfulDeliveries}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">DELIVERED SLA OK</div>
                  </div>

                  {/* Congestions */}
                  <div className="bg-[rgba(248,81,73,0.08)] border-2 border-[var(--error)] rounded-xl p-6 shadow-[0_0_20px_rgba(248,81,73,0.15)]">
                    <div className="text-[5rem] font-black text-[var(--error)] leading-none">
                      {rp.activeCongestions}
                    </div>
                    <div className="text-lg font-bold text-[var(--text-secondary)] mt-2 uppercase">BUFFER OVERFLOWS</div>
                  </div>
                </div>
              </StagePanel>

              {/* Network Topology Heatmap */}
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>🌐 LIVE MESH TOPOLOGY &amp; TRUNK UTILIZATION</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">GLOBAL BUFFER STATUS</span>
                </div>
                <div className="relative w-full h-[280px] bg-black/50 border border-[var(--border-subtle)] rounded-xl overflow-hidden p-4">
                  <svg className="w-full h-full" viewBox="0 0 1000 280">
                    <defs>
                      <linearGradient id="trunkGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00ffcc" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3fb950" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    {/* Render Links */}
                    {links.map((link: any, idx: number) => {
                      const fromNode = nodes.find((n: any) => n.id === link.from);
                      const toNode = nodes.find((n: any) => n.id === link.to);
                      if (!fromNode || !toNode) return null;
                      const x1 = ((fromNode.x ?? 10) / 100) * 900 + 50;
                      const y1 = ((fromNode.y ?? 50) / 100) * 200 + 40;
                      const x2 = ((toNode.x ?? 90) / 100) * 900 + 50;
                      const y2 = ((toNode.y ?? 50) / 100) * 200 + 40;
                      const cap = Number(link.capacityGbps || 10);
                      const bgLoad = Number(link.backgroundLoadGbps || 0);
                      const usage = cap > 0 ? bgLoad / cap : 0;
                      const isHighLoad = usage >= 0.75;
                      const strokeColor = isHighLoad ? '#f59e0b' : '#00ffcc55';

                      return (
                        <g key={link.id || idx}>
                          <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={strokeColor}
                            strokeWidth={isHighLoad ? 3 : 2}
                            strokeDasharray={isHighLoad ? '4 2' : 'none'}
                          />
                          <text
                            x={(x1 + x2) / 2}
                            y={(y1 + y2) / 2 - 6}
                            fill={isHighLoad ? '#f59e0b' : '#64748b'}
                            fontSize="10"
                            textAnchor="middle"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {cap}G ({bgLoad}G)
                          </text>
                        </g>
                      );
                    })}

                    {/* Render Nodes */}
                    {nodes.map((node: any) => {
                      const nx = ((node.x ?? 50) / 100) * 900 + 50;
                      const ny = ((node.y ?? 50) / 100) * 200 + 40;
                      const isSource = node.id === graph.sourceNodeId || node.type === 'INGRESS';
                      const isTarget = node.id === graph.targetNodeId || node.type === 'EGRESS';
                      const fillColor = isSource ? '#00ffcc' : isTarget ? '#3fb950' : '#1e293b';
                      const strokeColor = isSource ? '#00ffcc' : isTarget ? '#3fb950' : '#475569';

                      return (
                        <g key={node.id}>
                          <circle
                            cx={nx} cy={ny} r={isSource || isTarget ? 16 : 12}
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth={2}
                            filter={isSource || isTarget ? 'drop-shadow(0 0 8px rgba(0,255,204,0.6))' : 'none'}
                          />
                          <text
                            x={nx}
                            y={ny + 24}
                            fill="#f8fafc"
                            fontSize="11"
                            textAnchor="middle"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {node.id}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </StagePanel>

              {/* Real-time Dispatches Ticker */}
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>📡 REAL-TIME ROUTE DISPATCHES</span>
                  <span className="text-xs text-[var(--text-muted)]">FLEET TELEMETRY</span>
                </div>
                {rp.recentTransmissions.length === 0 ? (
                  <div className="text-center py-10 text-lg text-[var(--text-muted)] font-mono animate-pulse">
                    AWAITING INITIAL ROUTE DISPATCHES FROM NETWORK CONTROLLERS...
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {rp.recentTransmissions.map((t: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between font-mono">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[var(--accent-primary)]">[{t.playerName}]</span>
                          <span className="text-sm text-cyan-300 font-semibold">{t.pathText}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-500/30">
                            ⏱ {t.latencyMs}ms
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded bg-black/40 border ${t.packetLossPercent === 0 ? 'text-emerald-300 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                            📦 {t.packetLossPercent}% LOSS
                          </span>
                        </div>
                        <div>
                          {t.isSuccess ? (
                            <span className="px-3 py-1 bg-[rgba(63,185,80,0.2)] text-[var(--success)] border border-[var(--success)] text-sm font-bold rounded">
                              ✓ DELIVERED
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-[rgba(248,81,73,0.2)] text-[var(--error)] border border-[var(--error)] text-sm font-bold rounded">
                              ⚠ OVERFLOW {t.bottleneckLink || ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </StagePanel>
            </div>

            {/* Right 4 cols: Leaderboard & Controller Fleet */}
            <div className="col-span-4 flex flex-col gap-6">
              {/* Leaderboard */}
              <StagePanel>
                <div className="text-2xl font-black text-[var(--accent-primary)] tracking-widest uppercase mb-6 flex items-center justify-between">
                  <span>🏆 TRAFFIC CONTROLLERS</span>
                  <span className="text-xs text-[var(--text-muted)]">TOP RANKS</span>
                </div>
                <div className="flex flex-col gap-3">
                  {lb.slice(0, 8).map((entry: any, idx: number) => (
                    <div key={entry.id || idx} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between font-mono">
                      <div className="flex items-center gap-4">
                        <span className={`text-2xl font-black ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-[var(--text-muted)]'}`}>
                          #{idx + 1}
                        </span>
                        <span className="text-lg font-bold text-white">{entry.displayName || entry.name}</span>
                      </div>
                      <span className="text-2xl font-black text-[var(--accent-primary)]">{entry.score}</span>
                    </div>
                  ))}
                  {lb.length === 0 && (
                    <div className="text-center py-6 text-[var(--text-muted)]">
                      STANDBY FOR FIRST TRANSMISSION SCORE...
                    </div>
                  )}
                </div>
              </StagePanel>
            </div>
          </div>
        </div>
      );
    }

    if (currentGame?.template === 'LOGIC_HEIST') {
      const challenges = currentGame?.challenges || [];
      const entities = Object.keys(sessionData.chainProgress || {});
      const totalEntities = Math.max(entities.length, sessionData.teamCount || sessionData.playerCount);
      const completedEntities = entities.filter(e => sessionData.chainProgress[e] === 'COMPLETED').length;
      const solvingEntities = totalEntities - completedEntities;
      const totalVaults = challenges.length;
      const activeChallengeIds = Object.values(sessionData.chainProgress || {}).filter(id => id !== 'COMPLETED');
      const currentVault = challenges.find((c: any) => activeChallengeIds.includes(c.id)) || challenges[0];
      const targetState = currentVault?.config?.targetState || {};
      const lb = sessionData.leaderboard || [];

      // Check if current vault involves iteration / repetition
      const loopBlock = (currentVault?.config?.blocks || []).find((b: any) => b.operation === 'LOOP');
      const isIterationVault = Boolean(loopBlock || currentVault?.config?.concepts?.includes('ITERATION') || currentVault?.config?.vault === 2);

      // Check if current vault involves conditional logic
      const ifBlock = (currentVault?.config?.blocks || []).find((b: any) => b.operation === 'IF');
      const isConditionalVault = Boolean(ifBlock || currentVault?.config?.concepts?.includes('CONDITIONALS') || currentVault?.config?.vault === 3);

      return (
        <div className="w-full max-w-[95vw] mx-auto text-center">
          <div className="flex justify-between items-center mb-8 border-b-2 border-[var(--border-subtle)] pb-6">
            <div className="text-left">
              <div className="text-5xl font-black text-[var(--accent-primary)] uppercase tracking-wider">
                {currentGame?.name || 'LOGIC HEIST'}
              </div>
              <div className="text-2xl text-[var(--text-muted)] font-mono tracking-[0.25em] mt-1">
                OPERATION NIGHTFALL · SECURITY GRID
              </div>
            </div>
            {session.challengeStartTime && currentVault?.timeLimit && (
              <div className="text-5xl font-black font-mono text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                ⏱ <StageTimer startTime={session.challengeStartTime} timeLimit={currentVault.timeLimit} />
              </div>
            )}
          </div>

          {/* Target Objective Banner */}
          {Object.keys(targetState).length > 0 && (
            <div className="mb-10 p-6 bg-[rgba(0,255,204,0.06)] border-2 border-[var(--accent-primary)] rounded-xl inline-block shadow-[0_0_20px_rgba(0,255,204,0.15)]">
              <span className="text-2xl text-[var(--text-muted)] font-mono tracking-widest mr-4">PRIMARY OBJECTIVE:</span>
              <span className="text-4xl font-mono font-bold text-[var(--accent-primary)]">
                REACH TARGET STATE [ {Object.entries(targetState).map(([k, v]) => `${k} = ${v}`).join(', ')} ]
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left 8 cols: Stats Grid */}
            <div className="col-span-8">
              <StagePanel>
                <div className="grid grid-cols-3 gap-8">
                  {/* Vaults */}
                  <div className="bg-[rgba(0,255,204,0.05)] border-2 border-[var(--accent-primary)] rounded-xl p-8 shadow-[0_0_20px_rgba(0,255,204,0.15)]">
                    <div className="text-[6rem] font-black font-mono text-[var(--accent-primary)] drop-shadow-[0_0_15px_rgba(0,255,204,0.5)]">
                      {totalVaults}
                    </div>
                    <div className="text-2xl font-sans font-bold text-[var(--text-secondary)] mt-2">TOTAL VAULTS</div>
                  </div>
                  
                  {/* Breaching */}
                  <div className="bg-[rgba(255,180,0,0.08)] border-2 border-[var(--warning)] rounded-xl p-8 shadow-[0_0_20px_rgba(255,180,0,0.15)]">
                    <div className="text-[6rem] font-black font-mono text-[var(--warning)] drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]">
                      {solvingEntities}
                    </div>
                    <div className="text-2xl font-sans font-bold text-[var(--text-secondary)] mt-2">BREACHING</div>
                  </div>

                  {/* Cracked */}
                  <div className="bg-[rgba(63,185,80,0.1)] border-2 border-[var(--success)] rounded-xl p-8 shadow-[0_0_20px_rgba(63,185,80,0.2)]">
                    <div className="text-[6rem] font-black font-mono text-[var(--success)] drop-shadow-[0_0_15px_rgba(63,185,80,0.5)]">
                      {completedEntities}
                    </div>
                    <div className="text-2xl font-sans font-bold text-[var(--text-secondary)] mt-2">CRACKED</div>
                  </div>
                </div>
              </StagePanel>
              
              {isIterationVault && (
                <div className="mt-8 p-6 bg-[rgba(0,255,204,0.06)] border-2 border-[var(--accent-primary)] rounded-xl text-left shadow-[0_0_20px_rgba(0,255,204,0.15)]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-2xl font-mono text-[var(--accent-primary)] font-black tracking-wider flex items-center gap-3">
                      <span>🔁</span> REPETITION MECHANISM: {loopBlock?.label || `LOOP ×${loopBlock?.loopCount || 3}`}
                    </span>
                    <span className="text-lg font-mono text-[var(--text-muted)] font-bold">
                      {loopBlock?.loopCount || 3} REPETITIONS REQUIRED
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: loopBlock?.loopCount || 3 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-[rgba(0,255,204,0.1)] border-2 border-[var(--accent-primary)] rounded-lg p-5 text-center shadow-[0_0_10px_rgba(0,255,204,0.1)]"
                      >
                        <div className="text-sm font-mono text-[var(--text-muted)] font-bold">CYCLE #{idx + 1}</div>
                        <div className="text-3xl font-mono font-black text-[var(--accent-primary)] mt-1">
                          +{loopBlock?.value || 3}
                        </div>
                        <div className="text-sm font-mono text-[var(--text-secondary)] mt-1">
                          ACCUMULATOR: {((idx + 1) * (loopBlock?.value || 3))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-between items-center text-sm font-mono text-[var(--text-muted)]">
                    <span className="text-[var(--accent-secondary)]">SERVER EXECUTION: EXPANDING LOOP SEQUENCE</span>
                    <span className="text-[var(--success)] font-bold">TARGET: {Object.entries(targetState).map(([k, v]) => `${k} = ${v}`).join(', ')}</span>
                  </div>
                </div>
              )}

              {isConditionalVault && (
                <div className="mt-8 p-6 bg-[rgba(255,180,0,0.06)] border-2 border-[var(--warning)] rounded-xl text-left shadow-[0_0_20px_rgba(255,180,0,0.15)]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-2xl font-mono text-[var(--warning)] font-black tracking-wider flex items-center gap-3">
                      <span>🔀</span> DECISION MECHANISM: {ifBlock?.label || 'CONDITIONAL SENSOR BRANCHING'}
                    </span>
                    <span className="text-lg font-mono text-[var(--text-muted)] font-bold">
                      REACTIVE SENSOR GRID
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-4">
                    {/* True Path */}
                    <div className="bg-[rgba(63,185,80,0.08)] border-2 border-[var(--success)] rounded-lg p-5">
                      <div className="flex justify-between items-center text-sm font-mono font-bold text-[var(--success)]">
                        <span>✓ TRUE BRANCH (IF {ifBlock?.condition ? `${ifBlock.condition.variable} ${ifBlock.condition.operator} ${ifBlock.condition.value}` : 'MATCH'})</span>
                        <span className="bg-[rgba(63,185,80,0.2)] px-2 py-0.5 rounded text-xs">ACTION</span>
                      </div>
                      <div className="text-2xl font-mono font-black text-white mt-2">
                        {ifBlock?.trueBranch?.label || 'DAMPEN LASER'}
                      </div>
                      <div className="text-xs font-mono text-[var(--text-secondary)] mt-1">
                        OPERATION: {ifBlock?.trueBranch?.operation || 'SUB'} {ifBlock?.trueBranch?.variable || 'LASER'} {ifBlock?.trueBranch?.value ?? 50}
                      </div>
                    </div>

                    {/* False Path */}
                    <div className="bg-[rgba(0,255,204,0.08)] border-2 border-[var(--accent-primary)] rounded-lg p-5">
                      <div className="flex justify-between items-center text-sm font-mono font-bold text-[var(--accent-primary)]">
                        <span>✗ FALSE BRANCH (OTHERWISE)</span>
                        <span className="bg-[rgba(0,255,204,0.2)] px-2 py-0.5 rounded text-xs">FALLBACK</span>
                      </div>
                      <div className="text-2xl font-mono font-black text-white mt-2">
                        {ifBlock?.falseBranch?.label || 'BOOST POWER'}
                      </div>
                      <div className="text-xs font-mono text-[var(--text-secondary)] mt-1">
                        OPERATION: {ifBlock?.falseBranch?.operation || 'ADD'} {ifBlock?.falseBranch?.variable || 'LASER'} {ifBlock?.falseBranch?.value ?? 20}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center text-sm font-mono text-[var(--text-muted)]">
                    <span className="text-[var(--warning)]">EVALUATION: SENSOR-DRIVEN SERVER LOGIC</span>
                    <span className="text-[var(--success)] font-bold">TARGET: {Object.entries(targetState).map(([k, v]) => `${k} = ${v}`).join(', ')}</span>
                  </div>
                </div>
              )}

              <div className="mt-8 text-2xl text-[var(--text-muted)] font-mono animate-pulse tracking-widest text-center">
                AGENTS ARE EXECUTING LOGIC CHAINS...
              </div>
            </div>

            {/* Right 4 cols: Live Agent Leaderboard */}
            <div className="col-span-4 text-left">
              <StagePanel title="AGENT STANDINGS">
                <div className="flex flex-col gap-3">
                  {lb.slice(0, 5).map((entry: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-lg">
                      <span className="font-mono text-[var(--text-muted)] font-bold mr-3">#{idx + 1}</span>
                      <span className="font-bold flex-1 truncate">{entry.name}</span>
                      <span className="font-mono font-bold text-[var(--accent-primary)]">{entry.score} pts</span>
                    </div>
                  ))}
                  {lb.length === 0 && (
                    <div className="text-center py-6 font-mono text-sm text-[var(--text-muted)]">
                      STANDBY FOR FIRST BREACH...
                    </div>
                  )}
                </div>
              </StagePanel>
            </div>
          </div>
        </div>
      );
    }

    const challenge = currentGame?.challenges?.find((c: any) => c.id === session.currentChallengeId);
    
    return (
      <div className="w-full max-w-[90vw] mx-auto">
        <div className="flex justify-between mb-16 border-b-2 border-[var(--border-subtle)] pb-8 items-end">
          <div className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] uppercase">
            {currentGame?.template === 'RAPID_FIRE' && <span className="text-[var(--accent-primary)] mr-4">⚡</span>}
            {currentGame?.name}
          </div>
          <div className="text-4xl text-[var(--accent-secondary)] font-mono">
            QUESTION {currentGame?.challenges?.findIndex((c: any) => c.id === session.currentChallengeId) + 1} / {currentGame?.challenges?.length}
          </div>
        </div>
        
        {challenge && (
          <>
            <StagePanel>
              <h1 className="text-7xl font-black mb-16 leading-tight">{challenge.prompt}</h1>
              
              <div className="grid grid-cols-2 gap-8">
                {challenge.options?.map((opt: string, i: number) => (
                  <div key={i} className="p-8 text-4xl bg-[var(--bg-elevated)] rounded-xl border-2 border-[var(--border-subtle)] font-sans font-bold flex items-center">
                    <strong className="text-[var(--accent-primary)] mr-6 font-mono text-5xl">{String.fromCharCode(65 + i)}.</strong> 
                    {opt}
                  </div>
                ))}
              </div>
            </StagePanel>
            
            <div className="flex justify-between mt-20 items-center">
              <div className="text-[7rem] font-black font-mono text-[var(--accent-primary)] drop-shadow-[0_0_20px_rgba(0,255,204,0.3)]">
                <StageTimer startTime={session.challengeStartTime} timeLimit={challenge.timeLimit} />
              </div>
              <div className="text-5xl font-mono text-[var(--text-secondary)]">
                <strong className="text-[var(--accent-primary)] text-[5rem] mr-4">{sessionData.answersCount || 0}</strong> / {playerCount} ANSWERED
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAnswerReveal = () => {
    const challenge = currentGame?.challenges?.find((c: any) => c.id === session.currentChallengeId);
    if (!challenge) return <div>No active challenge</div>;

    const correctIdx = challenge.options?.findIndex((o: string) => o === challenge.answer);
    
    return (
      <div className="w-full max-w-5xl mx-auto text-center">
        <h2 className="text-5xl text-[var(--text-muted)] font-mono tracking-widest mb-16">ANSWERS LOCKED</h2>
        
        <StagePanel>
          <h1 className="text-7xl font-black text-[var(--success)] mb-8 drop-shadow-[0_0_15px_rgba(63,185,80,0.4)]">CORRECT ANSWER</h1>
          
          <div className="text-[10rem] font-black font-mono text-[var(--success)] my-12 drop-shadow-[0_0_30px_rgba(63,185,80,0.6)]">
            {correctIdx !== -1 ? String.fromCharCode(65 + correctIdx) : 'N/A'}
          </div>
          
          <div className="text-6xl bg-[rgba(63,185,80,0.15)] border-2 border-[var(--success)] p-12 rounded-xl inline-block font-sans font-bold shadow-[0_0_20px_rgba(63,185,80,0.2)]">
            {challenge.answer}
          </div>
        </StagePanel>
      </div>
    );
  };

  const renderLeaderboard = () => {
    const lb = sessionData.leaderboard || [
      { name: 'BUG BUSTERS', score: 840 },
      { name: 'NULL POINTERS', score: 790 },
      { name: 'BYTE FORCE', score: 750 }
    ];
    
    return (
      <div className="w-full max-w-5xl mx-auto">
        <h1 className="text-8xl font-black text-center mb-20 text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">LIVE STANDINGS</h1>
        
        <StagePanel>
          <div className="flex flex-col gap-6">
            {lb.map((entry: any, idx: number) => (
              <div key={idx} className={`flex justify-between items-center px-12 py-8 rounded-xl border-2 text-5xl font-bold
                ${idx === 0 ? 'bg-[rgba(0,255,204,0.1)] border-[var(--accent-primary)] shadow-[0_0_20px_rgba(0,255,204,0.2)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'}
              `}>
                <div className="flex items-center gap-12">
                  <span className={`w-12 text-center font-black font-mono ${idx === 0 ? 'text-[var(--game-gold)]' : idx === 1 ? 'text-[var(--game-silver)]' : idx === 2 ? 'text-[var(--game-bronze)]' : 'text-[var(--text-muted)]'}`}>{idx + 1}</span>
                  <span className="font-sans uppercase tracking-wide">{entry.name}</span>
                </div>
                <div className="font-mono text-[var(--accent-primary)] drop-shadow-[0_0_10px_rgba(0,255,204,0.4)]">{entry.score}</div>
              </div>
            ))}
          </div>
        </StagePanel>
      </div>
    );
  };

  const renderFinalResults = () => {
    const lb = sessionData.leaderboard || [
      { name: 'BUG BUSTERS', score: 1240 },
      { name: 'NULL POINTERS', score: 1100 },
    ];
    
    return (
      <div className="text-center">
        <h2 className="text-5xl text-[var(--text-muted)] mb-12 font-mono tracking-widest">GAME COMPLETE</h2>
        <div className="text-[8rem] my-16 animate-bounce">🏆</div>
        <StagePanel className="inline-block px-32 py-16">
          <h1 className="text-9xl font-black text-[var(--accent-primary)] mb-8 drop-shadow-[0_0_30px_rgba(0,255,204,0.6)] uppercase">
            {lb[0]?.name || 'WINNER'}
          </h1>
          <h3 className="text-7xl font-mono text-white">
            {lb[0]?.score || 0} POINTS
          </h3>
        </StagePanel>
      </div>
    );
  };

  const renderPaused = () => (
    <div className="text-center">
      <StagePanel className="inline-block border-[var(--error)] shadow-[0_0_30px_rgba(255,51,102,0.3)]">
        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[var(--error)]" />
        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[var(--error)]" />
        
        <h1 className="text-9xl font-black mb-12 text-[var(--error)] drop-shadow-[0_0_20px_rgba(255,51,102,0.5)] uppercase tracking-widest">PAUSED</h1>
        <h3 className="text-5xl text-[var(--text-muted)] leading-relaxed font-mono">
          PLEASE WAIT<br/>
          GAME MASTER WILL RESUME SHORTLY
        </h3>
      </StagePanel>
    </div>
  );

  const renderBlank = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-7xl tracking-[0.6em] text-[rgba(255,255,255,0.03)] font-black font-mono">
        TERMINAL
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[var(--bg-base)] text-white flex flex-col overflow-hidden scanlines grid-overlay relative">
      <div className={`absolute top-8 right-8 flex items-center gap-4 text-2xl font-bold font-mono z-50 ${connected ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
        <div className={`w-4 h-4 rounded-full ${connected ? 'bg-[var(--success)] shadow-[0_0_15px_var(--success)]' : 'bg-[var(--error)] shadow-[0_0_15px_var(--error)]'}`} />
        {connected ? 'LIVE' : 'RECONNECTING'}
      </div>

      <div className="flex-1 flex items-center justify-center p-16 relative z-10 overflow-auto">
        {stageMode === 'LOBBY' && renderLobby()}
        {stageMode === 'ANNOUNCEMENT' && renderAnnouncement()}
        {stageMode === 'COUNTDOWN' && renderCountdown()}
        {stageMode === 'QUESTION' && renderQuestion()}
        {stageMode === 'ANSWER_REVEAL' && renderAnswerReveal()}
        {stageMode === 'LEADERBOARD' && renderLeaderboard()}
        {stageMode === 'TEAM_LEADERBOARD' && renderLeaderboard()}
        {stageMode === 'FINAL_RESULTS' && renderFinalResults()}
        {stageMode === 'PAUSED' && renderPaused()}
        {stageMode === 'BLANK' && renderBlank()}
      </div>
    </div>
  );
}
