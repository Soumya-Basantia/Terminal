import React, { useEffect, useState } from 'react';
import { TerminalSection, TerminalText, TerminalError, TerminalSuccess } from '../../components/outputs';
import { api } from '../../../../lib/api';
import { connectSocket, disconnectSocket, getSocket } from '../../../../lib/socket';

interface BattleLobbyProps {
  roomCode: string;
}

export const BattleLobby: React.FC<BattleLobbyProps> = ({ roomCode }) => {
  const [state, setState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [sessionPlayer, setSessionPlayer] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const res = await api.post('/sessions/join', { roomCode });
        
        if (!mounted) return;
        setSessionPlayer(res.data.sessionPlayer);
        
        const socket = connectSocket();
        socket.emit('player:join', { 
          roomCode
        });

        socket.on('session_state_update', (data) => {
          if (mounted) {
            setSessionData(data);
            setState('connected');
          }
        });

      } catch (err: any) {
        if (mounted) {
          setState('error');
          setErrorMsg(err.response?.data?.error || err.message || 'Connection failed');
        }
      }
    };

    init();

    return () => {
      mounted = false;
      const socket = getSocket();
      socket.off('session_state_update');
    };
  }, [roomCode]);

  if (state === 'connecting') {
    return (
      <div className="font-mono">
        <TerminalText>Connecting to battle...</TerminalText>
        <div className="my-2 ml-2">
          <div className="text-zinc-400">Room:</div>
          <div className="text-cyan-400 font-bold text-xl">{roomCode.toUpperCase()}</div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="font-mono">
        <TerminalError>{errorMsg}</TerminalError>
      </div>
    );
  }

  if (!sessionData) return null;

  let activeChallenge: any = null;
  let isChainCompleted = false;
  let isChainReaction = sessionData.currentGame?.template === 'CHAIN_REACTION' || sessionData.currentGame?.template === 'DATA_HUNT';

  if (isChainReaction) {
    if (sessionData.session.status === 'ROUND_ACTIVE') {
      const entityId = sessionPlayer?.teamId || sessionPlayer?.id;
      const myChainChallengeId = sessionData.chainProgress?.[entityId];
      if (myChainChallengeId === 'COMPLETED') {
         isChainCompleted = true;
      } else if (myChainChallengeId) {
         activeChallenge = sessionData.currentGame?.challenges?.find((c: any) => c.id === myChainChallengeId);
      }
    }
  } else if (sessionData.session.status === 'QUESTION_ACTIVE' || sessionData.session.status === 'QUESTION_LOCKED' || sessionData.session.status === 'QUESTION_RESULTS') {
    activeChallenge = sessionData.currentGame?.challenges?.find((c: any) => c.id === sessionData.session.currentChallengeId);
  }

  if (isChainCompleted) {
    return (
      <div className="font-mono mt-4 border border-zinc-700 p-4 max-w-2xl bg-zinc-900/50">
        <div className="text-emerald-400 font-bold text-2xl uppercase blink mb-4">
          ✓ MISSION COMPLETE
        </div>
        <div className="text-zinc-300">
          You have successfully unlocked all nodes in the chain.
          Waiting for Game Master to end the round.
        </div>
      </div>
    );
  }

  if (activeChallenge) {
    const config = activeChallenge.config || {};
      
      return (
        <div className="font-mono mt-4 border border-zinc-700 p-4 max-w-2xl bg-zinc-900/50">
          <div className="text-cyan-400 font-bold mb-4 uppercase flex justify-between">
            <span>QUESTION: {activeChallenge.prompt}</span>
            <span className="text-amber-400">{activeChallenge.points} PTS</span>
          </div>
          
          {activeChallenge.type === 'MULTIPLE_CHOICE' || activeChallenge.type === 'SINGLE_CHOICE' ? (
            <div className="ml-4 mb-6 grid gap-2">
              {(config.options || []).map((opt: string, idx: number) => (
                <div key={idx} className="flex gap-4">
                  <span className="text-zinc-500">[{String.fromCharCode(65 + idx)}]</span>
                  <span className="text-zinc-300">{opt}</span>
                </div>
              ))}
            </div>
          ) : activeChallenge.type === 'BLOCK_CONSTRUCTION' ? (
            <div className="ml-4 mb-6">
              <div className="text-zinc-400 mb-2">AVAILABLE BLOCKS:</div>
              <div className="flex flex-wrap gap-2">
                {(config.options || []).map((opt: string, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-zinc-800 text-emerald-400 border border-emerald-900">
                    [{opt}]
                  </span>
                ))}
              </div>
            </div>
          ) : ['VARIABLE_SIMULATION', 'LOOP_SIMULATION', 'DECISION', 'CONSEQUENCE', 'CODE_REVEAL'].includes(activeChallenge.type) ? (
             <div className="ml-4 mb-6 text-zinc-400 italic">
               (System Context Active)
             </div>
          ) : null}
          
        <div className="mt-4 border-t border-zinc-800 pt-4">
          {(sessionData.session.status === 'QUESTION_ACTIVE' || sessionData.session.status === 'ROUND_ACTIVE') ? (
            <div className="text-emerald-400 animate-pulse">
              TYPE 'submit &lt;ANSWER&gt;' to submit your choice.
            </div>
          ) : sessionData.session.status === 'QUESTION_LOCKED' ? (
            <div className="text-amber-500">
              QUESTION LOCKED. AWAITING RESULTS...
            </div>
          ) : (
            <div className="text-cyan-400">
              RESULTS REVEALED. (Check projector / Game Master screen)
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sessionData.session.status === 'RESULTS') {
    return (
      <div className="font-mono mt-4 border-y border-zinc-700 py-4 max-w-lg">
        <div className="text-zinc-400 mb-4 uppercase">PREVIOUS GAME COMPLETE</div>
        
        {/* We would fetch the student's personal score here or they can check stage */}
        <div className="text-emerald-400 mb-6 font-bold">
          Check the Stage projector for the live leaderboard!
        </div>

        <div className="text-zinc-400 mb-2 uppercase">NEXT GAME</div>
        <div className="text-cyan-400 font-bold text-xl uppercase tracking-widest mb-4 flex items-center gap-2">
          ⚡ {sessionData.currentGame ? sessionData.currentGame.name : 'TBD...'}
        </div>

        <div className="text-amber-400 blink">Waiting for Game Master...</div>
      </div>
    );
  }

  return (
    <div className="font-mono mt-4">
      <div className="border-double border-4 border-zinc-700 p-4 max-w-lg">
        <div className="text-center font-bold text-cyan-400 text-xl tracking-widest mb-4 uppercase">
          {sessionData.event.name}
        </div>
        
        {sessionData.session.status === 'STARTING' && (
          <div className="mb-6 text-center border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="text-emerald-400 font-bold mb-1">GAME STARTED</div>
            <div className="text-2xl text-white font-black uppercase tracking-widest">
              {sessionData.currentGame ? sessionData.currentGame.name : ''}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="text-zinc-400">ROOM</div>
          <div className="text-zinc-200 font-bold">{sessionData.session.roomCode}</div>
          
          <div className="text-zinc-400">STATUS</div>
          <div className="text-zinc-200">{sessionData.session.status}</div>
          
          <div className="text-zinc-400">PLAYERS</div>
          <div className="text-zinc-200">{sessionData.playerCount}</div>
          
          <div className="text-zinc-400">TEAMS</div>
          <div className="text-zinc-200">{sessionData.teamCount}</div>

          <div className="text-zinc-400">CURRENT GAME</div>
          <div className="text-cyan-400 font-bold">{sessionData.currentGame ? sessionData.currentGame.name : 'N/A'}</div>
        </div>
        <div className="text-center text-amber-400 font-bold mt-6 blink">
          {sessionData.session.status === 'LOBBY' ? 'WAITING FOR GAME MASTER' : 
           sessionData.session.status === 'ENDED' ? 'EVENT HAS ENDED' : sessionData.session.status}
        </div>
      </div>
    </div>
  );
};
