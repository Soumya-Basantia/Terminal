const userSockets = new Map<string, Set<string>>();

export function addUserSocket(userId: string, socketId: string): boolean {
  let userSet = userSockets.get(userId);
  const isFirst = !userSet || userSet.size === 0;
  if (!userSet) {
    userSet = new Set();
    userSockets.set(userId, userSet);
  }
  userSet.add(socketId);
  return isFirst;
}

export function removeUserSocket(userId: string, socketId: string): boolean {
  const userSet = userSockets.get(userId);
  if (userSet) {
    userSet.delete(socketId);
    if (userSet.size === 0) {
      userSockets.delete(userId);
      return true; // was last socket (user went offline)
    }
  }
  return false;
}

export function isUserOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  return !!(sockets && sockets.size > 0);
}

export function getUserSocketIds(userId: string): string[] {
  const sockets = userSockets.get(userId);
  return sockets ? Array.from(sockets) : [];
}
