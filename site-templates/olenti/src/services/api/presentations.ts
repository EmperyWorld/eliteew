import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@typings/api';
import { apiClient } from './client';

export type PresentationFormat = 'classic' | 'modern' | 'minimal' | 'ollenti' | 'ollenti2';

export interface PresentationSlide {
  id: string;
  title?: string;
  content?: string;
  image?: string;
  layout?: 'title-content' | 'image-content' | 'title-image-content' | 'full-image';
  backgroundColor?: string;
  backgroundGradient?: string;
  textColor?: string;
  titleFontSize?: string;
  contentFontSize?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  titleAlign?: 'left' | 'center' | 'right';
  fontFamily?: string;
  lineHeight?: string;
  titleColor?: string;
  contentColor?: string;
  imagePosition?: 'top' | 'center' | 'bottom';
  imageSize?: 'small' | 'medium' | 'large' | 'full';
  transition?: 'none' | 'fade' | 'slide' | 'zoom' | 'convex' | 'concave';
}

export interface PresentationTheme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: string;
}

export interface Presentation {
  id: string;
  title: string;
  slug: string;
  format: PresentationFormat;
  slides: PresentationSlide[];
  theme?: PresentationTheme | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

type PresentationQueryParams = {
  search?: string;
  isPublished?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export const usePresentations = (filters?: PresentationQueryParams) => {
  return useQuery({
    queryKey: ['presentations', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Presentation>>('/presentations', {
        params: filters,
      });
      return data;
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
};

export const usePresentation = (id: string) => {
  return useQuery({
    queryKey: ['presentation', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Presentation>(`/presentations/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreatePresentation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (presentation: Partial<Presentation>) => {
      const { data } = await apiClient.post<Presentation>('/presentations', presentation);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presentations'] });
    },
  });
};

export const useUpdatePresentation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...presentation }: Partial<Presentation> & { id: string }) => {
      const { data } = await apiClient.patch<Presentation>(`/presentations/${id}`, presentation);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['presentations'] });
      queryClient.invalidateQueries({ queryKey: ['presentation', variables.id] });
    },
  });
};

export const useDeletePresentation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/presentations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presentations'] });
    },
  });
};
