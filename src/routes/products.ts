import { Router } from 'express';
import products from '../data/products.json';
import phones from '../data/phones.json';
import tablets from '../data/tablets.json';
import accessories from '../data/accessories.json';
import { ProductSpecs } from '../types';

const categoryData: Record<string, ProductSpecs[]> = {
  phones: phones as ProductSpecs[],
  tablets: tablets as ProductSpecs[],
  accessories: accessories as ProductSpecs[],
};

export const productsRouter = Router();

// Full flat catalog — same shape as the old public/api/products.json.
productsRouter.get('/products', (_req, res) => {
  res.json(products);
});

// Category-specific full specs — same shape as the old
// public/api/{category}.json files.
productsRouter.get('/products/:category', (req, res) => {
  const { category } = req.params;
  const data = categoryData[category];

  if (!data) {
    return res.status(404).json({ error: `Unknown category "${category}"` });
  }

  res.json(data);
});
