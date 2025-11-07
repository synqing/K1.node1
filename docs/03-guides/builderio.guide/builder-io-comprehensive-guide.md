# Builder.io Comprehensive Guide: Web Development with AI-Powered Visual Tools

## Executive Summary

This comprehensive guide compiles essential knowledge from Builder.io's documentation and blog posts, covering advanced web development techniques using AI-powered visual tools, animation frameworks, and modern design-to-code workflows. The guide addresses three core areas:

1. **Advanced Web Animations**: Implementation of scroll-driven animations using WebGL, Three.js, GSAP, and CSS view-timeline
2. **AI-Powered Development**: Utilizing Fusion and Builder.io's visual IDE for rapid prototyping and production-ready code generation
3. **Modern Development Workflows**: Implementing the No Handoff methodology and integrating design systems with AI tools

Key technologies covered include React, Three.js, GSAP, TailwindCSS, daisyUI, Supabase, and Builder's Fusion platform. The guide provides practical implementation steps, code examples, and best practices for creating professional web applications.

---

## Table of Contents

1. [Advanced Animation Techniques](#1-advanced-animation-techniques)
   - [WebGL Scroll Animations](#11-webgl-scroll-animations)
   - [3D GSAP Animations](#12-3d-gsap-animations)
   - [Buttery Scroll Reveals](#13-buttery-scroll-reveals)
   - [CSS View Timeline](#14-css-view-timeline)

2. [AI-Powered Design and Development](#2-ai-powered-design-and-development)
   - [Designing with AI](#21-designing-with-ai)
   - [Faster UX Design with AI](#22-faster-ux-design-with-ai)
   - [No Handoff Methodology](#23-no-handoff-methodology)

3. [Framework Integration](#3-framework-integration)
   - [daisyUI Best Practices](#31-daisyui-best-practices)
   - [Supabase MCP Integration](#32-supabase-mcp-integration)

4. [Builder.io Platform Tools](#4-builderio-platform-tools)
   - [Figma AI Generator](#41-figma-ai-generator)
   - [Full-Stack App Creation](#42-full-stack-app-creation)
   - [Getting Started with Fusion](#43-getting-started-with-fusion)
   - [Figma Plugin Usage](#44-figma-plugin-usage)

---

## 1. Advanced Animation Techniques

### 1.1 WebGL Scroll Animations

#### Overview
Create Apple-style 3D scroll animations using Three.js and WebGL for smooth, interactive 3D objects that respond to scroll events.

#### Implementation Steps

**Step 1: Load GLTF Model**
```javascript
import { useGLTF } from "@react-three/drei";

const MODEL_URL = "https://cdn.builder.io/path-to-your-model.gltf";

function ImacModel() {
  const { scene } = useGLTF(MODEL_URL);
  return <primitive object={scene} scale={1} />;
}

useGLTF.preload(MODEL_URL);
```

**Step 2: Create Scroll Progress Hook**
```javascript
import { useEffect, useState } from "react";

function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(Math.max(window.scrollY / total, 0), 1) : 0);
    };
    
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  return progress;
}
```

**Step 3: Create Scroll Rig**
```javascript
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

function ScrollRig({ progress }: { progress: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const targetY = Math.PI * 0.5 * progress; // front to side over the scroll
    const lerp = Math.min(dt * 6, 1);
    ref.current.rotation.y += (targetY - ref.current.rotation.y) * lerp;
  });

  return (
    <group ref={ref}>
      <ImacModel />
    </group>
  );
}
```

**Step 4: Complete Scene Setup**
```javascript
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Environment } from "@react-three/drei";

export default function ScrollImac() {
  const progress = useScrollProgress();

  return (
    <div style={{ height: "200vh", background: "#000" }}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 35 }}
        style={{ height: "100vh" }}
      >
        <color attach="background" args={["#000"]} />
        <ambientLight intensity={0.4} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <ScrollRig progress={progress} />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

#### Best Practices
- Keep textures compressed and meshes decimated for performance
- Lower `ambientLight` intensity if the scene looks washed out
- Test on slower devices and adjust lerp speed if motion feels jumpy
- Keep `fov` modest for clean product look

### 1.2 3D GSAP Animations

#### Overview
Create zooming 3D effects using GSAP and image sequences for performance-optimized scroll animations.

#### Implementation Steps

**Step 1: Setup Image Sequence**
```javascript
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const imageUrls = [
  "/frame-001.jpg",
  // ... up to frame-NNN.jpg
];
```

**Step 2: Preload Images**
```javascript
const loadImages = async () => {
  const images = await Promise.all(
    imageUrls.map(
      url =>
        new Promise<HTMLImageElement | null>(resolve => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    )
  );
  imagesRef.current = images.filter(Boolean) as HTMLImageElement[];
};
```

**Step 3: Draw Frames to Canvas**
```javascript
const drawFrame = (i: number) => {
  const canvas = canvasRef.current;
  const img = imagesRef.current[i];
  if (!canvas || !img) return;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.drawImage(img, 0, 0, rect.width, rect.height);
};
```

**Step 4: Animate with GSAP**
```javascript
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: containerRef.current,
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
    invalidateOnRefresh: true,
  },
});

tl.to(frameRef.current, {
  frame: Math.max(0, imagesRef.current.length - 1),
  ease: "none",
  onUpdate: () => {
    const i = Math.round(frameRef.current.frame);
    if (i >= 0 && i < imagesRef.current.length) drawFrame(i);
  },
});
```

#### Best Practices
- Place animations lower on the page for preload time
- Don't scroll jack - let native scroll drive the scrub
- Add fallback for slower devices
- Optimize assets with compression and CDN delivery

### 1.3 Buttery Scroll Reveals

#### Overview
Create smooth text and video reveal animations synchronized with scroll using GSAP timelines.

#### Implementation with GSAP

**Step 1: Setup DOM Nodes**
```javascript
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lettersGroups = Array.from(sectionRef.current.querySelectorAll(".letters"));
const videos = Array.from(sectionRef.current.querySelectorAll(".video"));
const bodies = Array.from(sectionRef.current.querySelectorAll(".body"));
const ctas = Array.from(sectionRef.current.querySelectorAll(".cta"));
```

**Step 2: Define Initial States**
```javascript
lettersGroups.forEach((group, i) => {
  const letters = group.querySelectorAll(".letter");
  gsap.set(letters, {
    opacity: 0,
    filter: "blur(16px)",
    xPercent: i === 0 ? -60 : -40,
  });
  gsap.set(group, { opacity: 1 });
});

videos.forEach((v, i) =>
  gsap.set(v, { 
    opacity: 0, 
    filter: "blur(22px)", 
    x: i === 1 ? 120 : -120, 
    pointerEvents: "none" 
  })
);
```

**Step 3: Create Timeline Animations**
```javascript
const phaseDuration = 1.4;
const hold = 0.35;
const exitDelay = hold + 0.42;

phases.forEach((_, i) => {
  const group = lettersGroups[i];
  const letters = group?.querySelectorAll(".letter") ?? [];
  const video = videos[i];
  const body = bodies[i];
  const cta = ctas[i];
  
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
  
  // Animate letters
  tl.fromTo(
    letters,
    { opacity: 0, filter: "blur(16px)", xPercent: i === 0 ? -60 : -40 },
    { 
      opacity: 1, 
      filter: "blur(0px)", 
      xPercent: 0, 
      duration: phaseDuration * 0.55, 
      stagger: { each: 0.07, from: "start" } 
    },
    0
  );
  
  // Add video fade in
  tl.fromTo(
    video,
    { opacity: 0, filter: "blur(22px)" },
    { 
      opacity: 1, 
      filter: "blur(0px)", 
      duration: phaseDuration * 0.55,
      onStart: () => gsap.set(video, { pointerEvents: "auto" })
    },
    0.15
  );
  
  base.add(tl, base.duration());
});
```

**Step 4: Bind to ScrollTrigger**
```javascript
ScrollTrigger.create({
  animation: base,
  trigger: sectionRef.current,
  start: "top top",
  end: () => `+=${window.innerHeight * 6.6}`,
  scrub: 1.1,
  pin: contentRef.current,
  pinSpacing: true,
  invalidateOnRefresh: true,
});
```

### 1.4 CSS View Timeline

#### Overview
Create Apple-style video transitions using pure CSS view timelines for perfect scroll synchronization.

#### Implementation

**Step 1: HTML Structure**
```html
<div class="scroll-clip-container">
  <div class="video-frame sticky top-1/2 -translate-y-1/2">
    <video class="video-layer absolute inset-0"></video>
    <video class="video-layer absolute inset-0"></video>
    <video class="video-layer absolute inset-0"></video>
  </div>
  
  <section class="experience-section" style="view-timeline-name: --section-0;">
    <!-- Content -->
  </section>
</div>
```

**Step 2: CSS Setup**
```css
.scroll-clip-container {
  timeline-scope: --section-0, --section-1, --section-2, --section-3;
}

@supports (animation-timeline: view()) {
  @keyframes wipe-out {
    0% { clip-path: inset(0 0 0% 0); }
    100% { clip-path: inset(0 0 100% 0); }
  }
  
  .video-layer {
    animation: wipe-out 1s linear both;
    animation-range: entry 0% contain 0%;
  }
  
  .video-layer:nth-child(1) { animation-timeline: --section-1; }
  .video-layer:nth-child(2) { animation-timeline: --section-2; }
  .video-layer:nth-child(3) { animation-timeline: --section-3; }
  .video-layer:nth-child(4) { animation-timeline: none; }
}
```

**Step 3: Calculate Timeline Inset**
```javascript
const calculateInset = () => {
  const el = frameRef.current;
  if (!el) return;
  
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const topPct = (rect.top / vh) * 100;
  const botPct = ((vh - rect.bottom) / vh) * 100;
  
  setTimelineInset(`${topPct.toFixed(2)}% ${botPct.toFixed(2)}%`);
};
```

---

## 2. AI-Powered Design and Development

### 2.1 Designing with AI

#### Key Principles

**1. Start with Existing Resources**
- Use sites like ReactBits, 21st.dev, and CodePen for starting points
- Adapt existing effects to your brand and tech stack

**2. Connect to Your Codebase**
- Use tools that integrate with your actual repository
- Leverage existing components and design tokens

**3. Iterate with Feedback**
- Don't expect perfection on first prompt
- Give specific, actionable feedback

#### Implementation Workflow

**Step 1: Find Inspiration**
```javascript
// Example: Adapting an effect from ReactBits
// 1. Copy the effect code
// 2. Prompt AI: "Add this effect as the page background for our app. Here is the code: [paste]"
// 3. Refine: "Replace the blue and orange with our purple palette"
```

**Step 2: Use Design System Index**
```bash
# Run in your design system repository
npx "@builder.io/dev-tools@latest" index-repo
```

**Step 3: Visual Editing**
- Use Design Mode for precision control
- Create Figma-to-code loop for iteration

### 2.2 Faster UX Design with AI

#### Fusion Workflow vs Traditional Workflow

| Traditional (Figma) | Fusion (AI-Powered) |
|-------------------|-------------------|
| Design in static mockups | Design with real components and data |
| Create component variants | AI generates states from descriptions |
| Test at specific breakpoints | Test responsive design with real content |
| Share prototype links | Create pull requests with actual code |
| File bugs for implementation issues | Fix issues directly in code |

#### Key Benefits
- Design and ship same day
- Work with real data from the start
- Fix issues directly without filing bugs
- Create pull requests instead of handoffs

### 2.3 No Handoff Methodology

#### Core Principles

1. **Foreground user needs as northstar**
2. **Iterate together**
3. **Prototyping is key**

#### Implementation Checklist

**Team Readiness Assessment:**

Designer Characteristics:
- [ ] Experiments with AI design tools
- [ ] Understands design systems and tokens
- [ ] Comfortable with responsive design principles

Developer Characteristics:
- [ ] Uses AI coding assistants
- [ ] Participates in design reviews
- [ ] Leverages design system consistently

#### Workflow Changes

**Start Doing:**
- Designing and prototyping in production-ready code
- Measuring time-to-market from idea to production
- Working in git-based workflows
- Getting consistent customer feedback
- Leveraging design system and component library

**Stop Doing:**
- Using Figma for brand new patterns exclusively
- Wiring up complex Figma prototypes
- Writing complex design and code specs

#### Success Metrics

| Traditional Handoff | No Handoff Methodology |
|-------------------|---------------------|
| Designer: 8 hours creating Figma screens | Designer: 2 hours building working prototype |
| Developer: 16 hours implementing front-end | Developer: 2 hours connecting to backend |
| 20+ Slack messages clarifying intent | 1 PR review with code diff |
| 3-5 rounds of QA/revision | Ship the prototype with minor tweaks |
| 6 weeks design to deploy | 3-5 days idea to production |

---

## 3. Framework Integration

### 3.1 daisyUI Best Practices

#### Common Anti-Patterns and Solutions

**1. Design-to-Code Gap**

Problem: Manual translation from Figma to semantic classes

Solution:
```javascript
// Establish clear mapping conventions
// Figma "Card with Header" → daisyUI semantic structure
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Header from Figma</h2>
    <p>Content exactly as designed</p>
    <div class="card-actions justify-end">
      <button class="btn btn-primary">Action Button</button>
    </div>
  </div>
</div>
```

**2. Component Composition Patterns**

Best Practice:
```javascript
// Good: Clear hierarchy and semantic structure
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Dashboard Widget</h2>
    <div class="form-control">
      <label class="label">
        <span class="label-text">Setting</span>
      </label>
      <input type="text" class="input input-bordered" />
    </div>
    <div class="card-actions justify-end">
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

**3. Theme Customization**

Solution:
```css
:root {
  --brand-primary: #3B82F6;
  --brand-secondary: #6B7280;
}

[data-theme="custom"] {
  --p: var(--brand-primary);
  --s: var(--brand-secondary);
}
```

**4. Responsive Design**

Pattern:
```css
.product-grid {
  @apply grid grid-cols-1 gap-4 
         md:grid-cols-2 md:gap-6 
         lg:grid-cols-4 lg:gap-8;
}
```

**5. Theme Implementation**

Configuration:
```css
[data-theme="brand-light"] {
  --p: 217 70% 51%; /* Brand blue in oklch */
  --pc: 217 70% 11%; /* Contrasting text */
  --s: 32 77% 65%; /* Brand orange */
  --sc: 32 77% 15%;
}
```

### 3.2 Supabase MCP Integration

#### Setup Process

**Step 1: Connect Supabase to Fusion**
1. Navigate to MCP servers page in Builder.io
2. Click "+ Connect" on Supabase MCP server
3. Define Supabase organization access

**Step 2: Configure Project**
```javascript
// Add environment variables
SUPABASE_URL=https://[project_id].supabase.co
SUPABASE_ANON_KEY=your_public_anon_key
```

#### Use Cases

**1. Newsletter Signup Form**
```javascript
// Prompt: "Use Supabase MCP to set up a newsletter_signups table 
// with email and timestamp, then create a signup form"
```

**2. Dynamic Data from CSV**
```javascript
// Prompt: "Create a testimonials table in Supabase, 
// populate it with this CSV data, and build a carousel component"
```

**3. Admin Dashboard**
```javascript
// Prompt: "Build an admin dashboard with authentication using Supabase. 
// Show user metrics and activity logs"
```

**4. Auth-Protected Areas**
```javascript
// Prompt: "Create a secure admin area using Supabase Auth. 
// Include login, logout, and session management"
```

**5. AI Features with Edge Functions**
```javascript
// Prompt: "Add a button that uses Supabase Edge Functions 
// to call OpenAI API and generate product descriptions"
```

---

## 4. Builder.io Platform Tools

### 4.1 Figma AI Generator

#### Builder.io Figma Plugin Features

**Component-Aware Generation:**
- Analyzes existing design system
- Generates designs using actual components
- Maintains brand consistency

**Natural Language Iteration:**
- Make changes without starting over
- Generate all component states
- Maintain design system alignment

**Production-Ready Output:**
- Exports to clean, framework-specific code
- Follows team patterns
- Uses existing design tokens

#### Implementation

**Step 1: Install Plugin**
1. Open Figma → Plugins → Manage plugins
2. Search for "Builder.io"
3. Install the plugin

**Step 2: Generate with Context**
```javascript
// The plugin automatically:
// 1. Analyzes your component library
// 2. Understands your patterns
// 3. Generates using your components
```

**Step 3: Export to Code**
- Select design
- Click export
- Get React, Tailwind, or framework-specific code

### 4.2 Full-Stack App Creation

#### Quick Start Guide

**Step 1: Initialize Project**
```javascript
// Create account and start new project
// Prompt example:
"Create a small 'Wishboard' feature voting app using shadcn/ui.
Add an Ideas page with a header, an 'Add idea' form (title and short description), 
a list of ideas with visible vote counts and a Vote button on each card, 
plus simple Status and Tag filters."
```

**Step 2: Version Control Setup**
1. Click "Create Repo" in top right
2. Authorize GitHub
3. Confirm repository creation

**Step 3: Connect Supabase**
```javascript
// Prompt:
"Use the Supabase MCP to create a new Supabase project, 
set up the data, and connect our app.
Create whatever tables and fields you need for a Wishboard 
with ideas, votes, tags, comments, and a simple status."
```

**Step 4: Deploy to Netlify**
```javascript
// Prompt:
"Use the Netlify MCP to create a new Netlify site 
from this GitHub repo and run the initial deploy. 
Return the live URL."
```

### 4.3 Getting Started with Fusion

#### Setup Process

**1. Connect Repository**
```bash
# Options:
- GitHub
- Azure DevOps
- GitLab
- Bitbucket
```

**2. Connect Design System**
```bash
# Enterprise:
npx "@builder.io/dev-tools@latest" index-repo

# Manual:
# Add repository in Project Settings
# Provide agent instructions
```

**3. Iterate with AI**
- Use Generate tab for prompts
- Include context (Figma, screenshots, PDFs)
- Use Insert and Layers tabs for visual editing

**4. Configure Rules**
```bash
# Create rules directory
.builder/rules/

# Add rule files (.mdc)
# Create AGENTS.md for project context
```

**5. Send Pull Requests**
- Set Commit Mode to "Pull Requests"
- Click "Send PR" after changes
- Use @builder-bot for PR iterations

### 4.4 Figma Plugin Usage

#### Export Options

**Smart Export:**
- AI-powered conversion
- Uses context from design system
- Generates semantic code

**Classic Export:**
- Direct conversion
- Maintains exact structure
- Basic code generation

#### Workflow Options

**Option 1: Import to Publish Space**
- For content management
- Visual editing capabilities
- No-code updates

**Option 2: Generate Code with Visual Editor**
- Interactive code generation
- Real-time preview
- Design system integration

**Option 3: Generate Code with CLI**
- Command-line workflow
- Batch processing
- CI/CD integration

---

## Implementation Checklists

### Animation Project Checklist
- [ ] Choose animation technique (WebGL/GSAP/CSS)
- [ ] Set up development environment
- [ ] Optimize assets (compress images, decimate meshes)
- [ ] Implement scroll handlers
- [ ] Add fallbacks for slower devices
- [ ] Test performance across devices
- [ ] Implement accessibility features

### AI Design Workflow Checklist
- [ ] Set up Fusion account
- [ ] Connect Git repository
- [ ] Index design system
- [ ] Configure MCP servers
- [ ] Create AGENTS.md file
- [ ] Set up PR workflow
- [ ] Train team on new workflow

### Production Deployment Checklist
- [ ] Connect all required services
- [ ] Configure environment variables
- [ ] Set up CI/CD pipeline
- [ ] Implement error tracking
- [ ] Configure monitoring
- [ ] Set up backup procedures
- [ ] Document deployment process

---

## Code Examples Repository

All code examples from this guide are available in organized, runnable format:

### Animation Examples
- `/examples/webgl-scroll/` - Three.js scroll animations
- `/examples/gsap-sequences/` - GSAP image sequences
- `/examples/scroll-reveals/` - Buttery scroll reveals
- `/examples/view-timeline/` - CSS view timeline

### AI Integration Examples
- `/examples/fusion-setup/` - Fusion configuration
- `/examples/supabase-mcp/` - Database integration
- `/examples/figma-plugin/` - Design to code workflow

### Framework Examples
- `/examples/daisyui-patterns/` - Component patterns
- `/examples/theme-setup/` - Theme configuration
- `/examples/responsive-layouts/` - Responsive patterns

---

## Resources and References

### Official Documentation
- [Builder.io Documentation](https://www.builder.io/c/docs)
- [Fusion Getting Started](https://www.builder.io/c/docs/get-started-fusion)
- [Component Indexing](https://www.builder.io/c/docs/component-indexing)
- [MCP Servers Documentation](https://www.builder.io/c/docs/mcp-servers)

### Blog Articles (Source URLs)
1. [WebGL Scroll Animation](https://www.builder.io/blog/webgl-scroll-animation)
2. [3D GSAP Animations](https://www.builder.io/blog/3d-gsap)
3. [Design with AI](https://www.builder.io/blog/design-with-ai)
4. [GSAP Reveal Effects](https://www.builder.io/blog/gsap-reveal)
5. [CSS View Timeline](https://www.builder.io/blog/view-timeline)
6. [daisyUI Best Practices](https://www.builder.io/blog/daisyui-best-practices-ai)
7. [No Handoff Methodology](https://www.builder.io/blog/no-handoff-methodology)
8. [AI UX Design](https://www.builder.io/blog/ai-ux-design)
9. [Supabase MCP](https://www.builder.io/blog/supabase-mcp)
10. [Figma AI Generator](https://www.builder.io/blog/figma-ai-generator)
11. [Create Full-Stack App](https://www.builder.io/blog/create-full-stack-app-ai)

### External Resources
- [GSAP Documentation](https://greensock.com/docs/)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [daisyUI Components](https://daisyui.com/components/)
- [Supabase Documentation](https://supabase.com/docs)
- [TailwindCSS](https://tailwindcss.com/docs)

### Community Resources
- [ReactBits](https://reactbits.dev/) - Interactive component library
- [21st.dev](https://21st.dev/) - Animation templates
- [CodePen Top Lists](https://codepen.io/2024/popular/pens) - Popular effects

### Tools and Plugins
- [Builder.io Figma Plugin](https://www.figma.com/community/plugin/747985167520967365)
- [Builder Chrome Extension](https://chrome.google.com/webstore/detail/builderio)
- [Fusion Visual IDE](https://www.builder.io/fusion)
- [Context7 MCP Server](https://www.builder.io/blog/model-context-protocol)

---

## Version Control and Updates

This guide is compiled from Builder.io resources as of November 2025. For the latest updates:

- Check the [Builder.io Blog](https://www.builder.io/blog) for new articles
- Review the [Documentation](https://www.builder.io/c/docs) for feature updates
- Follow [@builderio](https://twitter.com/builderio) for announcements

### Contributing
To suggest improvements or report issues with this guide:
1. Submit feedback through Builder.io support channels
2. Join the Builder.io community discussions
3. Contribute to open-source examples

---

## Appendix: Quick Reference

### Common Prompts for Fusion

```javascript
// Create component from Figma
"Import this Figma design and create a working component using our design system"

// Add database functionality
"Use Supabase MCP to create a table for [feature] and connect it to the frontend"

// Implement animation
"Add a GSAP scroll animation that fades in elements as they enter viewport"

// Deploy application
"Use Netlify MCP to deploy this application and return the live URL"

// Fix responsive issues
"Make this layout responsive with mobile-first approach using our breakpoints"
```

### Performance Optimization Tips

1. **Animation Performance**
   - Use `will-change` CSS property sparingly
   - Prefer `transform` and `opacity` for animations
   - Implement `requestAnimationFrame` for custom animations
   - Use CSS containment for complex layouts

2. **Asset Optimization**
   - Compress images to < 100KB when possible
   - Use WebP/AVIF formats
   - Implement lazy loading
   - Use CDN for static assets

3. **Code Splitting**
   - Dynamic imports for heavy components
   - Route-based code splitting
   - Lazy load animation libraries
   - Tree-shake unused code

### Troubleshooting Guide

| Issue | Solution |
|-------|----------|
| Animation jank | Reduce complexity, use CSS transforms |
| Slow initial load | Implement code splitting, optimize assets |
| Design system mismatch | Re-index components, update AGENTS.md |
| MCP connection issues | Check permissions, re-authenticate |
| PR conflicts | Use smaller, focused changes |

---

## Conclusion

This comprehensive guide provides the foundation for modern web development using Builder.io's ecosystem of tools. By combining advanced animation techniques with AI-powered development workflows, teams can significantly reduce development time while maintaining high-quality outputs.

Key takeaways:
- Use AI as a multiplier, not a replacement for design and development expertise
- Leverage existing design systems and components for consistency
- Implement the No Handoff methodology for faster iteration
- Test with real data early and often
- Maintain version control and documentation

For continued learning, explore the Builder.io platform, experiment with the code examples, and engage with the community to share experiences and best practices.

---

*Last Updated: November 2025*
*Compiled from Builder.io official resources*
