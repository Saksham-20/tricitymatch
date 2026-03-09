# shadcn/ui MultiStep Form Integration Guide

## ✅ Setup Complete

The shadcn/ui multistep form component has been successfully integrated into your TricityShadi project.

## 📁 Project Structure

The following structure has been created:

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/              # shadcn/ui components folder
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       └── multistep-form.tsx
│   ├── lib/
│   │   └── utils.ts        # cn() utility function
│   └── index.css            # Updated with shadcn CSS variables
├── tsconfig.json           # TypeScript configuration
├── tsconfig.node.json      # TypeScript config for Node
└── tailwind.config.js      # Updated with shadcn theme
```

## 🔧 Installation Steps

### 1. Install Dependencies

Run the following command to install all required dependencies:

```bash
cd frontend
npm install
```

This will install:
- **TypeScript** and type definitions
- **lucide-react** - Icon library
- **@radix-ui/react-slot** - Radix UI Slot component
- **@radix-ui/react-label** - Radix UI Label component
- **class-variance-authority** - For component variants
- **clsx** - For conditional classNames
- **tailwind-merge** - For merging Tailwind classes
- **tailwindcss-animate** - For animations

### 2. Verify TypeScript Setup

The project now supports both JavaScript (.jsx) and TypeScript (.tsx) files. The TypeScript configuration is set up with:
- Path aliases (`@/*` → `./src/*`)
- Strict mode enabled
- React JSX support

## 📝 Usage

### Import and Use the Component

You can now use the MultiStepForm component in any of your pages:

```tsx
import { MultiStepForm } from "@/components/ui/multistep-form"

export default function MyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 w-full">
      <MultiStepForm />
    </div>
  )
}
```

### Example: Add to Profile Page

You could integrate it into your Profile page for a better onboarding experience:

```tsx
// In frontend/src/pages/Profile.tsx
import { MultiStepForm } from "@/components/ui/multistep-form"

// Use it as an alternative to the current step-based form
```

## 🎨 Styling

The component uses shadcn/ui's design system with CSS variables defined in `index.css`. The colors are integrated with your existing trustworthy blue theme.

### Customization

You can customize the component by:
1. Modifying the `steps` array in `multistep-form.tsx`
2. Adjusting CSS variables in `index.css`
3. Updating Tailwind theme in `tailwind.config.js`

## 🔍 Component Features

- **Multi-step form** with progress indicator
- **Step navigation** with visual feedback
- **Form validation** (requires input before proceeding)
- **Completion screen** with success animation
- **Responsive design** that works on all screen sizes
- **Accessible** with proper ARIA labels and keyboard navigation

## 📚 Dependencies Explained

- **lucide-react**: Modern icon library (replaces react-icons for this component)
- **@radix-ui/react-slot**: Allows component composition
- **@radix-ui/react-label**: Accessible label component
- **class-variance-authority**: Type-safe variant management
- **clsx + tailwind-merge**: Utility for merging Tailwind classes

## 🚀 Next Steps

1. **Install dependencies**: Run `npm install` in the frontend directory
2. **Test the component**: Create a test page to verify it works
3. **Customize steps**: Modify the steps array to match your form requirements
4. **Integrate with your forms**: Replace or enhance existing form flows

## ⚠️ Important Notes

- The `/components/ui` folder is essential for shadcn/ui components. This is the standard location where shadcn CLI installs components.
- TypeScript files (.tsx) can coexist with JavaScript files (.jsx) in this project
- The `cn()` utility function from `@/lib/utils` is required for all shadcn components
- CSS variables in `index.css` must be maintained for proper theming

## 🐛 Troubleshooting

If you encounter issues:

1. **TypeScript errors**: Ensure all dependencies are installed
2. **Styling issues**: Check that CSS variables are defined in `index.css`
3. **Import errors**: Verify path aliases in `vite.config.js` and `tsconfig.json`
4. **Missing styles**: Ensure `tailwindcss-animate` is installed and configured

## 📖 Additional Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)



