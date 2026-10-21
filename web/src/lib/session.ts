const TOKEN_KEY = 'teamorbit-token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
