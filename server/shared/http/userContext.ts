export const DEFAULT_USER_ID = 1;

export interface UserContext {
  userId: number;
}

export function getUserContext(): UserContext {
  return {userId: DEFAULT_USER_ID};
}
