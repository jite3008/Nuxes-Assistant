
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Message, Source, Action } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const intentDetectionModel = "gemini-2.5-flash";
const searchModel = "gemini-2.5-flash";

// A map of common application names to their direct URL schemes
const knownAppSchemes: { [key: string]: string } = {
    // Social & Communication
    'instagram': 'instagram://',
    'facebook': 'fb://',
    'twitter': 'twitter://',
    'x': 'twitter://',
    'whatsapp': 'whatsapp://',
    'snapchat': 'snapchat://',
    'tiktok': 'tiktok://',
    'linkedin': 'linkedin://',
    'pinterest': 'pinterest://',
    'slack': 'slack://',
    'discord': 'discord://',
    'telegram': 'tg://',
    'zoom': 'zoomus://',
    'reddit': 'reddit://',

    // Music, Video & Entertainment
    'spotify': 'spotify:',
    'youtube': 'youtube://',
    'netflix': 'nflx://',
    'soundcloud': 'soundcloud://',
    'pandora': 'pandora://',
    'apple music': 'music://',
    
    // Navigation & Travel
    'maps': 'googlemaps://',
    'google maps': 'googlemaps://',
    'waze': 'waze://',
    'uber': 'uber://',
    'lyft': 'lyft://',
    'airbnb': 'airbnb://',

    // Google Suite
    'gmail': 'googlegmail://',
    'google drive': 'googledrive://',
    'drive': 'googledrive://',
    'google photos': 'googlephotos://',
    'photos': 'googlephotos://',
    'google calendar': 'googlecalendar://',
    'calendar': 'googlecalendar://',
    'google docs': 'googledocs://',
    'docs': 'googledocs://',
    'google sheets': 'googlesheets://',
    'sheets': 'googlesheets://',
    'google slides': 'googleslides://',
    'slides': 'googleslides://',
    
    // Shopping & Food
    'amazon': 'amazon://',
    'ebay': 'ebay://',
    'etsy': 'etsy://',
    'walmart': 'walmart://',
    'doordash': 'doordash://',
    'grubhub': 'grubhub://',
    'uber eats': 'ubereats://',

    // Productivity & Finance
    'evernote': 'evernote://',
    'trello': 'trello://',
    'asana': 'asana://',
    'outlook': 'ms-outlook://',
    'microsoft teams': 'msteams://',
    'teams': 'msteams://',
    'dropbox': 'dbx-dropbox://',
    'paypal': 'paypal://',
    'venmo': 'venmo://',
    'cash app': 'cashapp://',

    // Other
    'duolingo': 'duolingo://',
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const getYouTubeVideoId = (url: string): string | null => {
    try {
        if (!url || !url.trim()) return null;
        // Comprehensive regex to handle various YouTube URL formats
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch (e) {
        return null; // Should not happen with string input, but good practice
    }
};

const intentSchema = {
    type: Type.OBJECT,
    properties: {
        music: {
            type: Type.OBJECT,
            properties: {
                platform: { type: Type.STRING, description: "The music platform, e.g., Spotify, Apple Music." },
                query: { type: Type.STRING, description: "The song and/or artist to search for" }
            },
        },
        youtube: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "The video to search for on YouTube" }
            },
        },
        call: {
            type: Type.OBJECT,
            properties: {
                number: { type: Type.STRING, description: "The phone number to call" }
            },
        },
        website: {
            type: Type.OBJECT,
            properties: {
                url: { type: Type.STRING, description: "The full URL of the website to open, ensuring it starts with http:// or https://" }
            },
        },
        map: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "The location or directions to search on Google Maps" }
            },
        },
        openApp: {
            type: Type.OBJECT,
            properties: {
                appName: { type: Type.STRING, description: "The name of the application to open, e.g., 'Instagram', 'Calculator', 'WhatsApp'." }
            },
        },
        webSearch: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "The user's original query for a web search" }
            },
        },
        generalResponse: {
            type: Type.STRING,
            description: "A direct answer for general conversation, a question that doesn't need a web search, or if the intent is unclear."
        },
    },
};


