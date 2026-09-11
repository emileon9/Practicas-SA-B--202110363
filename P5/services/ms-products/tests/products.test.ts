import request from "supertest";
import app from "../src/app";
import { getProducts } from "../src/services/products.service";

describe("products.service", () => {
  it("getProducts devuelve una lista no vacia con la forma esperada", () => {
    const products = getProducts();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(typeof product.id).toBe("number");
      expect(typeof product.name).toBe("string");
      expect(product.price).toBeGreaterThan(0);
    }
  });

  it("cada producto tiene un id unico", () => {
    const ids = getProducts().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("GET /health", () => {
  it("responde 200 con el nombre del servicio", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "ms-products" });
  });
});
