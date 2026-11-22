import type { Product } from "@catalogue/shared";

export const products: Product[] = [
  {
    id: 1,
    title: "Fjallraven Backpack",
    price: 109.95,
    description: "Your perfect pack for everyday use and walks in the forest.",
    category: "men's clothing",
    image: "https://example.com/images/backpack.jpg",
    rating: { rate: 3.9, count: 120 },
  },
  {
    id: 2,
    title: "Mens Casual Premium Slim Fit T-Shirt",
    price: 22.3,
    description: "Slim-fitting style with a comfortable cotton blend.",
    category: "men's clothing",
    image: "https://example.com/images/tshirt.jpg",
    rating: { rate: 4.1, count: 259 },
  },
  {
    id: 3,
    title: "John Hardy Women's Naga Bracelet",
    price: 695,
    description: "From our Legends Collection, inspired by the Naga dragon.",
    category: "jewelery",
    image: "https://example.com/images/bracelet.jpg",
    rating: { rate: 4.6, count: 400 },
  },
  {
    id: 4,
    title: "WD 2TB Elements Portable External Hard Drive",
    price: 64,
    description: "USB 3.0 and USB 2.0 compatibility for fast data transfers.",
    category: "electronics",
    image: "https://example.com/images/drive.jpg",
    rating: { rate: 3.3, count: 203 },
  },
  {
    id: 5,
    title: "SanDisk SSD PLUS 1TB Internal SSD",
    price: 109,
    description: "Easy upgrade for faster boot-up, shutdown, and app response.",
    category: "electronics",
    image: "https://example.com/images/ssd.jpg",
    rating: { rate: 4.5, count: 310 },
  },
];

export const featuredProducts = products.slice(0, 5);
