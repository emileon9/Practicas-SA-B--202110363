import { buildSchema } from "graphql";

export const schema = buildSchema(`
  type Product {
    id: Int!
    name: String!
    price: Float!
  }

  type Query {
    products: [Product!]!
  }
`);
