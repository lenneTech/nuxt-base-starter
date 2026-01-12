export interface User {
  banExpires?: Date;
  banned?: boolean;
  banReason?: string;
  email: string;
  emailVerified: boolean;
  id: string;
  image?: string;
  name?: string;
  role?: string;
  twoFactorEnabled?: boolean;
}
