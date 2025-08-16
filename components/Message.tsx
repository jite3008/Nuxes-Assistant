import React from 'react';
import { Message as MessageType, Action, Source } from '../types';

const UserMessage: React.FC<{ message: MessageType }> = ({ message }) => (
  <div className="flex justify-end">
    <div className="bg-blue-600 rounded-lg rounded-br-none p-3 max-w-lg text-white">
      {message.imagePreview && (
        <img src={message.imagePreview} alt="User upload" className="rounded-md mb-2 max-h-48" />
      )}
      <p>{message.text}</p>
    </div>
  </div>
);

const ModelMessage: React.FC<{ message: MessageType }> = ({ message }) => (
  <div className="flex justify-start">
    <div className="bg-slate-700 rounded-lg rounded-bl-none p-3 max-w-lg text-gray-100">
      {message.isLoading ? (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{message.text}</p>

          {message.youtubeVideoId && (
            <div className="mt-3 aspect-video">
              <iframe
                className="w-full h-full rounded-md"
                src={`https://www.youtube.com/embed/${message.youtubeVideoId}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}
          
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actions.map((action: Action, index: number) => (
                <a
                  key={index}
                  href={action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors duration-200"
                >
                  {action.label}
                </a>
              ))}
            </div>
          )}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 border-t border-slate-600 pt-3">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Sources:</h4>
              <div className="flex flex-col space-y-2">
                {message.sources.map((source: Source, index: number) => (
                  <a
                    key={index}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm truncate"
                    title={source.uri}
                  >
                    {index + 1}. {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>
);

export const Message: React.FC<{ message: MessageType }> = ({ message }) => {
  return message.role === 'user' ? <UserMessage message={message} /> : <ModelMessage message={message} />;
};