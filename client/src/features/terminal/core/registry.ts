import type { CommandDefinition } from './types';

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>(); // maps alias -> command name

  register(command: CommandDefinition) {
    const name = command.name.toLowerCase();
    this.commands.set(name, command);
    if (command.aliases) {
      command.aliases.forEach(alias => {
        this.aliases.set(alias.toLowerCase(), name);
      });
    }
  }

  getCommand(nameOrAlias: string): CommandDefinition | undefined {
    const term = nameOrAlias.toLowerCase();
    if (this.commands.has(term)) {
      return this.commands.get(term);
    }
    const realName = this.aliases.get(term);
    if (realName) {
      return this.commands.get(realName);
    }
    return undefined;
  }

  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  getCommandNames(): string[] {
    const names = Array.from(this.commands.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...names, ...aliasNames];
  }
}

export const commandRegistry = new CommandRegistry();
