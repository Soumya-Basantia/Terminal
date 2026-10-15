import { useEffect } from 'react';
import type { SpotlightModuleId } from './SpotlightModule';

interface UseHostKeyboardShortcutsOptions {
  activeSpotlightId: SpotlightModuleId | null;
  onSelectSpotlight: (id: SpotlightModuleId | null) => void;
  isModalOpen?: boolean;
}

export function useHostKeyboardShortcuts({
  activeSpotlightId,
  onSelectSpotlight,
  isModalOpen = false,
}: UseHostKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing into an input field or modal is open
      if (isModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      // Escape: Restore dashboard
      if (e.key === 'Escape') {
        if (activeSpotlightId !== null) {
          e.preventDefault();
          onSelectSpotlight(null);
        }
        return;
      }

      // Check key combos without Ctrl/Meta/Alt
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toUpperCase();
      switch (key) {
        case 'Q':
          e.preventDefault();
          onSelectSpotlight(activeSpotlightId === 'question' ? null : 'question');
          break;
        case 'L':
          e.preventDefault();
          onSelectSpotlight(activeSpotlightId === 'leaderboard' ? null : 'leaderboard');
          break;
        case 'T':
        case 'P':
          e.preventDefault();
          onSelectSpotlight(activeSpotlightId === 'teams-progress' ? null : 'teams-progress');
          break;
        case 'S':
          e.preventDefault();
          onSelectSpotlight(activeSpotlightId === 'session-stats' ? null : 'session-stats');
          break;
        case 'A':
          e.preventDefault();
          onSelectSpotlight(activeSpotlightId === 'recent-activity' ? null : 'recent-activity');
          break;
        case 'F':
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpotlightId, onSelectSpotlight, isModalOpen]);
}
