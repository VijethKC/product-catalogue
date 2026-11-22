import { useMutation, useQuery } from "@tanstack/react-query";
import type { EnquiryRequest, ProductQuery } from "@catalogue/shared";
import { api } from "../api/client";

export function useFeatured() {
  return useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => api.getFeatured(),
  });
}

export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: ["products", "list", query],
    queryFn: () => api.listProducts(query),
    enabled,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryProducts(category: string) {
  return useQuery({
    queryKey: ["categories", category],
    queryFn: () => api.getCategoryProducts(category),
    enabled: category.length > 0,
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: () => api.getProduct(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCreateEnquiry() {
  return useMutation({
    mutationFn: (payload: EnquiryRequest) => api.createEnquiry(payload),
  });
}
