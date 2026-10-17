import { usersCatalogSize } from "../observability/metrics";

export interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Ana Lopez", email: "ana.lopez@example.com" },
  { id: 2, name: "Carlos Ramirez", email: "carlos.ramirez@example.com" },
  { id: 3, name: "Maria Fernandez", email: "maria.fernandez@example.com" },
];

// Gauge actualizada en la lectura (no en el modulo al cargar): asi refleja
// el tamano real del catalogo en el momento en que alguien lo consulta,
// en vez de un valor fijo calculado una sola vez al arrancar el proceso.
usersCatalogSize.set(users.length);

export function getUsers(): User[] {
  usersCatalogSize.set(users.length);
  return users;
}

/**
 * Practica 10: usado por ms-orders (ver
 * P5/services/ms-orders/app/services/users_client.py) para enriquecer
 * cada orden con el nombre del usuario que la hizo. Reutiliza el mismo
 * catalogo en memoria que ya expone `getUsers`, sin datos nuevos.
 */
export function getUserById(id: number): User | undefined {
  return users.find((u) => u.id === id);
}
