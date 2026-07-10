import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface PageContextValue {
  currentPage: string;
  activeView?: string;
  timeRange?: string;
  query?: string;
  services?: string[];
  setPageContext: (ctx: Partial<Omit<PageContextValue, 'setPageContext'>>) => void;
}

const PageContext = createContext<PageContextValue>({
  currentPage: '',
  setPageContext: () => {},
});

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<PageContextValue, 'setPageContext'>>({
    currentPage: '',
  });

  const setPageContext = useCallback((ctx: Partial<Omit<PageContextValue, 'setPageContext'>>) => {
    setState(prev => ({ ...prev, ...ctx }));
  }, []);

  return (
    <PageContext.Provider value={{ ...state, setPageContext }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  return useContext(PageContext);
}
