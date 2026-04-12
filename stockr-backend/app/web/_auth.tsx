'use client';
import { createContext, useContext } from 'react';

export interface AuthCtx { userId: string; email: string; role: string }
export const AuthContext = createContext<AuthCtx | null>(null);
export function useAuth() { return useContext(AuthContext); }
