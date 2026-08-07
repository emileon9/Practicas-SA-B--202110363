export type Role = "ADMIN" | "CLIENT";
export type ProtectedRoute = "ROUTE_1" | "ROUTE_2";

/**
 * Tabla de permisos, tal como la define el enunciado:
 *   Ruta 1 (solo Admin)      -> Admin: permitido, Cliente: denegado
 *   Ruta 2 (Admin y Cliente) -> Admin: permitido, Cliente: permitido
 *
 * Tenerla en un solo lugar, como un mapa de datos, hace facil agregar
 * nuevas rutas o roles despues sin tocar la logica que la consulta
 * (Open/Closed Principle).
 */
const PERMISSIONS: Record<ProtectedRoute, Role[]> = {
    ROUTE_1: ["ADMIN"],
    ROUTE_2: ["ADMIN", "CLIENT"],
};

export function isAllowed(role: Role, route: ProtectedRoute): boolean {
    const allowedRoles = PERMISSIONS[route];
    if (!allowedRoles) return false; // ruta desconocida -> denegar por defecto
    return allowedRoles.includes(role);
}