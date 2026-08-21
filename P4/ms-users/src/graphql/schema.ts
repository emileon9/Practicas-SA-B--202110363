import { buildSchema } from "graphql";

// TODO(Fase 4): agregar el tipo User { id, name, email } y la query "users"
export const schema = buildSchema(`
  type Query {
    _placeholder: Boolean
  }
`);
