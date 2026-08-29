import { getUsers } from "../services/users.service";

export const root = {
  users: () => getUsers(),
};
