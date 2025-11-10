# Builder.io Project Starter Kit

## Quick Start Files

### 📦 package.json
```json
{
  "name": "builder-io-starter",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "jest --watch",
    "test:ci": "jest --ci",
    "test:visual": "percy snapshot ./pages",
    "analyze": "ANALYZE=true next build",
    "validate-tokens": "node scripts/validate-design-tokens.js",
    "index-components": "npx @builder.io/dev-tools@latest index-repo",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,md,json}\"",
    "pre-commit": "lint-staged"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^14.0.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "three": "^0.158.0",
    "gsap": "^3.12.0",
    "@builder.io/sdk": "^2.0.0",
    "@builder.io/react": "^3.0.0",
    "@supabase/supabase-js": "^2.38.0",
    "framer-motion": "^10.16.0",
    "daisyui": "^4.4.0",
    "tailwindcss": "^3.3.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/node": "^20.10.0",
    "@types/three": "^0.158.0",
    "typescript": "^5.3.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@storybook/react": "^7.5.0",
    "@storybook/addon-essentials": "^7.5.0",
    "@storybook/addon-a11y": "^7.5.0",
    "eslint": "^8.54.0",
    "eslint-config-next": "^14.0.0",
    "prettier": "^3.1.0",
    "lint-staged": "^15.1.0",
    "husky": "^8.0.0",
    "@percy/cli": "^1.27.0",
    "@next/bundle-analyzer": "^14.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{md,json}": "prettier --write"
  }
}
```

### 🎨 tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './fusion-generated/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Add your brand colors here
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)'
      },
      animation: {
        'scroll-fade': 'scrollFade 1s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out'
      },
      keyframes: {
        scrollFade: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      }
    }
  },
  plugins: [
    require('daisyui'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')
  ],
  daisyui: {
    themes: ['light', 'dark', 'cupcake', 'corporate'],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
    rtl: false,
    prefix: '',
    logs: true
  }
}
```

### 🤖 AGENTS.md
```markdown
# Project Context for AI Agents

## Project Overview
This is a [Your Project Name] built with Next.js, React, and Builder.io Fusion.

## Architecture
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS + daisyUI
- **Animations**: GSAP for complex animations, Framer Motion for simple ones
- **3D**: Three.js with React Three Fiber
- **Database**: Supabase
- **Deployment**: Netlify/Vercel

