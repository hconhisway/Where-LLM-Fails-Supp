import { createContext, useContext } from 'react';

export const ViewerContext = createContext(null);

export function useViewerData() {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error('useViewerData must be used within ViewerContext.Provider');
  }
  return context;
}
