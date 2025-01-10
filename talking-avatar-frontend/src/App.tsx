import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { io } from 'socket.io-client';

function App() {
  const [token, setToken] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [targetImage, setTargetImage] = useState<string>("");
  const [sourceImage, setSourceImage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [swapResult, setSwapResult] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string>('');
  const [authMethod, setAuthMethod] = useState<'token' | 'credentials'>('token');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [script, setScript] = useState('');
  const [avatars, setAvatars] = useState<any[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [avatarsPerPage] = useState(6); // Number of avatars per page
  const [hasMoreAvatars, setHasMoreAvatars] = useState(true); // Track if more avatars are available
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false); // New state for loading avatars
  const [activeContentTab, setActiveContentTab] = useState<'script' | 'upload'>('script'); // New state for content tab
  const [voices, setVoices] = useState<any[]>([]); // New state for voices
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null); // New state for selected voice
  const [isLoadingVoices, setIsLoadingVoices] = useState(false); // Loader state for voices
  const [showVoicePopup, setShowVoicePopup] = useState(false); // State to control voice popup
  const [playScriptError, setPlayScriptError] = useState<string | null>(null); // State for error message
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // New state for audio URL
  const [audioData, setAudioData] = useState<string | null>(null);
  const [showPreviewPopup, setShowPreviewPopup] = useState(false); // New state for preview popup
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null); // New state for selected avatar URL
  const [talkingAvatarResult, setTalkingAvatarResult] = useState<string | null>(null);
  const [showTalkingAvatarPopup, setShowTalkingAvatarPopup] = useState(false);
  const [audioInputUrl, setAudioInputUrl] = useState<string>('');
  const [audioInputError, setAudioInputError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAvatars(true); // Start loading avatars
    if (authMethod === 'credentials') {
      await handleCredentialsSubmit();
    } else {
      setIsSubmitted(true);
      // Fetch avatar list when token is provided
      await fetchAvatarList(token);
    }
    setIsLoadingAvatars(false); // Stop loading avatars
  };

  const handleCredentialsSubmit = async () => {
    try {
      const response = await axios.post('https://openapi.akool.com/api/open/v3/getToken', {
        clientId,
        clientSecret
      });
      
      setToken(response.data.token);
      setIsSubmitted(true);
      
      await fetchAvatarList(response.data.token);
    } catch (error) {
      console.error('Error getting token:', error);
      alert('Failed to authenticate with provided credentials');
    }
  };

  const fetchAvatarList = async (token, page = 1) => {
    setIsLoadingAvatars(true); // Start loading avatars
    try {
      const response = await axios.get(`https://openapi.akool.com/api/open/v3/avatar/list?from=2&page=${page}&size=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Log the response to check its structure
      console.log('Avatar List Response:', response.data);

      // Ensure the data is an array before setting it
      if (Array.isArray(response.data.data.result)) {
        setAvatars(response.data.data.result);
      } else {
        console.error('Expected an array but got:', response.data.data.result);
        setAvatars([]); // Set to empty array if not an array
      }

      // Check if more avatars are available
      if (response.data.data.result.length < avatarsPerPage) {
        setHasMoreAvatars(false); // No more avatars to load
      }
    } catch (error) {
      console.error('Error fetching avatar list:', error);
      setAvatars([]); // Set to empty array on error
    } finally {
      setIsLoadingAvatars(false); // Stop loading avatars
    }
  };

  const loadMoreAvatars = () => {
    if (hasMoreAvatars) {
      const nextPage = currentPage + 1;
      fetchAvatarList(token, nextPage);
      setCurrentPage(nextPage);
    }
  };

  useEffect(() => {
    const avatarGrid = document.querySelector('.avatar-grid');
    const handleScroll = () => {
      if (avatarGrid) {
        const { scrollTop, scrollHeight, clientHeight } = avatarGrid;
        if (scrollHeight - scrollTop <= clientHeight + 10) {
          loadMoreAvatars();
        }
      }
    };

    avatarGrid?.addEventListener('scroll', handleScroll);
    return () => {
      avatarGrid?.removeEventListener('scroll', handleScroll);
    };
  }, [hasMoreAvatars, currentPage]);

  useEffect(() => {
    // Initialize socket connection when component mounts
    const socket = io('http://localhost:3007', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    // Connection event handlers
    socket.on('connect', () => {
      setIsLoading(false);
      console.log('WebSocket connected successfully');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      // Attempt to reconnect
      setTimeout(() => {
        socket.connect();
      }, 1000);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Reconnect if server disconnected
        socket.connect();
      }
    });

    socket.on('message', (message) => {
      console.log('Received status update:', message);
      
      if (message.data.type === 'avatar' && message.data.status === 3) {
        // Handle talking avatar result
        setTalkingAvatarResult(message.data.url);
        setShowTalkingAvatarPopup(true);
        setIsLoading(false);
      } else if (message.data.type === 'error') {
        alert(message.data.message);
        setSwapStatus('Failed');
      } else {
        setSwapStatus(message.data.message);
      }
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      document.body.classList.add('loading');
    } else {
      document.body.classList.remove('loading');
    }
  }, [isLoading]);


  const fetchVoices = async () => {
    setIsLoadingVoices(true); // Start loading voices
    try {
      const response = await axios.get('https://openapi.akool.com/api/open/v3/voice/list?from=3', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setVoices(response.data.data); // Set voices from response
      setShowVoicePopup(true); // Show the voice selection popup
    } catch (error) {
      console.error('Error fetching voices:', error);
    } finally {
      setIsLoadingVoices(false); // Stop loading voices
    }
  };

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId); // Store selected voice ID
    const selectedVoice = voices.find(voice => voice.voice_id === voiceId);
    if (selectedVoice && selectedVoice.preview) {
      const audio = new Audio(selectedVoice.preview);
      audio.play(); // Play audio preview
    }
  };

  const handlePlayScript = async () => {
    if (!selectedVoiceId) {
      setPlayScriptError("Please select a voice before moving further");
      return;
    }
    if (!script.trim()) {
      setPlayScriptError("Please enter the script you want to use");
      return;
    }
    setPlayScriptError(null); // Clear error if conditions are met

    // Prepare the API call data
    const apiData = {
      input_text: script, // Use the script text area value
      voice_id: selectedVoiceId, // Use the selected voice ID
      rate: "100%",
      webhookUrl: "https://7ed7-219-91-134-123.ngrok-free.app/api/webhook"
    };

    try {
      // Make the API call
      const response = await axios.post('https://openapi.akool.com/api/open/v3/audio/create', apiData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log("Audio creation response:", response.data);
      setAudioData(response.data.data);
      
    } catch (error) {
      console.error('Error creating audio:', error);
    }
  };

  useEffect(() => {
    // Socket listener for audio URL updates
    const socket = io('http://localhost:3007');
    socket.on('message', (message) => {
      if (message.data && message.data.url) {
        setAudioUrl(message.data.url); // Set the audio URL from the response
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handlePreview = () => {
    if (selectedAvatar) {
      setSelectedAvatarUrl(selectedAvatar.url); // Set the URL of the selected avatar
      setShowPreviewPopup(true); // Show the preview popup
    }
  };

  const handleGenerateOutput = async () => {
    if (!selectedAvatar || !audioUrl) return;
    
    setIsLoading(true); // Start loading state
    console.log("This is the audio url :: ", audioUrl);
    console.log("This is the avatar url ::", selectedAvatar.url);
    console.log("This is the audio data", audioData);
    
    const apiData = {
      width: 3840,
      height: 2160,
      avatar_from: 2,
      elements: [
        {
          type: "image",
          url: "https://drz0f01yeq1cx.cloudfront.net/1729480978805-talkingAvatarbg.png",
          layer_number: 0,
          width: 780,
          height: 438,
          scale_x: 1,
          scale_y: 1,
          offset_x: 1920,
          offset_y: 1080
        },
        {
          type: "avatar",
          avatar_id: selectedAvatar.avatar_id, // Use selected avatar's ID
          layer_number: 1,
          scale_x: 1,
          scale_y: 1,
          width: 1080,
          height: 1080,
          offset_x: 1920,
          offset_y: 1080,
          url: selectedAvatar.url
        },
        {
          type: "audio",
          // Conditional inclusion of voice_clone based on activeContentTab
          ...(activeContentTab === 'script' ? {
            voice_clone: {
              voice_from: audioData.from,
              voice_id: audioData.voice_model_id,
              voice_url: audioUrl
            }
          } : {}),
          url: audioUrl // Always include the audio URL
        }
      ],
      webhookUrl: "https://7ed7-219-91-134-123.ngrok-free.app/api/webhook"
    };

    try {
      const response = await axios.post('https://openapi.akool.com/api/open/v3/talkingavatar/create', apiData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("Generate Output Response:", response.data);
    } catch (error) {
      console.error('Error generating output:', error);
      setIsLoading(false); // Make sure to stop loading on error
    }
  };

  // Add download handler for talking avatar
  const handleTalkingAvatarDownload = async () => {
    if (!talkingAvatarResult) return;
    
    try {
      const response = await fetch(talkingAvatarResult);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'talking-avatar.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading video:', error);
      window.open(talkingAvatarResult, '_blank');
    }
  };

  const validateAudioUrl = (url: string): boolean => {
    // Check if URL is valid
    try {
      new URL(url);
    } catch {
      setAudioInputError('Please enter a valid URL');
      return false;
    }

    // Check if URL ends with common audio extensions
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];
    const hasAudioExtension = audioExtensions.some(ext => url.toLowerCase().endsWith(ext));
    
    if (!hasAudioExtension) {
      setAudioInputError('URL must point to an audio file (mp3, wav, m4a, aac, ogg)');
      return false;
    }

    setAudioInputError('');
    return true;
  };

  const handleAudioUrlSubmit = () => {
    if (validateAudioUrl(audioInputUrl)) {
      setAudioUrl(audioInputUrl);
    }
  };

  return (
    <div className="app-container">
      {isLoadingAvatars && (
        <div className="loader-overlay">
          <div className="loader"></div> {/* Loader component */}
        </div>
      )}
      {isLoadingVoices && (
        <div className="loader-overlay">
          <div className="loader"></div>
        </div>
      )}
      
      {showVoicePopup && (
        <div className="result-popup-overlay">
          <div className="result-popup">
            <h2>Select a Voice</h2>

            {/* Male Voices Section */}
            <h3>Male Voices</h3>
            <div className="voice-list">
              {voices.filter(voice => voice.gender.toLowerCase() === 'male').map(voice => (
                <div 
                  key={voice.voice_id} 
                  className={`voice-item ${selectedVoiceId === voice.voice_id ? 'selected' : ''}`} 
                  onClick={() => handleSelectVoice(voice.voice_id)}
                >
                  <p><strong>Name:</strong> {voice.name}</p>
                  <p><strong>Gender:</strong> {voice.gender}</p>
                  <p><strong>Accent:</strong> {voice.accent}</p>
                  <p><strong>Description:</strong> {voice.description}</p>
                </div>
              ))}
            </div>

            {/* Female Voices Section */}
            <h3>Female Voices</h3>
            <div className="voice-list">
              {voices.filter(voice => voice.gender.toLowerCase() === 'female').map(voice => (
                <div 
                  key={voice.voice_id} 
                  className={`voice-item ${selectedVoiceId === voice.voice_id ? 'selected' : ''}`} 
                  onClick={() => handleSelectVoice(voice.voice_id)}
                >
                  <p><strong>Name:</strong> {voice.name}</p>
                  <p><strong>Gender:</strong> {voice.gender}</p>
                  <p><strong>Accent:</strong> {voice.accent}</p>
                  <p><strong>Description:</strong> {voice.description}</p>
                </div>
              ))}
            </div>

            <div className="popup-buttons">
              <button className="ok-button" onClick={() => setShowVoicePopup(false)}>OK</button>
              <button className="cancel-button" onClick={() => setShowVoicePopup(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {!isSubmitted ? (
        <div className="welcome-container">
          <div className={`welcome-content ${isSubmitted ? 'fade-out' : 'fade-in'}`}>
            <div className="title-container">
              <img src="/images/4p6vr8j7vbom4axo7k0 2.png" alt="Face Swap AI Logo" className="logo" />
              <h1 className="title">Talking Avatar</h1>
            </div>
            
            <div className="auth-method-toggle">
              <button 
                className={`auth-toggle-btn ${authMethod === 'token' ? 'active' : ''}`}
                onClick={() => setAuthMethod('token')}
              >
                Use Bearer Token
              </button>
              <button 
                className={`auth-toggle-btn ${authMethod === 'credentials' ? 'active' : ''}`}
                onClick={() => setAuthMethod('credentials')}
              >
                Use Client Credentials
              </button>
            </div>

            <form onSubmit={handleSubmit} className="token-form">
              {authMethod === 'token' ? (
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your API token"
                  className="token-input"
                  required
                />
              ) : (
                <>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Enter your Client ID"
                    className="token-input"
                    required
                  />
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter your Client Secret"
                    className="token-input"
                    required
                  />
                </>
              )}
              <button type="submit" className="submit-button">
                Get Started
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="main-container">
          <div className="main-header">
            <img src="/images/4p6vr8j7vbom4axo7k0 2.png" alt="Talking Avatar AI Logo" className="logo" />
            <h1 className="title">Talking Avatar</h1>
          </div>
          <div className="avatar-selection" style={{ display: 'flex', alignItems: 'center' }}>
            <h2 style={{ marginRight: '1rem' }}>Choose Avatar</h2>
            <button 
              className="preview-button" 
              onClick={handlePreview} 
              disabled={!selectedAvatar} // Disable if no avatar is selected
            >
              Preview
            </button>
          </div>
          <div className="avatar-grid" style={{ display: 'flex', overflowX: 'auto' }}>
            {avatars.map((avatar) => (
              <div 
                className={`avatar-item ${selectedAvatar?.avatar_id === avatar.avatar_id ? 'selected' : ''}`} 
                key={avatar.avatar_id} 
                onClick={() => setSelectedAvatar(avatar)}
                style={{ cursor: 'pointer', margin: '0 10px' }}
              >
                <img src={avatar.thumbnailUrl} alt={avatar.name} className="avatar-image" />
                <p>{avatar.name}</p>
              </div>
            ))}
          </div>

          {/* Add margin to the container for the tabs */}
          <div className="tabs-container" style={{ marginTop: '2rem' }}>
            {/* New Tab Section */}
            <div className="tabs">
              <button 
                className={`tab ${activeContentTab === 'script' ? 'active' : ''}`} 
                onClick={() => {
                  setActiveContentTab('script');
                  setAudioUrl(null); // Reset audioUrl when switching to Script tab
                }}
              >
                Script
              </button>
              <button 
                className={`tab ${activeContentTab === 'upload' ? 'active' : ''}`} 
                onClick={() => {
                  setActiveContentTab('upload');
                  setAudioUrl(null); // Reset audioUrl when switching to Upload tab
                }}
              >
                Upload Audio
              </button>
            </div>

            {/* Content based on active tab */}
            {activeContentTab === 'script' ? (
              <div className="script-input">
                <h2>Script</h2>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter your script here..."
                  className="script-textarea"
                  maxLength={1000} // Limit to 1000 characters
                />
                <div className="script-buttons">
                  <button className="select-voice-button" onClick={fetchVoices}>Select Voice</button>
                  <button 
                    className="play-script-button" 
                    onClick={handlePlayScript}
                    disabled={!selectedVoiceId || !script.trim()} // Disable button if conditions are not met
                  >
                    Play Script
                  </button>
                  {audioUrl && (
                    <div className="audio-player">
                      <audio controls>
                        <source src={audioUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="upload-audio-input">
                <h2>Upload Audio</h2>
                <div className="audio-input-container">
                  <input
                    type="url"
                    value={audioInputUrl}
                    onChange={(e) => {
                      setAudioInputUrl(e.target.value);
                      if (audioInputError) setAudioInputError(''); // Clear error when input changes
                    }}
                    placeholder="Enter audio URL (mp3, wav, m4a, aac, ogg)"
                    className={`url-input ${audioInputError ? 'error' : ''}`}
                  />
                  <button 
                    className="audio-submit-button"
                    onClick={handleAudioUrlSubmit}
                    disabled={!audioInputUrl.trim()}
                  >
                    Set Audio
                  </button>
                </div>
                {audioInputError && (
                  <div className="audio-input-error">
                    {audioInputError}
                  </div>
                )}
                {audioUrl && activeContentTab === 'upload' && (
                  <div className="audio-preview">
                    <audio controls>
                      <source src={audioUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            )}
            <button 
              className={`generate-button ${(!selectedAvatar || !audioUrl) ? 'disabled' : ''}`}
              onClick={handleGenerateOutput}
              disabled={!selectedAvatar || !audioUrl}
            >
              {isLoading ? (
                <div className="button-content">
                  <div className="generate-loader"></div>
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate Output'
              )}
            </button>
          </div>
        </div>
      )}
      {(!selectedVoiceId || !script.trim()) && playScriptError && (
        <div className="error-message" style={{ position: 'absolute', marginTop: '0.5rem' }}>
          {playScriptError}
        </div>
      )}
      {/* Preview Popup */}
      {showPreviewPopup && (
        <div className="result-popup-overlay">
          <div className="result-popup">
            <h2>Avatar Preview</h2>
            {selectedAvatarUrl && <img src={selectedAvatarUrl} alt="Avatar Preview" style={{ maxWidth: '100%', borderRadius: '0.5rem' }} />} {/* Display the image */}
            <button onClick={() => setShowPreviewPopup(false)}>✖ Close</button>
          </div>
        </div>
      )}
      {/* Add Talking Avatar Result Popup */}
      
      {showTalkingAvatarPopup && talkingAvatarResult && (
        <div className="result-popup-overlay">
          <div className="result-popup video-result-popup">
            <h2>Talking Avatar Result</h2>
            <div className="result-video-container">
              <video 
                className="result-video" 
                controls 
                src={talkingAvatarResult}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="result-actions">
              <button 
                className="download-button"
                onClick={handleTalkingAvatarDownload}
              >
                Download
              </button>
              <button 
                className="close-popup-button"
                onClick={() => setShowTalkingAvatarPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add loading overlay */}
      {isLoading && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="processing-loader"></div>
            <p className="processing-text">Creating your talking avatar...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
