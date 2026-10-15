import { PresentationViewer } from '@pages/admin/presentations/components/PresentationViewer';
import { usePresentation } from '@services/api/presentations';
import { Loader2 } from 'lucide-react';
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export const PresentationViewPage: React.FC = () => {
  const { slug } = useParams();
  const { data: presentation, isLoading, error } = usePresentation(slug || '');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <p className="text-neutral-500 dark:text-slate-400">Загрузка презентации...</p>
      </div>
    );
  }

  if (error || !presentation || !presentation.isPublished) {
    return <Navigate to="/" replace />;
  }

  return <PresentationViewer presentation={presentation} />;
};
