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

export function getUsers(): User[] {
  return users;
}
