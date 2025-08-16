
import React from 'react';
import { SendIcon, MicrophoneIcon, PaperClipIcon } from './Icons';

interface InputBarProps {
  input: string;
  setInput: (value: string) => void;
  isListening: boolean;
  onSend: (e?: React.FormEvent) => void;
  onMicClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({
  input,
  setInput,
  isListening,
  onSend,
  onMicClick,
  onFileChange,
  isLoading,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <form
      onSubmit={onSend}
      className="bg-slate-800 p-4 flex items-center space-x-3 border-t border-slate-700"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
        accept="image/*"
      />
      <button
        type="button"
        onClick={handleAttachClick}
        disabled={isLoading}
        className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 transition-colors"
      >
        <PaperClipIcon />
      </button>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isListening ? 'Listening...' : 'Ask me anything...'}
        disabled={isLoading}
        className="flex-1 bg-slate-900 text-white placeholder-gray-500 p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      />

      <button
        type="button"
        onClick={onMicClick}
        disabled={isLoading}
        className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 transition-colors"
      >
        <MicrophoneIcon isListening={isListening} />
      </button>

      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-full p-3 transition-colors"
      >
        <SendIcon />
      </button>
    </form>
  );
};