## Design System
- **Colors**: Primary (#3B82F6), Secondary (#6B7280), Accent (#10B981)
- **Spacing**: 8px grid system (0.5rem base)
- **Typography**: Inter for UI, Mono for code
- **Components**: Located in `/components`, use compound pattern
- **Icons**: Lucide React

## Coding Standards
1. **Component Structure**:
   - Use functional components with hooks
   - Separate logic into custom hooks when > 50 lines
   - Keep components under 150 lines
   - Use compound components for complex UI

2. **Naming Conventions**:
   - Components: PascalCase
   - Functions: camelCase
   - Constants: UPPER_SNAKE_CASE
   - Files: kebab-case

3. **State Management**:
   - Local state with useState/useReducer
   - Server state with React Query/SWR
   - Global state with Context API (sparingly)

4. **Performance**:
   - Lazy load heavy components
   - Memoize expensive computations
   - Use dynamic imports for code splitting
   - Optimize images with next/image

5. **Accessibility**:
   - All interactive elements must be keyboard accessible
   - Include proper ARIA labels
   - Test with screen readers
   - Respect prefers-reduced-motion

## File Structure
```
/
├── app/                 # Next.js app directory
├── components/          # Reusable components
│   ├── ui/             # Design system components
│   ├── features/       # Feature-specific components
│   └── layouts/        # Layout components
├── lib/                # Utilities and helpers
├── hooks/              # Custom React hooks
├── styles/             # Global styles
├── public/             # Static assets
├── fusion-generated/   # AI-generated components
└── .builder/           # Builder.io configuration
```

## When Generating Code
- Always use existing components from `/components/ui`
- Follow the 8px spacing grid
- Include loading and error states
- Add TypeScript types
- Include basic animations where appropriate
- Make components responsive by default
- Consider accessibility from the start

## Common Patterns
```tsx
// Component with loading state
export function Feature() {
  const { data, loading, error } = useData();
  
  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  
  return <FeatureContent data={data} />;
}

// Animated component
export function AnimatedCard({ children }) {
  const ref = useRef();
  
  useGSAP(() => {
    gsap.from(ref.current, {
      y: 50,
      opacity: 0,
      duration: 0.5,
      scrollTrigger: ref.current
    });
  }, []);
  
  return <div ref={ref}>{children}</div>;
}
```

## External Services
- **Supabase**: Database and auth (credentials in .env)
- **Netlify**: Deployment and serverless functions
- **Sentry**: Error tracking
- **Analytics**: Google Analytics 4

## Testing Requirements
- Unit tests for utilities
- Integration tests for API routes
- Visual regression tests for UI components
- Accessibility tests for all pages

## Do's and Don'ts
✅ DO:
- Use semantic HTML
- Write self-documenting code
- Include error boundaries
- Add loading states
- Use design tokens

❌ DON'T:
- Use inline styles
- Ignore TypeScript errors
- Skip accessibility
- Use `any` type
- Create giant components
```

### 🔧 .env.example
```bash
# Builder.io
NEXT_PUBLIC_BUILDER_API_KEY=your_builder_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Feature Flags
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_USE_FUSION_COMPONENTS=true

# Development
ANALYZE=false
```

### 🚀 Quick Setup Script (setup.sh)
```bash
#!/bin/bash

echo "🚀 Setting up Builder.io project..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating project structure..."
mkdir -p components/{ui,features,layouts}
mkdir -p lib/utils
mkdir -p hooks
mkdir -p styles
mkdir -p fusion-generated
mkdir -p .builder/rules
mkdir -p app/{api,components}

# Copy environment variables
echo "🔐 Setting up environment..."
cp .env.example .env.local

# Install Builder.io CLI
echo "🛠 Installing Builder.io CLI..."
npm install -g @builder.io/cli

# Index components (if repo exists)
if [ -d ".git" ]; then
  echo "🔍 Indexing components..."
  npm run index-components
fi

# Setup Git hooks
echo "🪝 Setting up Git hooks..."
npx husky install
npx husky add .husky/pre-commit "npm run pre-commit"

# Initialize Storybook
echo "📚 Setting up Storybook..."
npx storybook@latest init --yes

# Create initial design tokens
echo "🎨 Creating design tokens..."
cat > styles/tokens.css << 'EOF'
:root {
  /* Colors */
  --color-primary: #3B82F6;
  --color-secondary: #6B7280;
  --color-accent: #10B981;
  --color-background: #FFFFFF;
  --color-text: #1F2937;
  
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  
  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Fira Code', monospace;
  
  /* Animation */
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme="dark"] {
  --color-background: #1F2937;
  --color-text: #F9FAFB;
}
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your API keys"
echo "2. Run 'npm run dev' to start development"
echo "3. Connect your GitHub repository"
echo "4. Configure Builder.io Fusion"
echo ""
echo "Happy building! 🎉"
```

### 🧪 Sample Test File (example.test.tsx)
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnimatedCard } from '@/components/ui/animated-card';

describe('AnimatedCard', () => {
  it('renders children correctly', () => {
    render(<AnimatedCard>Test Content</AnimatedCard>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies animation on scroll', async () => {
    const { container } = render(<AnimatedCard>Test</AnimatedCard>);
    const element = container.firstChild;
    
    // Initial state
    expect(element).toHaveStyle({ opacity: '0' });
    
    // Simulate scroll
    window.scrollY = 500;
    window.dispatchEvent(new Event('scroll'));
    
    // Wait for animation
    await waitFor(() => {
      expect(element).toHaveStyle({ opacity: '1' });
    });
  });

  it('respects reduced motion preference', () => {
    // Mock reduced motion
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addListener: jest.fn(),
      removeListener: jest.fn()
    }));

    const { container } = render(<AnimatedCard>Test</AnimatedCard>);
    expect(container.firstChild).toHaveStyle({ transition: 'none' });
  });
});
```

### 📝 PR Template (.github/pull_request_template.md)
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 🎨 UI/UX improvement
- [ ] ⚡ Performance improvement
- [ ] 📝 Documentation update
- [ ] 🤖 AI/Fusion generated

## Fusion Details (if applicable)
**Prompts used:**
```
[paste prompts]
```

**Manual adjustments:**
- List any hand-coded changes

## Testing
- [ ] Unit tests pass
- [ ] Visual regression tests pass
- [ ] Accessibility audit pass
- [ ] Cross-browser tested
- [ ] Mobile responsive

## Performance Impact
- Bundle size change: +/- X KB
- Lighthouse score: XX/100

## Screenshots
[Add screenshots if UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console errors
- [ ] Design tokens used appropriately
```

---

This starter kit provides everything teams need to begin using Builder.io immediately with best practices built in from day one.
