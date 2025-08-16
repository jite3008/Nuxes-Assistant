import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message as MessageType, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from './types';
import { Message } from './components/Message';
import { InputBar } from './components/InputBar';
import { getAssistantResponse } from './services/geminiService';
import { SpeakerOnIcon, SpeakerOffIcon } from './components/Icons';

const App: React.FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionImpl();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join('');
        setInput(transcript);
        if (event.results[0].isFinal) {
           // Auto-submit when speech is final
           handleSend(undefined, transcript);
        }
      };
      
      recognitionRef.current = recognition;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
  const speak = useCallback((text: string) => {
      if (!isTtsEnabled || !text) return;
      window.speechSynthesis.cancel(); // Cancel any previous speech
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled]);

  const handleSend = async (e?: React.FormEvent, voiceInput?: string) => {
    if (e) e.preventDefault();
    const currentInput = voiceInput || input;
    if (!currentInput.trim() && !attachedFile) return;

    setIsLoading(true);

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      text: currentInput,
      imagePreview: imagePreview || undefined,
    };

    setMessages((prev) => [...prev, userMessage, { id: 'loading', role: 'model', text: '', isLoading: true }]);

    const response = await getAssistantResponse(currentInput, attachedFile);

    // Clear input fields after sending the request
    setInput('');
    setAttachedFile(null);
    setImagePreview('');

    // Attempt to automatically perform the action for a more "native" feel
    // Do not auto-open for youtube videos that are being embedded.
    if (response.actions && response.actions.length > 0 && !response.youtubeVideoId) {
      const actionUrl = response.actions[0].url;
      // This may be blocked by the browser's pop-up blocker, but we try anyway.
      // The button in the message serves as a reliable fallback.
      window.open(actionUrl, '_blank');
    }

    const modelMessage: MessageType = {
      id: Date.now().toString() + '-model',
      role: 'model',
      text: response.text || 'Sorry, I could not process that.',
      actions: response.actions,
      sources: response.sources,
      youtubeVideoId: response.youtubeVideoId,
    };
    
    speak(modelMessage.text);

    setMessages((prev) => prev.filter(m => m.id !== 'loading'));
    setMessages((prev) => [...prev, modelMessage]);
    
    setIsLoading(false);
  };
  
  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setInput(prev => prev ? `${prev} (see attached image)` : 'Describe this image.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold text-white">Nexus AI Assistant</h1>
        <button onClick={() => setIsTtsEnabled(prev => !prev)} className="p-2 text-gray-300 hover:text-white transition-colors">
          {isTtsEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="w-full">
         {imagePreview && (
          <div className="bg-slate-800 p-2 text-center text-sm relative">
            <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover inline-block rounded-md"/>
            <button 
              onClick={() => {
                setAttachedFile(null);
                setImagePreview('');
              }} 
              className="absolute top-0 right-2 text-white bg-red-600 rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold"
             >&times;</button>
          </div>
        )}
        <InputBar
          input={input}
          setInput={setInput}
          isListening={isListening}
          onSend={handleSend}
          onMicClick={handleMicClick}
          onFileChange={handleFileChange}
          isLoading={isLoading}
        />
      </footer>
    </div>
  );
};

export default App;