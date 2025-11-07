# Builder.io Quick Reference Cheatsheet

## 🚀 Essential Commands

### Fusion CLI
```bash
# Project Setup
npx @builder.io/cli create my-app       # Create new project
npm run index-components                 # Index design system
npm run validate-tokens                  # Check design tokens

# Development
npm run dev                              # Start dev server
npm run build                            # Production build
npm run analyze                          # Bundle analysis

# Testing
npm test                                 # Run tests
npm run test:visual                      # Visual regression
npm run test:a11y                        # Accessibility audit
```

### Git Integration
```bash
# Builder.io Bot Commands (in PR comments)
@builderio-bot refactor this component
@builderio-bot move to separate file
@builderio-bot add TypeScript types
@builderio-bot fix accessibility issues
```

## 🎯 Common Fusion Prompts

### Component Generation
```text
"Create a [component] using our design system"
"Import this Figma design and make it responsive"
"Add loading and error states to this component"
"Make this accessible with ARIA labels and keyboard navigation"
```

### Database Operations (Supabase MCP)
```text
"Create a table for [feature] with fields: [list]"
"Add row-level security to [table]"
"Connect this form to save data in Supabase"
"Fetch and display data from [table] with pagination"
```

### Deployment (Netlify MCP)
```text
"Deploy this to Netlify and return the URL"
"Set up environment variables for production"
"Configure serverless functions"
"Enable form handling"
```

## 📝 Code Patterns

### GSAP Scroll Animation
```javascript
useGSAP(() => {
  gsap.from(ref.current, {
    y: 50,
    opacity: 0,
    duration: 1,
    scrollTrigger: {
      trigger: ref.current,
      start: "top 80%",
      end: "bottom 20%",
      scrub: true
    }
  });
}, []);
```

### Three.js Scroll Progress
```javascript
const progress = useScrollProgress();
useFrame((_, dt) => {
  const target = progress * Math.PI * 2;
  ref.current.rotation.y += (target - ref.current.rotation.y) * dt * 2;
});
```

### CSS View Timeline
```css
.element {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 50%;
}
```

### Reduced Motion Check
```javascript
const prefersReducedMotion = 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const duration = prefersReducedMotion ? 0 : 300;
```

## 🎨 Design System Integration

### Component Indexing
```javascript
// .builder/index.json structure
{
  "components": {
    "Button": {
      "path": "./components/ui/button.tsx",
      "props": {...},
      "examples": [...]
    }
  }
}
```

### Design Tokens
```css
:root {
  --color-primary: #3B82F6;
  --space-unit: 0.5rem;
  --radius-default: 0.375rem;
  --duration-normal: 300ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## 🔧 Configuration Files

### AGENTS.md Template
```markdown
# Project: [Name]
## Tech Stack: Next.js, TypeScript, Tailwind
## Design System: [Path to components]
## Patterns: [Key patterns to follow]
## Don'ts: [What to avoid]
```

### MCP Server Connection
```javascript
// Environment variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NETLIFY_AUTH_TOKEN=
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| AI generates wrong components | Re-index design system |
| Animations janky | Check frame throttling |
| Supabase connection fails | Verify OAuth, check RLS |
| Bundle too large | Enable code splitting |
| Styles not applying | Check CSS module scoping |

## 📊 Performance Targets

```javascript
// Core Web Vitals
LCP: < 2.5s  // Largest Contentful Paint
FID: < 100ms // First Input Delay  
CLS: < 0.1   // Cumulative Layout Shift
FPS: > 60    // Animation frame rate

// Bundle Size
Initial: < 200KB
Per route: < 100KB
3D models: < 1MB
Images: < 100KB (WebP)
```

## 🔑 Keyboard Shortcuts

### Fusion Editor
```
Cmd/Ctrl + K    : Command palette
Cmd/Ctrl + P    : Quick file open
Cmd/Ctrl + B    : Toggle sidebar
Cmd/Ctrl + /    : Comment line
Cmd/Ctrl + S    : Save and preview
Alt + Click     : Multi-cursor
```

## 🚦 Decision Matrix

```
Simple Component?     → Figma Plugin
Need Database?        → Fusion + Supabase MCP  
Complex Animation?    → GSAP/Three.js
Team Collaboration?   → Fusion + Git
Design System?        → Component Indexing
Quick Prototype?      → Builder Visual Editor
```

## 📚 Essential Links

**Documentation**
- [Fusion Docs](https://www.builder.io/c/docs/get-started-fusion)
- [Component Indexing](https://www.builder.io/c/docs/component-indexing)
- [MCP Servers](https://www.builder.io/c/docs/mcp-servers)

**Tools**
- [Figma Plugin](https://www.figma.com/community/plugin/747985167520967365)
- [Chrome Extension](https://chrome.google.com/webstore)
- [VS Code Extension](https://marketplace.visualstudio.com)

**Resources**
- [GSAP Docs](https://greensock.com/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [daisyUI Components](https://daisyui.com/components/)

## ✅ Pre-Launch Checklist

- [ ] All images optimized (WebP/AVIF)
- [ ] Accessibility audit passed
- [ ] Performance budget met
- [ ] Error tracking configured
- [ ] Analytics implemented
- [ ] SEO meta tags added
- [ ] OG images generated
- [ ] Sitemap created
- [ ] Security headers set
- [ ] Rate limiting enabled
- [ ] Backup strategy defined
- [ ] Monitoring alerts configured

## 🎯 Success Metrics

```javascript
// Track these KPIs
metrics = {
  velocity: "features_per_sprint",
  quality: "bugs_per_feature",
  performance: "lighthouse_score",
  satisfaction: "team_happiness_score",
  efficiency: "hours_saved_per_feature"
}
```

---
*Keep this handy while building with Builder.io!*
