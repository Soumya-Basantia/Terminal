import { registerSystemCommands } from './system';
import { registerProfileCommands } from './profile';
import { registerBattleCommands } from './battle';
import { registerTeamCommands } from './team';

let registered = false;

export function initializeCommands() {
  if (registered) return;
  registerSystemCommands();
  registerProfileCommands();
  registerBattleCommands();
  registerTeamCommands();
  registered = true;
}
