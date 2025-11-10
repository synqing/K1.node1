
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import WorkflowDemo from './pages/WorkflowDemo';
import { GraphAuthoringProvider } from './store/graphAuthoring';
import './index.css';
import './styles/globals.css';
import './lib/analysisClient';
// Builder.io integration is optional; uncomment to enable visual builder components
// import './builder/register';

// Optional: enable experimental design iteration styles
if (import.meta.env.VITE_ENABLE_DESIGN_ITER === 'true') {
  import('./styles/experimental/default_ui_darkmode.css');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const RootComponent = import.meta.env.VITE_SHOW_WORKFLOW_DEMO === 'true' ? WorkflowDemo : App;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <GraphAuthoringProvider>
      <RootComponent />
    </GraphAuthoringProvider>
  </QueryClientProvider>,
);
