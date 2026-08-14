import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { apiClient } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provee el estado de autenticacion a toda la app.
 * Al montarse, intenta recuperar la sesion llamando a /auth/me: si la
 * cookie HttpOnly sigue siendo valida (o se renueva automaticamente),
 * el usuario sigue "logueado" aunque haya recargado la pagina.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        apiClient
            .get("/auth/me")
            .then((res) => setUser(res.data.user))
            .catch(() => setUser(null))
            .finally(() => setIsLoading(false));
    }, []);

    async function login(email: string, password: string) {
        const res = await apiClient.post("/auth/login", { email, password });
        setUser(res.data.user);
    }

    async function register(name: string, email: string, password: string) {
        await apiClient.post("/auth/register", { name, email, password });
        // Registro no inicia sesion automaticamente; el usuario debe
        // hacer login despues (asi lo separamos como dos flujos claros).
    }

    async function logout() {
        await apiClient.post("/auth/logout");
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook para consumir el contexto. Lanza un error claro si se usa
 * fuera del AuthProvider, en vez de fallar de forma confusa despues.
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth debe usarse dentro de un AuthProvider.");
    }
    return context;
}