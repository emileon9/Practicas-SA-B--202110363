import { buildSchema } from "graphql";

export const schema = buildSchema(`
  type User {
    id: Int!
    name: String!
    email: String!
  }

  type Query {
    users: [User!]!
  }
`);
