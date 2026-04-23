<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Storyboard AI Studio

A comprehensive AI-powered storyboard creation studio for film, TV, and animation productions. Generate complete series with episodes, scenes, shots, characters, and visual assets using Google's Gemini AI and other providers.

## Features

### Story Generation
- **AI-Powered Story Creation**: Generate complete series concepts including loglines, treatments, episode synopses, and scene outlines
- **Character Development**: Create detailed character profiles with personality, appearance, behavior, and outfit descriptions
- **Narrative Arc Editor**: Visualize and adjust dramatic tension, emotional state, and conflict levels across episodes
- **Linda Seger Method Integration**: Apply professional screenplay techniques to refine characters and story structure

### Visual Styles
Supports multiple artistic styles for image generation:
- Cinematic (Photorealistic)
- Anime / Comic Book
- Film Noir / Sketch / Line Drawing
- Video Game styles (Stylized, LowPoly)
- Cyberpunk / Solarpunk / Sepia
- Custom style training with reference images

### Production Tools
- **Series Bible**: Manage logline, treatment, subplots, references, and soundtrack prompts
- **Episode Management**: Create and organize episodes with scenes and shots
- **Visual Organizer**: Drag-and-drop interface to reorder scenes and shots
- **Storyboard View**: Shot-by-shot editing with detailed technical parameters (lens, lighting, camera movement, etc.)
- **Gallery Views**: Browse generated images in gallery or grid format

### Collaboration
- **Comments System**: Add comments to specific shots, scenes, or story elements with user simulation
- **Multi-user Support**: Simulate different team members with color-coded avatars
- **Project Authors**: Track human contributors and their participation levels

### AI Integration
- **Multiple AI Providers**:
  - Google Gemini (text, image, video)
  - Ollama (local models)
  - ComfyUI (image generation)
- **Creative Profiles**: Define AI personas (Director, Cinematographer) to guide project style
- **Consistency Checking**: AI-powered continuity error detection and fixing
- **Story Modification**: AI-assisted story rewrites with adjustable intensity and "weirdness"

### Export Options
- **PDF Export**: Generate professional storyboard PDFs
- **Video Generation**: Turn storyboard frames into video clips
- **Frame.io Integration**: Share directly to Frame.io
- **Animatic Export**: Export shot sequences for animation

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **Gemini API Key** (or other AI provider credentials)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd storyboard-AI-studio-2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

   Optional providers (defaults shown):
   ```env
   # Ollama (for local models)
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3

   # ComfyUI (for image generation)
   COMFYUI_URL=http://127.0.0.1:8188
   COMFYUI_MODEL=v1-5-pruned-emaonly.ckpt
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173` (or the port shown in terminal)

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS |
| **AI - Text** | Google Gemini, Ollama |
| **AI - Image** | Google Imagen, ComfyUI |
| **AI - Video** | Google Veo |
| **Storage** | IndexedDB (browser local storage) |
| **PDF Generation** | jsPDF, html2canvas |

## Project Structure

```
├── App.tsx                 # Main application component
├── components/            # React components (36 components)
│   ├── Storyboard.tsx     # Shot-by-shot storyboard editor
│   ├── StoryGenerator.tsx # AI story generation wizard
│   ├── NarrativeArcEditor.tsx
│   ├── AdvancedNarrativeArc.tsx
│   ├── SeriesBible.tsx    # Series bible management
│   ├── VideoGenerator.tsx
│   ├── PDFExportModal.tsx
│   └── ... (30+ more)
├── contexts/              # React contexts
│   ├── authContext.tsx
│   ├── collaborationContext.tsx
│   └── languageContext.tsx
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
│   ├── db.ts             # IndexedDB persistence
│   ├── translations.ts   # i18n (EN/ES)
│   └── ...
├── services/              # AI service integrations
│   ├── geminiService.ts  # Gemini API wrapper
│   └── ai/              # Provider factory & implementations
│       ├── factory.ts
│       └── providers/
│           ├── gemini.ts
│           ├── ollama.ts
│           └── comfyui.ts
├── types.ts              # TypeScript type definitions
└── list_models.ts        # Utility to list available AI models
```

## Workflow Phases

1. **Setup** - Configure project style and settings
2. **Ideation** - Generate story concept with AI
3. **Structure** - Build episodes and narrative arc
4. **Refinement** - Develop characters using Linda Seger method
5. **Visualization** - Generate images for shots and characters
6. **Production** - Export PDFs, videos, or share to Frame.io

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Alt + M` | Open Story Modification modal |
| `Shift + Alt + A` | Open Consistency Check modal |

## Supported Languages

- English (en)
- Spanish (es)

## AI Models Used

- **Text Generation**: Gemini 2.0 Flash (default), configurable to Ollama models
- **Image Generation**: Imagen 2 (default), configurable to ComfyUI
- **Video Generation**: Veo (via Gemini)

## License

Private project. All rights reserved.

---

View in AI Studio: https://ai.studio/apps/drive/1-OwPDaCaCO8RxII7gSEwJVGYt9HS0Apj