export const getAssistantResponse = async (prompt: string, attachedFile: File | null): Promise<Partial<Message>> => {
    try {
        const parts = [{ text: prompt }];
        if (attachedFile) {
            const imagePart = await fileToGenerativePart(attachedFile);
            parts.push(imagePart as any);
        }

        const systemInstruction = `You are a powerful and helpful multipurpose assistant.
Analyze the user's prompt and determine their primary intent. Your response must be in JSON format conforming to the provided schema.
Based on the intent, populate ONLY ONE of the fields in the JSON. All other fields must be null.

IMPORTANT RULE: If a user asks to play something and mentions 'YouTube', you MUST use the 'youtube' intent.
IMPORTANT RULE: When a user's request could be both an app and a website (e.g., "open facebook"), you MUST prioritize the 'openApp' intent.

Here are the intents:
- youtube: User wants to watch a video on YouTube. Prioritize this if 'youtube' is mentioned in a media request.
- music: User wants to play music on a platform OTHER THAN YouTube.
- openApp: User wants to open a native application on their device. Prioritize this over 'website' for ambiguous names.
- website: User wants to open a specific website. Use for clear domain names (e.g., 'espn.com').
- call: User wants to make a phone call.
- map: User wants to find a location or directions.
- webSearch: Use this for any question that requires up-to-date, real-time, or factual information (e.g., "Who won the last Super Bowl?", "What is the capital of France?", "What is the weather like?"). Also use for explicit search commands like "google...".
- generalResponse: Use this to answer general knowledge questions that do not require real-time data (e.g., "Why is the sky blue?", "Tell me a joke"). It is also used for simple greetings, conversation, or when analyzing an attached image.`;
        
        const intentResponse = await ai.models.generateContent({
            model: intentDetectionModel,
            contents: { role: 'user', parts },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: intentSchema,
            }
        });

        const intentJsonText = intentResponse.text.trim();
        const intentData = JSON.parse(intentJsonText);

        const musicData = intentData.music;
        if (musicData && musicData.query && musicData.query.toLowerCase() !== 'null' && musicData.platform && musicData.platform.toLowerCase() !== 'null') {
            const { platform, query } = musicData;
            
            if (platform.toLowerCase().includes('spotify')) {
                const spotifyUri = `spotify:search:${encodeURIComponent(query)}`;
                return {
                    text: `Playing "${query}" on Spotify.`,
                    actions: [{ label: `Play on Spotify`, url: spotifyUri }]
                };
            }

            const url = `https://www.google.com/search?q=${encodeURIComponent(`play ${query} on ${platform}`)}`;
            return {
                text: `Playing "${query}" on ${platform}.`,
                actions: [{ label: `Play on ${platform}`, url }]
            };
        } else if (intentData.youtube && intentData.youtube.query && intentData.youtube.query.toLowerCase() !== 'null') {
            const { query } = intentData.youtube;
            try {
                const searchPrompt = `Search for a YouTube video about "${query}". Return ONLY the full raw URL of the top video result, like "https://www.youtube.com/watch?v=...". Do not add any other text.`;
                const videoSearchResponse = await ai.models.generateContent({
                    model: searchModel,
                    contents: { role: 'user', parts: [{ text: searchPrompt }] },
                    config: { tools: [{ googleSearch: {} }] },
                });

                const videoUrl = videoSearchResponse.text.trim();
                const videoId = getYouTubeVideoId(videoUrl);

                if (videoId) {
                    return {
                        text: `Here is the video for "${query}".`,
                        youtubeVideoId: videoId,
                        actions: [{ label: 'Watch on YouTube Website', url: `https://www.youtube.com/watch?v=${videoId}` }]
                    };
                } else {
                    console.warn("Could not extract YouTube video ID, falling back to search:", videoUrl);
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    return {
                        text: `I couldn't find a specific video to play, but here are the search results for "${query}".`,
                        actions: [{ label: 'Search on YouTube', url: searchUrl }]
                    };
                }

            } catch (error) {
                console.error("Error fetching YouTube video:", error);
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                return {
                    text: `I had trouble finding a specific video, but you can see the search results here.`,
                    actions: [{ label: 'Search on YouTube', url: searchUrl }]
                };
            }
        } else if (intentData.call && intentData.call.number && intentData.call.number.toLowerCase() !== 'null') {
            const { number } = intentData.call;
            const sanitizedNumber = number.replace(/\s/g, '');
            return {
                text: `Calling ${number}.`,
                actions: [{ label: `Call ${number}`, url: `tel:${sanitizedNumber}` }]
            };
        } else if (intentData.website && intentData.website.url && intentData.website.url.toLowerCase() !== 'null') {
            let { url } = intentData.website;
            if (!url.startsWith('http')) {
                url = `https://${url}`;
            }
            let hostname = 'the website';
            try {
                hostname = new URL(url).hostname;
            } catch (e) {
                console.warn('Could not parse URL for label:', url);
            }
            return {
                text: `Opening ${hostname}.`,
                actions: [{ label: `Open ${hostname}`, url }]
            };
        } else if (intentData.map && intentData.map.query && intentData.map.query.toLowerCase() !== 'null') {
            const { query } = intentData.map;
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
            return {
                text: `Finding "${query}" on Google Maps.`,
                actions: [{ label: 'Open in Google Maps', url }]
            };
        } else if (intentData.openApp && intentData.openApp.appName && intentData.openApp.appName.toLowerCase() !== 'null') {
            const { appName } = intentData.openApp;
            const normalizedAppName = appName.toLowerCase().trim();
            
            const scheme = knownAppSchemes[normalizedAppName];

            if (scheme) {
                return {
                    text: `Opening ${appName}...`,
                    actions: [{ label: `Open ${appName}`, url: scheme }]
                };
            } else {
                const url = `https://www.google.com/search?q=${encodeURIComponent(`open ${appName} app`)}`;
                return {
                    text: `I can't open "${appName}" directly, but this link might help you find it.`,
                    actions: [{ label: `Find ${appName}`, url }]
                };
            }
        } else if (intentData.webSearch && intentData.webSearch.query && intentData.webSearch.query.toLowerCase() !== 'null') {
            const { query } = intentData.webSearch;
            
            // Get grounded answer using the googleSearch tool
            const searchResponse = await ai.models.generateContent({
                model: searchModel,
                contents: { role: 'user', parts: [{ text: query }] },
                config: { tools: [{ googleSearch: {} }] },
            });
    
            const responseText = searchResponse.text.trim();
            const groundingMetadata = searchResponse.candidates?.[0]?.groundingMetadata;
            const webSources: Source[] = groundingMetadata?.groundingChunks
                ?.filter((c: any) => c.web?.uri)
                .map((c: any) => ({ uri: c.web.uri, title: c.web.title || c.web.uri })) || [];
    
            // Create the deep search link
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
            return {
                text: responseText || "Here are some search results for your query.",
                sources: webSources.length > 0 ? webSources : undefined,
                actions: [{ label: `Search Google for "${query}"`, url: searchUrl }]
            };
        } else if (intentData.generalResponse) {
            const responseText = intentData.generalResponse;
            if (responseText) {
                const query = prompt.trim();
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                return {
                    text: responseText,
                    actions: [{ label: `Search Google for "${query}"`, url: searchUrl }]
                };
            } else {
                // If generalResponse itself is null, fall back to search.
                const query = prompt.trim();
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                return {
                    text: `I couldn't answer that directly, so here are some Google search results for you.`,
                    actions: [{ label: `Search Google for "${query}"`, url: searchUrl }]
                };
            }
        } else {
            // This is the fallback block for malformed intents or missing parameters.
            console.warn("Falling back to web search due to missing params or unhandled intent:", intentData);
            const query = prompt.trim();
            
            if (!query) {
                return { text: "Sorry, I didn't understand that. Could you please rephrase?" };
            }

            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

            return {
                text: `I wasn't sure how to handle that. Here are the Google search results for you.`,
                actions: [{ label: `Search Google for "${query}"`, url: searchUrl }]
            };
        }

    } catch (error) {
        console.error("Error getting assistant response:", error);
        return { text: "Sorry, I encountered an error. Please try again." };
    }
};
