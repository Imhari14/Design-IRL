

# Design-IRL

**Your Pinterest board. Designed IRL.**

Design-IRL is an AI-powered creative playground for designers, brands, and everyone exploring visual inspiration. Harness the power of Gemini AI and Pinterest to transform inspiration into unique product mockups, brand aesthetics, room designs, and more—all in your browser.

> **Try it online:**  
> [Design-IRL on AI Studio](https://ai.studio/apps/drive/1-SWD6W5Qucbxw9XAmsmjBzEMIx5gc2lP)

---

## ✨ Main Features

- **Generate from Inspiration**  
  Create stunning product mockups, brand aesthetics, or unique room designs by fusing ideas from multiple images. Select images from Pinterest, analyze their style, and blend their features into a photorealistic, AI-generated composite.

- **Edit an Image**  
  Refine any image with simple text commands. Perfect for quick adjustments to your mockups, brand visuals, or interior designs. Just describe your desired change and let AI do the rest.

- **Virtual Try-On**  
  See it on you. Virtually try on clothes, accessories, ornaments, and more using your own photo and visual inspiration. Blend styles and test looks instantly.

---

## 🗺️ App Pathways

- **Generate:** Fuse inspirations and create new visual concepts.
- **Edit:** AI-edit any image with natural language prompts.
- **Try-On:** Combine your own photo with style inspirations for instant virtual try-ons.

## 🛠️ Getting Started (Local Development)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Set API keys in `.env.local`:**
   - `GEMINI_API_KEY` — [Get your Gemini API key from Google AI Studio](https://aistudio.google.com/app/apikey)
   - `SCRAPE_CREATORS_API_KEY` — For Pinterest search (obtain from scrapecreators.com)

3. **Run the app locally:**
   ```bash
   npm run dev
   ```
4. **Open in browser:** Access via [localhost](http://localhost:3000) or as directed in your terminal.

## 📦 Project Structure

```
/
├── components/         # UI components (PinCard, LoadingSpinner, etc.)
├── services/           # Pinterest and Gemini service integrations
├── types.ts            # TypeScript type definitions
├── App.tsx             # Main React app logic and state
├── index.html          # Entry HTML (includes Tailwind and fonts)
└── README.md           # Project documentation
```

## 📝 Tech Stack

- **React** (frontend logic)
- **TailwindCSS** (styling)
- **TypeScript** (type safety)
- **Google Gemini API** (AI analysis, image generation, editing, try-on)
- **Pinterest Search** (via scrapecreators.com API)

## 🤝 Contributing

Pull requests and suggestions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Design-IRL:** Turn your inspiration into reality Your Pinterest board. Designed IRL.
