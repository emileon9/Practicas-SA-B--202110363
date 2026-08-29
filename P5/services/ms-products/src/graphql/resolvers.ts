import { getProducts } from "../services/products.service";

export const root = {
  products: () => getProducts(),
};
