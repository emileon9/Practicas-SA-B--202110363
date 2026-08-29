export interface Product {
  id: number;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: 1, name: "Teclado mecanico", price: 45.99 },
  { id: 2, name: "Mouse inalambrico", price: 19.5 },
  { id: 3, name: "Monitor 24 pulgadas", price: 129.0 },
];

export function getProducts(): Product[] {
  return products;
}
