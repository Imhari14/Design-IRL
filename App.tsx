import React, { useState, useCallback, useMemo } from 'react';
import { AppState, Pin, TasteAnalysis, TasteProfile } from './types';
import { searchPins } from './services/pinterestService';
import { analyzeImage, generateRoom, editImage, urlToBase64, virtualTryOn } from './services/geminiService';
import PinCard from './components/PinCard';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.WELCOME);
  const [pathway, setPathway] = useState<'generate' | 'edit' | 'try-on' | null>(null);
  const [apiKey, setApiKey] = useState<string>(''); // Scrape Creators
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [tempGeminiApiKey, setTempGeminiApiKey] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('Scandinavian living room');
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPins, setSelectedPins] = useState<Pin[]>([]);
  const [maxSelections, setMaxSelections] = useState<number>(5);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [roomDescription, setRoomDescription] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('');
  
  const [userImageForTryOn, setUserImageForTryOn] = useState<{ dataUrl: string; file: File } | null>(null);
  const [tryOnPrompt, setTryOnPrompt] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showInspirationTray, setShowInspirationTray] = useState(false);


  const handleSearch = useCallback(async (loadMore = false) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Searching for inspiration...');
    setError(null);
    try {
      const cursor = loadMore ? nextCursor : null;
      const result = await searchPins(searchQuery, apiKey, cursor);
      if (result.data.length === 0 && !loadMore) {
          setError('No results found. Try a different keyword.');
      }
      setPins(prev => loadMore ? [...prev, ...result.data] : result.data);
      setNextCursor(result.cursor);
    } catch (e: any) {
      setError(e.message);
      setPins([]);
      if (e.message.includes('Invalid API key')) {
        setAppState(AppState.API_KEY_INPUT);
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, apiKey, nextCursor]);

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempApiKey.trim() && tempGeminiApiKey.trim()) {
      setApiKey(tempApiKey);
      setGeminiApiKey(tempGeminiApiKey);
      setAppState(AppState.PATHWAY_SELECTION);
      setError(null);
    } else {
      setError('Please enter both Scrape Creators and Gemini API keys.');
    }
  };

  const handleSelectPin = (pin: Pin) => {
    if (pathway === 'edit') {
      setSelectedPins([pin]);
      return;
    }
    
    setSelectedPins(prev => {
      if (prev.find(p => p.id === pin.id)) {
        return prev.filter(p => p.id !== pin.id);
      }
      if (prev.length < maxSelections) {
        return [...prev, pin];
      }
      return prev;
    });
  };

  const synthesizeProfiles = (analyses: TasteAnalysis[]): TasteProfile => {
    const colorCounts: { [key: string]: number } = {};
    const textureCounts: { [key: string]: number } = {};
    const moodCounts: { [key: string]: number } = {};

    analyses.forEach(analysis => {
      analysis.palette.forEach(color => {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      });
      analysis.materials.forEach(texture => {
        textureCounts[texture] = (textureCounts[texture] || 0) + 1;
      });
      moodCounts[analysis.mood] = (moodCounts[analysis.mood] || 0) + 1;
    });

    const getTopItems = (counts: { [key: string]: number }, limit: number) => 
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(item => item[0]);

    return {
      colors: getTopItems(colorCounts, 5),
      textures: getTopItems(textureCounts, 5),
      moods: getTopItems(moodCounts, 2),
    };
  };

  const handleAnalyzeTaste = async () => {
    if (selectedPins.length === 0) return;
    setAppState(AppState.ANALYZING);
    setIsLoading(true);
    setError(null);

    const totalPins = selectedPins.length;
    const successfulAnalyses: TasteAnalysis[] = [];

    try {
      for (let i = 0; i < totalPins; i++) {
        const pin = selectedPins[i];
        setLoadingMessage(`Analyzing ${i + 1}/${totalPins} pins...`);
        try {
          const { base64, mimeType } = await urlToBase64(pin.images.orig.url);
          const analysis = await analyzeImage(geminiApiKey, base64, mimeType);
          successfulAnalyses.push(analysis);
        } catch (e) {
          console.error(`Could not analyze image ${pin.id}. Skipping this pin.`, e);
        }
      }

      if (successfulAnalyses.length === 0) {
        throw new Error("Analysis failed for all selected images. Please try different pins.");
      }
      
      setLoadingMessage('Synthesizing your TasteDNA Profile...');
      await new Promise(resolve => setTimeout(resolve, 500)); 

      const profile = synthesizeProfiles(successfulAnalyses);
      setTasteProfile(profile);
      setAppState(AppState.GENERATING);
    } catch (e: any) {
      setError(e.message);
      setAppState(AppState.SEARCH);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditingFromPin = async () => {
    if (selectedPins.length !== 1) return;
    setIsLoading(true);
    setLoadingMessage('Preparing image for editing...');
    setError(null);
    try {
      const { base64, mimeType } = await urlToBase64(selectedPins[0].images.orig.url);
      setGeneratedImage(`data:${mimeType};base64,${base64}`);
      setAppState(AppState.EDITING);
    } catch (e: any) {
      setError("Failed to load image for editing. Please try again.");
      setAppState(AppState.SEARCH);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateRoom = async () => {
    if (!tasteProfile || !roomDescription.trim()) {
      setError("Please describe the space you want to create.");
      return;
    }
    setIsLoading(true);
    setError(null);

    const messages = [
      'Brewing up your design...',
      'Arranging the virtual furniture...',
      'Applying the color palette...',
      'Adjusting the lighting...',
      'Almost there, adding the final touches...',
    ];
    let messageIndex = 0;
    setLoadingMessage(messages[messageIndex]);
    const intervalId = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
    }, 3000); 

    try {
      const imageBytes = await generateRoom(geminiApiKey, tasteProfile, roomDescription);
      setGeneratedImage(`data:image/jpeg;base64,${imageBytes}`);
      setAppState(AppState.EDITING);
    } catch (e: any) {
      setError('Failed to generate mockup. Please try again.');
      setAppState(AppState.GENERATING);
    } finally {
      clearInterval(intervalId);
      setIsLoading(false);
    }
  };

  const handleEditImage = async () => {
    if (!generatedImage || !editPrompt.trim()) {
      setError("Please enter an edit instruction.");
      return;
    }
    setIsLoading(true);
    setError(null);
    
    const messages = [
        'Understanding your changes...',
        'Repainting the pixels...',
        'Making the magic happen...',
        'Finalizing the new look...',
    ];
    let messageIndex = 0;
    setLoadingMessage(messages[messageIndex]);
    const intervalId = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
    }, 2500);

    try {
      const currentImage = generatedImage.split(',')[1];
      const newImageBytes = await editImage(geminiApiKey, currentImage, editPrompt);
      setGeneratedImage(`data:image/jpeg;base64,${newImageBytes}`);
      setEditPrompt('');
    } catch (e: any) {
      setError('Failed to edit image. Please try again.');
    } finally {
      clearInterval(intervalId);
      setIsLoading(false);
    }
  };

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserImageForTryOn({ dataUrl: reader.result as string, file });
      };
      reader.readAsDataURL(file);
    }
  };

    const handleDeleteUserImage = () => {
        setUserImageForTryOn(null);
    };

    const handleAddMoreInspiration = () => {
        setAppState(AppState.SEARCH);
    };

  const handleVirtualTryOn = async () => {
    if (!userImageForTryOn || selectedPins.length === 0 || !tryOnPrompt.trim()) {
      setError("Please upload your photo, select at least one inspiration, and provide a prompt.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage("Preparing your virtual try-on...");
    setError(null);
    try {
      const userImageBase64 = userImageForTryOn.dataUrl.split(',')[1];
      const userImageMimeType = userImageForTryOn.file.type;
      
      setLoadingMessage(`Converting ${selectedPins.length} inspiration images...`);
      const inspirationImages = await Promise.all(
        selectedPins.map(pin => urlToBase64(pin.images.orig.url))
      );
      
      setLoadingMessage("Applying styles with AI...");
      const newImageBytes = await virtualTryOn(
        geminiApiKey,
        { base64: userImageBase64, mimeType: userImageMimeType },
        inspirationImages,
        tryOnPrompt
      );
      setGeneratedImage(`data:image/jpeg;base64,${newImageBytes}`);
      setAppState(AppState.EDITING);

    } catch (e: any) {
      setError('Failed to perform virtual try-on. Please try again.');
      setAppState(AppState.TRY_ON_SETUP);
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetSearch = () => {
    setPins([]);
    setSelectedPins([]);
    setNextCursor(null);
    setError(null);
  };

  const startOver = () => {
    setAppState(AppState.PATHWAY_SELECTION);
    setPathway(null);
    setSelectedPins([]);
    setTasteProfile(null);
    setRoomDescription('');
    setGeneratedImage(null);
    setEditPrompt('');
    setUserImageForTryOn(null);
    setTryOnPrompt('');
    setError(null);
    setShowInspirationTray(false);
    resetSearch();
  };
  
  const handleDownloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'design-irl-creation.jpeg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isMaxSelected = useMemo(() => selectedPins.length >= maxSelections, [selectedPins, maxSelections]);
  
  const renderHeader = () => (
    <header className="bg-black/50 backdrop-blur-lg border-b border-white/20 shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="font-caveat text-4xl font-bold text-white cursor-pointer" onClick={() => setAppState(AppState.WELCOME)}>Design IRL</h1>
        {appState > AppState.API_KEY_INPUT && (
          <div className="flex items-center">
            <button
              onClick={() => {
                setAppState(AppState.API_KEY_INPUT);
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-white mr-4"
            >
              Change API Keys
            </button>
            <button
              onClick={startOver}
              className="bg-gray-800 text-gray-200 px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium border border-gray-700"
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </header>
  );

  const renderWelcomeScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 text-center">
      <div className="max-w-4xl w-full bg-white/5 backdrop-blur-xl p-8 sm:p-12 rounded-2xl shadow-lg border border-white/20">
        <h1 className="font-caveat text-8xl font-bold text-white mb-4">Design IRL</h1>
        <p className="font-caveat text-3xl text-gray-300 mb-8">Your Pinterest board. Designed IRL.</p>
        <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
          Unleash your creativity. Whether you're designing a room, editing a photo, or trying on a new style, our AI-powered tools bring your vision to life.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mb-12">
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-lg border border-white/20">
                <h3 className="font-bold text-white text-xl mb-2">Generate from Inspiration</h3>
                <p className="text-gray-400">Combine multiple images to create entirely new room designs.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-lg border border-white/20">
                <h3 className="font-bold text-white text-xl mb-2">Edit an Image</h3>
                <p className="text-gray-400">Select a single photo and modify it with simple text prompts.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-lg border border-white/20">
                <h3 className="font-bold text-white text-xl mb-2">Virtual Try-On</h3>
                <p className="text-gray-400">Upload your own photo and apply styles from Pinterest.</p>
            </div>
        </div>
        <button
          onClick={() => setAppState(AppState.API_KEY_INPUT)}
          className="bg-white text-black font-bold py-3 px-8 rounded-md hover:bg-gray-200 transition duration-300 text-lg"
        >
          Get Started
        </button>
      </div>
    </div>
  );

  const renderApiKeyInput = () => (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-white/20">
        <h2 className="font-caveat text-6xl font-bold text-center text-white mb-2">Enter API Keys</h2>
        <p className="text-center text-gray-300 mb-8">Needed to connect to Pinterest and AI models.</p>
        <form onSubmit={handleApiKeySubmit}>
          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-gray-300 text-sm font-bold mb-2">Scrape Creators API Key</label>
            <input
              id="apiKey"
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter your Scrape Creators key"
              className="w-full px-3 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-black/30 text-white"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="geminiApiKey" className="block text-gray-300 text-sm font-bold mb-2">Google Gemini API Key</label>
            <input
              id="geminiApiKey"
              type="password"
              value={tempGeminiApiKey}
              onChange={(e) => setTempGeminiApiKey(e.target.value)}
              placeholder="Enter your Gemini key"
              className="w-full px-3 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-black/30 text-white"
            />
          </div>
          <button type="submit" className="w-full bg-white text-black font-bold py-2 px-4 rounded-md hover:bg-gray-200 transition duration-300">
            Start Designing
          </button>
          {error && <p className="mt-4 text-center text-red-500 text-sm">{error}</p>}
        </form>
         <div className="mt-8 text-sm text-gray-400 text-left space-y-4">
            <div>
                <p className="font-semibold text-gray-300">Where to find your keys:</p>
            </div>
            <div>
                <span className="font-bold">Scrape Creators:</span>
                <a href="https://scrapecreators.com/" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline ml-2">
                    scrapecreators.com
                </a>
                <p className="text-xs text-gray-500">Offers a <span className="font-bold text-yellow-500">Free Trial</span> with 100 credits, no credit card required.</p>
            </div>
            <div>
                <span className="font-bold">Google Gemini:</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline ml-2">
                    Google AI Studio
                </a>
                <p className="text-xs text-gray-500">Get your Gemini API key from Google AI Studio.</p>
            </div>
        </div>
         <p className="text-xs text-gray-500 mt-8 text-center">Your API keys are stored only in your browser session and are not saved on any server.</p>
      </div>
    </div>
  );

  const renderPathwaySelection = () => {
    const generateImageUrl = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1287&auto=format&fit=crop';
    const editImageUrl = 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?q=80&w=1170&auto=format&fit=crop';
    const tryOnImageUrl = 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?q=80&w=1470&auto=format&fit=crop';
    
    return (
      <div className="bg-black min-h-screen">
        {renderHeader()}
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center text-center" style={{minHeight: '80vh'}}>
            <h2 className="font-caveat text-5xl font-bold text-white mb-4">Choose Your Creative Path</h2>
            <p className="text-gray-400 mb-12 max-w-3xl">Select a workflow to begin. Generate a new room from multiple inspirations, edit a single image, or try on styles from Pinterest using your own photo.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {/* Generate Card */}
                <div 
                  onClick={() => { setPathway('generate'); setAppState(AppState.SEARCH); }}
                  className="bg-[#111111] border border-gray-800 p-6 rounded-2xl text-left hover:border-yellow-500 transition-all duration-300 cursor-pointer group flex flex-col"
                >
                    <div className="relative mb-4">
                       <img src={generateImageUrl} alt="A collage of inspiring room designs" className="w-full h-48 object-cover rounded-lg" />
                       <div 
                            onClick={(e) => { e.stopPropagation(); setViewingImage(generateImageUrl); }}
                            className="absolute top-2 left-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80 z-20"
                            title="View full screen"
                       >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
                           </svg>
                       </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Generate from Inspiration</h3>
                    <p className="text-gray-400">Select multiple images to create a unique room mockup.</p>
                     <p className="text-xs text-gray-500 mt-2">Images sourced from Pinterest.</p>
                </div>
                {/* Edit Card */}
                <div
                  onClick={() => { setPathway('edit'); setAppState(AppState.SEARCH); }}
                  className="bg-[#111111] border border-gray-800 p-6 rounded-2xl text-left hover:border-yellow-500 transition-all duration-300 cursor-pointer group flex flex-col"
                >
                    <div className="relative mb-4">
                        <img src={editImageUrl} alt="A single room being edited with AI" className="w-full h-48 object-cover rounded-lg" />
                        <div 
                            onClick={(e) => { e.stopPropagation(); setViewingImage(editImageUrl); }}
                            className="absolute top-2 left-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80 z-20"
                            title="View full screen"
                       >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
                           </svg>
                       </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Edit an Image</h3>
                    <p className="text-gray-400">Choose one image and use AI prompts to modify it.</p>
                    <p className="text-xs text-gray-500 mt-2">Image sourced from Pinterest.</p>
                </div>
                {/* Try-On Card */}
                <div
                  onClick={() => { setPathway('try-on'); setAppState(AppState.SEARCH); }}
                  className="bg-[#111111] border border-gray-800 p-6 rounded-2xl text-left hover:border-yellow-500 transition-all duration-300 cursor-pointer group flex flex-col"
                >
                    <div className="relative mb-4">
                        <img src={tryOnImageUrl} alt="A person trying on different fashion styles" className="w-full h-48 object-cover rounded-lg" />
                        <div 
                            onClick={(e) => { e.stopPropagation(); setViewingImage(tryOnImageUrl); }}
                            className="absolute top-2 left-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80 z-20"
                            title="View full screen"
                       >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
                           </svg>
                       </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Virtual Try-On</h3>
                    <p className="text-gray-400">Upload your photo and apply styles from Pinterest images.</p>
                    <p className="text-xs text-gray-500 mt-2">Images sourced from Pinterest.</p>
                </div>
            </div>
        </main>
      </div>
    );
  };

  const renderSearch = () => {
    let title = "Step 1: Select Your Inspirations";
    if (pathway === 'edit') title = "Step 1: Select an Image to Edit";
    if (pathway === 'try-on') title = "Step 1: Select Inspiration Styles";
    
    return (
      <div className="bg-black min-h-screen">
        {renderHeader()}
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="bg-[#111111] border border-gray-800 p-6 rounded-2xl shadow-md mb-6">
            <h2 className="font-caveat text-4xl font-bold text-white mb-2">{title}</h2>
            <p className="text-gray-400 mb-4">Select images from Pinterest to begin.</p>
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., 'leather jacket' or '80s hairstyle'"
                className="flex-grow px-4 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-[#1f1f1f] text-white"
              />
              <button type="submit" className="bg-white text-black font-bold py-2 px-6 rounded-md hover:bg-gray-200 transition duration-300">
                Search
              </button>
              <button type="button" onClick={resetSearch} className="bg-gray-800 text-gray-200 py-2 px-4 rounded-md hover:bg-gray-700 border border-gray-700">
                Reset
              </button>
            </form>
          </div>

          {error && <p className="text-center text-red-500 mb-4">{error}</p>}
          
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4">
            {pins.map(pin => (
              <PinCard 
                key={pin.id} 
                pin={pin} 
                isSelected={selectedPins.some(p => p.id === pin.id)} 
                onSelect={handleSelectPin}
                canSelect={pathway === 'edit' ? selectedPins.length < 1 : !isMaxSelected}
                onView={setViewingImage}
              />
            ))}
          </div>

          {pins.length > 0 && nextCursor && (
            <div className="text-center mt-8">
              <button onClick={() => handleSearch(true)} className="bg-gray-800 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-700 transition duration-300 border border-gray-700">
                Load More
              </button>
            </div>
          )}
        </main>
        
        {selectedPins.length > 0 && (
          <footer className="sticky bottom-0 bg-black/80 backdrop-blur-md border-t border-gray-800 shadow-lg p-4 z-30">
            <div className="container mx-auto flex justify-between items-center gap-4">
              {pathway === 'edit' ? (
                 <p className="font-semibold text-gray-300">Selected: {selectedPins.length}/1</p>
              ) : (
                <div className="flex items-center gap-2">
                    <label htmlFor="max-select" className="font-semibold text-gray-300 whitespace-nowrap">Selected: {selectedPins.length}/</label>
                    <input 
                        id="max-select"
                        type="number" 
                        min="1" 
                        max="10" 
                        value={maxSelections} 
                        onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            if (val >= 1 && val <= 10) setMaxSelections(val);
                        }}
                        className="bg-[#1f1f1f] text-white w-16 px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                </div>
              )}
              
              {pathway === 'generate' && (
                <button 
                  onClick={handleAnalyzeTaste} 
                  className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-md hover:bg-yellow-600 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  disabled={selectedPins.length === 0}
                >
                  Analyze Taste
                </button>
              )}
              {pathway === 'edit' && (
                <button 
                  onClick={handleStartEditingFromPin} 
                  className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-md hover:bg-yellow-600 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  disabled={selectedPins.length !== 1}
                >
                  Edit Selected Image
                </button>
              )}
              {pathway === 'try-on' && (
                <button
                  onClick={() => setAppState(AppState.TRY_ON_SETUP)}
                  className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-md hover:bg-yellow-600 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  disabled={selectedPins.length === 0}
                >
                  Next: Upload Your Photo
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    );
  };
  
  const renderTryOnSetup = () => (
    <div className="bg-black min-h-screen">
      {renderHeader()}
      <main className="container mx-auto p-4 flex items-center justify-center" style={{minHeight: '80vh'}}>
        <div className="w-full max-w-4xl bg-[#111111] border border-gray-800 p-8 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-caveat text-5xl font-bold text-white">Step 2: Your Photo & Prompt</h2>
            <button 
                onClick={handleAddMoreInspiration}
                className="bg-gray-800 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-700 border border-gray-700 text-sm"
            >
                + Add Inspiration
            </button>
          </div>
          <p className="text-gray-400 mb-6">Upload your photo, then tell the AI how to apply the inspiration styles.</p>

           <div className="mb-4">
                <p className="text-gray-300 font-semibold mb-2">Your Inspirations</p>
                <div className="flex gap-2 flex-wrap bg-[#1f1f1f] p-2 rounded-md border border-gray-700">
                    {selectedPins.length > 0 ? selectedPins.map(pin => (
                        <img key={pin.id} src={pin.images.orig.url} className="w-16 h-16 object-cover rounded" />
                    )) : <p className="text-xs text-gray-500">No inspiration images selected.</p>}
                </div>
           </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">Upload Your Photo</label>
            <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-700 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {userImageForTryOn ? (
                    <div className="relative group mx-auto h-48 w-auto">
                        <img src={userImageForTryOn.dataUrl} alt="User upload preview" className="h-48 w-auto rounded-md" />
                        <div 
                            onClick={handleDeleteUserImage}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                    </div>
                ) : (
                  <>
                    <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-400">
                      <label htmlFor="user-image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-yellow-500 hover:text-yellow-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-yellow-500 px-2">
                        <span>Upload a file</span>
                        <input id="user-image-upload" name="user-image-upload" type="file" className="sr-only" accept="image/*" onChange={handleUserImageUpload} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="tryOnPrompt" className="block text-gray-300 font-semibold mb-2">Your Prompt</label>
            <textarea
              id="tryOnPrompt"
              rows={3}
              value={tryOnPrompt}
              onChange={(e) => setTryOnPrompt(e.target.value)}
              placeholder="e.g., 'Put the leather jacket on me and give me the 80s hairstyle.'"
              className="w-full px-4 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-[#1f1f1f] text-white"
            />
          </div>
          <button 
            onClick={handleVirtualTryOn} 
            className="w-full bg-white text-black font-bold py-2 px-6 rounded-md hover:bg-gray-200 transition duration-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            disabled={!userImageForTryOn || selectedPins.length === 0 || !tryOnPrompt.trim()}
          >
            Generate Image
          </button>
          {error && <p className="mt-4 text-center text-red-500 text-sm">{error}</p>}
        </div>
      </main>
    </div>
  );

  const renderGenerating = () => (
    <div className="bg-black min-h-screen">
      {renderHeader()}
      <main className="container mx-auto p-4 flex items-center justify-center" style={{minHeight: '80vh'}}>
        <div className="w-full max-w-2xl bg-[#111111] border border-gray-800 p-8 rounded-2xl shadow-lg text-center">
          <h2 className="font-caveat text-5xl font-bold text-white mb-4">Crafting Your Space</h2>
          <p className="text-gray-400 mb-6">Based on your selections, we've created your unique TasteDNA Profile.</p>
          
          {tasteProfile && (
            <div className="text-left mb-6 bg-[#1f1f1f] p-4 rounded-md border border-gray-700">
              <p><span className="font-semibold text-white">Colors:</span> {tasteProfile.colors.join(', ')}</p>
              <p><span className="font-semibold text-white">Materials:</span> {tasteProfile.textures.join(', ')}</p>
              <p><span className="font-semibold text-white">Moods:</span> {tasteProfile.moods.join(', ')}</p>
            </div>
          )}

          <p className="text-gray-300 font-semibold mb-2">Now, what's this space for?</p>
          <input
            type="text"
            value={roomDescription}
            onChange={(e) => setRoomDescription(e.target.value)}
            placeholder="e.g., 'Home office for 2 with a cat'"
            className="w-full px-4 py-2 border border-gray-700 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-[#1f1f1f] text-white"
          />
          <button 
            onClick={handleGenerateRoom} 
            className="w-full bg-white text-black font-bold py-2 px-6 rounded-md hover:bg-gray-200 transition duration-300"
          >
            Generate Mockup
          </button>
          {error && <p className="mt-4 text-center text-red-500 text-sm">{error}</p>}
        </div>
      </main>
    </div>
  );

  const renderEditing = () => (
    <div className="bg-black min-h-screen">
      {renderHeader()}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
        <h2 className="font-caveat text-5xl font-bold text-center text-white mb-6">
          {pathway === 'generate' ? 'Your Generated Room' : 'Edit Your Image'}
        </h2>
        
        {generatedImage && (
          <div className="relative group mb-6 w-full max-w-4xl">
            <div className="rounded-lg shadow-lg overflow-hidden border border-gray-800">
              <img 
                src={generatedImage} 
                alt="AI-generated or user-selected room" 
                className="w-full max-h-[60vh] object-contain bg-black/50" 
              />
            </div>
            <div 
              onClick={() => setViewingImage(generatedImage)}
              className="absolute top-4 left-4 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80 z-20 cursor-pointer"
              title="View full screen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
              </svg>
            </div>
          </div>
        )}

        <div className="w-full max-w-4xl bg-[#111111] border border-gray-800 p-6 rounded-2xl shadow-md mb-6">
           <p className="text-gray-300 font-semibold mb-2">Want to change something? Edit with AI.</p>
          <form onSubmit={(e) => { e.preventDefault(); handleEditImage(); }} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="e.g., 'Add a rug' or 'Make the windows bigger'"
              className="flex-grow px-4 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-[#1f1f1f] text-white"
            />
            <button type="submit" className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-md hover:bg-yellow-600 transition duration-300">
              Edit Image
            </button>
          </form>
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
                onClick={handleDownloadImage}
                className="bg-white text-black font-bold py-2 px-6 rounded-md hover:bg-gray-200 transition duration-300"
            >
                Download Image
            </button>
            <a 
                href="https://lens.google.com/upload" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-gray-800 text-gray-200 font-bold py-2 px-6 rounded-md hover:bg-gray-700 transition duration-300 text-center border border-gray-700"
            >
                Find Objects with Google Lens
            </a>
            {pathway === 'try-on' && (
                <button
                    onClick={() => setShowInspirationTray(true)}
                    className="bg-gray-800 text-gray-200 font-bold py-2 px-6 rounded-md hover:bg-gray-700 transition duration-300 border border-gray-700"
                >
                    View Inspiration Images
                </button>
            )}
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">To use Google Lens, download your image first, then upload it on the Google Lens page.</p>
      </main>
    </div>
  );

  const renderImageViewer = () => {
    if (!viewingImage) return null;
    return (
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50"
        onClick={() => setViewingImage(null)}
      >
        <button 
          className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-50"
        >
          &times;
        </button>
        <img 
          src={viewingImage} 
          alt="Full screen view" 
          className="max-w-[90vw] max-h-[90vh] object-contain"
          onClick={e => e.stopPropagation()} // Prevent closing when clicking the image
        />
      </div>
    );
  };
  
  const renderInspirationTray = () => {
    if (!showInspirationTray || pathway !== 'try-on') return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-[#111111]/95 backdrop-blur-md border-t border-gray-800 p-4 z-40 animate-slide-up">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Your Inspiration</h3>
            <button onClick={() => setShowInspirationTray(false)} className="text-2xl text-gray-400 hover:text-white">&times;</button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {/* User Image */}
            {userImageForTryOn && (
              <div className="flex-shrink-0 text-center">
                 <p className="text-xs text-yellow-500 mb-1 font-semibold">Your Photo</p>
                 <img 
                   src={userImageForTryOn.dataUrl} 
                   alt="Your uploaded photo for try-on"
                   className="w-24 h-24 object-cover rounded-md border-2 border-yellow-500 cursor-pointer hover:opacity-80 transition-opacity"
                   onClick={() => setViewingImage(userImageForTryOn.dataUrl)}
                 />
              </div>
            )}
            {/* Pinterest Images */}
            {selectedPins.map(pin => (
               <div key={pin.id} className="flex-shrink-0">
                   <p className="text-xs text-gray-400 mb-1 invisible">Inspiration</p>
                  <img 
                     src={pin.images.orig.url}
                     alt={pin.title || 'Pinterest inspiration'}
                     className="w-24 h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                     onClick={() => setViewingImage(pin.images.orig.url)}
                  />
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  };


  const renderContent = () => {
    switch (appState) {
      case AppState.WELCOME:
        return renderWelcomeScreen();
      case AppState.API_KEY_INPUT:
        return renderApiKeyInput();
      case AppState.PATHWAY_SELECTION:
        return renderPathwaySelection();
      case AppState.SEARCH:
      case AppState.ANALYZING:
        return renderSearch();
      case AppState.TRY_ON_SETUP:
        return renderTryOnSetup();
      case AppState.GENERATING:
        return renderGenerating();
      case AppState.EDITING:
        return renderEditing();
      default:
        return <div>Something went wrong.</div>;
    }
  };

  return (
    <div>
      {isLoading && <LoadingSpinner message={loadingMessage} />}
      {renderImageViewer()}
      {renderInspirationTray()}
      {renderContent()}
    </div>
  );
};

export default App;
