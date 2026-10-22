/** The signed-in user, as proven by their JWT. */
export interface AuthUser {
  id: string;
  email?: string;
}
