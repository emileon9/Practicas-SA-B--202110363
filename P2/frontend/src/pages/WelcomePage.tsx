import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { useState } from "react";

/**
 * Pagina de confirmacion visible tras un login exitoso (requisito 7
 * del enunciado). Ademas sirve para probar en vivo la autorizacion
 * por roles, llamando a Ruta 1 y Ruta 2 desde botones.
 */
export function WelcomePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [routeResult, setRouteResult] = useState<string | null>(null);

    async function handleLogout() {
        await logout();
        navigate("/login");
    }

    async function testRoute(route: "route1" | "route2") {
        setRouteResult(null);
        try {
            const res = await apiClient.get(`/protected/${route}`);
            setRouteResult(`✅ ${res.data.message}`);
        } catch (err: any) {
            setRouteResult(`❌ ${err.response?.data?.error ?? "Error al acceder."}`);
        }
    }

    if (!user) return null;

    return (
        <div className="welcome-page">
            <div className="welcome-card">
                <div className="welcome-card__head">
                    <span className="welcome-card__avatar">
                        {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                        <h1>¡Bienvenido, {user.name}!</h1>
                        <p className="auth-card__subtitle">{user.email}</p>
                    </div>
                </div>

                <span className="role-badge">{user.role}</span>

                <hr className="divider" />

                <div>
                    <h3>Probar rutas protegidas</h3>
                    <div className="route-actions" style={{ marginTop: 10 }}>
                        <button className="btn btn-secondary" onClick={() => testRoute("route1")}>
                            Ruta 1 (solo Admin)
                        </button>
                        <button className="btn btn-secondary" onClick={() => testRoute("route2")}>
                            Ruta 2 (Admin y Cliente)
                        </button>
                    </div>

                    {routeResult && <p className="route-result" style={{ marginTop: 12 }}>{routeResult}</p>}
                </div>

                <hr className="divider" />

                <button className="btn btn-primary" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}
