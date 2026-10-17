import { getUserById, getUsers } from "../services/users.service";

export const root = {
  users: () => getUsers(),
  user: ({ id }: { id: number }) => getUserById(id) ?? null,
};
