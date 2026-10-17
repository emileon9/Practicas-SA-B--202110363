import { buildSchema } from "graphql";

export const schema = buildSchema(`
  type User {
    id: Int!
    name: String!
    email: String!
  }

  type Query {
    users: [User!]!
    # Practica 10: usada por ms-orders para enriquecer cada orden con el
    # nombre de su usuario (ver P5/services/ms-orders/app/services/users_client.py).
    # Nullable porque un userId sin usuario correspondiente es un estado
    # valido a manejar (no un error del esquema).
    user(id: Int!): User
  }
`);
