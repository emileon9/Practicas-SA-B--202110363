import { buildSchema } from "graphql";

// TODO(Fase 4): agregar el tipo Product { id, name, price } y la query "products"
export const schema = buildSchema(`
  type Query {
    _placeholder: Boolean
  }
`);
