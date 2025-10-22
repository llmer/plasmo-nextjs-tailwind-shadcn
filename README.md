# plasmo-nextjs-tailwind-shadcn

A browser extension wallet built with Plasmo, Next.js, Tailwind CSS, and shadcn-ui.

## Tech Stack

- **[Plasmo](https://docs.plasmo.com/)** - Browser extension framework
- **[Next.js](https://nextjs.org/)** - React framework for the dashboard/options page
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn-ui](https://ui.shadcn.com/)** - Re-usable component library

## Project Setup

This project was created using the following steps:

### 1. Initialize Plasmo with Next.js

```bash
pnpm create plasmo --with-nextjs
```

### 2. Install Tailwind CSS

```bash
pnpm i -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

### 3. Configure Tailwind

**tailwind.config.js:**
- Set content to `["./src/**/*.{ts,tsx}"]` to avoid matching node_modules
- Add shadcn-ui theme configuration with CSS variables

**src/style.css:**
- Add Tailwind directives and shadcn-ui CSS variables

**postcss.config.js:**
- Configure Tailwind and Autoprefixer plugins

### 4. Install shadcn-ui Dependencies

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
```

### 5. Configure Path Aliases

**tsconfig.json:**
- Add `"@/*": ["./src/*"]` to paths for shadcn-ui imports

### 6. Create shadcn-ui Configuration

**components.json:**
- Configure shadcn-ui with New York style, CSS variables, and path aliases

**src/lib/utils.ts:**
- Create the `cn()` helper function for merging Tailwind classes

### 7. Setup Next.js Custom App

**src/pages/_app.tsx:**
- Import global CSS (Next.js requires global CSS in _app)

### 8. Add shadcn-ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add input
# etc.
```

## Getting Started

First, run the development server:

```bash
pnpm dev
```

This will start both:
- **Plasmo dev server** - Builds the extension at `build/chrome-mv3-dev`
- **Next.js dev server** - Runs at `http://localhost:1947`

### Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` directory

### Development

- **Extension popup**: Edit `src/popup/index.tsx`
- **Next.js pages**: Edit files in `src/pages/`
- **Components**: Create in `src/components/`
- **UI components**: shadcn-ui components are in `src/components/ui/`

All changes auto-reload in both the extension and Next.js app.

For further guidance, [visit the Plasmo Documentation](https://docs.plasmo.com/)

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
